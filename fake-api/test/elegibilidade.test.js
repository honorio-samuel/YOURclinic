'use strict';

// RF52: consulta de elegibilidade na operadora simulada.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { gerarBanco } = require('../seed');
const { criarApi } = require('../servidor');
const contas = require('../usuarios-de-teste.json');

test('a recepção consulta a elegibilidade e a resposta fica registrada', async () => {
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
    const comConvenio = db.consultas.find((c) => c.idConvenio && db.elegibilidades.some((e) => e.idPaciente === c.idPaciente && e.carteirinha && !e.carteirinha.endsWith('9')));
    const ok = await pedir('POST', '/tiss/elegibilidade', { token: secretaria, corpo: { idConsulta: comConvenio.id } });
    assert.equal(ok.status, 201, JSON.stringify(ok.corpo));
    assert.equal(ok.corpo.situacao, 'ELEGIVEL');
    assert.equal(comConvenio.convenioConferido, true);
    comConvenio.numeroCarteirinha = '1234560009';
    const inativa = await pedir('POST', '/tiss/elegibilidade', { token: secretaria, corpo: { idConsulta: comConvenio.id } });
    assert.equal(inativa.corpo.situacao, 'NAO_ELEGIVEL');
    assert.ok(inativa.corpo.motivo);
    const particular = db.consultas.find((c) => !c.idConvenio);
    assert.equal((await pedir('POST', '/tiss/elegibilidade', { token: secretaria, corpo: { idConsulta: particular.id } })).status, 422);
    const admin = await entrar('admin');
    assert.equal((await pedir('POST', '/tiss/elegibilidade', { token: admin, corpo: { idConsulta: comConvenio.id } })).status, 403);
    assert.equal((await pedir('POST', '/elegibilidades', { token: secretaria, corpo: { situacao: 'ELEGIVEL' } })).status, 403);
  } finally {
    await new Promise((fim) => servidor.close(fim));
  }
});
