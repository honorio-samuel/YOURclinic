'use strict';

// Painel financeiro (RF35) e dashboard gerencial (RF41): só o Administrador,
// números que fecham com o banco e nada clínico. Carimbos da fila (RF22).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { gerarBanco } = require('../seed');
const { criarApi } = require('../servidor');
const { somarDiasUteis } = require('../indicadores');
const contas = require('../usuarios-de-teste.json');

const BANCO = gerarBanco();
const SENHA = contas.senhaDemonstracao;
const DEZ_HORAS = () => new Date(2026, 8, 28, 10, 0, 0);

async function subir() {
  const db = structuredClone(BANCO);
  const servidor = http.createServer(criarApi({ db, relogio: DEZ_HORAS, enviarEmail: () => {} }));
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

describe('indicadores (RF35, RF41)', () => {
  let api;
  before(async () => {
    api = await subir();
  });
  after(() => api.fechar());

  test('só o Administrador lê os painéis', async () => {
    for (const login of ['secretaria', 'medico', 'paciente']) {
      const token = await api.entrar(login);
      assert.equal((await api.pedir('GET', '/indicadores/financeiro', { token })).status, 403, login);
      assert.equal((await api.pedir('GET', '/indicadores/gerencial', { token })).status, 403, login);
    }
  });

  test('o painel financeiro fecha com os títulos e traz a data-base', async () => {
    const token = await api.entrar('admin');
    const { status, corpo } = await api.pedir('GET', '/indicadores/financeiro', { token });
    assert.equal(status, 200);
    assert.equal(corpo.dataBase, '2026-09-28');
    const pacienteAberto = api.db.titulosReceber
      .filter((t) => t.situacao === 'ABERTO' && !['CONVENIO', 'OPERADORA'].includes(t.origem))
      .reduce((s, t) => s + t.valor, 0);
    const r = corpo.receberPaciente;
    assert.equal(Math.round((r.aVencer.valor + r.vencido.valor) * 100), Math.round(pacienteAberto * 100));
    assert.equal(corpo.cartaoEmTransito.taxa, Math.round((corpo.cartaoEmTransito.bruto - corpo.cartaoEmTransito.liquido) * 100) / 100);
    assert.ok(corpo.saldo.projetado !== undefined && corpo.saldo.realizado !== undefined);
  });

  test('o dashboard não traz nada clínico e respeita o período', async () => {
    const token = await api.entrar('admin');
    const { corpo } = await api.pedir('GET', '/indicadores/gerencial?de=2026-09-01&ate=2026-09-28', { token });
    assert.deepEqual(corpo.periodo, { de: '2026-09-01', ate: '2026-09-28' });
    const texto = JSON.stringify(corpo);
    // Nenhum campo clínico como chave do resultado ("vencida" contém "cid").
    for (const proibido of ['diagnostico', 'cid', 'prescricoes', 'queixas']) assert.ok(!texto.includes(`"${proibido}"`), proibido);
    const finalizadas = api.db.consultas.filter((c) => c.status === 'FINALIZADO' && c.dataHora >= '2026-09-01' && c.dataHora <= '2026-09-28T23:59:59').length;
    assert.equal(corpo.desfecho.FINALIZADO, finalizadas);
    assert.ok(corpo.tempoMedioEspera.amostra > 0);
    assert.ok(corpo.ociosidade.blocos === corpo.ociosidade.ocupados + corpo.ociosidade.livres + corpo.ociosidade.bloqueados.reduce((s, b) => s + b.blocos, 0));
    assert.equal((await api.pedir('GET', '/indicadores/gerencial?de=2026-09-28&ate=2026-09-01', { token })).status, 422);
  });

  test('cada mudança de status guarda a hora (RF22)', async () => {
    const token = await api.entrar('secretaria');
    const consulta = api.db.consultas.find((c) => c.status === 'AGENDADO' && c.dataHora.startsWith('2026-09-28'));
    assert.equal((await api.pedir('PATCH', `/consultas/${consulta.id}`, { token, corpo: { status: 'NA_RECEPCAO' } })).status, 200);
    assert.equal(api.db.consultas.find((c) => c.id === consulta.id).carimbos.NA_RECEPCAO, '2026-09-28T10:00:00');
  });

  test('débito cai em dias úteis (X36)', () => {
    assert.equal(somarDiasUteis('2026-09-25', 1), '2026-09-28', 'sexta mais um dia útil é segunda');
  });
});
