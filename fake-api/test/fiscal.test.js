'use strict';

// Recibo (RF33) e NFS-e (RF34): emissão só de título pago, numeração por
// tipo sem lacunas, pagador distinto do paciente, alíquotas da tabela,
// rejeição simulada do ambiente nacional e leitura pelo titular.

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
  const servidor = http.createServer(criarApi({ db, relogio: DEZ_HORAS }));
  await new Promise((pronto) => servidor.listen(0, '127.0.0.1', pronto));
  const { port } = servidor.address();

  async function pedir(metodo, caminho, { token, corpo } = {}) {
    const res = await fetch(`http://127.0.0.1:${port}${caminho}`, {
      method: metodo,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      },
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

const pacienteDoTitulo = (db, t) => {
  const c = db.cobrancas.find((x) => x.id === t.idCobranca);
  return db.consultas.find((x) => x.id === c?.idConsulta)?.idPaciente ?? db.orcamentos.find((o) => o.id === c?.idOrcamento)?.idPaciente;
};
const semDocumento = (db, tipo, filtro = () => true) =>
  db.titulosReceber.find(
    (t) => t.idCobranca && t.situacao === 'PAGO' && !db.documentosFiscais.some((d) => d.idTituloReceber === t.id && d.tipo === tipo) && filtro(t)
  );
const maiorNumero = (db, tipo) => Math.max(0, ...db.documentosFiscais.filter((d) => d.tipo === tipo && d.numero).map((d) => Number(d.numero)));

describe('emissão de recibo (RF33)', () => {
  let api;
  let secretaria;
  before(async () => {
    api = await subir();
    secretaria = await api.entrar('secretaria');
  });
  after(() => api.fechar());

  test('a coleção genérica não emite documento', async () => {
    const t = semDocumento(api.db, 'RECIBO');
    assert.equal((await api.pedir('POST', '/documentosFiscais', { token: secretaria, corpo: { tipo: 'RECIBO', idTituloReceber: t.id } })).status, 403);
    const admin = await api.entrar('admin');
    assert.equal((await api.pedir('PATCH', '/documentosFiscais/1', { token: admin, corpo: { situacao: 'CANCELADO' } })).status, 403);
  });

  test('recibo de título pago, com número seguinte e sem nada clínico', async () => {
    const t = semDocumento(api.db, 'RECIBO');
    const esperado = String(maiorNumero(api.db, 'RECIBO') + 1).padStart(8, '0');
    const r = await api.pedir('POST', '/financeiro/documentos/recibo', { token: secretaria, corpo: { idTituloReceber: t.id } });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    assert.equal(r.corpo.numero, esperado);
    assert.equal(r.corpo.situacao, 'EMITIDO');
    assert.equal(r.corpo.valor, t.valor);
    assert.ok(r.corpo.descricao && r.corpo.emitente.cnpj);
    assert.equal(r.corpo.paciente.nome, api.db.pessoas.find((p) => p.id === pacienteDoTitulo(api.db, t)).nome);
    const texto = JSON.stringify(r.corpo);
    assert.ok(!/"cid"|diagnostico/i.test(texto));
    const repetido = await api.pedir('POST', '/financeiro/documentos/recibo', { token: secretaria, corpo: { idTituloReceber: t.id } });
    assert.equal(repetido.status, 409);
  });

  test('título aberto ou de operadora não gera recibo', async () => {
    const aberto = api.db.titulosReceber.find((t) => t.idCobranca && t.situacao === 'ABERTO');
    assert.equal((await api.pedir('POST', '/financeiro/documentos/recibo', { token: secretaria, corpo: { idTituloReceber: aberto.id } })).status, 409);
    const operadora = api.db.titulosReceber.find((t) => !t.idCobranca);
    assert.equal((await api.pedir('POST', '/financeiro/documentos/recibo', { token: secretaria, corpo: { idTituloReceber: operadora.id } })).status, 422);
  });

  test('o pagador pode ser o responsável legal; outra pessoa, não (RN-33.2)', async () => {
    const representado = new Set(api.db.representacoes.map((r) => r.idPaciente));
    const t = semDocumento(api.db, 'RECIBO', (x) => representado.has(pacienteDoTitulo(api.db, x)));
    assert.ok(t, 'banco sem título pago de representado');
    const responsavel = api.db.representacoes.find((r) => r.idPaciente === pacienteDoTitulo(api.db, t)).idResponsavelLegal;
    const estranho = api.db.pessoas.find((p) => p.id !== responsavel && p.id !== pacienteDoTitulo(api.db, t));
    assert.equal((await api.pedir('POST', '/financeiro/documentos/recibo', { token: secretaria, corpo: { idTituloReceber: t.id, idPagador: estranho.id } })).status, 422);
    const r = await api.pedir('POST', '/financeiro/documentos/recibo', { token: secretaria, corpo: { idTituloReceber: t.id, idPagador: responsavel } });
    assert.equal(r.status, 201);
    assert.equal(r.corpo.pagador.nome, api.db.pessoas.find((p) => p.id === responsavel).nome);
    assert.notEqual(r.corpo.pagador.nome, r.corpo.paciente.nome);
  });
});

describe('emissão de NFS-e (RF34)', () => {
  let api;
  let admin;
  before(async () => {
    api = await subir();
    admin = await api.entrar('admin');
  });
  after(() => api.fechar());

  test('só o Administrador emite; IBS e CBS vêm da tabela', async () => {
    const secretaria = await api.entrar('secretaria');
    const comCpf = (t) => api.db.pessoas.find((p) => p.id === pacienteDoTitulo(api.db, t))?.cpf;
    const t = semDocumento(api.db, 'NFSE', comCpf);
    assert.equal((await api.pedir('POST', '/financeiro/documentos/nfse', { token: secretaria, corpo: { idTituloReceber: t.id } })).status, 403);
    const esperado = String(maiorNumero(api.db, 'NFSE') + 1).padStart(8, '0');
    const r = await api.pedir('POST', '/financeiro/documentos/nfse', { token: admin, corpo: { idTituloReceber: t.id, ibs: 99 } });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    assert.equal(r.corpo.situacao, 'EMITIDO');
    assert.equal(r.corpo.numero, esperado);
    assert.match(r.corpo.chaveAcesso, /^SIM\d{8}\d{8}$/);
    assert.equal(r.corpo.ibs, Math.round(t.valor * 0.1) / 100);
    assert.equal(r.corpo.cbs, Math.round(t.valor * 0.9) / 100);
  });

  test('tomador sem CPF: a nota fica pendente com o erro e é reenviada depois da correção', async () => {
    const semCpf = (t) => !api.db.pessoas.find((p) => p.id === pacienteDoTitulo(api.db, t))?.cpf;
    const t = semDocumento(api.db, 'NFSE', semCpf);
    const r = await api.pedir('POST', '/financeiro/documentos/nfse', { token: admin, corpo: { idTituloReceber: t.id } });
    assert.equal(r.status, 201);
    assert.equal(r.corpo.situacao, 'PENDENTE');
    assert.equal(r.corpo.numero, null);
    assert.equal(r.corpo.erro.codigo, 'SIM-E01');
    assert.equal((await api.pedir('POST', '/financeiro/documentos/nfse', { token: admin, corpo: { idTituloReceber: t.id } })).status, 409);
    const ainda = await api.pedir('POST', `/financeiro/documentos/${r.corpo.id}/reenviar`, { token: admin });
    assert.equal(ainda.corpo.situacao, 'PENDENTE');
    api.db.pessoas.find((p) => p.id === pacienteDoTitulo(api.db, t)).cpf = '000.000.999-99';
    const ok = await api.pedir('POST', `/financeiro/documentos/${r.corpo.id}/reenviar`, { token: admin });
    assert.equal(ok.status, 200);
    assert.equal(ok.corpo.situacao, 'EMITIDO');
    assert.ok(ok.corpo.numero);
    assert.equal((await api.pedir('POST', `/financeiro/documentos/${r.corpo.id}/reenviar`, { token: admin })).status, 409);
  });
});

describe('leitura do documento', () => {
  let api;
  before(async () => {
    api = await subir();
  });
  after(() => api.fechar());

  test('o titular lê o próprio documento e não o dos outros', async () => {
    const token = await api.entrar('paciente');
    const eu = api.db.usuarios.find((u) => u.login === 'paciente').idPessoa;
    const meus = api.db.documentosFiscais.filter((d) => pacienteDoTitulo(api.db, api.db.titulosReceber.find((t) => t.id === d.idTituloReceber)) === eu);
    const outro = api.db.documentosFiscais.find((d) => pacienteDoTitulo(api.db, api.db.titulosReceber.find((t) => t.id === d.idTituloReceber)) !== eu);
    assert.ok(meus.length > 0);
    const r = await api.pedir('GET', `/financeiro/documentos/${meus[0].id}`, { token });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.numero, meus[0].numero);
    assert.equal((await api.pedir('GET', `/financeiro/documentos/${outro.id}`, { token })).status, 404);
  });

  test('a Secretária lê recibo, não NFS-e', async () => {
    const token = await api.entrar('secretaria');
    const recibo = api.db.documentosFiscais.find((d) => d.tipo === 'RECIBO');
    const nfse = api.db.documentosFiscais.find((d) => d.tipo === 'NFSE');
    assert.equal((await api.pedir('GET', `/financeiro/documentos/${recibo.id}`, { token })).status, 200);
    assert.equal((await api.pedir('GET', `/financeiro/documentos/${nfse.id}`, { token })).status, 404);
  });
});
