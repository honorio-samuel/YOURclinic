'use strict';

// RF59: reenvio manual da notificação que falhou, aviso por telefone e
// preferência de aviso do titular.

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
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const texto = await res.text();
    return { status: res.status, corpo: texto ? JSON.parse(texto) : null };
  }
  async function entrar(login) {
    const r = await pedir('POST', '/login', { corpo: { login, senha: SENHA } });
    assert.equal(r.status, 200);
    return r.corpo.token;
  }
  return { db, pedir, entrar, fechar: () => new Promise((fim) => servidor.close(fim)) };
}

describe('notificação que falhou (RF59)', () => {
  let api;
  let secretaria;
  before(async () => {
    api = await subir();
    secretaria = await api.entrar('secretaria');
  });
  after(() => api.fechar());

  test('a Secretária reenvia e o reenvio fica registrado', async () => {
    const falha = api.db.notificacoes.find((n) => n.situacao === 'FALHA' && n.destino);
    const antes = falha.tentativas ?? 0;
    const r = await api.pedir('POST', `/notificacoes/${falha.id}/reenviar`, { token: secretaria });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.equal(r.corpo.situacao, 'ENVIADA');
    assert.equal(r.corpo.tentativas, antes + 1);
    assert.equal(r.corpo.reenvio.idUsuario, api.db.usuarios.find((u) => u.login === 'secretaria').id);
    assert.equal((await api.pedir('POST', `/notificacoes/${falha.id}/reenviar`, { token: secretaria })).status, 409);
  });

  test('sem destino, só o aviso por telefone; a coleção não muda direto', async () => {
    // Uma notificação que falhou e não tem destino cadastrado.
    const falha = api.db.notificacoes.find((n) => n.situacao === 'ENVIADA');
    Object.assign(falha, { situacao: 'FALHA', destino: null });
    assert.equal((await api.pedir('POST', `/notificacoes/${falha.id}/reenviar`, { token: secretaria })).status, 409);
    const r = await api.pedir('POST', `/notificacoes/${falha.id}/aviso-por-telefone`, { token: secretaria });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.situacao, 'AVISADO_POR_TELEFONE');
    const outra = api.db.notificacoes.find((n) => n.situacao === 'ENVIADA');
    assert.equal((await api.pedir('PATCH', `/notificacoes/${outra.id}`, { token: secretaria, corpo: { situacao: 'FALHA' } })).status, 403);
    const medico = await api.entrar('medico');
    assert.equal((await api.pedir('POST', `/notificacoes/${outra.id}/reenviar`, { token: medico })).status, 403);
  });
});

describe('preferência de aviso do titular (RF39, RN-59.2)', () => {
  let api;
  before(async () => {
    api = await subir();
  });
  after(() => api.fechar());

  test('o titular desliga os lembretes e a escolha fica no cadastro', async () => {
    const paciente = await api.entrar('paciente');
    const eu = api.db.usuarios.find((u) => u.login === 'paciente').idPessoa;
    assert.deepEqual((await api.pedir('GET', '/portal/preferencias', { token: paciente })).corpo, { lembretes: true, cobrancas: true });
    const r = await api.pedir('PUT', '/portal/preferencias', { token: paciente, corpo: { lembretes: false, cobrancas: true } });
    assert.equal(r.status, 200);
    assert.deepEqual(api.db.pacientes.find((p) => p.id === eu).preferenciasAviso, { lembretes: false, cobrancas: true });
    assert.equal((await api.pedir('PUT', '/portal/preferencias', { token: paciente, corpo: { lembretes: 'nao' } })).status, 422);
    const secretaria = await api.entrar('secretaria');
    assert.equal((await api.pedir('GET', '/portal/preferencias', { token: secretaria })).status, 403);
  });
});
