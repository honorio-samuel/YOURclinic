'use strict';

// API simulada do YOURClinic com a proteção da RC03:
// 1. sem sessão, nenhuma rota responde (401), exceto /login e /saude;
// 2. o papel da sessão é conferido antes de qualquer busca no banco; a
//    recusa (403) é gravada em logsAuditoria;
// 3. registro fora do alcance do usuário responde 404, como se não existisse;
// 4. a resposta sai sem os campos que o papel não pode ver e sem senha.
// A matriz de quem vê o quê está em permissoes.js.

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  COLECOES, CLINICAS, ESPECIALIZACOES, ADMINISTRADOR, SECRETARIA, MEDICO, PACIENTE, RESPONSAVEL_LEGAL,
  politica, regraPara, projetar, camposGravaveis, igual, pacienteDe,
} = require('./permissoes');
const { horariosLivres, foraDaGrade, validarGrade, afetadasPeloBloqueio, somarDias } = require('./agenda');
const {
  MODALIDADES, PARCELADAS, BANDEIRAS, ADQUIRENTES, centavos, reais, resumoDaCobranca, maximoDeParcelas,
  respostaDoTef, confirmacaoDoTef, cartaoDoTerminal, brcodeSimulado, valorLiquido,
} = require('./checkout');
const { painelFinanceiro, dashboardGerencial } = require('./indicadores');
const {
  ORIGENS_DE_ENTRADA, DESTINOS_DE_SAIDA, MOTIVOS_DE_DESCARTE, TIPOS_COM_LOTE, STATUS_DE_ENTREGA, atualizarSaldo, vencido,
  lotesParaSaida, recalcularAlertas, inteiroPositivo, dataValida: ehDataValida, texto: textoLimpo, dataBr,
} = require('./estoque');
const { MEIOS_DE_DEVOLUCAO, avaliarReversao } = require('./estorno');
const { aliquotasEm, imposto, proximoNumero, origemDoTitulo, pagadoresPossiveis, montarDocumentoFiscal } = require('./fiscal');
const { detectarTipo, tipoPelaExtensao, reprovadoNaVarredura, nomeSeguro, arquivoDeDemonstracao } = require('./anexo');
const { montarRelatorio, paraCsv } = require('./relatorios');
const { MODELOS_PADRAO } = require('./modelos');
const { EM_REVISAO, dadosDaGuia, gerarGuia, criticaPrevia, guiaAtiva } = require('./guias');
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

async function lerCorpo(req, limite = TAMANHO_MAXIMO_CORPO) {
  let tamanho = 0;
  const pedacos = [];
  for await (const pedaco of req) {
    tamanho += pedaco.length;
    if (tamanho > limite) throw new ErroHttp(413, 'Corpo grande demais.');
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
  // Provedores simulados do checkout: segundos até o Pix ser pago e espera
  // do terminal TEF (README, "Checkout simulado").
  simulacao = { pixSegundos: 8, tefEsperaMs: 0, exportacaoSegundos: 3 },
  // Pasta dos arquivos anexados; sem ela (testes), ficam só na memória.
  pastaDeAnexos = null,
  // E-mail simulado (convite e redefinição de senha): sai no terminal.
  enviarEmail = (email) =>
    console.log(
      `\n--- E-mail simulado ---\nPara: ${email.para}\nAssunto: ${email.assunto}\nLink: ${email.link}\nVale até: ${email.validade}\n-----------------------\n`
    ),
}) {
  for (const colecao of COLECOES) db[colecao] ??= [];
  // Um banco anterior aos modelos de notificação recebe os modelos padrão.
  if (db.modelosNotificacao.length === 0) MODELOS_PADRAO.forEach((m, i) => db.modelosNotificacao.push({ id: i + 1, ...m }));

  const agoraTexto = (minutos = 0) => textoLocal(new Date(relogio().getTime() + minutos * 60 * 1000));
  const hoje = () => agoraTexto().slice(0, 10);
  const hojeClinica = () => dataDeReferencia ?? hoje();
  // Com minutos, soma ao horário da clínica e vira o dia se for o caso.
  const agoraClinica = (minutos = 0) => {
    const base = `${hojeClinica()}T${agoraTexto().slice(11)}`;
    return minutos ? textoLocal(new Date(Date.parse(base) + minutos * 60 * 1000)) : base;
  };

  const parametro = (chave, padrao) => {
    const valor = Number(db.parametros.find((p) => p.chave === chave)?.valor);
    return Number.isFinite(valor) ? valor : padrao;
  };

  const sessoes = new Sessoes({ minutos: minutosSessao ?? parametro('X15', 30), relogio });

  // RF26: o arquivo fica fora do banco e de qualquer pasta servida, com chave
  // aleatória; o banco guarda só a ligação entre o anexo e a chave.
  const arquivosEmMemoria = new Map();
  function guardarArquivo(chave, conteudo) {
    if (!pastaDeAnexos) return arquivosEmMemoria.set(chave, conteudo);
    fs.mkdirSync(pastaDeAnexos, { recursive: true });
    return fs.writeFileSync(path.join(pastaDeAnexos, chave), conteudo);
  }
  function lerArquivo(chave) {
    if (!pastaDeAnexos) return arquivosEmMemoria.get(chave) ?? null;
    const caminho = path.join(pastaDeAnexos, chave);
    return fs.existsSync(caminho) ? fs.readFileSync(caminho) : null;
  }

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
    const data = hojeClinica();
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
      // O acesso de exceção conta no relógio da clínica, como a agenda.
      const agora = agoraClinica();
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
      emitirConvite: (usuario) => emitirToken(usuario, 'CONVITE'),
      // RN-38.2: alertas de estoque refeitos depois de cada mudança no estoque.
      recalcularAlertas: () => recalcularAlertas(db, { hoje: hojeClinica(), antecedencia: parametro('X14', 60), inserir: ctx.inserir }),
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

    if (caminho === 'GET /sessao/representacoes-encerradas') {
      if (sessao.papel !== RESPONSAVEL_LEGAL) throw ACESSO_NEGADO();
      const vigentes = new Set(representacoesVigentes(sessao.idPessoa).map((r) => String(r.idPaciente)));
      const maioridade = db.representacoes.filter((r) => {
        if (!igual(r.idResponsavelLegal, sessao.idPessoa) || vigentes.has(String(r.idPaciente))) return false;
        const pessoa = db.pessoas.find((p) => igual(p.id, r.idPaciente));
        return idade(pessoa?.dataNascimento, hojeClinica()) >= 18;
      }).length;
      return enviar(res, 200, { maioridade });
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

  // Checkout (RF43 a RF47). Quem recebe é a Secretária, no próprio caixa para
  // dinheiro. O lançamento da maquininha avulsa acima do X52 espera a
  // conferência de outro usuário, Secretária ou Administrador (RN-46.3). O PSP
  // e o TEF são simulados (checkout.js).
  async function rotaDeCheckout(req, res, { partes, sessao, rota }) {
    const ctx = contexto(sessao, rota);
    const exigirPapel = (...papeis) => {
      if (papeis.includes(sessao.papel)) return;
      auditar({ acao: ACOES[req.method] ?? req.method, sessao, rota, registroAlvo: partes.join('/'), resultado: 'NEGADO', motivo: 'PAPEL' });
      throw ACESSO_NEGADO();
    };
    const emReais = (valor) => Math.round(Number(valor) * 100) / 100;
    const cobrancaDe = (id) => {
      const cobranca = ctx.buscar('cobrancas', id);
      if (!cobranca) throw NAO_ENCONTRADO();
      return cobranca;
    };
    const pacienteDaCobranca = (cobranca) =>
      ctx.buscar('consultas', cobranca?.idConsulta)?.idPaciente ?? ctx.buscar('orcamentos', cobranca?.idOrcamento)?.idPaciente ?? null;
    const caixaAberto = () => db.caixas.find((c) => c.situacao === 'ABERTO' && igual(c.idSecretaria, sessao.idPessoa));
    const cartaoDe = (id) => db.pagamentosCartao.find((c) => igual(c.id, id));
    const pixDe = (id) => db.pagamentosPix.find((c) => igual(c.id, id));
    const nomeDoUsuario = (idUsuario) => nomeDaPessoa(db.usuarios.find((u) => igual(u.id, idUsuario))?.idPessoa);

    // Nada de taxa nem valor líquido: a Secretária não os vê (S-07a).
    function projetarPagamento(p) {
      const base = { id: p.id, meio: p.meio, valor: p.valor, situacao: p.situacao, dataHora: p.dataHora };
      if (p.meio === 'PIX') {
        const pix = pixDe(p.id);
        return { ...base, txid: pix?.txid, brcode: p.situacao === 'PENDENTE' ? pix?.brcode : null, expiracao: pix?.expiracao };
      }
      if (p.meio === 'CARTAO') {
        const c = cartaoDe(p.id) ?? {};
        return {
          ...base,
          viaTef: c.viaTef, modalidade: c.modalidade, parcelas: c.parcelas, bandeira: c.bandeira, ultimosDigitos: c.ultimosDigitos,
          nsu: c.nsu, codigoAutorizacao: c.codigoAutorizacao, adquirente: c.adquirente,
          lancadoPorMim: igual(p.idUsuario, sessao.idUsuario),
        };
      }
      const d = db.pagamentosDinheiro.find((x) => igual(x.id, p.id));
      return { ...base, valorRecebido: d?.valorRecebido, troco: d?.troco };
    }

    // RF43, passo 1: itens, total e origem, sem conteúdo clínico (RN-45.3).
    function detalhe(cobranca) {
      const resumo = resumoDaCobranca(db, cobranca);
      const consulta = ctx.buscar('consultas', cobranca.idConsulta);
      const procedimento = consulta && ctx.buscar('procedimentos', consulta.idProcedimento);
      const idPaciente = pacienteDaCobranca(cobranca);
      const quando = consulta ? `${consulta.dataHora.slice(8, 10)}/${consulta.dataHora.slice(5, 7)}` : null;
      const descricao = consulta
        ? `${consulta.idConvenio != null ? 'Coparticipação · ' : ''}${procedimento?.tipo === 'CONSULTA' ? 'Consulta' : 'Atendimento'} de ${quando}`
        : `Orçamento nº ${cobranca.idOrcamento}`;
      const maximo = parametro('X32', 12);
      const valorMinimo = parametro('X33', 50);
      return {
        cobranca: {
          id: cobranca.id, dataEmissao: cobranca.dataEmissao, situacao: cobranca.situacao,
          idConsulta: cobranca.idConsulta, idOrcamento: cobranca.idOrcamento,
        },
        paciente: { id: idPaciente, nome: nomeDaPessoa(idPaciente) },
        itens: [{ descricao, valor: cobranca.valorTotal }],
        valorTotal: cobranca.valorTotal,
        pago: resumo.pago,
        saldo: resumo.saldo,
        disponivel: resumo.disponivel,
        pagamentos: resumo.pagamentos.map(projetarPagamento),
        parcelas: { maximo, valorMinimo },
        limiteSemConferencia: parametro('X52', 500),
        caixaAberto: Boolean(caixaAberto()),
        bandeiras: BANDEIRAS,
        adquirentes: ADQUIRENTES,
      };
    }

    // Quanto este meio recebe: até o que falta, sem contar o que espera desfecho.
    function valorDoMeio(cobranca, bruto) {
      if (cobranca.situacao !== 'ABERTA') throw new ErroHttp(409, 'Esta cobrança já está quitada.');
      const valor = emReais(bruto);
      if (!Number.isFinite(valor) || valor <= 0) throw new ErroHttp(422, 'Informe o valor a receber.');
      const { disponivel } = resumoDaCobranca(db, cobranca);
      if (centavos(valor) > centavos(disponivel)) throw new ErroHttp(422, 'O valor passa do que falta receber.');
      return valor;
    }

    function modalidadeDe(corpo, valor) {
      if (!MODALIDADES.includes(corpo.modalidade)) throw new ErroHttp(422, 'Escolha a modalidade.');
      if (!PARCELADAS.includes(corpo.modalidade)) return { modalidade: corpo.modalidade, parcelas: 1 };
      const maximo = maximoDeParcelas(valor, { maximo: parametro('X32', 12), valorMinimo: parametro('X33', 50) });
      const parcelas = Number(corpo.parcelas);
      if (maximo < 2) throw new ErroHttp(422, 'Este valor não pode ser parcelado.');
      if (!Number.isInteger(parcelas) || parcelas < 2 || parcelas > maximo) throw new ErroHttp(422, `Escolha de 2 a ${maximo} parcelas.`);
      return { modalidade: corpo.modalidade, parcelas };
    }

    // RF43, passo 5, e RF32: ao atingir o total, baixa do título e aviso ao titular.
    function quitarSePago(cobranca) {
      if (cobranca.situacao === 'PAGA' || resumoDaCobranca(db, cobranca).saldo > 0) return;
      cobranca.situacao = 'PAGA';
      for (const t of db.titulosReceber.filter((x) => igual(x.idCobranca, cobranca.id) && x.situacao === 'ABERTO')) t.situacao = 'PAGO';
      const idPaciente = pacienteDaCobranca(cobranca);
      const pessoa = ctx.buscar('pessoas', idPaciente);
      if (!pessoa) return;
      ctx.inserir('notificacoes', {
        evento: 'PAGAMENTO_CONFIRMADO',
        canal: pessoa.telefone ? 'WHATSAPP' : 'EMAIL',
        destino: pessoa.telefone ?? pessoa.email ?? null,
        dataEnvio: agoraClinica(),
        situacao: 'ENVIADA',
        tentativas: 1,
        idPessoa: idPaciente,
        idConsulta: cobranca.idConsulta ?? null,
        idParametro: null,
      });
    }

    function registrar(cobranca, meio, valor, situacao) {
      const pagamento = ctx.inserir('pagamentos', {
        valor, dataHora: agoraClinica(), situacao, idCobranca: cobranca.id, meio, idUsuario: sessao.idUsuario,
      });
      auditar({ acao: 'CRIAR', sessao, rota, registroAlvo: `pagamentos/${pagamento.id}`, resultado: 'PERMITIDO', motivo: meio });
      return pagamento;
    }

    function responder(status, cobranca, pagamento) {
      salvar();
      return enviar(res, status, { pagamento: projetarPagamento(pagamento), ...detalhe(cobranca) });
    }

    // RF44: QR dinâmico com txid próprio e expiração X31.
    function gerarPix(cobranca, valor) {
      const pagamento = registrar(cobranca, 'PIX', valor, 'PENDENTE');
      const agoraMs = relogio().getTime();
      const minutos = parametro('X31', 30);
      const txid = `YC${String(cobranca.id).padStart(6, '0')}${String(pagamento.id).padStart(8, '0')}${agoraMs.toString(36).toUpperCase()}`;
      db.pagamentosPix.push({
        id: pagamento.id, txid, brcode: brcodeSimulado(txid, valor), endToEndId: null,
        expiracao: `${hojeClinica()}T${agoraTexto(minutos).slice(11)}`,
        geradoEm: agoraMs, expiraEm: agoraMs + minutos * 60 * 1000,
      });
      return pagamento;
    }

    // RF44: consulta ao PSP simulado pelo txid: pago depois de PIX_SEGUNDOS,
    // vencido depois do X31.
    function verificarPix(pagamento, pix, cobranca, cancelar = false) {
      if (pagamento.situacao !== 'PENDENTE') return;
      const agoraMs = relogio().getTime();
      if (agoraMs >= pix.expiraEm) pagamento.situacao = 'EXPIRADO';
      else if (agoraMs - pix.geradoEm >= simulacao.pixSegundos * 1000) {
        pagamento.situacao = 'CONFIRMADO';
        pagamento.dataHora = agoraClinica();
        pix.endToEndId = `E${String(pagamento.id).padStart(8, '0')}${agoraMs}`;
        quitarSePago(cobranca);
      } else if (cancelar) {
        pagamento.situacao = 'CANCELADO';
      }
    }

    // P-05a e R-05a: o titular paga a própria cobrança por Pix, no ambiente do
    // PSP simulado; nenhuma tela tem campo de cartão. Pagar de novo devolve o
    // QR que ainda espera, em vez de gerar outro.
    if ([PACIENTE, RESPONSAVEL_LEGAL].includes(sessao.papel)) {
      const doTitular = (cobranca) => Boolean(cobranca) && igual(pacienteDaCobranca(cobranca), ctx.titular());
      const paraOTitular = (status, cobranca, pagamento) => {
        salvar();
        const pix = pixDe(pagamento.id);
        return enviar(res, status, {
          pagamento: {
            id: pagamento.id, valor: pagamento.valor, situacao: pagamento.situacao, txid: pix?.txid,
            brcode: pagamento.situacao === 'PENDENTE' ? pix?.brcode : null, expiracao: pix?.expiracao,
          },
          cobranca: { id: cobranca.id, situacao: cobranca.situacao, saldo: resumoDaCobranca(db, cobranca).saldo },
        });
      };
      if (req.method === 'POST' && partes[2] === 'pix-portal' && partes.length === 3) {
        const cobranca = ctx.buscar('cobrancas', partes[1]);
        if (!doTitular(cobranca)) throw NAO_ENCONTRADO();
        if (cobranca.situacao !== 'ABERTA') throw new ErroHttp(409, 'Esta cobrança já está quitada.');
        const espera = db.pagamentos.find((p) => igual(p.idCobranca, cobranca.id) && p.meio === 'PIX' && p.situacao === 'PENDENTE');
        if (espera) {
          verificarPix(espera, pixDe(espera.id), cobranca);
          if (espera.situacao === 'PENDENTE') return paraOTitular(200, cobranca, espera);
        }
        const { disponivel } = resumoDaCobranca(db, cobranca);
        if (!(disponivel > 0)) throw new ErroHttp(409, 'Há um pagamento em andamento na recepção para esta cobrança.');
        return paraOTitular(201, cobranca, gerarPix(cobranca, disponivel));
      }
      if (req.method === 'POST' && partes[1] === 'pix' && partes[3] === 'verificar' && partes.length === 4) {
        const pagamento = ctx.buscar('pagamentos', partes[2]);
        const pix = pixDe(partes[2]);
        const cobranca = pagamento ? ctx.buscar('cobrancas', pagamento.idCobranca) : null;
        if (!pix || !doTitular(cobranca)) throw NAO_ENCONTRADO();
        verificarPix(pagamento, pix, cobranca);
        return paraOTitular(200, cobranca, pagamento);
      }
      exigirPapel(SECRETARIA);
    }

    // Lançamentos da maquininha avulsa que esperam conferência.
    if (req.method === 'GET' && partes[1] === 'conferencias' && partes.length === 2) {
      exigirPapel(ADMINISTRADOR, SECRETARIA);
      const lista = db.pagamentos
        .filter((p) => p.situacao === 'AGUARDANDO_CONFERENCIA')
        .map((p) => ({
          ...projetarPagamento(p),
          idCobranca: p.idCobranca,
          paciente: nomeDaPessoa(pacienteDaCobranca(ctx.buscar('cobrancas', p.idCobranca))),
          lancadoPor: nomeDoUsuario(p.idUsuario),
        }));
      return enviar(res, 200, lista);
    }

    // RN-46.3: outro usuário confirma ou recusa o lançamento acima do limite.
    if (req.method === 'POST' && partes[1] === 'pagamentos' && partes[3] === 'conferir' && partes.length === 4) {
      exigirPapel(ADMINISTRADOR, SECRETARIA);
      const pagamento = ctx.buscar('pagamentos', partes[2]);
      if (!pagamento) throw NAO_ENCONTRADO();
      if (pagamento.situacao !== 'AGUARDANDO_CONFERENCIA') throw new ErroHttp(409, 'Este lançamento não espera conferência.');
      if (igual(pagamento.idUsuario, sessao.idUsuario)) throw new ErroHttp(409, 'Quem lançou não confere o próprio lançamento.');
      const corpo = await lerCorpo(req);
      const cobranca = cobrancaDe(pagamento.idCobranca);
      if (corpo.aprovar === true) {
        pagamento.situacao = 'CONFIRMADO';
        quitarSePago(cobranca);
      } else {
        const motivo = typeof corpo.motivo === 'string' ? corpo.motivo.trim() : '';
        if (motivo.length < 5) throw new ErroHttp(422, 'Informe o motivo da recusa.');
        pagamento.situacao = 'RECUSADO';
        pagamento.motivoRecusa = motivo;
      }
      pagamento.idConferente = sessao.idUsuario;
      auditar({
        acao: 'CONFERIR', sessao, rota, registroAlvo: `pagamentos/${pagamento.id}`, resultado: 'PERMITIDO',
        motivo: pagamento.situacao === 'CONFIRMADO' ? 'CONFIRMADO' : 'RECUSADO',
      });
      return responder(200, cobranca, pagamento);
    }

    // RF44: "Verificar agora" e a consulta periódica ao PSP pelo txid.
    if (req.method === 'POST' && partes[1] === 'pix' && partes.length === 4 && ['verificar', 'cancelar'].includes(partes[3])) {
      exigirPapel(SECRETARIA);
      const pagamento = ctx.buscar('pagamentos', partes[2]);
      const pix = pixDe(partes[2]);
      if (!pagamento || !pix || pagamento.meio !== 'PIX') throw NAO_ENCONTRADO();
      const cobranca = cobrancaDe(pagamento.idCobranca);
      verificarPix(pagamento, pix, cobranca, partes[3] === 'cancelar');
      return responder(200, cobranca, pagamento);
    }

    // RF45, E2 a E4: a consulta de confirmação da transação sem resposta.
    if (req.method === 'POST' && partes[1] === 'tef' && partes[3] === 'confirmar' && partes.length === 4) {
      exigirPapel(SECRETARIA);
      const pagamento = ctx.buscar('pagamentos', partes[2]);
      const cartao = cartaoDe(partes[2]);
      if (!pagamento || !cartao?.viaTef) throw NAO_ENCONTRADO();
      const cobranca = cobrancaDe(pagamento.idCobranca);
      if (pagamento.situacao === 'INDEFINIDO') {
        if (confirmacaoDoTef(pagamento.valor) === 'APROVADO') {
          pagamento.situacao = 'CONFIRMADO';
          Object.assign(cartao, cartaoDoTerminal(pagamento.id));
          quitarSePago(cobranca);
        } else {
          pagamento.situacao = 'NAO_REALIZADO';
        }
      }
      return responder(200, cobranca, pagamento);
    }

    if (req.method === 'GET' && partes.length === 2) {
      exigirPapel(SECRETARIA);
      return enviar(res, 200, detalhe(cobrancaDe(partes[1])));
    }

    if (req.method === 'POST' && partes.length === 3) {
      exigirPapel(SECRETARIA);
      const cobranca = cobrancaDe(partes[1]);
      const corpo = await lerCorpo(req);

      // RF47: dinheiro só no caixa aberto de quem recebe (RN-47.1).
      if (partes[2] === 'dinheiro') {
        const caixa = caixaAberto();
        if (!caixa) throw new ErroHttp(409, 'Abra o seu caixa em Meu caixa para receber em dinheiro.');
        const valor = valorDoMeio(cobranca, corpo.valor);
        const recebido = emReais(corpo.valorRecebido);
        if (!Number.isFinite(recebido) || centavos(recebido) < centavos(valor)) {
          throw new ErroHttp(422, 'O valor recebido não cobre o valor a pagar.');
        }
        const pagamento = registrar(cobranca, 'DINHEIRO', valor, 'CONFIRMADO');
        db.pagamentosDinheiro.push({ id: pagamento.id, valorRecebido: recebido, troco: reais(centavos(recebido) - centavos(valor)), idCaixa: caixa.id });
        quitarSePago(cobranca);
        return responder(201, cobranca, pagamento);
      }

      // RF44: QR dinâmico com txid próprio e expiração X31.
      if (partes[2] === 'pix') {
        const pagamento = gerarPix(cobranca, valorDoMeio(cobranca, corpo.valor));
        return responder(201, cobranca, pagamento);
      }

      // RF45: o valor vai ao terminal; a chave evita cobrança em dobro (RN-43.5).
      if (partes[2] === 'tef') {
        const chave = typeof corpo.chave === 'string' ? corpo.chave : '';
        if (!/^[\w-]{8,64}$/.test(chave)) throw new ErroHttp(422, 'Pedido sem identificador da transação.');
        const repetido = db.pagamentosCartao.find((c) => c.chave === chave);
        if (repetido) return responder(200, cobranca, ctx.buscar('pagamentos', repetido.id));
        const valor = valorDoMeio(cobranca, corpo.valor);
        const { modalidade, parcelas } = modalidadeDe(corpo, valor);
        if (simulacao.tefEsperaMs) await new Promise((pronto) => setTimeout(pronto, simulacao.tefEsperaMs));
        const resposta = respostaDoTef(valor);
        const situacao = { APROVADO: 'CONFIRMADO', NEGADO: 'NEGADO', INDEFINIDO: 'INDEFINIDO' }[resposta];
        const pagamento = registrar(cobranca, 'CARTAO', valor, situacao);
        const terminal = cartaoDoTerminal(pagamento.id);
        db.pagamentosCartao.push({
          id: pagamento.id, chave, viaTef: true, modalidade, parcelas,
          ...(resposta === 'APROVADO' ? terminal : { bandeira: null, nsu: null, codigoAutorizacao: null, ultimosDigitos: null, adquirente: terminal.adquirente }),
          valorBruto: valor, valorLiquido: valorLiquido(valor, modalidade), situacaoConciliacao: 'PENDENTE', dataHora: agoraClinica(),
        });
        if (resposta === 'APROVADO') quitarSePago(cobranca);
        return responder(201, cobranca, pagamento);
      }

      // RF46: lançamento do comprovante da maquininha avulsa, a conciliar depois.
      if (partes[2] === 'pos') {
        const valor = valorDoMeio(cobranca, corpo.valor);
        const { modalidade, parcelas } = modalidadeDe(corpo, valor);
        const nsu = typeof corpo.nsu === 'string' ? corpo.nsu.trim() : '';
        const codigo = typeof corpo.codigoAutorizacao === 'string' ? corpo.codigoAutorizacao.trim().toUpperCase() : '';
        if (!/^\d{4,12}$/.test(nsu) || !/^[A-Z0-9]{4,12}$/.test(codigo)) {
          throw new ErroHttp(422, 'Informe o NSU e o código de autorização do comprovante.');
        }
        if (!/^\d{4}$/.test(corpo.ultimosDigitos ?? '')) throw new ErroHttp(422, 'Informe os quatro últimos dígitos do cartão.');
        if (!BANDEIRAS.includes(corpo.bandeira)) throw new ErroHttp(422, 'Escolha a bandeira.');
        if (!ADQUIRENTES.includes(corpo.adquirente)) throw new ErroHttp(422, 'Escolha o adquirente.');
        // RN-46.2: NSU repetido no mesmo dia e adquirente é lançamento em dobro.
        const hoje = hojeClinica();
        const repetido = db.pagamentosCartao.some(
          (c) =>
            c.nsu === nsu &&
            c.adquirente === corpo.adquirente &&
            String(c.dataHora ?? '').startsWith(hoje) &&
            ctx.buscar('pagamentos', c.id)?.situacao !== 'RECUSADO'
        );
        if (repetido) throw new ErroHttp(409, 'Este NSU já foi lançado hoje neste adquirente. Confira o comprovante.');
        const conferir = valor > parametro('X52', 500);
        const pagamento = registrar(cobranca, 'CARTAO', valor, conferir ? 'AGUARDANDO_CONFERENCIA' : 'CONFIRMADO');
        db.pagamentosCartao.push({
          id: pagamento.id, viaTef: false, modalidade, parcelas, bandeira: corpo.bandeira, nsu, codigoAutorizacao: codigo,
          ultimosDigitos: corpo.ultimosDigitos, adquirente: corpo.adquirente,
          valorBruto: valor, valorLiquido: valorLiquido(valor, modalidade), situacaoConciliacao: 'PENDENTE', dataHora: agoraClinica(),
        });
        if (!conferir) quitarSePago(cobranca);
        return responder(201, cobranca, pagamento);
      }
    }

    throw NAO_ENCONTRADO();
  }

  // RNF13: a exportação é gerada depois do pedido; aqui ela fica pronta
  // alguns segundos depois (README, "Exportações simuladas").
  function concluirExportacoes() {
    const segundos = simulacao.exportacaoSegundos;
    if (!(segundos >= 0)) return;
    const agora = agoraClinica();
    let mudou = false;
    // RF42: o relatório pedido fica pronto no mesmo prazo da exportação.
    for (const r of db.relatorios) {
      if (r.situacao !== 'GERANDO') continue;
      if (!r.pedidoEm || Date.parse(`${agora}Z`) - Date.parse(`${r.pedidoEm}Z`) >= segundos * 1000) {
        r.situacao = 'PRONTO';
        r.geradoEm = agora;
        mudou = true;
      }
    }
    for (const e of db.exportacoes) {
      if (e.situacao !== 'SOLICITADA' || !e.dataSolicitacao) continue;
      if (Date.parse(`${agora}Z`) - Date.parse(`${e.dataSolicitacao}Z`) >= segundos * 1000) {
        e.situacao = 'CONCLUIDA';
        e.dataConclusao = agora;
        mudou = true;
      }
    }
    if (mudou) salvar();
  }

  const STATUS_NO_HISTORICO = {
    AGENDADO: 'Agendado', NA_RECEPCAO: 'Na recepção', EM_ATENDIMENTO: 'Em atendimento',
    FINALIZADO: 'Realizado', CANCELADO: 'Cancelado', NAO_COMPARECEU: 'Não compareceu',
  };

  // RF29 e RF30: o conteúdo do documento sai do servidor, que monta o
  // histórico sem conteúdo clínico e o prontuário sem anotações privadas.
  function montarDocumento(exportacao, idPaciente, sessao) {
    const pessoa = db.pessoas.find((p) => igual(p.id, idPaciente));
    const medico = (id) => {
      const m = db.medicos.find((x) => igual(x.id, id));
      return { nome: nomeDaPessoa(id), especialidade: m?.especialidade ?? null, crm: m ? `${m.crm}/${m.ufCrm}` : null };
    };
    const procedimento = (id) => db.procedimentos.find((p) => igual(p.id, id));
    const consultas = db.consultas
      .filter((c) => igual(c.idPaciente, idPaciente) && c.dataHora <= agoraClinica())
      .sort((a, b) => a.dataHora.localeCompare(b.dataHora));
    const verificacao = `YC-${String(exportacao.id).padStart(6, '0')}-${(exportacao.id * 7919 + Date.parse(`${exportacao.dataConclusao}Z`) / 1000)
      .toString(36)
      .toUpperCase()
      .slice(-6)}`;
    const base = {
      id: exportacao.id,
      tipo: exportacao.tipo,
      paciente: { nome: pessoa?.nome ?? '—', dataNascimento: pessoa?.dataNascimento ?? null },
      solicitante: nomeDaPessoa(db.usuarios.find((u) => igual(u.id, exportacao.idSolicitante))?.idPessoa) ?? nomeDaPessoa(sessao.idPessoa),
      emitidoEm: agoraClinica(),
      verificacao,
    };
    if (exportacao.tipo === 'HISTORICO') {
      // Sem anamnese, diagnóstico, prescrição nem motivo de cancelamento (RN-29.2).
      return {
        ...base,
        atendimentos: consultas.map((c) => ({
          dataHora: c.dataHora,
          tipo: procedimento(c.idProcedimento)?.tipo === 'CONSULTA' ? 'Consulta' : 'Procedimento',
          medico: medico(c.idMedico).nome,
          especialidade: medico(c.idMedico).especialidade,
          situacao: STATUS_NO_HISTORICO[c.status] ?? c.status,
        })),
      };
    }
    const prontuario = db.prontuarios.find((p) => igual(p.idPaciente, idPaciente));
    const registros = db.registrosClinicos
      .filter((r) => prontuario && igual(r.idProntuario, prontuario.id) && r.selado)
      .sort((a, b) => a.dataHora.localeCompare(b.dataHora));
    return {
      ...base,
      registros: registros.map((r) => {
        const consulta = db.consultas.find((c) => igual(c.id, r.idConsulta));
        const retificacoes = db.retificacoes.filter((x) => igual(x.idRegistroClinico, r.id));
        // A versão vigente de cada campo, com as retificações sinalizadas (RF24).
        const vigente = (campo) => retificacoes.filter((x) => x.campo === campo).at(-1)?.textoCorrigido ?? r[campo] ?? '';
        const prescricoes = db.prescricoes.filter((p) => igual(p.idRegistroClinico, r.id));
        return {
          dataHora: r.dataHora,
          medico: medico(r.idMedico ?? consulta?.idMedico),
          sobExcecao: Boolean(r.sobExcecao),
          queixas: vigente('queixas'),
          exameFisico: vigente('exameFisico'),
          diagnostico: vigente('diagnostico'),
          cid: vigente('cid'),
          conduta: vigente('conduta'),
          prescricoes: prescricoes.map((p) => ({
            dataEmissao: p.dataEmissao,
            itens: db.itensPrescricao
              .filter((i) => igual(i.idPrescricao, p.id))
              .map((i) => ({ medicamento: i.medicamento, concentracao: i.concentracao, posologia: i.posologia, quantidade: i.quantidade, duracao: i.duracao ?? null, classificacao: i.classificacao })),
          })),
          correcaoDaPrescricao: retificacoes.filter((x) => x.campo === 'prescricao').at(-1)?.textoCorrigido ?? null,
          retificacoes: retificacoes.map((x) => ({ dataHora: x.dataHora, autor: nomeDaPessoa(x.idMedico ?? r.idMedico ?? consulta?.idMedico), motivo: x.motivo, campo: x.campo ?? null })),
        };
      }),
    };
  }

  // O documento é de quem o pediu (RN-27.1), só pronto e só dentro de X42 horas.
  async function rotaDeDocumento(req, res, { partes, sessao, rota }) {
    if (req.method !== 'GET' || partes.length !== 3) throw NAO_ENCONTRADO();
    const ctx = contexto(sessao, rota);
    const regra = regraPara('exportacoes', sessao.papel);
    const exportacao = ctx.buscar('exportacoes', partes[1]);
    if (!regra?.ler || !exportacao || !regra.ler(exportacao, ctx)) {
      auditar({ acao: 'LER', sessao, rota, registroAlvo: `exportacoes/${partes[1]}`, resultado: 'NEGADO', motivo: 'FORA_DO_ALCANCE' });
      throw NAO_ENCONTRADO();
    }
    if (exportacao.idSolicitante != null && !igual(exportacao.idSolicitante, sessao.idUsuario)) {
      throw new ErroHttp(403, 'Este documento é de quem o pediu.');
    }
    if (exportacao.situacao !== 'CONCLUIDA') throw new ErroHttp(409, 'O documento ainda está sendo gerado.');
    const horas = parametro('X42', 24);
    if (exportacao.dataConclusao && Date.parse(`${agoraClinica()}Z`) - Date.parse(`${exportacao.dataConclusao}Z`) > horas * 3600 * 1000) {
      throw new ErroHttp(410, 'O link expirou. Peça a exportação de novo.');
    }
    const idPaciente = pacienteDe('exportacoes', exportacao, ctx);
    auditar({ acao: 'BAIXAR', sessao, rota, registroAlvo: `exportacoes/${exportacao.id}`, resultado: 'PERMITIDO' });
    return enviar(res, 200, montarDocumento(exportacao, idPaciente, sessao));
  }

  // ── Credencial (RF02, RF09) ──────────────────────────────────────────────
  // Convite e redefinição usam token de uso único, guardado só como hash, com
  // validade X04 (horas) ou X05 (minutos). Os campos começam com "senha", e
  // por isso nunca saem da API. O e-mail é simulado (enviarEmail).
  const hashDoToken = (token) => crypto.createHash('sha256').update(String(token)).digest('hex');
  const regraDeSenha = (senha) =>
    typeof senha === 'string' && senha.length >= 8 && /[A-Za-z]/.test(senha) && /\d/.test(senha)
      ? null
      : 'A senha precisa de ao menos 8 caracteres, com letras e números.';
  const MENSAGEM_TOKEN = 'Este link não vale mais. Peça um novo à clínica.';
  const MENSAGEM_RECUPERACAO = 'Se este e-mail estiver cadastrado, você receberá as instruções em instantes.';

  // RN-02.2: um token novo invalida o anterior, porque o hash é trocado.
  function emitirToken(usuario, tipo) {
    const token = crypto.randomBytes(24).toString('base64url');
    const convite = tipo === 'CONVITE';
    const minutos = convite ? parametro('X04', 72) * 60 : parametro('X05', 30);
    usuario.senhaToken = hashDoToken(token);
    usuario.senhaTokenTipo = tipo;
    usuario.senhaTokenExpiraEm = relogio().getTime() + minutos * 60 * 1000;
    usuario.senhaTokenTentativas = 0;
    const caminho = convite ? 'convite' : 'redefinir-senha';
    enviarEmail({
      para: usuario.email,
      assunto: convite ? 'Convite para acessar a YOURClinic' : 'Redefinição de senha da YOURClinic',
      link: `${origens[0] ?? 'http://localhost:3000'}/${caminho}/${token}`,
      validade: textoLocal(new Date(usuario.senhaTokenExpiraEm)),
      token,
    });
    auditar({
      acao: convite ? 'EMITIR_CONVITE' : 'EMITIR_REDEFINICAO',
      sessao: null,
      rota: 'interna',
      registroAlvo: `usuarios/${usuario.id}`,
      resultado: 'PERMITIDO',
    });
  }

  function usuarioDoToken(token, tipo) {
    const hash = hashDoToken(token);
    const usuario = db.usuarios.find((u) => u.senhaToken === hash && u.senhaTokenTipo === tipo);
    if (!usuario || !(usuario.senhaTokenExpiraEm > relogio().getTime())) return null;
    if (tipo === 'CONVITE' && usuario.situacao !== 'CONVITE_PENDENTE') return null;
    if (tipo === 'REDEFINICAO' && usuario.situacao !== 'ATIVO') return null;
    return usuario;
  }

  // RN-02.1: o token morre no primeiro uso.
  function apagarToken(usuario) {
    delete usuario.senhaToken;
    delete usuario.senhaTokenTipo;
    delete usuario.senhaTokenExpiraEm;
    delete usuario.senhaTokenTentativas;
  }

  const soDigitos = (texto) => String(texto ?? '').replace(/\D/g, '');

  // RF09, passo 3. O Paciente confere o próprio CPF e o nascimento; o
  // Responsável, o próprio CPF e o nascimento de um representado (D19, B16).
  function conferirIdentidade(usuario, { cpf, dataNascimento }) {
    const pessoa = db.pessoas.find((p) => igual(p.id, usuario.idPessoa));
    if (!pessoa || soDigitos(pessoa.cpf) !== soDigitos(cpf) || soDigitos(cpf).length !== 11) return false;
    if (usuario.papel === RESPONSAVEL_LEGAL) {
      return db.representacoes.some(
        (r) =>
          igual(r.idResponsavelLegal, usuario.idPessoa) &&
          db.pessoas.find((p) => igual(p.id, r.idPaciente))?.dataNascimento === dataNascimento
      );
    }
    return pessoa.dataNascimento === dataNascimento;
  }

  // Rotas sem sessão: primeiro acesso por convite (G-04a, G-04b) e
  // recuperação de senha (G-05, G-06). Nada aqui diz se um e-mail existe.
  async function rotaPublicaDeCredencial(req, res, { partes, rota }) {
    const caminho = `${req.method} /${partes[0]}${partes[1] ? `/${partes[1]}` : ''}`;

    if (partes[0] === 'convites' && partes.length === 2) {
      const usuario = usuarioDoToken(partes[1], 'CONVITE');
      if (!usuario) throw new ErroHttp(410, MENSAGEM_TOKEN);
      if (req.method === 'GET') return enviar(res, 200, { papel: usuario.papel });
      if (req.method !== 'POST') throw new ErroHttp(405, 'Método não permitido.');
      const corpo = await lerCorpo(req);
      if (!conferirIdentidade(usuario, corpo)) {
        usuario.senhaTokenTentativas = (usuario.senhaTokenTentativas ?? 0) + 1;
        auditar({ acao: 'ATIVAR_CONTA', sessao: null, rota, registroAlvo: `usuarios/${usuario.id}`, resultado: 'NEGADO', motivo: 'CONFERENCIA' });
        // RN-09.2: passou de X01 tentativas, o convite deixa de valer.
        if (usuario.senhaTokenTentativas >= parametro('X01', 5)) {
          apagarToken(usuario);
          salvar();
          throw new ErroHttp(410, 'Muitas tentativas. Peça um novo convite à clínica.');
        }
        salvar();
        throw new ErroHttp(422, 'Os dados não conferem com o cadastro da clínica.');
      }
      const erro = regraDeSenha(corpo.senha);
      if (erro) throw new ErroHttp(422, erro);
      usuario.senhaHash = gerarHash(corpo.senha);
      usuario.situacao = 'ATIVO';
      usuario.tentativasFalhas = 0;
      usuario.bloqueadoAte = null;
      apagarToken(usuario);
      auditar({ acao: 'ATIVAR_CONTA', sessao: null, rota, registroAlvo: `usuarios/${usuario.id}`, resultado: 'PERMITIDO' });
      return enviar(res, 204);
    }

    if (caminho === 'POST /senha/recuperar' && partes.length === 2) {
      const corpo = await lerCorpo(req);
      const email = typeof corpo.email === 'string' ? corpo.email.trim().toLowerCase() : '';
      const usuario = email ? db.usuarios.find((u) => u.email?.toLowerCase() === email && u.situacao === 'ATIVO') : null;
      if (usuario) emitirToken(usuario, 'REDEFINICAO');
      salvar();
      return enviar(res, 202, { mensagem: MENSAGEM_RECUPERACAO });
    }

    if (partes[0] === 'senha' && partes[1] === 'redefinir' && partes.length === 3) {
      const usuario = usuarioDoToken(partes[2], 'REDEFINICAO');
      if (!usuario) throw new ErroHttp(410, MENSAGEM_TOKEN);
      if (req.method === 'GET') return enviar(res, 200, { valido: true });
      if (req.method !== 'POST') throw new ErroHttp(405, 'Método não permitido.');
      const corpo = await lerCorpo(req);
      const erro = regraDeSenha(corpo.senha);
      if (erro) throw new ErroHttp(422, erro);
      usuario.senhaHash = gerarHash(corpo.senha);
      usuario.tentativasFalhas = 0;
      usuario.bloqueadoAte = null;
      apagarToken(usuario);
      // RF02: redefinir encerra todas as sessões abertas do usuário.
      sessoes.encerrarDoUsuario(usuario.id);
      auditar({ acao: 'REDEFINIR_SENHA', sessao: null, rota, registroAlvo: `usuarios/${usuario.id}`, resultado: 'PERMITIDO' });
      return enviar(res, 204);
    }

    throw NAO_ENCONTRADO();
  }

  // RF03: reenviar o convite de uma conta pendente. A Secretária só reenvia
  // os do portal (S-01b).
  async function reenviarConvite(req, res, { partes, sessao, rota }) {
    if (req.method !== 'POST') throw new ErroHttp(405, 'Método não permitido.');
    const usuario = db.usuarios.find((u) => igual(u.id, partes[1]));
    const permitido =
      sessao.papel === ADMINISTRADOR || (sessao.papel === SECRETARIA && [PACIENTE, RESPONSAVEL_LEGAL].includes(usuario?.papel));
    if (!usuario || !permitido) {
      auditar({ acao: 'EMITIR_CONVITE', sessao, rota, registroAlvo: `usuarios/${partes[1]}`, resultado: 'NEGADO', motivo: 'PAPEL' });
      throw usuario ? ACESSO_NEGADO() : NAO_ENCONTRADO();
    }
    if (usuario.situacao !== 'CONVITE_PENDENTE') throw new ErroHttp(409, 'Esta conta já está ativa.');
    emitirToken(usuario, 'CONVITE');
    salvar();
    return enviar(res, 202, { mensagem: `Convite reenviado para ${usuario.email}.` });
  }

  // Estoque (RF36 a RF38). Entrada, saída e ajuste passam só por aqui, para
  // que o saldo nunca seja editado direto (RN-36.2). Entrada: Administrador e
  // Secretária. Saída: Secretária e Médico (RF37, corrigido na v2.0). Ajuste:
  // o do Administrador vale na hora; o da Secretária espera a aprovação dele.
  async function rotaDeEstoque(req, res, { partes, sessao, rota }) {
    const ctx = contexto(sessao, rota);
    const exigirPapel = (...papeis) => {
      if (papeis.includes(sessao.papel)) return;
      auditar({ acao: ACOES[req.method] ?? req.method, sessao, rota, registroAlvo: partes.join('/'), resultado: 'NEGADO', motivo: 'PAPEL' });
      throw ACESSO_NEGADO();
    };
    if (req.method !== 'POST') throw NAO_ENCONTRADO();
    const hoje = hojeClinica();
    const loteDe = (id) => {
      const lote = ctx.buscar('lotes', id);
      if (!lote) throw new ErroHttp(422, 'Escolha o lote.');
      return lote;
    };
    const nomeDoLote = (lote) => (lote.numero ? `lote ${lote.numero}` : 'item sem lote');
    const quantidadeDe = (valor) => {
      const n = Number(valor);
      if (!inteiroPositivo(n)) throw new ErroHttp(422, 'Informe a quantidade, um número inteiro maior que zero.');
      return n;
    };

    function gravar(dados) {
      const m = ctx.inserir('movimentacoes', {
        dataHora: agoraClinica(), justificativa: null, motivoDescarte: null, idConsulta: null, idTituloPagar: null,
        ajusteSituacao: null, conferenciaManual: null, idUsuario: sessao.idUsuario, ...dados,
      });
      auditar({ acao: 'CRIAR', sessao, rota, registroAlvo: `movimentacoes/${m.id}`, resultado: 'PERMITIDO', motivo: m.origem });
      return m;
    }
    // RN-38.2: o alerta é recalculado a cada movimentação.
    function concluir(status, m, lote) {
      atualizarSaldo(db, lote);
      ctx.recalcularAlertas();
      salvar();
      const regra = regraPara('movimentacoes', sessao.papel);
      return enviar(res, status, {
        movimentacao: regra ? projetar(regra, m, ctx) : { id: m.id },
        lote: { id: lote.id, numero: lote.numero, validade: lote.validade, quantidade: lote.quantidade },
      });
    }

    // Entrada: produto, lote, validade, quantidade e origem. Sendo compra, o
    // Administrador pode vincular o título a pagar (RF50).
    if (partes[1] === 'entradas' && partes.length === 2) {
      exigirPapel(ADMINISTRADOR, SECRETARIA);
      const corpo = await lerCorpo(req);
      const produto = ctx.buscar('produtos', corpo.idProduto);
      if (!produto) throw new ErroHttp(422, 'Escolha o produto.');
      if (produto.situacao !== 'ATIVO') throw new ErroHttp(409, 'Produto inativo. Reative o produto para registrar a entrada.');
      const quantidade = quantidadeDe(corpo.quantidade);
      if (!ORIGENS_DE_ENTRADA.includes(corpo.origem)) throw new ErroHttp(422, 'Escolha a origem.');
      let idTituloPagar = null;
      // A Secretária não vê títulos a pagar (RC06); o campo dela é ignorado.
      if (sessao.papel === ADMINISTRADOR && corpo.idTituloPagar != null && corpo.idTituloPagar !== '') {
        if (corpo.origem !== 'COMPRA') throw new ErroHttp(422, 'Só a compra se vincula a um título a pagar.');
        const titulo = ctx.buscar('titulosPagar', corpo.idTituloPagar);
        if (!titulo) throw new ErroHttp(422, 'Título a pagar não encontrado.');
        idTituloPagar = titulo.id;
      }
      let lote;
      if (produto.controlaLote || TIPOS_COM_LOTE.includes(produto.tipo)) {
        // RN-36.1: lote e validade obrigatórios.
        const numero = textoLimpo(corpo.numeroLote);
        if (!numero) throw new ErroHttp(422, 'Informe o número do lote.');
        if (numero.length > 30) throw new ErroHttp(422, 'O número do lote tem até 30 caracteres.');
        if (!ehDataValida(corpo.validade)) throw new ErroHttp(422, 'Informe a validade do lote.');
        if (corpo.validade < hoje) throw new ErroHttp(422, 'A validade já passou: lote vencido não entra no estoque.');
        lote = db.lotes.find((l) => igual(l.idProduto, produto.id) && (l.numero ?? '').toUpperCase() === numero.toUpperCase());
        if (lote && lote.validade !== corpo.validade) {
          throw new ErroHttp(422, `O lote ${lote.numero} já está cadastrado com validade ${dataBr(lote.validade)}. Confira o número ou a validade.`);
        }
        lote ??= ctx.inserir('lotes', { numero, validade: corpo.validade, quantidade: 0, idProduto: produto.id });
      } else {
        // Produto sem controle de lote: um só lote, sem número nem validade.
        lote =
          db.lotes.find((l) => igual(l.idProduto, produto.id) && l.numero == null) ??
          ctx.inserir('lotes', { numero: null, validade: null, quantidade: 0, idProduto: produto.id });
      }
      return concluir(201, gravar({ tipo: 'ENTRADA', quantidade, origem: corpo.origem, idLote: lote.id, idTituloPagar }), lote);
    }

    // Saída: para o paciente atendido hoje (dispensação) ou descarte.
    if (partes[1] === 'saidas' && partes.length === 2) {
      exigirPapel(SECRETARIA, MEDICO);
      const corpo = await lerCorpo(req);
      const lote = loteDe(corpo.idLote);
      const produto = ctx.buscar('produtos', lote.idProduto);
      if (!produto || produto.situacao !== 'ATIVO') throw new ErroHttp(409, 'Produto inativo. Reative o produto para registrar a saída.');
      const quantidade = quantidadeDe(corpo.quantidade);
      if (quantidade > lote.quantidade) throw new ErroHttp(422, `O ${nomeDoLote(lote)} tem só ${lote.quantidade} em estoque.`);
      if (!DESTINOS_DE_SAIDA.includes(corpo.destino)) throw new ErroHttp(422, 'Escolha o destino: paciente ou descarte.');
      // RN-37.3: item de controle especial só sai depois da conferência manual.
      if (produto.controleEspecial && corpo.conferenciaManual !== true) {
        throw new ErroHttp(422, 'Item de controle especial: registre a conferência manual antes da saída.');
      }
      const justificativa = textoLimpo(corpo.justificativa);
      const dados = { tipo: 'SAIDA', quantidade, origem: corpo.destino, idLote: lote.id, conferenciaManual: produto.controleEspecial ? true : null };
      if (corpo.destino === 'DISPENSACAO') {
        // RN-38.1: lote vencido não sai para o paciente, e nenhum papel sobrepõe.
        if (vencido(lote, hoje)) throw new ErroHttp(409, `O ${nomeDoLote(lote)} venceu em ${dataBr(lote.validade)}: só sai por descarte.`);
        // O Médico entrega no próprio atendimento; a Secretária, a quem está na clínica hoje.
        const consulta = ctx.buscar('consultas', corpo.idConsulta);
        const statusAceitos = sessao.papel === MEDICO ? ['EM_ATENDIMENTO', 'FINALIZADO'] : STATUS_DE_ENTREGA;
        const aceita =
          consulta &&
          consulta.dataHora.slice(0, 10) === hoje &&
          statusAceitos.includes(consulta.status) &&
          (sessao.papel !== MEDICO || igual(consulta.idMedico, sessao.idPessoa));
        if (!aceita) throw new ErroHttp(422, 'Escolha o paciente entre os atendidos hoje.');
        // A sugestão é o lote que vence primeiro; trocar exige justificativa.
        const sugerido = lotesParaSaida(db, produto.id, hoje)[0];
        const trocou = sugerido && !igual(sugerido.id, lote.id);
        if (trocou && justificativa.length < 5) {
          throw new ErroHttp(422, `O ${nomeDoLote(sugerido)} vence antes. Para usar outro lote, explique o motivo da troca.`);
        }
        Object.assign(dados, { idConsulta: consulta.id, justificativa: trocou ? justificativa : null });
      } else {
        if (!MOTIVOS_DE_DESCARTE.includes(corpo.motivoDescarte)) throw new ErroHttp(422, 'Escolha o motivo do descarte.');
        if (corpo.motivoDescarte === 'VENCIMENTO' && !vencido(lote, hoje)) {
          throw new ErroHttp(422, `O ${nomeDoLote(lote)} ainda está na validade. Escolha outro motivo.`);
        }
        if (corpo.motivoDescarte === 'OUTRO' && justificativa.length < 5) throw new ErroHttp(422, 'Descreva o motivo do descarte.');
        Object.assign(dados, { motivoDescarte: corpo.motivoDescarte, justificativa: justificativa || null });
      }
      return concluir(201, gravar(dados), lote);
    }

    // Ajuste de inventário: a diferença entre a contagem e o saldo, com motivo.
    if (partes[1] === 'ajustes' && partes.length === 2) {
      exigirPapel(ADMINISTRADOR, SECRETARIA);
      const corpo = await lerCorpo(req);
      const lote = loteDe(corpo.idLote);
      const contada = Number(corpo.quantidadeContada);
      if (!(Number.isInteger(contada) && contada >= 0)) throw new ErroHttp(422, 'Informe a quantidade contada, um número inteiro.');
      const diferenca = contada - lote.quantidade;
      if (diferenca === 0) throw new ErroHttp(422, 'A contagem bate com o saldo: não há o que ajustar.');
      const justificativa = textoLimpo(corpo.justificativa);
      if (justificativa.length < 5) throw new ErroHttp(422, 'Informe o motivo do ajuste.');
      if (db.movimentacoes.some((m) => igual(m.idLote, lote.id) && m.tipo === 'AJUSTE' && m.ajusteSituacao === 'A_APROVAR')) {
        throw new ErroHttp(409, 'Já há um pedido de ajuste deste lote esperando o Administrador.');
      }
      const doAdministrador = sessao.papel === ADMINISTRADOR;
      const m = gravar({
        tipo: 'AJUSTE', origem: 'AJUSTE_INVENTARIO', quantidade: diferenca, idLote: lote.id, justificativa,
        saldoNaContagem: lote.quantidade, quantidadeContada: contada,
        ajusteSituacao: doAdministrador ? 'APROVADO' : 'A_APROVAR',
        idAprovador: doAdministrador ? sessao.idUsuario : null,
        dataDecisao: doAdministrador ? agoraClinica() : null,
        motivoRecusa: null,
      });
      return concluir(201, m, lote);
    }

    // Decisão do Administrador sobre o pedido de ajuste da Secretária.
    if (partes[1] === 'ajustes' && partes.length === 4 && ['aprovar', 'recusar'].includes(partes[3])) {
      exigirPapel(ADMINISTRADOR);
      const corpo = await lerCorpo(req);
      const m = db.movimentacoes.find((x) => igual(x.id, partes[2]) && x.tipo === 'AJUSTE');
      if (!m) throw NAO_ENCONTRADO();
      if (m.ajusteSituacao !== 'A_APROVAR') throw new ErroHttp(409, 'Este pedido já foi decidido.');
      const lote = loteDe(m.idLote);
      if (partes[3] === 'aprovar') {
        if (lote.quantidade + m.quantidade < 0) {
          throw new ErroHttp(409, `O ajuste deixaria o lote com saldo negativo: hoje o saldo é ${lote.quantidade}. Recuse e peça uma nova contagem.`);
        }
        m.ajusteSituacao = 'APROVADO';
      } else {
        const motivo = textoLimpo(corpo.motivo);
        if (motivo.length < 5) throw new ErroHttp(422, 'Informe o motivo da recusa.');
        m.ajusteSituacao = 'RECUSADO';
        m.motivoRecusa = motivo;
      }
      m.idAprovador = sessao.idUsuario;
      m.dataDecisao = agoraClinica();
      auditar({ acao: 'EDITAR', sessao, rota, registroAlvo: `movimentacoes/${m.id}`, resultado: 'PERMITIDO', motivo: m.ajusteSituacao });
      return concluir(200, m, lote);
    }

    throw NAO_ENCONTRADO();
  }

  // RN-38.2: além de a cada movimentação, os alertas são revistos uma vez por
  // dia da clínica, no primeiro pedido do dia (o ator Sistema da especificação).
  let ultimaRevisaoDoEstoque = null;
  function revisarEstoqueDoDia() {
    const hoje = hojeClinica();
    if (ultimaRevisaoDoEstoque === hoje) return;
    ultimaRevisaoDoEstoque = hoje;
    if (recalcularAlertas(db, { hoje, antecedencia: parametro('X14', 60), inserir })) salvar();
  }

  // Cancelamento e estorno (RF48). A Secretária localiza o pagamento, vê o que
  // o meio permite e pede, com motivo; o Administrador aprova ou recusa: nenhum
  // estorno acontece com um só par de olhos. Aprovado, o pedido é o lançamento
  // de sinal oposto (o pagamento original não muda), o título reabre e o
  // recibo e a NFS-e são cancelados. Chargeback a clínica só registra.
  async function rotaDeEstorno(req, res, { partes, sessao, rota }) {
    const ctx = contexto(sessao, rota);
    const exigirPapel = (...papeis) => {
      if (papeis.includes(sessao.papel)) return;
      auditar({ acao: ACOES[req.method] ?? req.method, sessao, rota, registroAlvo: partes.join('/'), resultado: 'NEGADO', motivo: 'PAPEL' });
      throw ACESSO_NEGADO();
    };
    const hoje = hojeClinica();
    const avaliar = (pagamento, ignorar = null) => avaliarReversao(db, pagamento, { hoje, prazoCredito: parametro('X34', 30), ignorar });
    const emReais = (valor) => Math.round(Number(valor) * 100) / 100;
    const brl = (valor) => `R$ ${Number(valor).toFixed(2).replace('.', ',')}`;
    const registrar = (estorno, acao) => {
      auditar({ acao, sessao, rota, registroAlvo: `estornos/${estorno.id}`, resultado: 'PERMITIDO', motivo: estorno.situacao });
      salvar();
    };

    if (req.method === 'GET' && partes[2] === 'avaliar' && partes.length === 4) {
      exigirPapel(SECRETARIA, ADMINISTRADOR);
      const pagamento = ctx.buscar('pagamentos', partes[3]);
      if (!pagamento) throw NAO_ENCONTRADO();
      return enviar(res, 200, avaliar(pagamento));
    }
    if (req.method !== 'POST') throw NAO_ENCONTRADO();
    const corpo = await lerCorpo(req);

    // Pedido da Secretária, ou registro de chargeback.
    if (partes.length === 2) {
      exigirPapel(SECRETARIA);
      const pagamento = ctx.buscar('pagamentos', corpo.idPagamento);
      if (!pagamento) throw new ErroHttp(422, 'Escolha o pagamento.');
      const motivo = textoLimpo(corpo.motivo);
      if (motivo.length < 5) throw new ErroHttp(422, 'Informe o motivo.');
      const valor = emReais(corpo.valor);
      const titulo = db.titulosReceber.find((t) => igual(t.idCobranca, pagamento.idCobranca));
      const pedido = {
        valor, motivo, idPagamento: pagamento.id, idTituloReceber: titulo?.id ?? null, idSolicitante: sessao.idUsuario,
        dataPedido: agoraClinica(), dataHora: null, protocolo: null, forma: null, meioDevolucao: null,
        idAprovador: null, dataDecisao: null, motivoRecusa: null,
      };
      if (corpo.chargeback === true) {
        // RN-48.3: a contestação parte do portador; a clínica não a controla.
        if (pagamento.meio !== 'CARTAO' || pagamento.situacao !== 'CONFIRMADO') throw new ErroHttp(422, 'Chargeback só existe em pagamento confirmado com cartão.');
        if (!(valor > 0) || centavos(valor) > centavos(pagamento.valor)) throw new ErroHttp(422, `Informe o valor contestado, até ${brl(pagamento.valor)}.`);
        const estorno = ctx.inserir('estornos', { ...pedido, tipo: 'CHARGEBACK', situacao: 'REGISTRADO' });
        registrar(estorno, 'CRIAR');
        return enviar(res, 201, estorno);
      }
      const avaliacao = avaliar(pagamento);
      if (!avaliacao.possivel) throw new ErroHttp(409, avaliacao.orientacao);
      if (avaliacao.pedidoAberto) throw new ErroHttp(409, 'Já há um pedido deste pagamento esperando o Administrador.');
      if (!(valor > 0)) throw new ErroHttp(422, 'Informe o valor a devolver.');
      if (centavos(valor) > centavos(avaliacao.disponivel)) throw new ErroHttp(422, `O valor passa do que ainda pode ser devolvido (${brl(avaliacao.disponivel)}).`);
      // RN-48.2: parcial no crédito e no Pix; no débito, só o total.
      if (!avaliacao.parcial && centavos(valor) !== centavos(avaliacao.disponivel)) throw new ErroHttp(422, 'Neste meio a devolução é só pelo valor total.');
      if (avaliacao.exigeMeio && !MEIOS_DE_DEVOLUCAO.includes(corpo.meioDevolucao)) throw new ErroHttp(422, 'Escolha como devolver: Pix ou dinheiro.');
      const estorno = ctx.inserir('estornos', {
        ...pedido, tipo: avaliacao.tipo, situacao: 'A_APROVAR', forma: avaliacao.forma,
        meioDevolucao: avaliacao.exigeMeio ? corpo.meioDevolucao : null,
      });
      registrar(estorno, 'CRIAR');
      return enviar(res, 201, estorno);
    }

    // Decisão do Administrador.
    if (partes.length === 4 && ['aprovar', 'recusar'].includes(partes[3])) {
      exigirPapel(ADMINISTRADOR);
      const estorno = ctx.buscar('estornos', partes[2]);
      if (!estorno) throw NAO_ENCONTRADO();
      if (estorno.situacao !== 'A_APROVAR') throw new ErroHttp(409, 'Este pedido já foi decidido.');
      const agora = agoraClinica();
      if (partes[3] === 'recusar') {
        const motivo = textoLimpo(corpo.motivo);
        if (motivo.length < 5) throw new ErroHttp(422, 'Informe o motivo da recusa.');
        Object.assign(estorno, { situacao: 'RECUSADO', motivoRecusa: motivo, idAprovador: sessao.idUsuario, dataDecisao: agora });
        registrar(estorno, 'EDITAR');
        return enviar(res, 200, estorno);
      }
      const pagamento = ctx.buscar('pagamentos', estorno.idPagamento);
      // O prazo do meio pode ter passado desde o pedido: a forma precisa valer hoje.
      const avaliacao = avaliar(pagamento, estorno.id);
      if (!avaliacao.possivel || avaliacao.forma !== estorno.forma) {
        throw new ErroHttp(409, `O que o meio permite mudou desde o pedido: ${avaliacao.orientacao} Recuse este pedido e peça um novo.`);
      }
      // A devolução em dinheiro sai de um caixa aberto: o do recebimento ou o de quem pediu.
      let caixa = null;
      if (pagamento.meio === 'DINHEIRO' || estorno.meioDevolucao === 'DINHEIRO') {
        const original = db.caixas.find((c) => igual(c.id, db.pagamentosDinheiro.find((d) => igual(d.id, pagamento.id))?.idCaixa));
        const solicitante = db.usuarios.find((u) => igual(u.id, estorno.idSolicitante));
        caixa = original?.situacao === 'ABERTO' ? original : db.caixas.find((c) => c.situacao === 'ABERTO' && igual(c.idSecretaria, solicitante?.idPessoa));
        if (!caixa) throw new ErroHttp(409, 'A devolução em dinheiro sai de um caixa aberto. Peça a quem fez o pedido que abra o caixa e aprove de novo.');
      }
      Object.assign(estorno, {
        situacao: estorno.tipo === 'CANCELAMENTO' ? 'CANCELADO' : 'ESTORNADO',
        dataHora: agora, protocolo: `EST-${String(estorno.id).padStart(6, '0')}`, idAprovador: sessao.idUsuario, dataDecisao: agora,
      });
      if (caixa) {
        ctx.inserir('movimentosCaixa', {
          tipo: 'DEVOLUCAO', valor: estorno.valor, motivo: `Devolução ${estorno.protocolo}`, dataHora: agora, idUsuario: sessao.idUsuario,
          idCaixa: caixa.id, idEstorno: estorno.id,
        });
      }
      // RF48, passo 5: título reaberto (RF32), recibo (RF33) e NFS-e (RF34) cancelados.
      const cobranca = ctx.buscar('cobrancas', pagamento.idCobranca);
      if (cobranca && resumoDaCobranca(db, cobranca).saldo > 0) {
        cobranca.situacao = 'ABERTA';
        for (const t of db.titulosReceber.filter((x) => igual(x.idCobranca, cobranca.id) && x.situacao === 'PAGO')) t.situacao = 'ABERTO';
      }
      const titulos = db.titulosReceber.filter((t) => igual(t.idCobranca, pagamento.idCobranca));
      for (const d of db.documentosFiscais.filter((x) => x.situacao === 'EMITIDO' && titulos.some((t) => igual(t.id, x.idTituloReceber)))) {
        d.situacao = 'CANCELADO';
      }
      registrar(estorno, 'EDITAR');
      return enviar(res, 200, estorno);
    }

    throw NAO_ENCONTRADO();
  }

  // Recibo (RF33) e NFS-e (RF34). Só de título pago; o servidor numera, monta
  // e guarda o documento. A NFS-e vai a um ambiente nacional simulado, que
  // rejeita tomador sem CPF; a rejeição fica pendente, com o código e a
  // descrição à vista do Administrador, e pode ser reenviada.
  async function rotaDeDocumentoFiscal(req, res, { partes, sessao, rota }) {
    const ctx = contexto(sessao, rota);
    const exigirPapel = (...papeis) => {
      if (papeis.includes(sessao.papel)) return;
      auditar({ acao: ACOES[req.method] ?? req.method, sessao, rota, registroAlvo: partes.join('/'), resultado: 'NEGADO', motivo: 'PAPEL' });
      throw ACESSO_NEGADO();
    };
    const hoje = hojeClinica();
    const responder = (status, doc, acao) => {
      auditar({ acao, sessao, rota, registroAlvo: `documentosFiscais/${doc.id}`, resultado: 'PERMITIDO', motivo: doc.tipo });
      if (acao !== 'LER') salvar();
      return enviar(res, status, montarDocumentoFiscal(db, doc));
    };

    // O documento, para quem o lê pela coleção (o titular, só o próprio).
    if (req.method === 'GET' && partes.length === 3) {
      const regra = regraPara('documentosFiscais', sessao.papel);
      const doc = ctx.buscar('documentosFiscais', partes[2]);
      if (!regra || !doc || !regra.ler(doc, ctx)) {
        auditar({ acao: 'LER', sessao, rota, registroAlvo: `documentosFiscais/${partes[2]}`, resultado: 'NEGADO', motivo: 'FORA_DO_ALCANCE' });
        throw NAO_ENCONTRADO();
      }
      return responder(200, doc, 'LER');
    }
    if (req.method !== 'POST') throw NAO_ENCONTRADO();
    const corpo = await lerCorpo(req);

    const tituloPago = (id) => {
      const titulo = ctx.buscar('titulosReceber', id);
      if (!titulo || titulo.idCobranca == null) throw new ErroHttp(422, 'Escolha um título de paciente.');
      if (titulo.situacao !== 'PAGO') throw new ErroHttp(409, 'O documento só sai depois do pagamento do título.');
      return titulo;
    };
    const existente = (titulo, tipo) =>
      db.documentosFiscais.find((d) => igual(d.idTituloReceber, titulo.id) && d.tipo === tipo && ['EMITIDO', 'PENDENTE'].includes(d.situacao));
    const pagadorDe = (idPaciente) => {
      if (corpo.idPagador == null || corpo.idPagador === '') return idPaciente;
      if (!pagadoresPossiveis(db, idPaciente).includes(String(corpo.idPagador))) {
        throw new ErroHttp(422, 'O pagador é o paciente ou um responsável legal dele.');
      }
      return Number(corpo.idPagador);
    };
    // Ambiente nacional simulado: sem CPF do tomador, a nota é rejeitada.
    const transmitir = (doc) => {
      const tomador = db.pessoas.find((p) => igual(p.id, doc.idPagador));
      if (!tomador?.cpf) {
        doc.situacao = 'PENDENTE';
        doc.erro = { codigo: 'SIM-E01', descricao: 'Tomador sem CPF: o ambiente nacional rejeitou a nota. Complete o CPF no cadastro e reenvie.' };
        return;
      }
      doc.situacao = 'EMITIDO';
      doc.numero = proximoNumero(db, 'NFSE');
      doc.chaveAcesso = `SIM${doc.dataEmissao.replace(/-/g, '')}${doc.numero}`;
      doc.erro = null;
    };

    if (partes[2] === 'recibo' && partes.length === 3) {
      exigirPapel(SECRETARIA, ADMINISTRADOR);
      const titulo = tituloPago(corpo.idTituloReceber);
      const ja = existente(titulo, 'RECIBO');
      if (ja) throw new ErroHttp(409, `Este título já tem o recibo nº ${ja.numero}.`);
      const { idPaciente } = origemDoTitulo(db, titulo);
      const doc = ctx.inserir('documentosFiscais', {
        tipo: 'RECIBO', numero: proximoNumero(db, 'RECIBO'), dataEmissao: hoje, valor: titulo.valor, ibs: null, cbs: null,
        situacao: 'EMITIDO', idTituloReceber: titulo.id, idPaciente, idPagador: pagadorDe(idPaciente), chaveAcesso: null, erro: null,
      });
      return responder(201, doc, 'CRIAR');
    }

    if (partes[2] === 'nfse' && partes.length === 3) {
      exigirPapel(ADMINISTRADOR);
      const titulo = tituloPago(corpo.idTituloReceber);
      const ja = existente(titulo, 'NFSE');
      if (ja) throw new ErroHttp(409, ja.situacao === 'PENDENTE' ? 'Já há uma NFS-e pendente deste título: corrija e reenvie.' : `Este título já tem a NFS-e nº ${ja.numero}.`);
      // RN-34.2: as alíquotas vêm da tabela vigente, nunca do operador.
      const aliquotas = aliquotasEm(hoje);
      if (!aliquotas) throw new ErroHttp(409, 'Não há alíquotas de IBS e CBS vigentes na tabela.');
      const { idPaciente } = origemDoTitulo(db, titulo);
      const doc = ctx.inserir('documentosFiscais', {
        tipo: 'NFSE', numero: null, dataEmissao: hoje, valor: titulo.valor,
        ibs: imposto(titulo.valor, aliquotas.ibs), cbs: imposto(titulo.valor, aliquotas.cbs),
        situacao: 'PENDENTE', idTituloReceber: titulo.id, idPaciente, idPagador: pagadorDe(idPaciente), chaveAcesso: null, erro: null,
      });
      transmitir(doc);
      return responder(201, doc, 'CRIAR');
    }

    if (partes.length === 4 && partes[3] === 'reenviar') {
      exigirPapel(ADMINISTRADOR);
      const doc = ctx.buscar('documentosFiscais', partes[2]);
      if (!doc || doc.tipo !== 'NFSE') throw NAO_ENCONTRADO();
      if (doc.situacao !== 'PENDENTE') throw new ErroHttp(409, 'Só a NFS-e pendente é reenviada.');
      transmitir(doc);
      return responder(200, doc, 'EDITAR');
    }

    throw NAO_ENCONTRADO();
  }

  // Anexos de exame (RF26, RF27). O envio confere o tipo real, o tamanho (X13)
  // e a varredura, e guarda o arquivo fora do banco, com chave imprevisível.
  // O conteúdo só sai para o Médico com o paciente no alcance e para o
  // titular; a Secretária nunca o abre, nem o que ela mesma enviou (RN-26.1).
  async function rotaDeAnexo(req, res, { partes, sessao, rota }) {
    const ctx = contexto(sessao, rota);
    const negar = (motivo, alvo = partes.join('/')) => {
      auditar({ acao: ACOES[req.method] ?? req.method, sessao, rota, registroAlvo: alvo, resultado: 'NEGADO', motivo });
      throw ACESSO_NEGADO();
    };
    const limiteMb = parametro('X13', 5);

    if (req.method === 'POST' && partes[1] === 'envio' && partes.length === 2) {
      if (![SECRETARIA, MEDICO, PACIENTE, RESPONSAVEL_LEGAL].includes(sessao.papel)) negar('PAPEL');
      // E2: recusa antes de receber tudo, pelo tamanho anunciado.
      const limiteBytes = limiteMb * 1024 * 1024;
      const limiteCorpo = Math.ceil(limiteBytes * 1.4) + 64 * 1024;
      if (Number(req.headers['content-length']) > limiteCorpo) throw new ErroHttp(413, `O arquivo passa de ${limiteMb} MB.`);
      const corpo = await lerCorpo(req, limiteCorpo);
      const doPortal = [PACIENTE, RESPONSAVEL_LEGAL].includes(sessao.papel);
      const idPaciente = doPortal ? ctx.titular() : Number(corpo.idPaciente);
      if (idPaciente == null || !ctx.buscar('pacientes', idPaciente)) throw new ErroHttp(422, 'Escolha o paciente.');
      if (sessao.papel === MEDICO && !ctx.alcance().has(String(idPaciente))) negar('FORA_DO_ALCANCE', `pacientes/${idPaciente}`);
      const nomeArquivo = nomeSeguro(corpo.nomeArquivo);
      const conteudo = typeof corpo.conteudo === 'string' ? Buffer.from(corpo.conteudo, 'base64') : Buffer.alloc(0);
      if (conteudo.length === 0) throw new ErroHttp(422, 'Escolha o arquivo.');
      if (conteudo.length > limiteBytes) throw new ErroHttp(413, `O arquivo passa de ${limiteMb} MB.`);
      // E1: o tipo vale pelo conteúdo; a tentativa com tipo trocado vai ao log.
      const tipoReal = detectarTipo(conteudo);
      if (!tipoReal || tipoPelaExtensao(nomeArquivo) !== tipoReal) {
        auditar({ acao: 'CRIAR', sessao, rota, registroAlvo: `pacientes/${idPaciente}`, resultado: 'NEGADO', motivo: 'TIPO_DO_ARQUIVO' });
        throw new ErroHttp(422, tipoReal ? 'A extensão não confere com o conteúdo do arquivo.' : 'Envie um PDF, JPG ou PNG.');
      }
      // E3: a varredura reprovou: o arquivo é descartado e o evento, registrado.
      if (reprovadoNaVarredura(conteudo)) {
        auditar({ acao: 'CRIAR', sessao, rota, registroAlvo: `pacientes/${idPaciente}`, resultado: 'NEGADO', motivo: 'VARREDURA_REPROVOU' });
        throw new ErroHttp(422, 'A varredura antivírus reprovou o arquivo, que foi descartado.');
      }
      const prontuario = db.prontuarios.find((p) => igual(p.idPaciente, idPaciente));
      const anexo = ctx.inserir('anexos', {
        nomeArquivo, tipoMime: tipoReal, tamanho: conteudo.length, dataEnvio: agoraClinica(), statusVarredura: 'LIMPO',
        enviadoPor: sessao.papel, situacao: doPortal ? 'A_ACEITAR' : 'DISPONIVEL', motivoRecusa: null,
        idPaciente, idProntuario: prontuario?.id ?? null,
      });
      const chave = crypto.randomUUID();
      guardarArquivo(chave, conteudo);
      db.arquivosDeAnexo = { ...(db.arquivosDeAnexo ?? {}), [anexo.id]: chave };
      auditar({ acao: 'CRIAR', sessao, rota, registroAlvo: `anexos/${anexo.id}`, resultado: 'PERMITIDO' });
      salvar();
      // RF26: quem enviou recebe só os metadados.
      return enviar(res, 201, projetar(regraPara('anexos', sessao.papel), anexo, ctx));
    }

    if (req.method === 'GET' && partes[2] === 'arquivo' && partes.length === 3) {
      const anexo = ctx.buscar('anexos', partes[1]);
      const alvo = `anexos/${partes[1]}`;
      if (![MEDICO, PACIENTE, RESPONSAVEL_LEGAL].includes(sessao.papel)) negar('PAPEL', alvo);
      const regra = regraPara('anexos', sessao.papel);
      if (!anexo || !regra?.ler(anexo, ctx)) {
        auditar({ acao: 'LER', sessao, rota, registroAlvo: alvo, resultado: 'NEGADO', motivo: 'FORA_DO_ALCANCE' });
        throw NAO_ENCONTRADO();
      }
      if (anexo.statusVarredura !== 'LIMPO') throw new ErroHttp(409, 'O arquivo ainda não passou pela varredura.');
      const chave = db.arquivosDeAnexo?.[anexo.id];
      const conteudo = (chave && lerArquivo(chave)) || arquivoDeDemonstracao(anexo);
      const baixar = new URL(req.url, 'http://localhost').searchParams.has('baixar');
      // RF27: cada visualização e cada download vão ao log.
      auditar({ acao: baixar ? 'BAIXAR' : 'LER', sessao, rota, registroAlvo: alvo, resultado: 'PERMITIDO' });
      res.writeHead(200, {
        'Content-Type': detectarTipo(conteudo) ?? anexo.tipoMime,
        'Content-Length': conteudo.length,
        'Content-Disposition': `${baixar ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(anexo.nomeArquivo)}`,
      });
      return res.end(conteudo);
    }

    throw NAO_ENCONTRADO();
  }

  // RF59: a recepção reenvia a notificação que falhou, ou registra que avisou
  // por telefone; o titular escolhe os avisos que não são obrigatórios.
  async function rotaDeNotificacao(req, res, { partes, sessao, rota }) {
    const ctx = contexto(sessao, rota);
    const exigirPapel = (...papeis) => {
      if (papeis.includes(sessao.papel)) return;
      auditar({ acao: ACOES[req.method] ?? req.method, sessao, rota, registroAlvo: partes.join('/'), resultado: 'NEGADO', motivo: 'PAPEL' });
      throw ACESSO_NEGADO();
    };

    // Preferência de aviso do titular (RF39, RN-59.2): lembretes e avisos de
    // cobrança podem ser desligados; o aviso de cancelamento pela clínica não.
    if (partes[0] === 'portal' && partes[1] === 'preferencias' && partes.length === 2) {
      exigirPapel(PACIENTE, RESPONSAVEL_LEGAL);
      const paciente = ctx.buscar('pacientes', ctx.titular());
      if (!paciente) throw new ErroHttp(409, 'Escolha o representado.');
      if (req.method === 'PUT') {
        const corpo = await lerCorpo(req);
        if (typeof corpo.lembretes !== 'boolean' || typeof corpo.cobrancas !== 'boolean') throw new ErroHttp(422, 'Informe as duas preferências.');
        paciente.preferenciasAviso = { lembretes: corpo.lembretes, cobrancas: corpo.cobrancas };
        auditar({ acao: 'EDITAR', sessao, rota, registroAlvo: `pacientes/${paciente.id}`, resultado: 'PERMITIDO', motivo: 'PREFERENCIA_DE_AVISO' });
        salvar();
      } else if (req.method !== 'GET') throw NAO_ENCONTRADO();
      return enviar(res, 200, { lembretes: true, cobrancas: true, ...(paciente.preferenciasAviso ?? {}) });
    }

    if (req.method !== 'POST' || partes.length !== 3) throw NAO_ENCONTRADO();
    exigirPapel(SECRETARIA, ADMINISTRADOR);
    const notificacao = ctx.buscar('notificacoes', partes[1]);
    if (!notificacao) throw NAO_ENCONTRADO();
    if (!['FALHA', 'FALHOU'].includes(notificacao.situacao)) throw new ErroHttp(409, 'Só a notificação que falhou é tratada aqui.');
    const tratamento = { idUsuario: sessao.idUsuario, dataHora: agoraClinica() };
    if (partes[2] === 'reenviar') {
      if (!notificacao.destino) throw new ErroHttp(409, 'Sem telefone ou e-mail cadastrado: avise o paciente por telefone e registre o aviso.');
      // Provedor simulado: o reenvio entrega.
      Object.assign(notificacao, { situacao: 'ENVIADA', tentativas: (notificacao.tentativas ?? 0) + 1, dataEnvio: tratamento.dataHora, reenvio: tratamento });
    } else if (partes[2] === 'aviso-por-telefone') {
      Object.assign(notificacao, { situacao: 'AVISADO_POR_TELEFONE', reenvio: tratamento });
    } else {
      throw NAO_ENCONTRADO();
    }
    auditar({ acao: 'EDITAR', sessao, rota, registroAlvo: `notificacoes/${notificacao.id}`, resultado: 'PERMITIDO', motivo: partes[2] === 'reenviar' ? 'REENVIO' : 'AVISO_POR_TELEFONE' });
    salvar();
    return enviar(res, 200, notificacao);
  }

  // RF55: a recepção monta o lote com guias liberadas de uma operadora e o
  // envia; a operadora simulada devolve o protocolo na hora. Cada guia do
  // lote vira um título a receber da operadora (RF32).
  // RF49: conciliação de recebíveis de cartão, só do Administrador. O extrato
  // vem da adquirente simulada: o crédito confere com o líquido esperado, menos
  // nas transações de NSU múltiplo de 3, em que a adquirente credita R$ 1,50
  // a menos. A divergência é aceita (vale o extrato) ou contestada.
  async function rotaDeConciliacao(req, res, { partes, sessao, rota }) {
    if (sessao.papel !== ADMINISTRADOR) {
      auditar({ acao: 'EDITAR', sessao, rota, registroAlvo: partes.join('/'), resultado: 'NEGADO', motivo: 'PAPEL' });
      throw ACESSO_NEGADO();
    }
    if (req.method !== 'POST') throw NAO_ENCONTRADO();
    const confirmado = (c) => db.pagamentos.find((p) => igual(p.id, c.id))?.situacao === 'CONFIRMADO';

    if (partes.length === 3 && partes[2] === 'extrato') {
      const corpo = await lerCorpo(req);
      const pendentes = db.pagamentosCartao.filter((c) => c.situacaoConciliacao === 'PENDENTE' && confirmado(c) && (!corpo.adquirente || c.adquirente === corpo.adquirente));
      let conciliadas = 0;
      let divergentes = 0;
      for (const c of pendentes) {
        const valorExtrato = Number(c.nsu) % 3 === 0 ? reais(centavos(c.valorLiquido) - 150) : c.valorLiquido;
        c.valorExtrato = valorExtrato;
        c.extratoImportadoEm = agoraClinica();
        if (centavos(valorExtrato) === centavos(c.valorLiquido)) {
          c.situacaoConciliacao = 'CONCILIADO';
          conciliadas += 1;
        } else {
          c.situacaoConciliacao = 'DIVERGENTE';
          divergentes += 1;
        }
      }
      auditar({ acao: 'EDITAR', sessao, rota, registroAlvo: 'pagamentosCartao', resultado: 'PERMITIDO', motivo: 'EXTRATO' });
      salvar();
      return enviar(res, 200, { lidas: pendentes.length, conciliadas, divergentes });
    }

    if (partes.length === 4 && partes[3] === 'tratar') {
      const cartao = db.pagamentosCartao.find((c) => igual(c.id, partes[2]));
      if (!cartao) throw NAO_ENCONTRADO();
      if (cartao.situacaoConciliacao !== 'DIVERGENTE') throw new ErroHttp(409, 'Esta transação não está divergente.');
      const corpo = await lerCorpo(req);
      if (!['ACEITAR', 'CONTESTAR'].includes(corpo.decisao)) throw new ErroHttp(422, 'Escolha aceitar o extrato ou contestar.');
      const observacao = typeof corpo.observacao === 'string' ? corpo.observacao.trim() : '';
      if (observacao.length < 5) throw new ErroHttp(422, 'Escreva a observação do tratamento.');
      cartao.tratamento = { decisao: corpo.decisao, observacao, dataHora: agoraClinica(), idUsuario: sessao.idUsuario, liquidoAnterior: cartao.valorLiquido };
      if (corpo.decisao === 'ACEITAR') {
        if (cartao.valorExtrato != null) cartao.valorLiquido = cartao.valorExtrato;
        cartao.situacaoConciliacao = 'CONCILIADO';
      } else {
        cartao.situacaoConciliacao = 'CONTESTADO';
      }
      auditar({ acao: 'EDITAR', sessao, rota, registroAlvo: `pagamentosCartao/${cartao.id}`, resultado: 'PERMITIDO', motivo: corpo.decisao });
      salvar();
      return enviar(res, 200, cartao);
    }

    throw NAO_ENCONTRADO();
  }

  // RF56: o demonstrativo de retorno da operadora simulada para um lote
  // protocolado. A guia de número múltiplo de 4 volta glosada, com um motivo
  // da lista; as outras, pagas. Cada glosa nova pode ir a recurso (RF57).
  const MOTIVOS_DE_GLOSA = [
    'Carteirinha vencida na data do atendimento',
    'Procedimento sem autorização prévia',
    'Divergência no código do procedimento',
    'Guia sem assinatura do beneficiário',
  ];
  async function rotaDeDemonstrativo(req, res, { partes, sessao, rota }) {
    if (sessao.papel !== SECRETARIA) {
      auditar({ acao: 'CRIAR', sessao, rota, registroAlvo: partes.join('/'), resultado: 'NEGADO', motivo: 'PAPEL' });
      throw ACESSO_NEGADO();
    }
    if (req.method !== 'POST' || partes.length !== 2) throw NAO_ENCONTRADO();
    const corpo = await lerCorpo(req);
    const lote = db.lotesCobranca.find((l) => igual(l.id, corpo.idLoteCobranca));
    if (!lote) throw new ErroHttp(422, 'Escolha o lote.');
    if (lote.situacao !== 'PROTOCOLADO') throw new ErroHttp(409, 'O demonstrativo vem depois do protocolo do lote.');
    if (lote.demonstradoEm) throw new ErroHttp(409, 'O demonstrativo deste lote já foi importado.');
    const hoje = hojeClinica();
    let pagas = 0;
    let glosadas = 0;
    let maior = db.glosas.reduce((m, g) => Math.max(m, Number(String(g.codigo).replace(/\D/g, '')) || 0), 0);
    for (const guia of db.guiasTiss.filter((g) => igual(g.idLoteCobranca, lote.id) && g.situacao === 'ENVIADA')) {
      if (db.glosas.some((x) => igual(x.idGuiaTiss, guia.id))) continue;
      const numero = Number(String(guia.numero).replace(/\D/g, '')) || 0;
      if (numero % 4 === 0) {
        maior += 1;
        inserir('glosas', {
          codigo: `GT-${String(maior).padStart(4, '0')}`,
          motivo: MOTIVOS_DE_GLOSA[Math.floor(numero / 4) % MOTIVOS_DE_GLOSA.length],
          valorGlosado: guia.valor,
          dataDemonstrativo: hoje,
          idGuiaTiss: guia.id,
          situacao: 'GLOSADO',
        });
        guia.situacao = 'GLOSADA';
        glosadas += 1;
      } else {
        guia.situacao = 'PAGA';
        pagas += 1;
      }
    }
    lote.demonstradoEm = agoraClinica();
    auditar({ acao: 'CRIAR', sessao, rota, registroAlvo: `lotesCobranca/${lote.id}`, resultado: 'PERMITIDO', motivo: 'DEMONSTRATIVO' });
    salvar();
    return enviar(res, 200, { lote: lote.numero, pagas, glosadas });
  }

  // RF54: a Secretária gera a guia de um atendimento de convênio finalizado
  // (a guia nova depois de um cancelamento, por exemplo), revisa a crítica
  // prévia, atualiza os dados que o sistema preenche e libera para o lote.
  async function rotaDeGuia(req, res, { partes, sessao, rota }) {
    const ctx = contexto(sessao, rota);
    if (sessao.papel !== SECRETARIA) {
      auditar({ acao: 'EDITAR', sessao, rota, registroAlvo: partes.join('/'), resultado: 'NEGADO', motivo: 'PAPEL' });
      throw ACESSO_NEGADO();
    }
    const hoje = hojeClinica();
    const projetarGuia = (guia) => projetar(regraPara('guiasTiss', SECRETARIA), guia, ctx);
    const resposta = (guia) => {
      const consulta = ctx.buscar('consultas', guia.idConsulta);
      const procedimento = ctx.buscar('procedimentos', consulta?.idProcedimento);
      return {
        guia: projetarGuia(guia),
        bloqueios: criticaPrevia(db, guia, hoje),
        atendimento: {
          data: consulta?.dataHora ?? null,
          procedimento: procedimento ? `${procedimento.codigo} · ${procedimento.nome}` : null,
          exigeAutorizacao: Boolean(procedimento?.exigeAutorizacao),
          elegibilidade: ctx.buscar('elegibilidades', guia.idElegibilidade)?.situacao ?? null,
          autorizacao: ctx.buscar('autorizacoes', guia.idAutorizacao)?.situacao ?? null,
        },
      };
    };

    if (partes.length === 2 && req.method === 'POST') {
      const corpo = await lerCorpo(req);
      const consulta = ctx.buscar('consultas', corpo.idConsulta);
      if (!consulta || !consulta.idConvenio || consulta.status !== 'FINALIZADO') throw new ErroHttp(422, 'Escolha um atendimento de convênio finalizado.');
      if (guiaAtiva(db, consulta.id)) throw new ErroHttp(409, 'Este atendimento já tem guia. Para corrigir uma guia liberada, cancele-a antes.');
      const guia = gerarGuia(db, consulta, { inserir: ctx.inserir, hoje });
      auditar({ acao: 'CRIAR', sessao, rota, registroAlvo: `guiasTiss/${guia.id}`, resultado: 'PERMITIDO' });
      salvar();
      return enviar(res, 201, resposta(guia));
    }

    const guia = partes.length === 4 ? db.guiasTiss.find((g) => igual(g.id, partes[2])) : null;
    if (!guia) throw NAO_ENCONTRADO();
    if (partes[3] === 'critica' && req.method === 'GET') return enviar(res, 200, resposta(guia));
    if (req.method !== 'POST' || !['atualizar', 'liberar'].includes(partes[3])) throw NAO_ENCONTRADO();
    if (!EM_REVISAO.includes(guia.situacao)) throw new ErroHttp(409, 'Depois de liberada, a guia não muda: a correção é cancelar e gerar outra.');

    if (partes[3] === 'atualizar') {
      Object.assign(guia, dadosDaGuia(db, ctx.buscar('consultas', guia.idConsulta)));
      if (guia.situacao === 'BLOQUEADA' && criticaPrevia(db, guia, hoje).length === 0) guia.situacao = 'EM_DIGITACAO';
      auditar({ acao: 'EDITAR', sessao, rota, registroAlvo: `guiasTiss/${guia.id}`, resultado: 'PERMITIDO', motivo: 'ATUALIZAR' });
      salvar();
      return enviar(res, 200, resposta(guia));
    }

    const bloqueios = criticaPrevia(db, guia, hoje);
    if (bloqueios.length > 0) {
      guia.situacao = 'BLOQUEADA';
      auditar({ acao: 'EDITAR', sessao, rota, registroAlvo: `guiasTiss/${guia.id}`, resultado: 'NEGADO', motivo: 'CRITICA_PREVIA' });
      salvar();
      return enviar(res, 422, {
        erro: `A crítica prévia encontrou ${bloqueios.length === 1 ? 'um bloqueio' : `${bloqueios.length} bloqueios`}.`,
        bloqueios,
      });
    }
    guia.situacao = 'LIBERADA';
    auditar({ acao: 'EDITAR', sessao, rota, registroAlvo: `guiasTiss/${guia.id}`, resultado: 'PERMITIDO', motivo: 'LIBERAR' });
    salvar();
    return enviar(res, 200, resposta(guia));
  }

  async function rotaDeLote(req, res, { partes, sessao, rota }) {
    const ctx = contexto(sessao, rota);
    if (sessao.papel !== SECRETARIA) {
      auditar({ acao: 'CRIAR', sessao, rota, registroAlvo: partes.join('/'), resultado: 'NEGADO', motivo: 'PAPEL' });
      throw ACESSO_NEGADO();
    }
    if (req.method !== 'POST') throw NAO_ENCONTRADO();
    const convenioDaGuia = (g) => ctx.buscar('contratosOperadora', g.idContratoOperadora)?.idConvenio;
    const projetarLote = (lote) => projetar(regraPara('lotesCobranca', SECRETARIA), lote, ctx);

    if (partes.length === 2) {
      const corpo = await lerCorpo(req);
      const convenio = ctx.buscar('convenios', corpo.idConvenio);
      if (!convenio) throw new ErroHttp(422, 'Escolha a operadora.');
      const ids = Array.isArray(corpo.idsGuias) ? corpo.idsGuias : [];
      const guias = ids.map((id) => ctx.buscar('guiasTiss', id));
      if (guias.length === 0) throw new ErroHttp(422, 'Escolha ao menos uma guia.');
      if (guias.some((g) => !g || g.situacao !== 'LIBERADA' || g.idLoteCobranca != null || !igual(convenioDaGuia(g), convenio.id))) {
        throw new ErroHttp(422, 'Só entram no lote guias liberadas, fora de outro lote, desta operadora.');
      }
      const maior = db.lotesCobranca.reduce((m, l) => Math.max(m, Number(String(l.numero).replace(/\D/g, '')) || 0), 0);
      const lote = ctx.inserir('lotesCobranca', {
        numero: `LOTE-${String(maior + 1).padStart(4, '0')}`, dataEnvio: null, protocolo: null,
        valorApresentado: reais(guias.reduce((s, g) => s + centavos(g.valor), 0)), situacao: 'A_ENVIAR', idConvenio: convenio.id,
      });
      const vencimento = somarDias(hojeClinica(), 60);
      for (const g of guias) {
        g.idLoteCobranca = lote.id;
        ctx.inserir('titulosReceber', {
          origem: 'CONVENIO', vencimento, valor: g.valor, situacao: 'ABERTO', idCobranca: null, idLoteCobranca: lote.id, idCoparticipacao: null, idGuiaTiss: g.id,
        });
      }
      auditar({ acao: 'CRIAR', sessao, rota, registroAlvo: `lotesCobranca/${lote.id}`, resultado: 'PERMITIDO' });
      salvar();
      return enviar(res, 201, { ...projetarLote(lote), guias: guias.length });
    }

    if (partes.length === 4 && partes[3] === 'enviar') {
      const lote = ctx.buscar('lotesCobranca', partes[2]);
      if (!lote) throw NAO_ENCONTRADO();
      if (lote.situacao !== 'A_ENVIAR') throw new ErroHttp(409, 'Este lote já foi enviado.');
      Object.assign(lote, { situacao: 'PROTOCOLADO', dataEnvio: agoraClinica(), protocolo: `PROT-${String(Date.now()).slice(-8)}` });
      for (const g of db.guiasTiss.filter((x) => igual(x.idLoteCobranca, lote.id))) g.situacao = 'ENVIADA';
      auditar({ acao: 'EDITAR', sessao, rota, registroAlvo: `lotesCobranca/${lote.id}`, resultado: 'PERMITIDO', motivo: 'ENVIO' });
      salvar();
      return enviar(res, 200, projetarLote(lote));
    }

    throw NAO_ENCONTRADO();
  }

  // RF52: a recepção consulta a elegibilidade do beneficiário na operadora,
  // aqui simulada: carteirinha terminada em 9 está inativa; as demais valem
  // até o fim do ano seguinte. A resposta fica registrada na consulta.
  async function rotaDeElegibilidade(req, res, { partes, sessao, rota }) {
    const ctx = contexto(sessao, rota);
    if (sessao.papel !== SECRETARIA) {
      auditar({ acao: 'CRIAR', sessao, rota, registroAlvo: partes.join('/'), resultado: 'NEGADO', motivo: 'PAPEL' });
      throw ACESSO_NEGADO();
    }
    if (req.method !== 'POST' || partes.length !== 2) throw NAO_ENCONTRADO();
    const corpo = await lerCorpo(req);
    const consulta = ctx.buscar('consultas', corpo.idConsulta);
    if (!consulta || consulta.idConvenio == null) throw new ErroHttp(422, 'Escolha uma consulta por convênio.');
    // A carteirinha vem do agendamento ou da última consulta à operadora.
    const anterior = db.elegibilidades
      .filter((e) => igual(e.idPaciente, consulta.idPaciente) && igual(e.idConvenio, consulta.idConvenio))
      .sort((a, b) => b.id - a.id)[0];
    const carteirinha = String(consulta.numeroCarteirinha ?? anterior?.carteirinha ?? '').trim();
    if (!carteirinha) throw new ErroHttp(422, 'A consulta não tem o número da carteirinha.');
    const hoje = hojeClinica();
    const inativa = carteirinha.endsWith('9');
    const elegibilidade = ctx.inserir('elegibilidades', {
      dataConsulta: hoje,
      carteirinha,
      situacao: inativa ? 'NAO_ELEGIVEL' : 'ELEGIVEL',
      validade: inativa ? null : `${Number(hoje.slice(0, 4)) + 1}-12-31`,
      motivo: inativa ? 'Carteirinha inativa na operadora.' : null,
      protocolo: `ELG-${String(Date.now()).slice(-8)}`,
      idPaciente: consulta.idPaciente,
      idConvenio: consulta.idConvenio,
    });
    consulta.convenioConferido = !inativa;
    auditar({ acao: 'CRIAR', sessao, rota, registroAlvo: `elegibilidades/${elegibilidade.id}`, resultado: 'PERMITIDO', motivo: elegibilidade.situacao });
    salvar();
    return enviar(res, 201, elegibilidade);
  }

  // RF42: conteúdo do relatório, só do Administrador: a tabela para ver na
  // tela e o CSV para baixar. Cada leitura e cada download vão ao log.
  function rotaDeRelatorio(req, res, { partes, sessao, rota }) {
    const alvo = `relatorios/${partes[1]}`;
    if (sessao.papel !== ADMINISTRADOR) {
      auditar({ acao: 'LER', sessao, rota, registroAlvo: alvo, resultado: 'NEGADO', motivo: 'PAPEL' });
      throw ACESSO_NEGADO();
    }
    if (req.method !== 'GET') throw NAO_ENCONTRADO();
    const relatorio = db.relatorios.find((r) => igual(r.id, partes[1]));
    if (!relatorio) throw NAO_ENCONTRADO();
    if (relatorio.situacao !== 'PRONTO') throw new ErroHttp(409, 'O relatório ainda está sendo gerado.');
    const conteudo = montarRelatorio(db, relatorio);
    if (partes[2] === 'dados') {
      auditar({ acao: 'LER', sessao, rota, registroAlvo: alvo, resultado: 'PERMITIDO' });
      return enviar(res, 200, { ...conteudo, nome: relatorio.nome, periodoInicio: relatorio.periodoInicio, periodoFim: relatorio.periodoFim });
    }
    auditar({ acao: 'BAIXAR', sessao, rota, registroAlvo: alvo, resultado: 'PERMITIDO' });
    const nome = `${relatorio.nome}-${relatorio.periodoInicio}-a-${relatorio.periodoFim}.csv`;
    res.writeHead(200, {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nome)}`,
    });
    return res.end(paraCsv(conteudo));
  }

  // A-12 e A-29: painel financeiro (RF35) e dashboard gerencial (RF41), só
  // do Administrador (RC06, nível 3). O período do dashboard vem em ?de&ate;
  // sem ele, os últimos 30 dias até hoje.
  function rotaDeIndicadores(req, res, { url, partes, sessao, rota }) {
    if (sessao.papel !== ADMINISTRADOR) {
      auditar({ acao: 'LER', sessao, rota, registroAlvo: partes.join('/'), resultado: 'NEGADO', motivo: 'PAPEL' });
      throw ACESSO_NEGADO();
    }
    if (req.method !== 'GET' || partes.length !== 2) throw NAO_ENCONTRADO();
    const hojeRef = hojeClinica();
    if (partes[1] === 'financeiro') return enviar(res, 200, painelFinanceiro(db, { hoje: hojeRef, parametro }));
    if (partes[1] === 'gerencial') {
      const data = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v ?? '') ? v : null);
      const ate = data(url.searchParams.get('ate')) ?? hojeRef;
      const de = data(url.searchParams.get('de')) ?? somarDias(ate, -29);
      if (de > ate) throw new ErroHttp(422, 'Período inválido.');
      return enviar(res, 200, dashboardGerencial(db, { de, ate, hoje: hojeRef }));
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

    // excluir: a mesma trava da edição vale para apagar.
    const atual = buscarNoAlcance();
    const impedimento = regra.podeEditar?.(atual, ctx);
    if (impedimento) throw new ErroHttp(409, impedimento);
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
      if (partes[0] === 'convites' || (partes[0] === 'senha' && ['recuperar', 'redefinir'].includes(partes[1]))) {
        return await rotaPublicaDeCredencial(req, res, { partes, rota });
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

      concluirExportacoes();
      revisarEstoqueDoDia();
      if (partes[0] === 'sessao' || url.pathname === '/logout') {
        return await rotaDeSessao(req, res, { partes, sessao, token, rota });
      }
      if (partes[0] === 'agenda') return await rotaDeAgenda(req, res, { url, partes, sessao, rota });
      if (partes[0] === 'checkout') return await rotaDeCheckout(req, res, { partes, sessao, rota });
      if (partes[0] === 'indicadores') return rotaDeIndicadores(req, res, { url, partes, sessao, rota });
      if (partes[0] === 'estoque') return await rotaDeEstoque(req, res, { partes, sessao, rota });
      if (partes[0] === 'financeiro' && partes[1] === 'estornos') return await rotaDeEstorno(req, res, { partes, sessao, rota });
      if (partes[0] === 'financeiro' && partes[1] === 'documentos') return await rotaDeDocumentoFiscal(req, res, { partes, sessao, rota });
      if (partes[0] === 'financeiro' && partes[1] === 'conciliacao') return await rotaDeConciliacao(req, res, { partes, sessao, rota });
      if (partes[0] === 'anexos' && (partes[1] === 'envio' || partes[2] === 'arquivo')) return await rotaDeAnexo(req, res, { partes, sessao, rota });
      if (partes[0] === 'tiss' && partes[1] === 'elegibilidade') return await rotaDeElegibilidade(req, res, { partes, sessao, rota });
      if (partes[0] === 'tiss' && partes[1] === 'lotes') return await rotaDeLote(req, res, { partes, sessao, rota });
      if (partes[0] === 'tiss' && partes[1] === 'guias') return await rotaDeGuia(req, res, { partes, sessao, rota });
      if (partes[0] === 'tiss' && partes[1] === 'demonstrativo') return await rotaDeDemonstrativo(req, res, { partes, sessao, rota });
      if (partes[0] === 'relatorios' && partes.length === 3 && ['dados', 'arquivo'].includes(partes[2])) return rotaDeRelatorio(req, res, { partes, sessao, rota });
      if ((partes[0] === 'notificacoes' && partes.length === 3) || (partes[0] === 'portal' && partes[1] === 'preferencias')) {
        return await rotaDeNotificacao(req, res, { partes, sessao, rota });
      }
      if (partes[0] === 'usuarios' && partes[2] === 'convite' && partes.length === 3) {
        return await reenviarConvite(req, res, { partes, sessao, rota });
      }
      if (partes[0] === 'exportacoes' && partes[2] === 'documento') return await rotaDeDocumento(req, res, { partes, sessao, rota });
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
    .createServer(criarApi({
      db,
      salvar,
      pastaDeAnexos: path.join(path.dirname(caminho), 'anexos'),
      origens,
      minutosSessao,
      dataDeReferencia: process.env.DATA_DE_HOJE || DATA_PADRAO,
      simulacao: {
        pixSegundos: Number(process.env.PIX_SEGUNDOS ?? 8),
        tefEsperaMs: Number(process.env.TEF_ESPERA_MS ?? 1500),
        exportacaoSegundos: Number(process.env.EXPORTACAO_SEGUNDOS ?? 3),
      },
    }))
    .listen(porta, host, () => console.log(`API simulada em http://${host}:${porta}`));
}

if (require.main === module) iniciar();

module.exports = { criarApi, textoLocal };
