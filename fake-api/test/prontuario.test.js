'use strict';

// Prontuário (RF06, RF23 a RF30): registro só em atendimento e selado ao
// finalizar, retificação pelo autor, prescrição, acesso de exceção e
// exportação com documento.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { gerarBanco } = require('../seed');
const { criarApi } = require('../servidor');
const contas = require('../usuarios-de-teste.json');

const BANCO = gerarBanco();
const SENHA = contas.senhaDemonstracao;
const DEZ_HORAS = () => new Date(2026, 8, 28, 10, 0, 0);

async function subir() {
  const db = structuredClone(BANCO);
  const servidor = http.createServer(
    criarApi({ db, relogio: DEZ_HORAS, simulacao: { pixSegundos: 0, tefEsperaMs: 0, exportacaoSegundos: 0 } })
  );
  await new Promise((pronto) => servidor.listen(0, '127.0.0.1', pronto));
  const { port } = servidor.address();
  async function pedir(metodo, caminho, { token, corpo } = {}) {
    const res = await fetch(`http://127.0.0.1:${port}${caminho}`, {
      method: metodo,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const texto = await res.text();
    return { status: res.status, corpo: texto ? JSON.parse(texto) : null };
  }
  async function entrar(login) {
    const r = await pedir('POST', '/login', { corpo: { login, senha: SENHA } });
    assert.equal(r.status, 200, `login de ${login} falhou`);
    return r.corpo.token;
  }
  return { db, pedir, entrar, fechar: () => new Promise((fim) => servidor.close(fim)) };
}

const pessoaDe = (db, login) => db.usuarios.find((u) => u.login === login).idPessoa;

describe('registro clínico, retificação e prescrição (RF23 a RF25)', () => {
  let api;
  let token;
  let consulta;
  let registro;
  let prescricao;
  before(async () => {
    api = await subir();
    token = await api.entrar('medico');
    const eu = pessoaDe(api.db, 'medico');
    consulta = api.db.consultas.find(
      (c) => c.status === 'NA_RECEPCAO' && c.idMedico === eu && !api.db.registrosClinicos.some((r) => r.idConsulta === c.id)
    );
    assert.ok(consulta, 'sem paciente na recepção para a médica de demonstração');
  });
  after(() => api.fechar());

  test('não há registro de consulta que não está em atendimento (E3)', async () => {
    const r = await api.pedir('POST', '/registrosClinicos', { token, corpo: { idConsulta: consulta.id, queixas: 'Dor.' } });
    assert.ok([403, 422].includes(r.status));
  });

  test('em atendimento, o registro nasce do autor, em edição, e aceita rascunho', async () => {
    assert.equal((await api.pedir('PATCH', `/consultas/${consulta.id}`, { token, corpo: { status: 'EM_ATENDIMENTO' } })).status, 200);
    const criado = await api.pedir('POST', '/registrosClinicos', {
      token,
      corpo: { idConsulta: consulta.id, queixas: 'Dor de cabeça há dois dias.', selado: true, idMedico: 999 },
    });
    assert.equal(criado.status, 201);
    registro = criado.corpo;
    assert.equal(registro.selado, false);
    assert.equal(registro.idMedico, pessoaDe(api.db, 'medico'));
    assert.ok(registro.idProntuario);
    assert.equal((await api.pedir('POST', '/registrosClinicos', { token, corpo: { idConsulta: consulta.id } })).status, 422);
    const rascunho = await api.pedir('PATCH', `/registrosClinicos/${registro.id}`, {
      token,
      corpo: { diagnostico: 'Cefaleia tensional', conduta: 'Analgésico se dor.' },
    });
    assert.equal(rascunho.status, 200);
  });

  test('prescrição: classificação obrigatória; controle especial muda o tipo da receita', async () => {
    const criada = await api.pedir('POST', '/prescricoes', { token, corpo: { idRegistroClinico: registro.id } });
    assert.equal(criada.status, 201);
    prescricao = criada.corpo;
    assert.equal(prescricao.idPaciente, consulta.idPaciente);
    const item = { idPrescricao: prescricao.id, medicamento: 'Dipirona', concentracao: '500 mg', posologia: '1 comprimido a cada 6 horas', quantidade: 12, duracao: '3 dias' };
    assert.equal((await api.pedir('POST', '/itensPrescricao', { token, corpo: item })).status, 422, 'sem classificação');
    assert.equal((await api.pedir('POST', '/itensPrescricao', { token, corpo: { ...item, classificacao: 'COMUM' } })).status, 201);
    const controlado = await api.pedir('POST', '/itensPrescricao', {
      token,
      corpo: { ...item, medicamento: 'Clonazepam', concentracao: '2 mg', classificacao: 'CONTROLE_ESPECIAL' },
    });
    assert.equal(controlado.status, 201);
    assert.equal(api.db.prescricoes.find((p) => p.id === prescricao.id).tipoReceita, 'CONTROLE_ESPECIAL');
  });

  test('finalizar sela registro e prescrição; depois, só retificação do autor', async () => {
    assert.equal((await api.pedir('PATCH', `/consultas/${consulta.id}`, { token, corpo: { status: 'FINALIZADO' } })).status, 200);
    const selado = api.db.registrosClinicos.find((r) => r.id === registro.id);
    assert.equal(selado.selado, true);
    assert.ok(selado.dataSelagem);
    assert.equal((await api.pedir('PATCH', `/registrosClinicos/${registro.id}`, { token, corpo: { conduta: 'x' } })).status, 409);
    const item = api.db.itensPrescricao.find((i) => i.idPrescricao === prescricao.id);
    assert.equal((await api.pedir('PATCH', `/itensPrescricao/${item.id}`, { token, corpo: { quantidade: 30 } })).status, 409);

    const semMotivo = await api.pedir('POST', '/retificacoes', {
      token,
      corpo: { idRegistroClinico: registro.id, campo: 'conduta', textoCorrigido: 'Analgésico se dor. Retorno em 15 dias.' },
    });
    assert.equal(semMotivo.status, 422);
    const certa = await api.pedir('POST', '/retificacoes', {
      token,
      corpo: { idRegistroClinico: registro.id, campo: 'conduta', textoCorrigido: 'Analgésico se dor. Retorno em 15 dias.', motivo: 'Faltou o retorno' },
    });
    assert.equal(certa.status, 201);
    assert.equal(certa.corpo.textoAnterior, 'Analgésico se dor.');
    const repetida = await api.pedir('POST', '/retificacoes', {
      token,
      corpo: { idRegistroClinico: registro.id, campo: 'cid', textoCorrigido: 'G44.2', motivo: 'Faltou o retorno' },
    });
    assert.equal(repetida.status, 422, 'motivo repetido');
    assert.equal(api.db.registrosClinicos.find((r) => r.id === registro.id).conduta, 'Analgésico se dor.', 'o original fica');

    const outro = await api.entrar('medico2');
    const alheia = await api.pedir('POST', '/retificacoes', {
      token: outro,
      corpo: { idRegistroClinico: registro.id, campo: 'conduta', textoCorrigido: 'Outra conduta qualquer.', motivo: 'Tentativa de outro médico' },
    });
    assert.notEqual(alheia.status, 201);
  });
});

describe('acesso de exceção (RF06)', () => {
  let api;
  before(async () => {
    api = await subir();
  });
  after(() => api.fechar());

  test('justificativa com conteúdo, aviso ao Administrador e padrão atípico no segundo pedido', async () => {
    const token = await api.entrar('medico');
    const eu = pessoaDe(api.db, 'medico');
    const comVinculo = new Set(api.db.vinculos.filter((v) => v.idMedico === eu && ['ATIVO', 'HISTORICO'].includes(v.estado)).map((v) => v.idPaciente));
    const paciente = api.db.pacientes.find((p) => !comVinculo.has(p.id) && !api.db.acessosExcecao.some((a) => a.idPaciente === p.id && a.idMedico === eu));
    assert.equal((await api.pedir('GET', `/registrosClinicos?idPaciente=${paciente.id}`, { token })).corpo.length, 0);

    const curta = await api.pedir('POST', '/acessosExcecao', { token, corpo: { idPaciente: paciente.id, justificativa: 'urgente' } });
    assert.equal(curta.status, 422);
    const semSentido = await api.pedir('POST', '/acessosExcecao', { token, corpo: { idPaciente: paciente.id, justificativa: 'aaaaaaa aaaaaaa aaaaaaa aaaaaaa' } });
    assert.equal(semSentido.status, 422);

    const texto = 'Paciente chegou em crise alérgica e preciso ver as alergias registradas.';
    const avisosAntes = api.db.notificacoes.filter((n) => n.evento === 'ACESSO_EXCECAO').length;
    const certo = await api.pedir('POST', '/acessosExcecao', { token, corpo: { idPaciente: paciente.id, justificativa: texto } });
    assert.equal(certo.status, 201);
    assert.equal(certo.corpo.padraoAtipico, false);
    assert.ok(api.db.notificacoes.filter((n) => n.evento === 'ACESSO_EXCECAO').length > avisosAntes);
    assert.ok(api.db.logsAuditoria.some((l) => l.acao === 'ACESSO_EXCECAO'));

    const repetido = await api.pedir('POST', '/acessosExcecao', { token, corpo: { idPaciente: paciente.id, justificativa: texto } });
    assert.equal(repetido.status, 422);
    const segundo = await api.pedir('POST', '/acessosExcecao', {
      token,
      corpo: { idPaciente: paciente.id, justificativa: 'Retorno da crise alérgica; conferir a medicação em uso no prontuário.' },
    });
    assert.equal(segundo.status, 201);
    assert.equal(segundo.corpo.padraoAtipico, true);
  });
});

describe('exportações e documento (RF29, RF30)', () => {
  let api;
  before(async () => {
    api = await subir();
  });
  after(() => api.fechar());

  test('o prontuário completo sai sem anotações privadas, só para quem pediu', async () => {
    const token = await api.entrar('medico');
    const eu = pessoaDe(api.db, 'medico');
    const anotacao = api.db.anotacoesPrivadas.find((a) => a.idMedico === eu);
    const paciente = anotacao.idPaciente;
    const pedido = await api.pedir('POST', '/exportacoes', { token, corpo: { tipo: 'PRONTUARIO', formato: 'PDF', idPaciente: paciente } });
    assert.equal(pedido.status, 201);
    assert.equal(pedido.corpo.situacao, 'SOLICITADA');
    assert.equal(pedido.corpo.idSolicitante, api.db.usuarios.find((u) => u.login === 'medico').id);

    const documento = await api.pedir('GET', `/exportacoes/${pedido.corpo.id}/documento`, { token });
    assert.equal(documento.status, 200);
    assert.equal(documento.corpo.tipo, 'PRONTUARIO');
    assert.ok(Array.isArray(documento.corpo.registros));
    assert.ok(documento.corpo.verificacao);
    assert.ok(!JSON.stringify(documento.corpo).includes(anotacao.texto), 'a anotação privada nunca entra');
    assert.ok(api.db.logsAuditoria.some((l) => l.acao === 'BAIXAR' && l.registroAlvo === `exportacoes/${pedido.corpo.id}`));

    const outro = await api.entrar('medico2');
    const alheio = await api.pedir('GET', `/exportacoes/${pedido.corpo.id}/documento`, { token: outro });
    assert.ok([403, 404].includes(alheio.status));
  });

  test('o histórico do titular não leva conteúdo clínico nem motivo de cancelamento', async () => {
    const token = await api.entrar('paciente');
    const pedido = await api.pedir('POST', '/exportacoes', { token, corpo: { tipo: 'HISTORICO', formato: 'PDF' } });
    assert.equal(pedido.status, 201);
    const documento = await api.pedir('GET', `/exportacoes/${pedido.corpo.id}/documento`, { token });
    assert.equal(documento.status, 200);
    assert.ok(documento.corpo.atendimentos.length > 0);
    const texto = JSON.stringify(documento.corpo);
    for (const proibido of ['diagnostico', 'queixas', 'cid', 'motivoCancelamento', 'prescricoes']) assert.ok(!texto.includes(proibido), proibido);
  });
});
