'use strict';

// RF49: importação do extrato da adquirente e tratamento da divergência.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { gerarBanco } = require('../seed');
const { criarApi } = require('../servidor');
const contas = require('../usuarios-de-teste.json');


test('o extrato concilia as pendentes e a divergência é aceita ou contestada', async () => {
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
    assert.equal((await pedir('POST', '/financeiro/conciliacao/extrato', { token: secretaria, corpo: {} })).status, 403);

    const admin = await entrar('admin');
    const importado = await pedir('POST', '/financeiro/conciliacao/extrato', { token: admin, corpo: {} });
    assert.equal(importado.status, 200, JSON.stringify(importado.corpo));
    assert.equal(importado.corpo.lidas, importado.corpo.conciliadas + importado.corpo.divergentes);
    assert.ok(importado.corpo.divergentes > 0 && importado.corpo.conciliadas > 0);
    const divergentes = db.pagamentosCartao.filter((c) => c.situacaoConciliacao === 'DIVERGENTE' && c.extratoImportadoEm);
    assert.equal(divergentes.length, importado.corpo.divergentes);

    const [aceitar, contestar] = divergentes;
    assert.equal((await pedir('POST', `/financeiro/conciliacao/${aceitar.id}/tratar`, { token: admin, corpo: { decisao: 'ACEITAR' } })).status, 422);
    const aceita = await pedir('POST', `/financeiro/conciliacao/${aceitar.id}/tratar`, { token: admin, corpo: { decisao: 'ACEITAR', observacao: 'Taxa de antecipação.' } });
    assert.equal(aceita.status, 200, JSON.stringify(aceita.corpo));
    assert.equal(aceita.corpo.situacaoConciliacao, 'CONCILIADO');
    assert.equal(aceita.corpo.valorLiquido, aceitar.valorExtrato);
    const contestada = await pedir('POST', `/financeiro/conciliacao/${contestar.id}/tratar`, { token: admin, corpo: { decisao: 'CONTESTAR', observacao: 'Pedir o ajuste à adquirente.' } });
    assert.equal(contestada.corpo.situacaoConciliacao, 'CONTESTADO');
    assert.equal((await pedir('POST', `/financeiro/conciliacao/${contestar.id}/tratar`, { token: admin, corpo: { decisao: 'ACEITAR', observacao: 'De novo.' } })).status, 409);
  } finally {
    await new Promise((fim) => servidor.close(fim));
  }
});
