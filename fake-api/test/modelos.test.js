'use strict';

// RF59: modelos e canais dos avisos, ajustados pelo Administrador.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { gerarBanco } = require('../seed');
const { criarApi } = require('../servidor');
const contas = require('../usuarios-de-teste.json');


test('o Administrador ajusta o modelo do aviso; campo desconhecido e Secretária são barrados', async () => {
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
    const admin = await entrar('admin');
    const lista = await pedir('GET', '/modelosNotificacao', { token: admin });
    assert.equal(lista.status, 200);
    assert.ok(lista.corpo.length >= 5, 'a API nasce com os modelos padrão');
    const modelo = lista.corpo.find((m) => m.evento === 'CONFIRMACAO_AGENDAMENTO');
    assert.equal((await pedir('PATCH', `/modelosNotificacao/${modelo.id}`, { token: admin, corpo: { texto: 'Seu diagnóstico: {cid}, no dia {data}.' } })).status, 422);
    const ok = await pedir('PATCH', `/modelosNotificacao/${modelo.id}`, { token: admin, corpo: { texto: 'Consulta com {medico} em {data} às {hora}.', canal: 'EMAIL', ativo: false } });
    assert.equal(ok.status, 200, JSON.stringify(ok.corpo));
    assert.equal(ok.corpo.canal, 'EMAIL');
    assert.equal(ok.corpo.ativo, false);
    await pedir('PATCH', `/modelosNotificacao/${modelo.id}`, { token: admin, corpo: { evento: 'OUTRO' } });
    assert.equal(db.modelosNotificacao.find((m) => m.id === modelo.id).evento, 'CONFIRMACAO_AGENDAMENTO', 'o evento do modelo não muda');
    const secretaria = await entrar('secretaria');
    assert.equal((await pedir('PATCH', `/modelosNotificacao/${modelo.id}`, { token: secretaria, corpo: { ativo: true } })).status, 403);
  } finally {
    await new Promise((fim) => servidor.close(fim));
  }
});
