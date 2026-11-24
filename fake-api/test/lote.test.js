'use strict';

// RF55: a recepção monta o lote com guias liberadas de uma operadora e o envia.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { gerarBanco } = require('../seed');
const { criarApi } = require('../servidor');
const contas = require('../usuarios-de-teste.json');

test('a recepção monta o lote, cada guia vira título da operadora e o envio registra o protocolo', async () => {
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
    const convenioDe = (g) => db.contratosOperadora.find((c) => c.id === g.idContratoOperadora).idConvenio;
    const livres = db.guiasTiss.filter((g) => g.situacao === 'LIBERADA' && g.idLoteCobranca == null);
    assert.ok(livres.length >= 2, 'o seed deixa guias liberadas fora de lote');
    const idConvenio = convenioDe(livres[0]);
    const daOperadora = livres.filter((g) => convenioDe(g) === idConvenio);
    const deOutra = livres.find((g) => convenioDe(g) !== idConvenio);
    const titulosAntes = db.titulosReceber.length;

    if (deOutra) {
      const misturado = await pedir('POST', '/tiss/lotes', { token: secretaria, corpo: { idConvenio, idsGuias: [daOperadora[0].id, deOutra.id] } });
      assert.equal(misturado.status, 422);
    }
    assert.equal((await pedir('POST', '/tiss/lotes', { token: secretaria, corpo: { idConvenio, idsGuias: [] } })).status, 422);

    const criado = await pedir('POST', '/tiss/lotes', { token: secretaria, corpo: { idConvenio, idsGuias: daOperadora.map((g) => g.id) } });
    assert.equal(criado.status, 201, JSON.stringify(criado.corpo));
    assert.equal(criado.corpo.situacao, 'A_ENVIAR');
    assert.equal(criado.corpo.guias, daOperadora.length);
    assert.equal(criado.corpo.valorApresentado, undefined, 'a Secretária não vê o total do lote (D9)');
    const lote = db.lotesCobranca.find((l) => l.id === criado.corpo.id);
    assert.equal(lote.valorApresentado, Math.round(daOperadora.reduce((s, g) => s + g.valor * 100, 0)) / 100);
    assert.ok(daOperadora.every((g) => g.idLoteCobranca === lote.id));
    assert.equal(db.titulosReceber.length, titulosAntes + daOperadora.length);

    const repetido = await pedir('POST', '/tiss/lotes', { token: secretaria, corpo: { idConvenio, idsGuias: [daOperadora[0].id] } });
    assert.equal(repetido.status, 422, 'a guia não entra em dois lotes');

    const enviado = await pedir('POST', `/tiss/lotes/${lote.id}/enviar`, { token: secretaria });
    assert.equal(enviado.status, 200, JSON.stringify(enviado.corpo));
    assert.equal(enviado.corpo.situacao, 'PROTOCOLADO');
    assert.ok(enviado.corpo.protocolo);
    assert.ok(daOperadora.every((g) => g.situacao === 'ENVIADA'));
    assert.equal((await pedir('POST', `/tiss/lotes/${lote.id}/enviar`, { token: secretaria })).status, 409);

    const admin = await entrar('admin');
    assert.equal((await pedir('POST', '/tiss/lotes', { token: admin, corpo: { idConvenio, idsGuias: [] } })).status, 403);
  } finally {
    await new Promise((fim) => servidor.close(fim));
  }
});
