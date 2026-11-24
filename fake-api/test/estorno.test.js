'use strict';

// Cancelamento e estorno (RF48): matriz por meio, pedido da Secretária,
// aprovação do Administrador com os efeitos (título reaberto, recibo e NFS-e
// cancelados, devolução no caixa) e registro de chargeback.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { gerarBanco } = require('../seed');
const { criarApi } = require('../servidor');
const { avaliarReversao, PRAZO_PIX_DIAS } = require('../estorno');
const { resumoDaCobranca } = require('../checkout');
const contas = require('../usuarios-de-teste.json');

const BANCO = gerarBanco();
const SENHA = contas.senhaDemonstracao;
const HOJE = '2026-09-28';
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

const semEstorno = (db, p) => !db.estornos.some((e) => e.idPagamento === p.id);
const doMeio = (db, meio, filtro = () => true) =>
  db.pagamentos.find((p) => p.meio === meio && p.situacao === 'CONFIRMADO' && p.valor > 0 && semEstorno(db, p) && filtro(p));
const cartao = (db, p) => db.pagamentosCartao.find((c) => c.id === p.id);
const docsDaCobranca = (db, idCobranca) => {
  const titulos = db.titulosReceber.filter((t) => t.idCobranca === idCobranca).map((t) => t.id);
  return db.documentosFiscais.filter((d) => titulos.includes(d.idTituloReceber));
};

describe('matriz de reversibilidade por meio (RF48)', () => {
  const avaliar = (db, p, hoje = HOJE) => avaliarReversao(db, p, { hoje, prazoCredito: 30 });

  test('dinheiro: saída do caixa aberto ou devolução no caixa do dia', () => {
    const db = structuredClone(BANCO);
    const p = doMeio(db, 'DINHEIRO');
    const caixa = db.caixas.find((c) => c.id === db.pagamentosDinheiro.find((d) => d.id === p.id).idCaixa);
    caixa.situacao = 'FECHADO';
    assert.equal(avaliar(db, p).forma, 'DEVOLUCAO_CAIXA_SEGUINTE');
    caixa.situacao = 'ABERTO';
    const r = avaliar(db, p);
    assert.equal(r.forma, 'SAIDA_DE_CAIXA');
    assert.equal(r.parcial, true);
  });

  test('Pix: devolução pelo PSP no prazo; depois, transferência manual', () => {
    const db = structuredClone(BANCO);
    const p = doMeio(db, 'PIX');
    assert.equal(avaliar(db, p, p.dataHora.slice(0, 10)).forma, 'DEVOLUCAO_PSP');
    const depois = new Date(Date.parse(`${p.dataHora.slice(0, 10)}T00:00:00Z`) + (PRAZO_PIX_DIAS + 1) * 86400000).toISOString().slice(0, 10);
    assert.equal(avaliar(db, p, depois).forma, 'TRANSFERENCIA_MANUAL');
  });

  test('débito: cancelamento só no mesmo dia e sem parcial; depois, Pix ou dinheiro', () => {
    const db = structuredClone(BANCO);
    const p = doMeio(db, 'CARTAO', (x) => cartao(db, x).modalidade === 'DEBITO');
    const noDia = avaliar(db, p, p.dataHora.slice(0, 10));
    assert.equal(noDia.tipo, 'CANCELAMENTO');
    assert.equal(noDia.forma, 'CANCELAMENTO_TERMINAL');
    assert.equal(noDia.parcial, false);
    const depois = avaliar(db, p);
    assert.equal(depois.tipo, 'ESTORNO');
    assert.equal(depois.forma, 'DEVOLUCAO_OUTRO_MEIO');
    assert.equal(depois.exigeMeio, true);
    assert.equal(depois.parcial, false);
  });

  test('crédito: cancelamento no adquirente até o X34; depois, outro meio', () => {
    const db = structuredClone(BANCO);
    const p = doMeio(db, 'CARTAO', (x) => cartao(db, x).modalidade === 'CREDITO' && x.dataHora >= '2026-09-01');
    assert.equal(avaliar(db, p).forma, 'CANCELAMENTO_ADQUIRENTE');
    assert.equal(avaliar(db, p).parcial, true);
    const tarde = new Date(Date.parse(`${p.dataHora.slice(0, 10)}T00:00:00Z`) + 31 * 86400000).toISOString().slice(0, 10);
    assert.equal(avaliar(db, p, tarde).forma, 'DEVOLUCAO_OUTRO_MEIO');
  });

  test('o estorno feito sai do pago da cobrança e reabre o título', () => {
    const feito = BANCO.estornos.find((e) => e.situacao === 'ESTORNADO');
    const p = BANCO.pagamentos.find((x) => x.id === feito.idPagamento);
    const cobranca = BANCO.cobrancas.find((c) => c.id === p.idCobranca);
    assert.equal(resumoDaCobranca(BANCO, cobranca).saldo, feito.valor);
    assert.equal(cobranca.situacao, 'ABERTA');
    assert.equal(BANCO.titulosReceber.find((t) => t.idCobranca === cobranca.id).situacao, 'ABERTO');
  });
});

describe('pedido e aprovação (RF48)', () => {
  let api;
  let secretaria;
  let admin;
  before(async () => {
    api = await subir();
    secretaria = await api.entrar('secretaria');
    admin = await api.entrar('admin');
  });
  after(() => api.fechar());

  test('só pelas rotas próprias: a coleção genérica não grava estorno', async () => {
    const p = doMeio(api.db, 'PIX');
    assert.equal((await api.pedir('POST', '/estornos', { token: secretaria, corpo: { idPagamento: p.id, valor: 1, motivo: 'Teste de rota' } })).status, 403);
    assert.equal((await api.pedir('PATCH', '/estornos/2', { token: admin, corpo: { situacao: 'ESTORNADO' } })).status, 403);
    assert.equal((await api.pedir('POST', '/financeiro/estornos', { token: admin, corpo: { idPagamento: p.id, valor: 1, motivo: 'Pedido do admin' } })).status, 403);
  });

  test('crédito parcial: pedido, um por vez, e aprovação com os efeitos', async () => {
    const p = doMeio(api.db, 'CARTAO', (x) => cartao(api.db, x).modalidade === 'CREDITO' && docsDaCobranca(api.db, x.idCobranca).length > 0);
    const avaliacao = await api.pedir('GET', `/financeiro/estornos/avaliar/${p.id}`, { token: secretaria });
    assert.equal(avaliacao.status, 200);
    assert.equal(avaliacao.corpo.forma, 'CANCELAMENTO_ADQUIRENTE');
    const pedido = await api.pedir('POST', '/financeiro/estornos', {
      token: secretaria,
      corpo: { idPagamento: p.id, valor: 50, motivo: 'Desconto combinado depois do pagamento' },
    });
    assert.equal(pedido.status, 201, JSON.stringify(pedido.corpo));
    assert.equal(pedido.corpo.situacao, 'A_APROVAR');
    assert.equal(pedido.corpo.tipo, 'ESTORNO');
    const outro = await api.pedir('POST', '/financeiro/estornos', { token: secretaria, corpo: { idPagamento: p.id, valor: 10, motivo: 'Mais um pedido' } });
    assert.equal(outro.status, 409);
    assert.equal((await api.pedir('POST', `/financeiro/estornos/${pedido.corpo.id}/aprovar`, { token: secretaria })).status, 403);

    const aprovado = await api.pedir('POST', `/financeiro/estornos/${pedido.corpo.id}/aprovar`, { token: admin });
    assert.equal(aprovado.status, 200, JSON.stringify(aprovado.corpo));
    assert.equal(aprovado.corpo.situacao, 'ESTORNADO');
    assert.match(aprovado.corpo.protocolo, /^EST-\d{6}$/);
    const original = api.db.pagamentos.find((x) => x.id === p.id);
    assert.equal(original.valor, p.valor);
    assert.equal(original.situacao, 'CONFIRMADO');
    const cobranca = api.db.cobrancas.find((c) => c.id === p.idCobranca);
    assert.equal(resumoDaCobranca(api.db, cobranca).saldo, 50);
    assert.equal(cobranca.situacao, 'ABERTA');
    assert.ok(api.db.titulosReceber.filter((t) => t.idCobranca === cobranca.id).every((t) => t.situacao === 'ABERTO'));
    assert.ok(docsDaCobranca(api.db, cobranca.id).every((d) => d.situacao === 'CANCELADO'));
    const depois = await api.pedir('GET', `/financeiro/estornos/avaliar/${p.id}`, { token: secretaria });
    assert.equal(depois.corpo.disponivel, p.valor - 50);
  });

  test('débito de outro dia: só o total, por Pix ou dinheiro', async () => {
    const p = doMeio(api.db, 'CARTAO', (x) => cartao(api.db, x).modalidade === 'DEBITO');
    const base = { idPagamento: p.id, motivo: 'Cobrança feita em duplicidade' };
    assert.equal((await api.pedir('POST', '/financeiro/estornos', { token: secretaria, corpo: { ...base, valor: p.valor - 1, meioDevolucao: 'PIX' } })).status, 422);
    assert.equal((await api.pedir('POST', '/financeiro/estornos', { token: secretaria, corpo: { ...base, valor: p.valor } })).status, 422);
    const r = await api.pedir('POST', '/financeiro/estornos', { token: secretaria, corpo: { ...base, valor: p.valor, meioDevolucao: 'PIX' } });
    assert.equal(r.status, 201);
    assert.equal(r.corpo.forma, 'DEVOLUCAO_OUTRO_MEIO');
    assert.equal(r.corpo.meioDevolucao, 'PIX');
  });

  test('dinheiro: a devolução sai de um caixa aberto', async () => {
    const p = doMeio(api.db, 'DINHEIRO');
    const pedido = await api.pedir('POST', '/financeiro/estornos', {
      token: secretaria,
      corpo: { idPagamento: p.id, valor: p.valor, motivo: 'Consulta não realizada' },
    });
    assert.equal(pedido.status, 201);
    const aberto = api.db.caixas.find((c) => c.situacao === 'ABERTO');
    aberto.situacao = 'FECHADO';
    const semCaixa = await api.pedir('POST', `/financeiro/estornos/${pedido.corpo.id}/aprovar`, { token: admin });
    assert.equal(semCaixa.status, 409);
    assert.match(semCaixa.corpo.erro, /caixa aberto/);
    aberto.situacao = 'ABERTO';
    const r = await api.pedir('POST', `/financeiro/estornos/${pedido.corpo.id}/aprovar`, { token: admin });
    assert.equal(r.status, 200);
    const devolucao = api.db.movimentosCaixa.find((m) => m.idEstorno === pedido.corpo.id);
    assert.equal(devolucao.tipo, 'DEVOLUCAO');
    assert.equal(devolucao.idCaixa, aberto.id);
    assert.equal(devolucao.valor, p.valor);
  });

  test('recusar pede motivo; o pedido decidido não muda', async () => {
    const pendente = api.db.estornos.find((e) => e.situacao === 'A_APROVAR' && e.idSolicitante != null);
    assert.equal((await api.pedir('POST', `/financeiro/estornos/${pendente.id}/recusar`, { token: admin, corpo: {} })).status, 422);
    const r = await api.pedir('POST', `/financeiro/estornos/${pendente.id}/recusar`, { token: admin, corpo: { motivo: 'Devolução já feita por fora' } });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.situacao, 'RECUSADO');
    assert.equal((await api.pedir('POST', `/financeiro/estornos/${pendente.id}/aprovar`, { token: admin })).status, 409);
  });

  test('a aprovação confere de novo o que o meio permite', async () => {
    const p = doMeio(api.db, 'PIX', (x) => x.dataHora >= '2026-09-01');
    const pedido = await api.pedir('POST', '/financeiro/estornos', { token: secretaria, corpo: { idPagamento: p.id, valor: p.valor, motivo: 'Paciente pediu a devolução' } });
    assert.equal(pedido.status, 201);
    api.db.estornos.find((e) => e.id === pedido.corpo.id).forma = 'TRANSFERENCIA_MANUAL';
    const r = await api.pedir('POST', `/financeiro/estornos/${pedido.corpo.id}/aprovar`, { token: admin });
    assert.equal(r.status, 409);
  });

  test('chargeback: a Secretária registra, só em cartão, sem aprovação', async () => {
    const p = doMeio(api.db, 'CARTAO');
    const r = await api.pedir('POST', '/financeiro/estornos', {
      token: secretaria,
      corpo: { idPagamento: p.id, chargeback: true, valor: p.valor, motivo: 'Aviso do adquirente: contestação do portador' },
    });
    assert.equal(r.status, 201);
    assert.equal(r.corpo.tipo, 'CHARGEBACK');
    assert.equal(r.corpo.situacao, 'REGISTRADO');
    const pix = doMeio(api.db, 'PIX');
    const naoCartao = await api.pedir('POST', '/financeiro/estornos', {
      token: secretaria,
      corpo: { idPagamento: pix.id, chargeback: true, valor: pix.valor, motivo: 'Contestação de Pix' },
    });
    assert.equal(naoCartao.status, 422);
  });
});
