'use strict';

// API simulada do YOURClinic com a proteção da RC03:
// 1. sem sessão, nenhuma rota responde (401), exceto /login e /saude;
// 2. o papel da sessão é conferido antes de qualquer busca no banco; a
//    recusa (403) é gravada em logsAuditoria;
// 3. registro fora do alcance do usuário responde 404, como se não existisse;
// 4. a resposta sai sem os campos que o papel não pode ver e sem senha.
// A matriz de quem vê o quê está em permissoes.js.

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const {
  COLECOES, CLINICAS, ESPECIALIZACOES, ADMINISTRADOR, SECRETARIA, MEDICO, PACIENTE, RESPONSAVEL_LEGAL,
  politica, regraPara, projetar, camposGravaveis, igual,
} = require('./permissoes');
const { horariosLivres, foraDaGrade, validarGrade, afetadasPeloBloqueio, somarDias } = require('./agenda');
const { DATA_PADRAO } = require('./seed');
const { Sessoes, conferirSenha, gerarHash, HASH_DE_ENGANO } = require('./sessao');
const { filtrar, ordenar, paginar, escolherCampos } = require('./consulta');

const TAMANHO_MAXIMO_CORPO = 100 * 1024;
const MENSAGEM_LOGIN = 'Login ou senha inválidos.';
const ORIGENS_PADRAO = ['http://localhost:3000', 'http://127.0.0.1:3000'];

class ErroHttp extends Error {
  constructor(status, mensagem) {
    super(mensagem);
    this.status = status;
  }
}

const NAO_ENCONTRADO = () => new ErroHttp(404, 'Não encontrado.');
const ACESSO_NEGADO = () => new ErroHttp(403, 'Acesso negado.');

// Data e hora locais no formato do banco: AAAA-MM-DDTHH:MM:SS.
function textoLocal(data) {
  const doisDigitos = (n) => String(n).padStart(2, '0');
  return (
    `${data.getFullYear()}-${doisDigitos(data.getMonth() + 1)}-${doisDigitos(data.getDate())}` +
    `T${doisDigitos(data.getHours())}:${doisDigitos(data.getMinutes())}:${doisDigitos(data.getSeconds())}`
  );
}

function idade(dataNascimento, hoje) {
  if (!dataNascimento) return Infinity;
  const [ano, mes, dia] = dataNascimento.split('-').map(Number);
  const [anoHoje, mesHoje, diaHoje] = hoje.split('-').map(Number);
  return anoHoje - ano - (mesHoje < mes || (mesHoje === mes && diaHoje < dia) ? 1 : 0);
}

function enviar(res, status, corpo) {
  if (corpo === undefined) {
    res.writeHead(status);
    res.end();
    return;
  }
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(corpo));
}

async function lerCorpo(req) {
  let tamanho = 0;
  const pedacos = [];
  for await (const pedaco of req) {
    tamanho += pedaco.length;
    if (tamanho > TAMANHO_MAXIMO_CORPO) throw new ErroHttp(413, 'Corpo grande demais.');
    pedacos.push(pedaco);
  }
  let corpo;
  try {
    corpo = JSON.parse(Buffer.concat(pedacos).toString('utf8') || '{}');
  } catch {
    throw new ErroHttp(400, 'JSON inválido.');
  }
  if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) {
    throw new ErroHttp(400, 'O corpo deve ser um objeto JSON.');
  }
  return corpo;
}

const tokenDe = (req) => /^Bearer ([0-9a-f]{64})$/.exec(req.headers.authorization ?? '')?.[1] ?? null;

const ACOES = { GET: 'LER', POST: 'CRIAR', PATCH: 'EDITAR', PUT: 'EDITAR', DELETE: 'EXCLUIR' };

function verboDe(metodo, id) {
  if (metodo === 'GET') return 'ler';
  if (metodo === 'POST' && id === undefined) return 'criar';
  if (metodo === 'PATCH' && id !== undefined) return 'editar';
  if (metodo === 'DELETE' && id !== undefined) return 'excluir';
  return null;
}

// dataDeReferencia é o "hoje" das regras de agenda: os dados simulados ficam
// nessa data (a mesma DATA_DE_HOJE do app), e a hora vem do relógio. A sessão
// e o log usam o relógio de verdade.
function criarApi({
  db,
  salvar = () => {},
  relogio = () => new Date(),
  minutosSessao,
  origens = ORIGENS_PADRAO,
  dataDeReferencia = DATA_PADRAO,
}) {
  for (const colecao of COLECOES) db[colecao] ??= [];

  const agoraTexto = (minutos = 0) => textoLocal(new Date(relogio().getTime() + minutos * 60 * 1000));
  const hoje = () => agoraTexto().slice(0, 10);
  const hojeClinica = () => dataDeReferencia ?? hoje();
  const agoraClinica = () => `${hojeClinica()}T${agoraTexto().slice(11)}`;

  const parametro = (chave, padrao) => {
    const valor = Number(db.parametros.find((p) => p.chave === chave)?.valor);
    return Number.isFinite(valor) ? valor : padrao;
  };

  const sessoes = new Sessoes({ minutos: minutosSessao ?? parametro('X15', 30), relogio });

  function inserir(colecao, dados) {
    const id = db[colecao].reduce((maior, r) => Math.max(maior, Number(r.id) || 0), 0) + 1;
    const registro = { id, ...dados };
    db[colecao].push(registro);
    return registro;
  }

  function auditar({ acao, sessao, rota, registroAlvo = null, resultado, motivo = null }) {
    inserir('logsAuditoria', {
      dataHora: agoraTexto(),
      acao,
      papel: sessao?.papel ?? null,
      rota,
      registroAlvo,
      resultado,
      motivo,
      idUsuario: sessao?.idUsuario ?? null,
    });
    salvar();
  }

  // Representações em vigor de um Responsável Legal. A representação acaba na
  // maioridade do representado (RF08, R-07).
  function representacoesVigentes(idResponsavel) {
    const data = hoje();
    return db.representacoes.filter((r) => {
      if (!igual(r.idResponsavelLegal, idResponsavel)) return false;
      if (r.inicioVigencia && r.inicioVigencia > data) return false;
      if (r.fimVigencia && r.fimVigencia < data) return false;
      const pessoa = db.pessoas.find((p) => igual(p.id, r.idPaciente));
      return idade(pessoa?.dataNascimento, data) < 18;
    });
  }

  function calcularAlcance(sessao) {
    const ids = new Set();
    if (sessao.papel === MEDICO) {
      for (const v of db.vinculos) {
        if (igual(v.idMedico, sessao.idPessoa) && ['ATIVO', 'HISTORICO'].includes(v.estado)) {
          ids.add(String(v.idPaciente));
        }
      }
      const agora = agoraTexto();
      for (const a of db.acessosExcecao) {
        if (igual(a.idMedico, sessao.idPessoa) && a.expiraEm && a.expiraEm > agora) {
          ids.add(String(a.idPaciente));
        }
      }
    } else if (sessao.papel === PACIENTE) {
      ids.add(String(sessao.idPessoa));
    } else if (sessao.papel === RESPONSAVEL_LEGAL && sessao.representado != null) {
      if (representacoesVigentes(sessao.idPessoa).some((r) => igual(r.idPaciente, sessao.representado))) {
        ids.add(String(sessao.representado));
      }
    }
    return ids;
  }

  function contexto(sessao, rota) {
    const indices = new Map();
    let alcance = null;
    const ctx = {
      db,
      sessao,
      agoraTexto,
      agoraClinica,
      hojeClinica,
      parametro,
      buscar(colecao, id) {
        if (id == null || !db[colecao]) return undefined;
        if (!indices.has(colecao)) {
          indices.set(colecao, new Map(db[colecao].map((r) => [String(r.id), r])));
        }
        return indices.get(colecao).get(String(id));
      },
      auditar(dados) {
        auditar({ sessao, rota, ...dados });
      },
      inserir(colecao, dados) {
        indices.delete(colecao);
        alcance = null;
        return inserir(colecao, dados);
      },
      alcance() {
        alcance ??= calcularAlcance(sessao);
        return alcance;
      },
      // Paciente em nome de quem o titular age no portal.
      titular() {
        if (sessao.papel === PACIENTE) return sessao.idPessoa;
        if (sessao.papel === RESPONSAVEL_LEGAL) return sessao.representado ?? null;
        return null;
      },
    };
    return ctx;
  }

  const nomeDaPessoa = (id) => db.pessoas.find((p) => igual(p.id, id))?.nome ?? null;

  function descreverSessao(sessao) {
    return {
      usuario: {
        id: sessao.idUsuario,
        idPessoa: sessao.idPessoa,
        nome: nomeDaPessoa(sessao.idPessoa),
        papel: sessao.papel,
      },
      expiraEm: new Date(sessao.expiraEm).toISOString(),
      representado:
        sessao.representado != null
          ? { idPaciente: sessao.representado, nome: nomeDaPessoa(sessao.representado) }
          : null,
    };
  }

  async function login(req, res, rota) {
    const corpo = await lerCorpo(req);
    const login = typeof corpo.login === 'string' ? corpo.login.trim().toLowerCase() : '';
    const senha = typeof corpo.senha === 'string' ? corpo.senha : '';
    const usuario = login
      ? db.usuarios.find((u) => [u.login, u.email].some((v) => typeof v === 'string' && v.toLowerCase() === login))
      : undefined;
    const agora = agoraTexto();
    const bloqueado = Boolean(usuario?.bloqueadoAte && usuario.bloqueadoAte > agora);
    // A senha é sempre conferida, mesmo sem usuário, para o tempo de resposta
    // não indicar se a conta existe.
    const confere = conferirSenha(senha, usuario?.senhaHash ?? HASH_DE_ENGANO);

    if (!usuario || bloqueado || !confere || usuario.situacao !== 'ATIVO') {
      if (usuario && !bloqueado) {
        usuario.tentativasFalhas = (usuario.tentativasFalhas ?? 0) + 1;
        if (usuario.tentativasFalhas >= parametro('X01', 5)) {
          usuario.bloqueadoAte = agoraTexto(parametro('X03', 15));
          usuario.tentativasFalhas = 0;
        }
      }
      auditar({
        acao: 'LOGIN',
        sessao: usuario ? { idUsuario: usuario.id, papel: usuario.papel } : null,
        rota,
        registroAlvo: usuario ? `usuarios/${usuario.id}` : null,
        resultado: 'NEGADO',
        motivo: bloqueado ? 'BLOQUEADO' : 'CREDENCIAL',
      });
      // A mesma mensagem para login inexistente, senha errada e conta
      // bloqueada (RNF19, D28).
      return enviar(res, 401, { erro: MENSAGEM_LOGIN });
    }

    usuario.tentativasFalhas = 0;
    usuario.bloqueadoAte = null;
    usuario.ultimoAcesso = agora;
    const dados = { idUsuario: usuario.id, idPessoa: usuario.idPessoa, papel: usuario.papel, representado: null };
    if (usuario.papel === RESPONSAVEL_LEGAL) {
      const vigentes = representacoesVigentes(usuario.idPessoa);
      if (vigentes.length === 1) dados.representado = vigentes[0].idPaciente;
    }
    const { token, sessao } = sessoes.criar(dados);
    auditar({ acao: 'LOGIN', sessao, rota, registroAlvo: `usuarios/${usuario.id}`, resultado: 'PERMITIDO' });
    return enviar(res, 200, { token, ...descreverSessao(sessao) });
  }

  async function rotaDeSessao(req, res, { partes, sessao, token, rota }) {
    const caminho = `${req.method} /${partes.join('/')}`;

    if (caminho === 'GET /sessao') return enviar(res, 200, descreverSessao(sessao));

    if (caminho === 'POST /logout') {
      sessoes.encerrar(token);
      auditar({ acao: 'LOGOUT', sessao, rota, resultado: 'PERMITIDO' });
      return enviar(res, 204);
    }

    // G-10: alterar a própria senha encerra as outras sessões do usuário.
    if (caminho === 'POST /sessao/senha') {
      const corpo = await lerCorpo(req);
      const usuario = db.usuarios.find((u) => igual(u.id, sessao.idUsuario));
      if (!usuario || !conferirSenha(String(corpo.senhaAtual ?? ''), usuario.senhaHash)) {
        auditar({ acao: 'ALTERAR_SENHA', sessao, rota, resultado: 'NEGADO', motivo: 'CREDENCIAL' });
        throw new ErroHttp(422, 'Senha atual incorreta.');
      }
      const nova = String(corpo.novaSenha ?? '');
      if (nova.length < 8 || !/[A-Za-z]/.test(nova) || !/\d/.test(nova)) {
        throw new ErroHttp(422, 'A nova senha precisa de ao menos 8 caracteres, com letras e números.');
      }
      usuario.senhaHash = gerarHash(nova);
      sessoes.encerrarDoUsuario(usuario.id, token);
      auditar({ acao: 'ALTERAR_SENHA', sessao, rota, registroAlvo: `usuarios/${usuario.id}`, resultado: 'PERMITIDO' });
      return enviar(res, 204);
    }

    // G-09: o Responsável Legal escolhe em nome de quem age.
    if (caminho === 'GET /sessao/representados' || caminho === 'POST /sessao/representado') {
      if (sessao.papel !== RESPONSAVEL_LEGAL) {
        auditar({ acao: ACOES[req.method], sessao, rota, resultado: 'NEGADO', motivo: 'PAPEL' });
        throw ACESSO_NEGADO();
      }
      const vigentes = representacoesVigentes(sessao.idPessoa);
      if (req.method === 'GET') {
        return enviar(
          res,
          200,
          vigentes.map((r) => ({ idPaciente: r.idPaciente, nome: nomeDaPessoa(r.idPaciente) }))
        );
      }
      const corpo = await lerCorpo(req);
      const escolhida = vigentes.find((r) => igual(r.idPaciente, corpo.idPaciente));
      if (!escolhida) {
        auditar({ acao: 'SELECIONAR_REPRESENTADO', sessao, rota, resultado: 'NEGADO', motivo: 'FORA_DO_ALCANCE' });
        throw NAO_ENCONTRADO();
      }
      sessao.representado = escolhida.idPaciente;
      auditar({
        acao: 'SELECIONAR_REPRESENTADO',
        sessao,
        rota,
        registroAlvo: `pacientes/${escolhida.idPaciente}`,
        resultado: 'PERMITIDO',
      });
      return enviar(res, 200, descreverSessao(sessao));
    }

    throw NAO_ENCONTRADO();
  }

  // Rotas da agenda que não são uma coleção: horários livres, a grade inteira
  // de um médico e o tratamento de várias consultas de uma vez.
  async function rotaDeAgenda(req, res, { url, partes, sessao, rota }) {
    const ctx = contexto(sessao, rota);
    const exigirPapel = (...papeis) => {
      if (papeis.includes(sessao.papel)) return;
      auditar({ acao: ACOES[req.method] ?? req.method, sessao, rota, registroAlvo: partes.join('/'), resultado: 'NEGADO', motivo: 'PAPEL' });
      throw ACESSO_NEGADO();
    };
    const dataValida = (valor) => /^\d{4}-\d{2}-\d{2}$/.test(valor ?? '');

    // RF16, passo 2, e RF13, passo 4: horários livres de um médico para um tipo
    // de atendimento, dia a dia. Não diz por que um horário falta nem quem o
    // ocupa. Na remarcação, a recepção informa a consulta, que não conta como
    // ocupando o próprio horário.
    if (req.method === 'GET' && partes[1] === 'horarios' && partes.length === 2) {
      exigirPapel(ADMINISTRADOR, SECRETARIA, PACIENTE, RESPONSAVEL_LEGAL);
      const p = url.searchParams;
      const medico = ctx.buscar('medicos', p.get('idMedico'));
      const procedimento = ctx.buscar('procedimentos', p.get('idProcedimento'));
      if (medico?.situacao !== 'ATIVO' || procedimento?.situacao !== 'ATIVO') {
        throw new ErroHttp(422, 'Escolha o médico e o tipo de atendimento.');
      }
      const hojeRef = hojeClinica();
      const pedido = p.get('de') ?? hojeRef;
      const ate = p.get('ate') ?? pedido;
      if (!dataValida(pedido) || !dataValida(ate) || ate < pedido) throw new ErroHttp(422, 'Período inválido.');
      const de = pedido < hojeRef ? hojeRef : pedido;
      const ignorarId = [ADMINISTRADOR, SECRETARIA].includes(sessao.papel) ? p.get('idConsulta') : null;
      const dias = [];
      for (let data = de; data <= ate && dias.length < 62; data = somarDias(data, 1)) {
        dias.push({
          data,
          horarios: horariosLivres(db, {
            idMedico: medico.id,
            data,
            duracao: procedimento.duracaoPadrao,
            aPartirDe: data === hojeRef ? agoraClinica() : null,
            ignorarId,
          }),
        });
      }
      return enviar(res, 200, { duracao: procedimento.duracaoPadrao, dias });
    }

    // A-10 e S-05a: a grade inteira de um médico, trocada de uma vez. Reduzir
    // a grade sobre consultas já agendadas espera o reagendamento (RN-13.2).
    if (req.method === 'PUT' && partes[1] === 'grade' && partes.length === 3) {
      exigirPapel(ADMINISTRADOR, SECRETARIA);
      const medico = ctx.buscar('medicos', partes[2]);
      if (!medico) throw NAO_ENCONTRADO();
      if (medico.situacao !== 'ATIVO') throw new ErroHttp(422, 'Escolha um médico ativo.');
      const corpo = await lerCorpo(req);
      const erro = validarGrade(corpo);
      if (erro) throw new ErroHttp(422, erro);
      const periodos = corpo.periodos.map((p) => ({ diaSemana: p.diaSemana, horaInicio: p.horaInicio, horaFim: p.horaFim }));
      const fora = foraDaGrade(db, medico.id, periodos, agoraClinica());
      if (fora.length > 0) {
        throw new ErroHttp(
          409,
          `${fora.length} ${fora.length === 1 ? 'consulta agendada ficaria' : 'consultas agendadas ficariam'} fora da nova grade. Reagende antes de reduzir a grade.`
        );
      }
      db.gradesHorario = db.gradesHorario.filter((g) => !igual(g.idMedico, medico.id));
      const novos = periodos.map((p) => inserir('gradesHorario', { ...p, granularidade: corpo.granularidade, idMedico: medico.id }));
      salvar();
      auditar({ acao: 'EDITAR', sessao, rota, registroAlvo: `gradesHorario?idMedico=${medico.id}`, resultado: 'PERMITIDO' });
      return enviar(res, 200, novos);
    }

    // RF20 e A-11b: reagendar ou cancelar várias consultas, com o mesmo motivo.
    // O lote é tudo ou nada (A4-R09): as ações são conferidas numa cópia, uma
    // depois da outra, e só então gravadas. Cada consulta tem o próprio
    // registro no log e o próprio aviso ao paciente.
    if (req.method === 'POST' && partes[1] === 'lote' && partes.length === 2) {
      exigirPapel(ADMINISTRADOR, SECRETARIA);
      const corpo = await lerCorpo(req);
      const motivo = typeof corpo.motivo === 'string' ? corpo.motivo.trim() : '';
      if (motivo.length < 5) throw new ErroHttp(422, 'Informe o motivo.');
      const acoes = Array.isArray(corpo.acoes) ? corpo.acoes : [];
      if (acoes.length === 0 || acoes.length > 200) throw new ErroHttp(422, 'Escolha as consultas.');
      if (new Set(acoes.map((a) => String(a?.idConsulta))).size !== acoes.length) {
        throw new ErroHttp(422, 'A mesma consulta aparece duas vezes.');
      }
      const regra = regraPara('consultas', sessao.papel);
      const copia = structuredClone(db.consultas);
      const ctxDaCopia = {
        ...ctx,
        db: { ...db, consultas: copia },
        buscar: (colecao, id) => (colecao === 'consultas' ? copia.find((c) => igual(c.id, id)) : ctx.buscar(colecao, id)),
      };
      const planos = [];
      for (const acao of acoes) {
        const atual = copia.find((c) => igual(c.id, acao?.idConsulta));
        if (!atual) throw new ErroHttp(422, 'Uma das consultas não existe mais.');
        let mudancas = null;
        if (acao.acao === 'CANCELAR') mudancas = { status: 'CANCELADO', motivoCancelamento: motivo };
        if (acao.acao === 'REAGENDAR') {
          mudancas = { dataHora: acao.dataHora, motivoRemarcacao: motivo };
          if (acao.idMedico != null) mudancas.idMedico = Number(acao.idMedico);
        }
        if (!mudancas) throw new ErroHttp(422, 'Escolha reagendar ou cancelar cada consulta.');
        const erro = regra.validar(
          { ...atual, ...mudancas },
          atual,
          ctxDaCopia,
          mudancas
        );
        if (erro) throw new ErroHttp(422, `${nomeDaPessoa(atual.idPaciente) ?? 'Paciente'}: ${erro}`);
        Object.assign(atual, mudancas);
        planos.push({ id: atual.id, mudancas });
      }
      for (const { id, mudancas } of planos) {
        const consulta = ctx.buscar('consultas', id);
        const antigo = { ...consulta };
        Object.assign(consulta, mudancas);
        regra.aposEditar?.(consulta, antigo, ctx);
        auditar({ acao: 'EDITAR', sessao, rota, registroAlvo: `consultas/${id}`, resultado: 'PERMITIDO', motivo: 'LOTE' });
      }
      if (corpo.idBloqueio != null) {
        const bloqueio = ctx.buscar('bloqueiosAgenda', corpo.idBloqueio);
        if (bloqueio) bloqueio.consultasAfetadas = bloqueio.situacao === 'ATIVO' ? afetadasPeloBloqueio(db, bloqueio).length : 0;
      }
      salvar();
      return enviar(res, 200, { tratadas: planos.length });
    }

    throw NAO_ENCONTRADO();
  }

  async function rotaDeColecao(req, res, { url, partes, sessao, rota }) {
    const [colecao, id, ...resto] = partes;
    if (!colecao || resto.length > 0) throw NAO_ENCONTRADO();

    // O banco inteiro não sai para ninguém.
    if (colecao === 'db') {
      auditar({ acao: ACOES[req.method] ?? req.method, sessao, rota, registroAlvo: 'db', resultado: 'NEGADO', motivo: 'ROTA_BLOQUEADA' });
      throw ACESSO_NEGADO();
    }
    if (!Object.hasOwn(politica, colecao)) throw NAO_ENCONTRADO();

    const verbo = verboDe(req.method, id);
    if (!verbo) throw new ErroHttp(405, 'Método não permitido.');

    // Recusa por papel antes de tocar no banco (RC03, camada 2).
    const regra = regraPara(colecao, sessao.papel);
    const permitido = Boolean(regra) && (verbo === 'ler' ? typeof regra.ler === 'function' : regra[verbo] === true);
    const alvo = id === undefined ? colecao : `${colecao}/${id}`;
    if (!permitido) {
      auditar({ acao: ACOES[req.method], sessao, rota, registroAlvo: alvo, resultado: 'NEGADO', motivo: 'PAPEL' });
      throw ACESSO_NEGADO();
    }

    const ctx = contexto(sessao, rota);
    const foraDoAlcance = () => {
      auditar({ acao: ACOES[req.method], sessao, rota, registroAlvo: alvo, resultado: 'NEGADO', motivo: 'FORA_DO_ALCANCE' });
    };
    // Registro fora do alcance responde como inexistente (G-08b).
    const buscarNoAlcance = () => {
      const registro = ctx.buscar(colecao, id);
      if (!registro) throw NAO_ENCONTRADO();
      if (!regra.ler(registro, ctx)) {
        foraDoAlcance();
        throw NAO_ENCONTRADO();
      }
      return registro;
    };

    if (verbo === 'ler' && id === undefined) {
      const parametros = url.searchParams;
      const visiveis = db[colecao]
        .filter((r) => regra.ler(r, ctx))
        .map((r) => projetar(regra, r, ctx));
      const lista = ordenar(filtrar(visiveis, parametros), parametros);
      res.setHeader('X-Total-Count', String(lista.length));
      if (CLINICAS.has(colecao)) {
        auditar({ acao: 'LER', sessao, rota, registroAlvo: alvo, resultado: 'PERMITIDO' });
      }
      return enviar(res, 200, escolherCampos(paginar(lista, parametros), parametros));
    }

    if (verbo === 'ler') {
      const registro = buscarNoAlcance();
      if (CLINICAS.has(colecao)) {
        auditar({ acao: 'LER', sessao, rota, registroAlvo: alvo, resultado: 'PERMITIDO' });
      }
      return enviar(res, 200, escolherCampos([projetar(regra, registro, ctx)], url.searchParams)[0]);
    }

    if (verbo === 'criar') {
      const corpo = await lerCorpo(req);
      const fixos = regra.fixar ? regra.fixar(ctx) : {};
      const novo = { ...camposGravaveis(regra, corpo, { ...corpo, ...fixos }, ctx, { edicao: false }), ...fixos };
      // Paciente, médico e os demais papéis nascem com o id da pessoa.
      if (ESPECIALIZACOES.has(colecao)) {
        const pessoa = ctx.buscar('pessoas', corpo.id);
        if (!pessoa) throw new ErroHttp(422, 'Cadastre a pessoa antes.');
        if (ctx.buscar(colecao, pessoa.id)) throw new ErroHttp(409, 'Esta pessoa já tem este cadastro.');
        novo.id = pessoa.id;
      }
      regra.completar?.(novo, ctx);
      const erro = regra.validar?.(novo, null, ctx, novo);
      if (erro) throw new ErroHttp(422, erro);
      if (!(regra.alcanceDeEscrita ?? regra.ler)(novo, ctx)) {
        foraDoAlcance();
        throw ACESSO_NEGADO();
      }
      const registro = ctx.inserir(colecao, novo);
      regra.aposCriar?.(registro, ctx);
      salvar();
      auditar({ acao: 'CRIAR', sessao, rota, registroAlvo: `${colecao}/${registro.id}`, resultado: 'PERMITIDO' });
      return enviar(res, 201, projetar(regra, registro, ctx));
    }

    if (verbo === 'editar') {
      const atual = buscarNoAlcance();
      const corpo = await lerCorpo(req);
      const impedimento = regra.podeEditar?.(atual, ctx);
      if (impedimento) throw new ErroHttp(409, impedimento);
      const mudancas = camposGravaveis(regra, corpo, atual, ctx, { edicao: true });
      const novo = { ...atual, ...mudancas };
      const erro = regra.validar?.(novo, atual, ctx, mudancas);
      if (erro) throw new ErroHttp(422, erro);
      // A edição não pode levar o registro para fora do alcance de quem edita.
      if (!(regra.alcanceDeEscrita ?? regra.ler)(novo, ctx)) {
        foraDoAlcance();
        throw ACESSO_NEGADO();
      }
      const antigo = { ...atual };
      Object.assign(atual, mudancas);
      regra.aposEditar?.(atual, antigo, ctx);
      salvar();
      auditar({ acao: 'EDITAR', sessao, rota, registroAlvo: alvo, resultado: 'PERMITIDO' });
      return enviar(res, 200, projetar(regra, atual, ctx));
    }

    // excluir
    const atual = buscarNoAlcance();
    db[colecao] = db[colecao].filter((r) => r !== atual);
    salvar();
    auditar({ acao: 'EXCLUIR', sessao, rota, registroAlvo: alvo, resultado: 'PERMITIDO' });
    return enviar(res, 204);
  }

  function cabecalhosComuns(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    const origem = req.headers.origin;
    if (origem && origens.includes(origem)) {
      res.setHeader('Access-Control-Allow-Origin', origem);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.setHeader('Access-Control-Expose-Headers', 'X-Total-Count');
    }
  }

  return async function tratar(req, res) {
    cabecalhosComuns(req, res);
    if (req.method === 'OPTIONS') return enviar(res, 204);

    let url;
    let partes;
    try {
      url = new URL(req.url, 'http://api.local');
      partes = url.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    } catch {
      return enviar(res, 400, { erro: 'Endereço inválido.' });
    }
    const rota = `${req.method} ${url.pathname}`;

    try {
      if (url.pathname === '/saude' && req.method === 'GET') return enviar(res, 200, { ok: true });
      if (url.pathname === '/login') {
        if (req.method !== 'POST') throw new ErroHttp(405, 'Método não permitido.');
        return await login(req, res, rota);
      }

      // Sessão obrigatória em todo o resto (RF01).
      const token = tokenDe(req);
      const sessao = sessoes.validar(token);
      if (!sessao) {
        auditar({
          acao: ACOES[req.method] ?? req.method,
          sessao: null,
          rota,
          registroAlvo: partes.join('/') || null,
          resultado: 'NEGADO',
          motivo: 'SEM_SESSAO',
        });
        return enviar(res, 401, { erro: 'Sessão ausente ou expirada.' });
      }

      if (partes[0] === 'sessao' || url.pathname === '/logout') {
        return await rotaDeSessao(req, res, { partes, sessao, token, rota });
      }
      if (partes[0] === 'agenda') return await rotaDeAgenda(req, res, { url, partes, sessao, rota });
      return await rotaDeColecao(req, res, { url, partes, sessao, rota });
    } catch (erro) {
      if (erro instanceof ErroHttp) return enviar(res, erro.status, { erro: erro.message });
      // A mensagem não revela estrutura interna (RNF19).
      console.error(erro);
      return enviar(res, 500, { erro: 'Erro inesperado.' });
    }
  };
}

function iniciar() {
  const caminho = process.env.CAMINHO_DB ?? path.join(__dirname, 'db.json');
  if (!fs.existsSync(caminho)) {
    const { gerarBanco } = require('./seed');
    fs.writeFileSync(caminho, JSON.stringify(gerarBanco(), null, 2));
    console.log(`Banco sintético gerado em ${caminho}`);
  }
  const db = JSON.parse(fs.readFileSync(caminho, 'utf8'));
  const salvar = () => {
    const temporario = `${caminho}.tmp`;
    fs.writeFileSync(temporario, JSON.stringify(db, null, 2));
    fs.renameSync(temporario, caminho);
  };
  const origens = process.env.ORIGENS ? process.env.ORIGENS.split(',') : ORIGENS_PADRAO;
  const minutosSessao = Number(process.env.SESSAO_MINUTOS) || undefined;

  // No Render, a porta vem em PORT e a variável RENDER existe; lá a API
  // precisa aceitar conexões de fora. Na máquina local, só da própria máquina,
  // a menos que HOST diga outra coisa.
  const porta = Number(process.env.PORTA || process.env.PORT) || 3001;
  const host = process.env.HOST || (process.env.RENDER ? '0.0.0.0' : '127.0.0.1');
  http
    .createServer(criarApi({ db, salvar, origens, minutosSessao, dataDeReferencia: process.env.DATA_DE_HOJE || DATA_PADRAO }))
    .listen(porta, host, () => console.log(`API simulada em http://${host}:${porta}`));
}

if (require.main === module) iniciar();

module.exports = { criarApi, textoLocal };
