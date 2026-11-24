'use strict';

// RF51: contrato com a operadora e tabela de preços, só do Administrador.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { gerarBanco } = require('../seed');
const { criarApi } = require('../servidor');
const contas = require('../usuarios-de-teste.json');

test('o Administrador cadastra contrato e tabela com validação; a Secretária só lê', async () => {
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
    const contrato = {
      idConvenio: db.convenios[0].id,
      numero: 'CT-9001',
      vigenciaInicio: '2026-10-01',
      vigenciaFim: '2027-09-30',
      versaoTiss: '4.01.00',
      meioTransmissao: 'PORTAL',
      prazoApresentacao: 30,
      prazoPagamento: 45,
      prazoRecurso: 30,
      situacao: 'VIGENTE',
    };
    assert.equal((await pedir('POST', '/contratosOperadora', { token: admin, corpo: { ...contrato, vigenciaFim: '2026-01-01' } })).status, 422);
    assert.equal((await pedir('POST', '/contratosOperadora', { token: admin, corpo: { ...contrato, numero: db.contratosOperadora[0].numero } })).status, 422);
    const criado = await pedir('POST', '/contratosOperadora', { token: admin, corpo: contrato });
    assert.equal(criado.status, 201, JSON.stringify(criado.corpo));
    assert.equal((await pedir('PATCH', `/contratosOperadora/${criado.corpo.id}`, { token: admin, corpo: { prazoPagamento: 0 } })).status, 422);
    assert.equal((await pedir('PATCH', `/contratosOperadora/${criado.corpo.id}`, { token: admin, corpo: { situacao: 'ENCERRADO' } })).status, 200);

    const item = { idContratoOperadora: criado.corpo.id, idProcedimento: db.procedimentos[0].id, valorNegociado: 120, vigenciaInicio: contrato.vigenciaInicio, vigenciaFim: contrato.vigenciaFim };
    assert.equal((await pedir('POST', '/itensTabelaPreco', { token: admin, corpo: { ...item, valorNegociado: 0 } })).status, 422);
    const preco = await pedir('POST', '/itensTabelaPreco', { token: admin, corpo: item });
    assert.equal(preco.status, 201, JSON.stringify(preco.corpo));
    assert.equal((await pedir('POST', '/itensTabelaPreco', { token: admin, corpo: item })).status, 422, 'o procedimento aparece uma vez por contrato');
    assert.equal((await pedir('PATCH', `/itensTabelaPreco/${preco.corpo.id}`, { token: admin, corpo: { valorNegociado: 130.5 } })).status, 200);

    const secretaria = await entrar('secretaria');
    assert.equal((await pedir('POST', '/contratosOperadora', { token: secretaria, corpo: { ...contrato, numero: 'CT-9002' } })).status, 403);
    assert.equal((await pedir('PATCH', `/itensTabelaPreco/${preco.corpo.id}`, { token: secretaria, corpo: { valorNegociado: 1 } })).status, 403);
  } finally {
    await new Promise((fim) => servidor.close(fim));
  }
});
