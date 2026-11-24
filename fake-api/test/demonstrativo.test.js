'use strict';

// RF56: demonstrativo de retorno da operadora simulada para o lote protocolado.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { gerarBanco } = require('../seed');
const { criarApi } = require('../servidor');
const contas = require('../usuarios-de-teste.json');


test('o demonstrativo paga ou glosa as guias do lote, uma vez só, e a glosa nova vai a recurso', async () => {
  const db = gerarBanco();
  const servidor = http.createServer(criarApi({ db, relogio: () => new Date(2026, 8, 28, 10, 0, 0) }));
  await new Promise((pronto) => servidor.listen(0, '127.0.0.1', pronto));
  const { port } = servidor.address();
  const pedir = async (metodo, caminho, { token, corpo } = {}) => {
    const res = await fetch(`http://127.0.0.1:${port}${caminho}`, {
      method: metodo,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const texto = await res.text();
    return { status: res.status, corpo: texto ? JSON.parse(texto) : null };
  };
  const entrar = async (login) => (await pedir('POST', '/login', { corpo: { login, senha: contas.senhaDemonstracao } })).corpo.token;
  try {
    const secretaria = await entrar('secretaria');
    const aEnviar = db.lotesCobranca.find((l) => l.situacao === 'A_ENVIAR');
    assert.equal((await pedir('POST', '/tiss/demonstrativo', { token: secretaria, corpo: { idLoteCobranca: aEnviar.id } })).status, 409);
    const lote = db.lotesCobranca.find((l) => l.situacao === 'PROTOCOLADO');
    const glosasAntes = db.glosas.length;
    const r = await pedir('POST', '/tiss/demonstrativo', { token: secretaria, corpo: { idLoteCobranca: lote.id } });
    assert.equal(r.status, 200, JSON.stringify(r.corpo));
    assert.ok(r.corpo.pagas > 0 && r.corpo.glosadas > 0);
    assert.equal(db.glosas.length, glosasAntes + r.corpo.glosadas);
    assert.equal((await pedir('POST', '/tiss/demonstrativo', { token: secretaria, corpo: { idLoteCobranca: lote.id } })).status, 409);

    const nova = db.glosas[db.glosas.length - 1];
    assert.equal(nova.situacao, 'GLOSADO');
    const recurso = await pedir('POST', '/recursosGlosa', { token: secretaria, corpo: { idGlosa: nova.id, justificativa: 'Carteirinha válida na data, segue o comprovante.' } });
    assert.equal(recurso.status, 201, JSON.stringify(recurso.corpo));

    const admin = await entrar('admin');
    assert.equal((await pedir('POST', '/tiss/demonstrativo', { token: admin, corpo: { idLoteCobranca: lote.id } })).status, 403);
  } finally {
    await new Promise((fim) => servidor.close(fim));
  }
});
