'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { gerarBanco } = require('../seed');
const { criarApi } = require('../servidor');
const { COLECOES, politica } = require('../permissoes');
const contas = require('../usuarios-de-teste.json');

const BANCO = gerarBanco();
const SENHA = contas.senhaDemonstracao;

async function subir({ relogio, minutosSessao } = {}) {
  const db = structuredClone(BANCO);
  const servidor = http.createServer(criarApi({ db, relogio, minutosSessao }));
  await new Promise((pronto) => servidor.listen(0, '127.0.0.1', pronto));
  const { port } = servidor.address();

  async function pedir(metodo, caminho, { token, corpo, cabecalhos = {} } = {}) {
    const res = await fetch(`http://127.0.0.1:${port}${caminho}`, {
      method: metodo,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(corpo ? { 'Content-Type': 'application/json' } : {}),
        ...cabecalhos,
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const texto = await res.text();
    return { status: res.status, corpo: texto ? JSON.parse(texto) : null, cabecalhos: res.headers };
  }

  async function entrar(login, senha = SENHA) {
    const r = await pedir('POST', '/login', { corpo: { login, senha } });
    assert.equal(r.status, 200, `login de ${login} falhou`);
    return r.corpo.token;
  }

  return { db, pedir, entrar, fechar: () => new Promise((fim) => servidor.close(fim)) };
}

const pessoaDe = (db, login) => db.usuarios.find((u) => u.login === login).idPessoa;
const ultimoLog = (db) => db.logsAuditoria.at(-1);

function chavesDe(valor, encontradas = new Set()) {
  if (Array.isArray(valor)) valor.forEach((v) => chavesDe(v, encontradas));
  else if (valor && typeof valor === 'object') {
    for (const [chave, v] of Object.entries(valor)) {
      encontradas.add(chave);
      chavesDe(v, encontradas);
    }
  }
  return encontradas;
}

describe('banco sintético', () => {
  test('tem as 53 coleções e nenhuma senha em texto', () => {
    assert.equal(COLECOES.length, 53);
    for (const colecao of COLECOES) assert.ok(Array.isArray(BANCO[colecao]), colecao);
    for (const usuario of BANCO.usuarios) {
      assert.equal(usuario.senha, undefined);
      if (usuario.situacao === 'ATIVO') assert.match(usuario.senhaHash, /^scrypt\$/);
    }
  });

  test('CPFs com dígito verificador inválido e e-mails do domínio .test', () => {
    const digitosValidos = (cpf) => {
      const n = cpf.replace(/\D/g, '').split('').map(Number);
      const dv = (k) => {
        const soma = n.slice(0, k).reduce((t, d, i) => t + d * (k + 1 - i), 0);
        const resto = (soma * 10) % 11;
        return resto === 10 ? 0 : resto;
      };
      return dv(9) === n[9] && dv(10) === n[10];
    };
    for (const pessoa of BANCO.pessoas) {
      if (pessoa.cpf !== null) assert.equal(digitosValidos(pessoa.cpf), false, pessoa.cpf);
      assert.match(pessoa.email, /@exemplo\.test$/);
    }
  });

  test('toda coleção tem regra na matriz', () => {
    assert.deepEqual(Object.keys(politica).sort(), [...COLECOES].sort());
  });
});

describe('sessão obrigatória', () => {
  let api;
  before(async () => {
    api = await subir();
  });
  after(() => api.fechar());

  test('sem sessão, nenhuma rota de dados responde e a negação vai para o log', async () => {
    for (const caminho of ['/pacientes', '/usuarios', '/db', '/registrosClinicos/1', '/qualquer']) {
      const antes = api.db.logsAuditoria.length;
      const r = await api.pedir('GET', caminho);
      assert.equal(r.status, 401, caminho);
      assert.equal(api.db.logsAuditoria.length, antes + 1);
      assert.equal(ultimoLog(api.db).motivo, 'SEM_SESSAO');
      assert.equal(ultimoLog(api.db).resultado, 'NEGADO');
    }
    const comTokenFalso = await api.pedir('GET', '/pacientes', { token: 'a'.repeat(64) });
    assert.equal(comTokenFalso.status, 401);
  });

  test('/saude responde sem sessão', async () => {
    assert.equal((await api.pedir('GET', '/saude')).status, 200);
  });

  test('login errado e login inexistente recebem a mesma resposta', async () => {
    const errado = await api.pedir('POST', '/login', { corpo: { login: 'admin', senha: 'outra-senha-1' } });
    const inexistente = await api.pedir('POST', '/login', { corpo: { login: 'ninguem', senha: 'outra-senha-1' } });
    assert.equal(errado.status, 401);
    assert.deepEqual(errado.corpo, inexistente.corpo);
  });

  test('login devolve token e papel, sem senha', async () => {
    const r = await api.pedir('POST', '/login', { corpo: { login: 'medico', senha: SENHA } });
    assert.equal(r.status, 200);
    assert.match(r.corpo.token, /^[0-9a-f]{64}$/);
    assert.equal(r.corpo.usuario.papel, 'MEDICO');
    assert.ok(r.corpo.usuario.nome);
    assert.ok(![...chavesDe(r.corpo)].some((c) => /^senha/i.test(c)));
  });

  test('aceita o e-mail no lugar do login', async () => {
    const usuario = api.db.usuarios.find((u) => u.login === 'secretaria');
    const r = await api.pedir('POST', '/login', { corpo: { login: usuario.email, senha: SENHA } });
    assert.equal(r.status, 200);
  });

  test('conta com convite pendente não entra', async () => {
    const pendente = api.db.usuarios.find((u) => u.situacao === 'CONVITE_PENDENTE');
    const r = await api.pedir('POST', '/login', { corpo: { login: pendente.login, senha: SENHA } });
    assert.equal(r.status, 401);
  });

  test('bloqueia a conta depois de X01 falhas, com a mesma mensagem', async () => {
    for (let i = 0; i < 5; i++) {
      await api.pedir('POST', '/login', { corpo: { login: 'responsavel2', senha: 'errada-123' } });
    }
    const certa = await api.pedir('POST', '/login', { corpo: { login: 'responsavel2', senha: SENHA } });
    assert.equal(certa.status, 401);
    assert.equal(ultimoLog(api.db).motivo, 'BLOQUEADO');
  });

  test('logout encerra a sessão', async () => {
    const token = await api.entrar('admin');
    assert.equal((await api.pedir('POST', '/logout', { token })).status, 204);
    assert.equal((await api.pedir('GET', '/sessao', { token })).status, 401);
  });

  test('a sessão expira por inatividade', async () => {
    let agora = Date.parse('2026-10-20T10:00:00');
    const comRelogio = await subir({ relogio: () => new Date(agora), minutosSessao: 30 });
    try {
      const token = await comRelogio.entrar('admin');
      agora += 29 * 60 * 1000;
      assert.equal((await comRelogio.pedir('GET', '/sessao', { token })).status, 200);
      agora += 29 * 60 * 1000;
      assert.equal((await comRelogio.pedir('GET', '/sessao', { token })).status, 200, 'cada acesso renova o prazo');
      agora += 31 * 60 * 1000;
      assert.equal((await comRelogio.pedir('GET', '/sessao', { token })).status, 401);
    } finally {
      await comRelogio.fechar();
    }
  });
});

describe('recusa por papel', () => {
  let api;
  const tokens = {};
  before(async () => {
    api = await subir();
    for (const conta of contas.contas) tokens[conta.login] = await api.entrar(conta.login);
  });
  after(() => api.fechar());

  test('/db é recusado até para o Administrador, e a recusa fica no log', async () => {
    const r = await api.pedir('GET', '/db', { token: tokens.admin });
    assert.equal(r.status, 403);
    assert.equal(ultimoLog(api.db).motivo, 'ROTA_BLOQUEADA');
  });

  test('a recusa vem antes da busca: id inexistente também recebe 403', async () => {
    const casos = [
      ['secretaria', '/registrosClinicos'],
      ['secretaria', '/registrosClinicos/999999'],
      ['secretaria', '/logsAuditoria'],
      ['secretaria', '/usuarios'],
      ['admin', '/registrosClinicos'],
      ['admin', '/anotacoesPrivadas/999999'],
      ['admin', '/prescricoes'],
      ['medico', '/caixas'],
      ['medico', '/titulosPagar'],
      ['paciente', '/usuarios'],
      ['paciente', '/registrosClinicos'],
      ['responsavel', '/logsAuditoria'],
    ];
    for (const [login, caminho] of casos) {
      const antes = api.db.logsAuditoria.length;
      const r = await api.pedir('GET', caminho, { token: tokens[login] });
      assert.equal(r.status, 403, `${login} ${caminho}`);
      const log = ultimoLog(api.db);
      assert.equal(api.db.logsAuditoria.length, antes + 1);
      assert.equal(log.resultado, 'NEGADO');
      assert.equal(log.motivo, 'PAPEL');
      assert.equal(log.registroAlvo, caminho.slice(1));
    }
  });

  test('escrita sem permissão também é recusada', async () => {
    const r = await api.pedir('POST', '/logsAuditoria', { token: tokens.admin, corpo: { acao: 'X' } });
    assert.equal(r.status, 403);
    const d = await api.pedir('DELETE', '/pacientes/1', { token: tokens.secretaria });
    assert.equal(d.status, 403);
  });

  test('nenhuma resposta traz campo de senha, para nenhum papel', async () => {
    for (const conta of contas.contas) {
      const papel = conta.papel;
      for (const colecao of COLECOES) {
        if (!politica[colecao][papel]) continue;
        const r = await api.pedir('GET', `/${colecao}`, { token: tokens[conta.login] });
        assert.equal(r.status, 200, `${conta.login} ${colecao}`);
        const comSenha = [...chavesDe(r.corpo)].filter((c) => /^senha/i.test(c));
        assert.deepEqual(comSenha, [], `${conta.login} ${colecao}`);
      }
    }
  });
});

describe('campos ocultos por papel', () => {
  let api;
  const tokens = {};
  before(async () => {
    api = await subir();
    for (const conta of contas.contas) tokens[conta.login] = await api.entrar(conta.login);
  });
  after(() => api.fechar());

  const ler = async (login, caminho) => {
    const r = await api.pedir('GET', caminho, { token: tokens[login] });
    assert.equal(r.status, 200, `${login} ${caminho}`);
    return r.corpo;
  };
  const semCampo = (lista, campo) => lista.every((r) => !(campo in r));

  test('Observações Gerais nunca vão ao Administrador (A3-R17)', async () => {
    assert.ok(semCampo(await ler('admin', '/pacientes'), 'observacoesGerais'));
    const daSecretaria = await ler('secretaria', '/pacientes');
    assert.ok(daSecretaria.some((p) => p.observacoesGerais));
  });

  test('custo de aquisição só para o Administrador (RC06)', async () => {
    assert.ok(semCampo(await ler('secretaria', '/produtos'), 'custoAquisicao'));
    assert.ok(semCampo(await ler('medico', '/produtos'), 'custoAquisicao'));
    assert.ok((await ler('admin', '/produtos')).every((p) => 'custoAquisicao' in p));
  });

  test('filtrar por campo oculto não revela nada', async () => {
    assert.deepEqual(await ler('secretaria', '/produtos?custoAquisicao_gte=0'), []);
    assert.deepEqual(await ler('secretaria', '/produtos?custoAquisicao_lte=999999'), []);
    assert.deepEqual(await ler('admin', '/pacientes?observacoesGerais_like=a'), []);
  });

  test('fechamento cego: a Secretária vê só o próprio caixa, sem esperado nem divergência (D5)', async () => {
    const caixas = await ler('secretaria', '/caixas');
    const minha = pessoaDe(api.db, 'secretaria');
    assert.ok(caixas.length > 0);
    assert.ok(caixas.every((c) => c.idSecretaria === minha));
    assert.ok(semCampo(caixas, 'saldoApurado') && semCampo(caixas, 'divergencia'));
    assert.ok((await ler('admin', '/caixas')).some((c) => c.divergencia !== null && c.divergencia !== 0));
  });

  test('outros campos por papel', async () => {
    assert.ok(semCampo(await ler('medico', '/procedimentos'), 'precoParticular'));
    assert.ok(semCampo(await ler('paciente', '/procedimentos'), 'precoParticular'));
    assert.ok(semCampo(await ler('admin', '/movimentacoes'), 'idConsulta'));
    assert.ok(semCampo(await ler('secretaria', '/lotesCobranca'), 'valorApresentado'));
    assert.ok(semCampo(await ler('secretaria', '/autorizacoes'), 'justificativa'));
    assert.ok(semCampo(await ler('admin', '/autorizacoes'), 'justificativa'));
    assert.ok(semCampo(await ler('secretaria', '/pagamentosCartao'), 'valorLiquido'));
    assert.ok(semCampo(await ler('medico', '/orcamentos'), 'valorTotal'));
    assert.ok(semCampo(await ler('admin', '/usuarios'), 'senhaHash'));
  });

  test('o Paciente vê a própria pessoa inteira e, dos médicos, só o nome', async () => {
    const pessoas = await ler('paciente', '/pessoas');
    const eu = pessoaDe(api.db, 'paciente');
    const medicos = new Set(api.db.medicos.map((m) => m.id));
    assert.equal(pessoas.length, 1 + medicos.size);
    for (const p of pessoas) {
      if (p.id === eu) assert.ok(p.cpf && p.email);
      else assert.deepEqual(Object.keys(p).sort(), ['id', 'nome']);
    }
  });

  test('_campos devolve só as colunas pedidas', async () => {
    const r = await ler('secretaria', '/pessoas?_campos=nome&_limit=3');
    assert.equal(r.length, 3);
    for (const p of r) assert.deepEqual(Object.keys(p).sort(), ['id', 'nome']);
  });
});

describe('alcance do Médico (RC05)', () => {
  let api;
  let token;
  let eu;
  before(async () => {
    api = await subir();
    token = await api.entrar('medico');
    eu = pessoaDe(api.db, 'medico');
  });
  after(() => api.fechar());

  const prontuarioDe = (idPaciente) => api.db.prontuarios.find((p) => p.idPaciente === idPaciente);

  test('lê registros clínicos só de quem tem vínculo Ativo ou Histórico', async () => {
    const r = await api.pedir('GET', '/registrosClinicos', { token });
    assert.equal(r.status, 200);
    const comVinculo = new Set(
      api.db.vinculos.filter((v) => v.idMedico === eu && ['ATIVO', 'HISTORICO'].includes(v.estado)).map((v) => v.idPaciente)
    );
    assert.ok(r.corpo.length > 0);
    assert.ok(r.corpo.length < api.db.registrosClinicos.length);
    for (const registro of r.corpo) {
      const prontuario = api.db.prontuarios.find((p) => p.id === registro.idProntuario);
      assert.ok(comVinculo.has(prontuario.idPaciente));
    }
    assert.equal(ultimoLog(api.db).acao, 'LER');
    assert.equal(ultimoLog(api.db).resultado, 'PERMITIDO');
  });

  test('vínculo Encerrado não dá acesso; o registro responde como inexistente', async () => {
    const encerrado = api.db.vinculos.find((v) => v.idMedico === eu && v.estado === 'ENCERRADO');
    const historico = api.db.vinculos.find((v) => v.idMedico === eu && v.estado === 'HISTORICO');
    assert.ok(encerrado && historico);
    const fora = await api.pedir('GET', `/prontuarios/${prontuarioDe(encerrado.idPaciente).id}`, { token });
    assert.equal(fora.status, 404);
    assert.equal(ultimoLog(api.db).motivo, 'FORA_DO_ALCANCE');
    const inexistente = await api.pedir('GET', '/prontuarios/999999', { token });
    assert.deepEqual(fora.corpo, inexistente.corpo);
    const dentro = await api.pedir('GET', `/prontuarios/${prontuarioDe(historico.idPaciente).id}`, { token });
    assert.equal(dentro.status, 200);
  });

  test('chamar o paciente cria o vínculo e abre o prontuário (RF05)', async () => {
    const naRecepcao = api.db.consultas.find(
      (c) =>
        c.idMedico === eu &&
        c.status === 'NA_RECEPCAO' &&
        !api.db.vinculos.some((v) => v.idMedico === eu && v.idPaciente === c.idPaciente)
    );
    assert.ok(naRecepcao, 'o seed deve ter paciente na recepção sem vínculo');
    const antes = await api.pedir('GET', `/anexos?idPaciente=${naRecepcao.idPaciente}`, { token });
    assert.deepEqual(antes.corpo, []);

    const pular = await api.pedir('PATCH', `/consultas/${naRecepcao.id}`, { token, corpo: { status: 'FINALIZADO' } });
    assert.equal(pular.status, 422);

    const chamar = await api.pedir('PATCH', `/consultas/${naRecepcao.id}`, { token, corpo: { status: 'EM_ATENDIMENTO' } });
    assert.equal(chamar.status, 200);
    const depois = await api.pedir('GET', `/prontuarios?idPaciente=${naRecepcao.idPaciente}`, { token });
    assert.equal(depois.corpo.length, 1);
  });

  test('a Secretária não leva o paciente a Em Atendimento (D1)', async () => {
    const tokenSecretaria = await api.entrar('secretaria');
    const naRecepcao = api.db.consultas.find((c) => c.status === 'NA_RECEPCAO');
    const r = await api.pedir('PATCH', `/consultas/${naRecepcao.id}`, { token: tokenSecretaria, corpo: { status: 'EM_ATENDIMENTO' } });
    assert.equal(r.status, 422);
  });

  test('registro selado não muda', async () => {
    const { corpo } = await api.pedir('GET', '/registrosClinicos?selado=true&_limit=1', { token });
    const r = await api.pedir('PATCH', `/registrosClinicos/${corpo[0].id}`, { token, corpo: { conduta: 'outra' } });
    assert.equal(r.status, 409);
  });

  test('anotações privadas: só as do autor, e o autor é o da sessão', async () => {
    const minhas = await api.pedir('GET', '/anotacoesPrivadas', { token });
    assert.ok(minhas.corpo.length > 0);
    assert.ok(minhas.corpo.every((a) => a.idMedico === eu));

    const deOutro = api.db.anotacoesPrivadas.find((a) => a.idMedico !== eu);
    assert.equal((await api.pedir('GET', `/anotacoesPrivadas/${deOutro.id}`, { token })).status, 404);

    const paciente = minhas.corpo[0].idPaciente;
    const criada = await api.pedir('POST', '/anotacoesPrivadas', {
      token,
      corpo: { texto: 'Teste', idPaciente: paciente, idMedico: deOutro.idMedico },
    });
    assert.equal(criada.status, 201);
    assert.equal(criada.corpo.idMedico, eu);
  });

  test('não cria registro para paciente fora do alcance', async () => {
    const encerrado = api.db.vinculos.find((v) => v.idMedico === eu && v.estado === 'ENCERRADO');
    const r = await api.pedir('POST', '/anotacoesPrivadas', { token, corpo: { texto: 'x', idPaciente: encerrado.idPaciente } });
    assert.equal(r.status, 403);
    assert.equal(ultimoLog(api.db).motivo, 'FORA_DO_ALCANCE');
  });

  test('paginação e X-Total-Count contam só o alcance', async () => {
    const r = await api.pedir('GET', '/consultas?_page=1&_limit=5', { token });
    assert.equal(r.corpo.length, 5);
    const minhas = api.db.consultas.filter((c) => c.idMedico === eu).length;
    assert.equal(Number(r.cabecalhos.get('x-total-count')), minhas);
  });
});

describe('portal do Paciente e do Responsável Legal', () => {
  let api;
  before(async () => {
    api = await subir();
  });
  after(() => api.fechar());

  test('o Paciente só vê o que é dele, e o servidor impõe o titular ao criar', async () => {
    const token = await api.entrar('paciente');
    const eu = pessoaDe(api.db, 'paciente');
    const consultas = await api.pedir('GET', '/consultas', { token });
    assert.ok(consultas.corpo.length > 0);
    assert.ok(consultas.corpo.every((c) => c.idPaciente === eu));

    const outra = api.db.consultas.find((c) => c.idPaciente !== eu);
    assert.equal((await api.pedir('GET', `/consultas/${outra.id}`, { token })).status, 404);
    const outroPaciente = api.db.pacientes.find((p) => p.id !== eu);
    assert.equal((await api.pedir('GET', `/pacientes/${outroPaciente.id}`, { token })).status, 404);

    const nova = await api.pedir('POST', '/consultas', {
      token,
      corpo: { idPaciente: outroPaciente.id, idMedico: outra.idMedico, dataHora: '2026-11-03T08:00:00', idProcedimento: 1, status: 'FINALIZADO' },
    });
    assert.equal(nova.status, 201);
    assert.equal(nova.corpo.idPaciente, eu);
    assert.equal(nova.corpo.status, 'AGENDADO');

    const orcamentos = await api.pedir('GET', '/orcamentos', { token });
    assert.ok(orcamentos.corpo.length > 0);
    assert.ok(orcamentos.corpo.every((o) => ['ACEITE', 'ACEITO', 'RECUSADO', 'EXPIRADO'].includes(o.etapa)));
  });

  test('o Responsável com uma representada entra com ela selecionada', async () => {
    const r = await api.pedir('POST', '/login', { corpo: { login: 'responsavel', senha: SENHA } });
    assert.ok(r.corpo.representado);
    const consultas = await api.pedir('GET', '/consultas', { token: r.corpo.token });
    assert.ok(consultas.corpo.length > 0);
    assert.ok(consultas.corpo.every((c) => c.idPaciente === r.corpo.representado.idPaciente));
  });

  test('com dois representados, nada aparece antes da escolha (G-09)', async () => {
    const r = await api.pedir('POST', '/login', { corpo: { login: 'responsavel2', senha: SENHA } });
    const token = r.corpo.token;
    assert.equal(r.corpo.representado, null);
    assert.deepEqual((await api.pedir('GET', '/consultas', { token })).corpo, []);

    const representados = await api.pedir('GET', '/sessao/representados', { token });
    assert.equal(representados.corpo.length, 2);
    const escolha = await api.pedir('POST', '/sessao/representado', { token, corpo: { idPaciente: representados.corpo[1].idPaciente } });
    assert.equal(escolha.status, 200);
    const consultas = await api.pedir('GET', '/consultas', { token });
    assert.ok(consultas.corpo.every((c) => c.idPaciente === representados.corpo[1].idPaciente));

    const alheio = api.db.pacientes.find((p) => !representados.corpo.some((x) => x.idPaciente === p.id));
    assert.equal((await api.pedir('POST', '/sessao/representado', { token, corpo: { idPaciente: alheio.id } })).status, 404);
  });

  test('a representação acaba na maioridade (R-07)', async () => {
    const terceiro = api.db.usuarios.filter((u) => u.papel === 'RESPONSAVEL_LEGAL')[2];
    const token = await api.entrar(terceiro.login);
    const representados = await api.pedir('GET', '/sessao/representados', { token });
    const deles = api.db.representacoes.filter((r) => r.idResponsavelLegal === terceiro.idPessoa);
    assert.equal(deles.length, 2);
    assert.equal(representados.corpo.length, 1);
  });

  test('outros papéis não usam as rotas de representação', async () => {
    const token = await api.entrar('paciente');
    assert.equal((await api.pedir('GET', '/sessao/representados', { token })).status, 403);
  });
});

describe('escrita', () => {
  let api;
  before(async () => {
    api = await subir();
  });
  after(() => api.fechar());

  test('a senha não é gravada pela rota genérica', async () => {
    const token = await api.entrar('admin');
    const alvo = api.db.usuarios.find((u) => u.login === 'secretaria');
    const hashAntes = alvo.senhaHash;
    const r = await api.pedir('PATCH', `/usuarios/${alvo.id}`, { token, corpo: { senhaHash: 'x', senha: 'y', situacao: 'ATIVO' } });
    assert.equal(r.status, 200);
    assert.equal(alvo.senhaHash, hashAntes);
    assert.equal(alvo.senha, undefined);
  });

  test('campo oculto não é gravado', async () => {
    const token = await api.entrar('secretaria');
    const r = await api.pedir('POST', '/produtos', { token, corpo: { descricao: 'Teste', custoAquisicao: 1 } });
    assert.equal(r.status, 201);
    assert.equal(api.db.produtos.find((p) => p.id === r.corpo.id).custoAquisicao, undefined);
  });

  test('alterar a própria senha exige a atual e encerra as outras sessões', async () => {
    const primeira = await api.entrar('medico2');
    const segunda = await api.entrar('medico2');
    const errada = await api.pedir('POST', '/sessao/senha', { token: primeira, corpo: { senhaAtual: 'x', novaSenha: 'NovaSenha123' } });
    assert.equal(errada.status, 422);
    const certa = await api.pedir('POST', '/sessao/senha', { token: primeira, corpo: { senhaAtual: SENHA, novaSenha: 'NovaSenha123' } });
    assert.equal(certa.status, 204);
    assert.equal((await api.pedir('GET', '/sessao', { token: segunda })).status, 401);
    assert.equal((await api.pedir('GET', '/sessao', { token: primeira })).status, 200);
    await api.entrar('medico2', 'NovaSenha123');
  });

  test('fechamento de caixa: o servidor calcula a divergência e a Secretária não a vê', async () => {
    const token = await api.entrar('secretaria');
    const aberto = await api.pedir('POST', '/caixas', { token, corpo: { saldoInicial: 100, situacao: 'FECHADO', idSecretaria: 1 } });
    assert.equal(aberto.status, 201);
    assert.equal(aberto.corpo.situacao, 'ABERTO');
    assert.equal(aberto.corpo.idSecretaria, pessoaDe(api.db, 'secretaria'));

    const semJustificativa = await api.pedir('PATCH', `/caixas/${aberto.corpo.id}`, {
      token,
      corpo: { dataFechamento: '2026-09-28T18:00:00', saldoContado: 90 },
    });
    assert.equal(semJustificativa.status, 422);
    const fechado = await api.pedir('PATCH', `/caixas/${aberto.corpo.id}`, {
      token,
      corpo: { dataFechamento: '2026-09-28T18:00:00', saldoContado: 90, justificativa: 'Faltou troco.' },
    });
    assert.equal(fechado.status, 200);
    assert.equal(fechado.corpo.divergencia, undefined);
    const noBanco = api.db.caixas.find((c) => c.id === aberto.corpo.id);
    assert.equal(noBanco.divergencia, -10);
    assert.equal(noBanco.situacao, 'A_APROVAR');
  });

  test('o Administrador só vê orçamentos na etapa de aprovação (RC09) e consegue aprová-los', async () => {
    const token = await api.entrar('admin');
    const r = await api.pedir('GET', '/orcamentos', { token });
    assert.ok(r.corpo.length > 0);
    assert.ok(r.corpo.every((o) => o.etapa === 'APROVACAO'));
    const aprovado = await api.pedir('PATCH', `/orcamentos/${r.corpo[0].id}`, { token, corpo: { etapa: 'ACEITE' } });
    assert.equal(aprovado.status, 200);
    assert.equal((await api.pedir('GET', `/orcamentos/${r.corpo[0].id}`, { token })).status, 404, 'saiu da fila');
  });

  test('o Médico envia o escopo à Secretária e depois não mexe mais', async () => {
    const token = await api.entrar('medico');
    const { corpo } = await api.pedir('GET', '/orcamentos?etapa=ESCOPO', { token });
    assert.equal(corpo.length, 1);
    const enviado = await api.pedir('PATCH', `/orcamentos/${corpo[0].id}`, { token, corpo: { etapa: 'VALORES' } });
    assert.equal(enviado.status, 200);
    const depois = await api.pedir('PATCH', `/orcamentos/${corpo[0].id}`, { token, corpo: { etapa: 'ESCOPO' } });
    assert.equal(depois.status, 409);
  });

  test('o Paciente cancela a própria consulta, mas não faz check-in', async () => {
    const token = await api.entrar('paciente');
    const eu = pessoaDe(api.db, 'paciente');
    const agendadas = api.db.consultas.filter((c) => c.idPaciente === eu && c.status === 'AGENDADO');
    assert.ok(agendadas.length >= 2);
    const cancelada = await api.pedir('PATCH', `/consultas/${agendadas[0].id}`, { token, corpo: { status: 'CANCELADO' } });
    assert.equal(cancelada.status, 200);
    assert.equal(cancelada.corpo.status, 'CANCELADO');
    const checkin = await api.pedir('PATCH', `/consultas/${agendadas[1].id}`, { token, corpo: { status: 'NA_RECEPCAO' } });
    assert.equal(checkin.status, 422);
  });

  test('a Secretária não marca dois pacientes no mesmo horário do médico (RF18)', async () => {
    const token = await api.entrar('secretaria');
    const [a, b] = api.db.consultas.filter((c) => c.status === 'AGENDADO' && c.idMedico === api.db.consultas.find((x) => x.status === 'AGENDADO').idMedico);
    const remarcar = await api.pedir('PATCH', `/consultas/${a.id}`, { token, corpo: { dataHora: b.dataHora } });
    assert.equal(remarcar.status, 422);
    const nova = await api.pedir('POST', '/consultas', {
      token,
      corpo: { idPaciente: a.idPaciente, idMedico: a.idMedico, dataHora: '2026-11-04T08:00:00', status: 'FINALIZADO', idProcedimento: 1 },
    });
    assert.equal(nova.status, 422, 'consulta nova começa como Agendada');
  });
});

describe('regras do RF22 e do RF31 da v2.0', () => {
  let api;
  before(async () => {
    api = await subir();
  });
  after(() => api.fechar());

  const daMedica = (status) => {
    const eu = pessoaDe(api.db, 'medico');
    return api.db.consultas.find((c) => c.idMedico === eu && c.status === status && c.dataHora.startsWith('2026-09-28'));
  };

  test('o Médico volta Em Atendimento para Na Recepção só com motivo, e o log destaca', async () => {
    const token = await api.entrar('medico');
    const consulta = daMedica('EM_ATENDIMENTO');
    const semMotivo = await api.pedir('PATCH', `/consultas/${consulta.id}`, { token, corpo: { status: 'NA_RECEPCAO' } });
    assert.equal(semMotivo.status, 422);
    const motivo = 'Paciente saiu para buscar exame no carro.';
    const comMotivo = await api.pedir('PATCH', `/consultas/${consulta.id}`, { token, corpo: { status: 'NA_RECEPCAO', motivoTransicao: motivo } });
    assert.equal(comMotivo.status, 200);
    assert.equal(comMotivo.corpo.motivoTransicao, motivo);
    const destaque = api.db.logsAuditoria.find((l) => l.acao === 'TRANSICAO_RETROATIVA' && l.registroAlvo === `consultas/${consulta.id}`);
    assert.equal(destaque.motivo, 'EM_ATENDIMENTO>NA_RECEPCAO');
    assert.ok(!JSON.stringify(destaque).includes(motivo), 'o log guarda só a referência');
  });

  test('o motivo antigo não serve para uma nova volta', async () => {
    const token = await api.entrar('medico');
    const consulta = api.db.consultas.find((c) => c.motivoTransicao);
    assert.ok(consulta, 'depende do teste anterior');
    const chamar = await api.pedir('PATCH', `/consultas/${consulta.id}`, { token, corpo: { status: 'EM_ATENDIMENTO' } });
    assert.equal(chamar.status, 200);
    const deNovo = await api.pedir('PATCH', `/consultas/${consulta.id}`, { token, corpo: { status: 'NA_RECEPCAO' } });
    assert.equal(deNovo.status, 422);
  });

  test('voltar de Finalizado não reabre o registro selado', async () => {
    const token = await api.entrar('medico');
    const consulta = daMedica('FINALIZADO');
    const volta = await api.pedir('PATCH', `/consultas/${consulta.id}`, { token, corpo: { status: 'EM_ATENDIMENTO', motivoTransicao: 'Faltou registrar a prescrição.' } });
    assert.equal(volta.status, 200);
    const registro = api.db.registrosClinicos.find((r) => r.idConsulta === consulta.id);
    assert.equal(registro.selado, true);
    assert.equal((await api.pedir('PATCH', `/registrosClinicos/${registro.id}`, { token, corpo: { conduta: 'x' } })).status, 409);
  });

  test('a Secretária não faz volta de status, mas marca Não Compareceu a partir da recepção', async () => {
    const token = await api.entrar('secretaria');
    const emAtendimento = api.db.consultas.find((c) => c.status === 'EM_ATENDIMENTO');
    const volta = await api.pedir('PATCH', `/consultas/${emAtendimento.id}`, { token, corpo: { status: 'NA_RECEPCAO', motivoTransicao: 'Tentativa da recepção.' } });
    assert.equal(volta.status, 422);
    const naRecepcao = api.db.consultas.find((c) => c.status === 'NA_RECEPCAO');
    const faltou = await api.pedir('PATCH', `/consultas/${naRecepcao.id}`, { token, corpo: { status: 'NAO_COMPARECEU' } });
    assert.equal(faltou.status, 200);
  });

  test('devolver o orçamento exige observação, e o Médico a lê em Devolvido', async () => {
    const secretaria = await api.entrar('secretaria');
    const emValores = api.db.orcamentos.find((o) => o.etapa === 'VALORES');
    const sem = await api.pedir('PATCH', `/orcamentos/${emValores.id}`, { token: secretaria, corpo: { etapa: 'DEVOLVIDO' } });
    assert.equal(sem.status, 422);
    const observacao = 'Falta definir a quantidade de sessões.';
    const com = await api.pedir('PATCH', `/orcamentos/${emValores.id}`, { token: secretaria, corpo: { etapa: 'DEVOLVIDO', observacaoDevolucao: observacao } });
    assert.equal(com.status, 200);

    const loginDoMedico = api.db.usuarios.find((u) => u.idPessoa === emValores.idMedico).login;
    const medico = await api.entrar(loginDoMedico);
    const lido = await api.pedir('GET', `/orcamentos/${emValores.id}`, { token: medico });
    assert.equal(lido.corpo.observacaoDevolucao, observacao);

    const admin = await api.entrar('admin');
    const emAprovacao = api.db.orcamentos.find((o) => o.etapa === 'APROVACAO');
    assert.equal((await api.pedir('PATCH', `/orcamentos/${emAprovacao.id}`, { token: admin, corpo: { etapa: 'VALORES' } })).status, 422);
    assert.equal(
      (await api.pedir('PATCH', `/orcamentos/${emAprovacao.id}`, { token: admin, corpo: { etapa: 'VALORES', observacaoDevolucao: 'Rever o valor unitário.' } })).status,
      200
    );

    const paciente = await api.entrar('paciente');
    const doTitular = await api.pedir('GET', '/orcamentos', { token: paciente });
    assert.ok(doTitular.corpo.every((o) => !('observacaoDevolucao' in o)));
  });
});

describe('portal: títulos, itens dispensados e exportações', () => {
  let api;
  before(async () => {
    api = await subir();
  });
  after(() => api.fechar());

  test('o titular lê só os próprios títulos a receber', async () => {
    const token = await api.entrar('paciente');
    const eu = pessoaDe(api.db, 'paciente');
    const { corpo } = await api.pedir('GET', '/titulosReceber', { token });
    assert.ok(corpo.length > 0);
    for (const titulo of corpo) {
      const cobranca = api.db.cobrancas.find((c) => c.id === titulo.idCobranca);
      const consulta = api.db.consultas.find((c) => c.id === cobranca.idConsulta);
      const orcamento = api.db.orcamentos.find((o) => o.id === cobranca.idOrcamento);
      assert.equal((consulta ?? orcamento).idPaciente, eu);
    }
  });

  test('do estoque, o titular vê só nome e lote do que recebeu', async () => {
    for (const login of ['paciente', 'responsavel']) {
      const token = await api.entrar(login);
      const sessao = (await api.pedir('GET', '/sessao', { token })).corpo;
      const titular = sessao.representado?.idPaciente ?? sessao.usuario.idPessoa;
      const lotes = (await api.pedir('GET', '/lotes', { token })).corpo;
      const produtos = (await api.pedir('GET', '/produtos', { token })).corpo;
      assert.ok(lotes.length > 0, login);
      assert.ok(produtos.length > 0 && produtos.length < api.db.produtos.length, login);
      for (const lote of lotes) {
        assert.deepEqual(Object.keys(lote).sort(), ['id', 'idProduto', 'numero', 'validade']);
        const dispensado = api.db.movimentacoes.some(
          (m) => m.idLote === lote.id && m.origem === 'DISPENSACAO' && api.db.consultas[m.idConsulta - 1].idPaciente === titular
        );
        assert.ok(dispensado, `${login}: lote ${lote.id}`);
      }
      for (const produto of produtos) assert.deepEqual(Object.keys(produto).sort(), ['descricao', 'id', 'tipo', 'unidade']);
    }
  });

  test('exportações têm idPaciente, e o servidor impõe o titular ao pedir', async () => {
    const token = await api.entrar('paciente');
    const eu = pessoaDe(api.db, 'paciente');
    const minhas = await api.pedir('GET', `/exportacoes?idPaciente=${eu}`, { token });
    assert.equal(minhas.corpo.length, 2);
    const outro = api.db.pacientes.find((p) => p.id !== eu);
    const pedido = await api.pedir('POST', '/exportacoes', { token, corpo: { tipo: 'HISTORICO', formato: 'PDF', idPaciente: outro.id, situacao: 'CONCLUIDA' } });
    assert.equal(pedido.status, 201);
    assert.equal(pedido.corpo.idPaciente, eu);
    assert.equal(pedido.corpo.situacao, 'SOLICITADA');
  });

  test('o Médico filtra prescrições por idPaciente', async () => {
    const token = await api.entrar('medico');
    const { corpo: todas } = await api.pedir('GET', '/prescricoes', { token });
    assert.ok(todas.length > 0);
    const idPaciente = todas[0].idPaciente;
    const { corpo } = await api.pedir('GET', `/prescricoes?idPaciente=${idPaciente}`, { token });
    assert.ok(corpo.length > 0 && corpo.every((p) => p.idPaciente === idPaciente));
  });
});

describe('CORS', () => {
  let api;
  before(async () => {
    api = await subir();
  });
  after(() => api.fechar());

  test('libera só a origem do app', async () => {
    const doApp = await api.pedir('OPTIONS', '/pacientes', { cabecalhos: { Origin: 'http://localhost:3000' } });
    assert.equal(doApp.status, 204);
    assert.equal(doApp.cabecalhos.get('access-control-allow-origin'), 'http://localhost:3000');
    const deFora = await api.pedir('OPTIONS', '/pacientes', { cabecalhos: { Origin: 'https://exemplo.test' } });
    assert.equal(deFora.cabecalhos.get('access-control-allow-origin'), null);
  });
});
