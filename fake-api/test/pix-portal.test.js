'use strict';

// Pagamento pelo portal (P-05a, R-05a): o titular paga a própria cobrança
// por Pix no PSP simulado, e só a dele.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { gerarBanco } = require('../seed');
const { criarApi } = require('../servidor');
const contas = require('../usuarios-de-teste.json');

const BANCO = gerarBanco();
const SENHA = contas.senhaDemonstracao;
const DEZ_HORAS = () => new Date(2026, 8, 28, 10, 0, 0);

async function subir(pixSegundos) {
  const db = structuredClone(BANCO);
  const servidor = http.createServer(criarApi({ db, relogio: DEZ_HORAS, simulacao: { pixSegundos, tefEsperaMs: 0 } }));
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

const pacienteDa = (db, c) => db.consultas.find((x) => x.id === c.idConsulta)?.idPaciente ?? db.orcamentos.find((o) => o.id === c.idOrcamento)?.idPaciente;

describe('Pix pelo portal', () => {
  test('o titular gera o QR, que fica pago e quita a cobrança', async () => {
    const api = await subir(0);
    try {
      const token = await api.entrar('paciente');
      const eu = api.db.usuarios.find((u) => u.login === 'paciente').idPessoa;
      const aberta = api.db.cobrancas.find((c) => c.situacao === 'ABERTA' && pacienteDa(api.db, c) === eu);
      assert.ok(aberta, 'banco sem cobrança aberta do paciente');
      const r = await api.pedir('POST', `/checkout/${aberta.id}/pix-portal`, { token });
      assert.equal(r.status, 201, JSON.stringify(r.corpo));
      assert.equal(r.corpo.pagamento.situacao, 'PENDENTE');
      assert.ok(r.corpo.pagamento.brcode);
      const v = await api.pedir('POST', `/checkout/pix/${r.corpo.pagamento.id}/verificar`, { token });
      assert.equal(v.status, 200);
      assert.equal(v.corpo.pagamento.situacao, 'CONFIRMADO');
      assert.equal(v.corpo.cobranca.situacao, 'PAGA');
      assert.equal(v.corpo.cobranca.saldo, 0);
      assert.equal((await api.pedir('POST', `/checkout/${aberta.id}/pix-portal`, { token })).status, 409);
    } finally {
      await api.fechar();
    }
  });

  test('pagar de novo devolve o mesmo QR; cobrança de outro e rotas da recepção ficam fechadas', async () => {
    const api = await subir(600);
    try {
      const token = await api.entrar('paciente');
      const eu = api.db.usuarios.find((u) => u.login === 'paciente').idPessoa;
      const aberta = api.db.cobrancas.find((c) => c.situacao === 'ABERTA' && pacienteDa(api.db, c) === eu);
      const primeiro = await api.pedir('POST', `/checkout/${aberta.id}/pix-portal`, { token });
      const segundo = await api.pedir('POST', `/checkout/${aberta.id}/pix-portal`, { token });
      assert.equal(segundo.status, 200);
      assert.equal(segundo.corpo.pagamento.id, primeiro.corpo.pagamento.id);
      const deOutro = api.db.cobrancas.find((c) => c.situacao === 'ABERTA' && pacienteDa(api.db, c) !== eu);
      assert.equal((await api.pedir('POST', `/checkout/${deOutro.id}/pix-portal`, { token })).status, 404);
      assert.equal((await api.pedir('GET', `/checkout/${aberta.id}`, { token })).status, 403);
      assert.equal((await api.pedir('POST', `/checkout/${aberta.id}/dinheiro`, { token, corpo: { valor: 1, valorRecebido: 1 } })).status, 403);
    } finally {
      await api.fechar();
    }
  });
});
