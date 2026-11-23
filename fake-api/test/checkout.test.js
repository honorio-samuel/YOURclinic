'use strict';

// Checkout e caixa (RF32, RF43 a RF47, A-13b): cobrança gerada ao finalizar,
// pagamento composto, Pix, TEF e maquininha avulsa simulados, conferência por
// outro usuário, sangria e cobrança criada pelo Administrador.

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
  const servidor = http.createServer(criarApi({ db, relogio: DEZ_HORAS, simulacao: { pixSegundos: 0, tefEsperaMs: 0 } }));
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

const pessoaDe = (db, login) => db.usuarios.find((u) => u.login === login).idPessoa;
const abertaDeHoje = (db) => db.cobrancas.find((c) => c.situacao === 'ABERTA' && c.dataEmissao === '2026-09-28' && c.idConsulta);
let sequencia = 0;
const chave = () => `teste-tef-${String(++sequencia).padStart(4, '0')}`;

describe('cobrança gerada ao finalizar (RF32)', () => {
  let api;
  before(async () => {
    api = await subir();
  });
  after(() => api.fechar());

  test('a consulta particular finalizada gera uma cobrança e um título, uma vez só', async () => {
    const token = await api.entrar('medico');
    const consulta = api.db.consultas.find(
      (c) => c.status === 'EM_ATENDIMENTO' && c.idMedico === pessoaDe(api.db, 'medico') && c.idConvenio === null
    );
    assert.ok(consulta, 'sem consulta em atendimento no banco sintético');
    assert.ok(!api.db.cobrancas.some((c) => c.idConsulta === consulta.id));
    assert.equal((await api.pedir('PATCH', `/consultas/${consulta.id}`, { token, corpo: { status: 'FINALIZADO' } })).status, 200);
    const cobrancas = api.db.cobrancas.filter((c) => c.idConsulta === consulta.id);
    assert.equal(cobrancas.length, 1);
    assert.equal(cobrancas[0].situacao, 'ABERTA');
    assert.ok(cobrancas[0].valorTotal > 0);
    const titulo = api.db.titulosReceber.find((t) => t.idCobranca === cobrancas[0].id);
    assert.equal(titulo.origem, 'PARTICULAR');
    assert.equal(titulo.situacao, 'ABERTO');

    // Volta retroativa e nova finalização não duplicam a cobrança.
    await api.pedir('PATCH', `/consultas/${consulta.id}`, { token, corpo: { status: 'EM_ATENDIMENTO', motivoTransicao: 'Faltou registrar a conduta.' } });
    await api.pedir('PATCH', `/consultas/${consulta.id}`, { token, corpo: { status: 'FINALIZADO' } });
    assert.equal(api.db.cobrancas.filter((c) => c.idConsulta === consulta.id).length, 1);
  });
});

describe('checkout: acesso e pagamento composto (RF43, RF44, RF47)', () => {
  let api;
  before(async () => {
    api = await subir();
  });
  after(() => api.fechar());

  test('só a Secretária executa o checkout', async () => {
    const cobranca = abertaDeHoje(api.db);
    for (const login of ['admin', 'medico', 'paciente']) {
      const token = await api.entrar(login);
      assert.equal((await api.pedir('GET', `/checkout/${cobranca.id}`, { token })).status, 403, login);
    }
    const token = await api.entrar('secretaria');
    const r = await api.pedir('GET', `/checkout/${cobranca.id}`, { token });
    assert.equal(r.status, 200);
    assert.equal(r.corpo.saldo, cobranca.valorTotal);
    assert.equal(r.corpo.caixaAberto, true);
    assert.equal(r.corpo.itens.length, 1);
    assert.ok(!JSON.stringify(r.corpo).includes('valorLiquido'));
    // Pagamento não nasce pela coleção.
    const direto = await api.pedir('POST', '/pagamentos', { token, corpo: { idCobranca: cobranca.id, valor: 1, meio: 'PIX', situacao: 'CONFIRMADO' } });
    assert.equal(direto.status, 403);
  });

  test('dinheiro e Pix quitam juntos; o título baixa e o titular é avisado', async () => {
    const token = await api.entrar('secretaria');
    const cobranca = abertaDeHoje(api.db);
    const parte = Math.round(cobranca.valorTotal * 40) / 100;
    const resto = Math.round((cobranca.valorTotal - parte) * 100) / 100;

    const acima = await api.pedir('POST', `/checkout/${cobranca.id}/dinheiro`, { token, corpo: { valor: cobranca.valorTotal + 1, valorRecebido: 1000 } });
    assert.equal(acima.status, 422);
    const pouco = await api.pedir('POST', `/checkout/${cobranca.id}/dinheiro`, { token, corpo: { valor: parte, valorRecebido: parte - 1 } });
    assert.equal(pouco.status, 422);

    const dinheiro = await api.pedir('POST', `/checkout/${cobranca.id}/dinheiro`, { token, corpo: { valor: parte, valorRecebido: parte + 20 } });
    assert.equal(dinheiro.status, 201);
    assert.equal(dinheiro.corpo.pagamento.troco, 20);
    assert.equal(dinheiro.corpo.saldo, resto);
    assert.equal(api.db.cobrancas.find((c) => c.id === cobranca.id).situacao, 'ABERTA');

    const pix = await api.pedir('POST', `/checkout/${cobranca.id}/pix`, { token, corpo: { valor: resto } });
    assert.equal(pix.status, 201);
    assert.equal(pix.corpo.pagamento.situacao, 'PENDENTE');
    assert.ok(pix.corpo.pagamento.brcode && pix.corpo.pagamento.txid);
    // Enquanto o QR espera, não sobra valor para outro meio.
    assert.equal(pix.corpo.disponivel, 0);

    const verificado = await api.pedir('POST', `/checkout/pix/${pix.corpo.pagamento.id}/verificar`, { token });
    assert.equal(verificado.corpo.pagamento.situacao, 'CONFIRMADO');
    assert.equal(verificado.corpo.cobranca.situacao, 'PAGA');
    assert.equal(api.db.titulosReceber.find((t) => t.idCobranca === cobranca.id).situacao, 'PAGO');
    assert.ok(api.db.notificacoes.some((n) => n.evento === 'PAGAMENTO_CONFIRMADO' && n.idConsulta === cobranca.idConsulta));

    const depois = await api.pedir('POST', `/checkout/${cobranca.id}/pix`, { token, corpo: { valor: 1 } });
    assert.equal(depois.status, 409);
  });

  test('o QR que expira não baixa e libera um novo txid (RF44, E1)', async () => {
    const token = await api.entrar('secretaria');
    const cobranca = api.db.cobrancas.find((c) => c.situacao === 'ABERTA' && c.idConsulta && c.id !== abertaDeHoje(api.db)?.id);
    api.db.parametros.find((p) => p.chave === 'X31').valor = 0;
    const primeiro = await api.pedir('POST', `/checkout/${cobranca.id}/pix`, { token, corpo: { valor: cobranca.valorTotal } });
    const expirado = await api.pedir('POST', `/checkout/pix/${primeiro.corpo.pagamento.id}/verificar`, { token });
    assert.equal(expirado.corpo.pagamento.situacao, 'EXPIRADO');
    assert.equal(expirado.corpo.cobranca.situacao, 'ABERTA');
    api.db.parametros.find((p) => p.chave === 'X31').valor = 30;
    const novo = await api.pedir('POST', `/checkout/${cobranca.id}/pix`, { token, corpo: { valor: cobranca.valorTotal } });
    assert.equal(novo.status, 201);
    assert.notEqual(novo.corpo.pagamento.txid, primeiro.corpo.pagamento.txid);
  });

  test('dinheiro só no caixa aberto de quem recebe (RN-47.1)', async () => {
    const token = await api.entrar('secretaria2');
    const cobranca = api.db.cobrancas.find((c) => c.situacao === 'ABERTA');
    const r = await api.pedir('POST', `/checkout/${cobranca.id}/dinheiro`, { token, corpo: { valor: 10, valorRecebido: 10 } });
    assert.equal(r.status, 409);
  });
});

describe('checkout: cartão (RF45, RF46)', () => {
  let api;
  let cobrancas;
  before(async () => {
    api = await subir();
    cobrancas = api.db.cobrancas.filter((c) => c.situacao === 'ABERTA' && c.idConsulta);
  });
  after(() => api.fechar());

  test('TEF aprovado guarda só bandeira, final, NSU e autorização; a mesma chave não cobra em dobro', async () => {
    const token = await api.entrar('secretaria');
    const cobranca = cobrancas[0];
    const k = chave();
    const r = await api.pedir('POST', `/checkout/${cobranca.id}/tef`, { token, corpo: { valor: cobranca.valorTotal, modalidade: 'DEBITO', chave: k } });
    assert.equal(r.status, 201);
    assert.equal(r.corpo.pagamento.situacao, 'CONFIRMADO');
    assert.match(r.corpo.pagamento.ultimosDigitos, /^\d{4}$/);
    assert.ok(r.corpo.pagamento.nsu && r.corpo.pagamento.codigoAutorizacao);
    assert.equal(r.corpo.cobranca.situacao, 'PAGA');
    const repetido = await api.pedir('POST', `/checkout/${cobranca.id}/tef`, { token, corpo: { valor: cobranca.valorTotal, modalidade: 'DEBITO', chave: k } });
    assert.equal(repetido.status, 200);
    assert.equal(repetido.corpo.pagamento.id, r.corpo.pagamento.id);
    assert.equal(api.db.pagamentos.filter((p) => p.idCobranca === cobranca.id).length, 1);
  });

  test('TEF negado, sem resposta e confirmado depois, ou não realizado (E1 a E4)', async () => {
    const token = await api.entrar('secretaria');
    const cobranca = cobrancas[1];
    const negado = await api.pedir('POST', `/checkout/${cobranca.id}/tef`, { token, corpo: { valor: 10.13, modalidade: 'CREDITO', chave: chave() } });
    assert.equal(negado.corpo.pagamento.situacao, 'NEGADO');
    assert.equal(negado.corpo.pago, 0);

    const semResposta = await api.pedir('POST', `/checkout/${cobranca.id}/tef`, { token, corpo: { valor: 10.48, modalidade: 'CREDITO', chave: chave() } });
    assert.equal(semResposta.corpo.pagamento.situacao, 'INDEFINIDO');
    const naoHouve = await api.pedir('POST', `/checkout/tef/${semResposta.corpo.pagamento.id}/confirmar`, { token });
    assert.equal(naoHouve.corpo.pagamento.situacao, 'NAO_REALIZADO');

    const atrasada = await api.pedir('POST', `/checkout/${cobranca.id}/tef`, { token, corpo: { valor: 10.49, modalidade: 'CREDITO', chave: chave() } });
    assert.equal(atrasada.corpo.pagamento.situacao, 'INDEFINIDO');
    const aprovada = await api.pedir('POST', `/checkout/tef/${atrasada.corpo.pagamento.id}/confirmar`, { token });
    assert.equal(aprovada.corpo.pagamento.situacao, 'CONFIRMADO');
    assert.equal(aprovada.corpo.pago, 10.49);
  });

  test('parcelas seguem X32 e X33 (RN-43.2)', async () => {
    const token = await api.entrar('secretaria');
    const cobranca = cobrancas[2];
    const pequeno = await api.pedir('POST', `/checkout/${cobranca.id}/tef`, {
      token,
      corpo: { valor: 40, modalidade: 'CREDITO_PARCELADO_LOJISTA', parcelas: 2, chave: chave() },
    });
    assert.equal(pequeno.status, 422);
    const demais = await api.pedir('POST', `/checkout/${cobranca.id}/tef`, {
      token,
      corpo: { valor: 100, modalidade: 'CREDITO_PARCELADO_EMISSOR', parcelas: 3, chave: chave() },
    });
    assert.equal(demais.status, 422, 'R$ 100 dividem em no máximo 2 parcelas de R$ 50');
    const certo = await api.pedir('POST', `/checkout/${cobranca.id}/tef`, {
      token,
      corpo: { valor: 100, modalidade: 'CREDITO_PARCELADO_EMISSOR', parcelas: 2, chave: chave() },
    });
    assert.equal(certo.status, 201);
    assert.equal(certo.corpo.pagamento.parcelas, 2);
  });

  test('POS avulso: NSU e autorização obrigatórios, NSU repetido recusado, conciliação pendente', async () => {
    const token = await api.entrar('secretaria');
    const cobranca = cobrancas[3];
    const base = { modalidade: 'CREDITO', bandeira: 'VISA', ultimosDigitos: '4242', adquirente: 'Adquirente Fictícia B' };
    const semNsu = await api.pedir('POST', `/checkout/${cobranca.id}/pos`, { token, corpo: { ...base, valor: 50, codigoAutorizacao: 'AB1234' } });
    assert.equal(semNsu.status, 422);
    const certo = await api.pedir('POST', `/checkout/${cobranca.id}/pos`, {
      token,
      corpo: { ...base, valor: 50, nsu: '123456', codigoAutorizacao: 'ab1234' },
    });
    assert.equal(certo.status, 201);
    assert.equal(certo.corpo.pagamento.situacao, 'CONFIRMADO');
    assert.equal(certo.corpo.pagamento.codigoAutorizacao, 'AB1234');
    assert.equal(api.db.pagamentosCartao.find((c) => c.id === certo.corpo.pagamento.id).situacaoConciliacao, 'PENDENTE');
    const dobro = await api.pedir('POST', `/checkout/${cobranca.id}/pos`, {
      token,
      corpo: { ...base, valor: 10, nsu: '123456', codigoAutorizacao: 'CD5678' },
    });
    assert.equal(dobro.status, 409);
  });

  test('POS acima do X52 espera outro usuário (RN-46.3)', async () => {
    const token = await api.entrar('secretaria');
    // Limite baixo para o teste não depender dos valores do banco sintético.
    api.db.parametros.find((p) => p.chave === 'X52').valor = 100;
    const cobranca = cobrancas.find((c) => c.valorTotal > 100 && api.db.cobrancas.find((x) => x.id === c.id).situacao === 'ABERTA' && !api.db.pagamentos.some((p) => p.idCobranca === c.id));
    assert.ok(cobranca, 'sem cobrança acima de R$ 100 no banco sintético');
    const corpo = {
      valor: cobranca.valorTotal, modalidade: 'CREDITO', bandeira: 'ELO', ultimosDigitos: '1234',
      adquirente: 'Adquirente Fictícia A', nsu: '654321', codigoAutorizacao: 'ZX9876',
    };
    const lancado = await api.pedir('POST', `/checkout/${cobranca.id}/pos`, { token, corpo });
    assert.equal(lancado.corpo.pagamento.situacao, 'AGUARDANDO_CONFERENCIA');
    assert.equal(lancado.corpo.cobranca.situacao, 'ABERTA');
    const id = lancado.corpo.pagamento.id;

    const proprio = await api.pedir('POST', `/checkout/pagamentos/${id}/conferir`, { token, corpo: { aprovar: true } });
    assert.equal(proprio.status, 409);

    const colega = await api.entrar('secretaria2');
    const fila = await api.pedir('GET', '/checkout/conferencias', { token: colega });
    assert.ok(fila.corpo.some((p) => p.id === id && p.lancadoPorMim === false && p.paciente));
    const semMotivo = await api.pedir('POST', `/checkout/pagamentos/${id}/conferir`, { token: colega, corpo: { aprovar: false } });
    assert.equal(semMotivo.status, 422);
    const ok = await api.pedir('POST', `/checkout/pagamentos/${id}/conferir`, { token: colega, corpo: { aprovar: true } });
    assert.equal(ok.status, 200);
    assert.equal(ok.corpo.cobranca.situacao, 'PAGA');
    assert.equal(api.db.pagamentos.find((p) => p.id === id).idConferente, api.db.usuarios.find((u) => u.login === 'secretaria2').id);
  });
});

describe('caixa: sangria e reforço (RF47)', () => {
  let api;
  before(async () => {
    api = await subir();
  });
  after(() => api.fechar());

  test('com motivo e só no próprio caixa aberto; entram no esperado do fechamento', async () => {
    const token = await api.entrar('secretaria');
    const caixa = api.db.caixas.find((c) => c.situacao === 'ABERTO' && c.idSecretaria === pessoaDe(api.db, 'secretaria'));
    const semMotivo = await api.pedir('POST', '/movimentosCaixa', { token, corpo: { idCaixa: caixa.id, tipo: 'SANGRIA', valor: 50 } });
    assert.equal(semMotivo.status, 422);
    const sangria = await api.pedir('POST', '/movimentosCaixa', {
      token,
      corpo: { idCaixa: caixa.id, tipo: 'SANGRIA', valor: 50, motivo: 'Depósito no cofre' },
    });
    assert.equal(sangria.status, 201);
    const outra = await api.entrar('secretaria2');
    const alheio = await api.pedir('POST', '/movimentosCaixa', {
      token: outra,
      corpo: { idCaixa: caixa.id, tipo: 'REFORCO', valor: 10, motivo: 'Troco para a tarde' },
    });
    assert.equal(alheio.status, 422);

    const fechado = await api.pedir('PATCH', `/caixas/${caixa.id}`, {
      token,
      corpo: { dataFechamento: '2026-09-28T18:00:00', saldoContado: caixa.saldoInicial - 50 },
    });
    assert.equal(fechado.status, 200);
    assert.equal(api.db.caixas.find((c) => c.id === caixa.id).situacao, 'FECHADO', 'a sangria sai do esperado');
  });

  test('a Secretária não muda a situação do caixa; reconta quando o Administrador devolve', async () => {
    const token = await api.entrar('secretaria');
    const aberto = await api.pedir('POST', '/caixas', { token, corpo: { saldoInicial: 100, turno: 'TARDE' } });
    assert.equal(aberto.status, 201);
    await api.pedir('PATCH', `/caixas/${aberto.corpo.id}`, { token, corpo: { situacao: 'FECHADO' } });
    assert.equal(api.db.caixas.find((c) => c.id === aberto.corpo.id).situacao, 'ABERTO');

    await api.pedir('PATCH', `/caixas/${aberto.corpo.id}`, {
      token,
      corpo: { dataFechamento: '2026-09-28T18:00:00', saldoContado: 90, justificativa: 'Contagem com pressa.' },
    });
    assert.equal(api.db.caixas.find((c) => c.id === aberto.corpo.id).situacao, 'A_APROVAR');
    const admin = await api.entrar('admin');
    const devolvido = await api.pedir('PATCH', `/caixas/${aberto.corpo.id}`, {
      token: admin,
      corpo: { situacao: 'RECONTAGEM', motivoDevolucao: 'Conte de novo as notas de 10.' },
    });
    assert.equal(devolvido.status, 200);
    const recontado = await api.pedir('PATCH', `/caixas/${aberto.corpo.id}`, { token, corpo: { saldoContado: 100, justificativa: null } });
    assert.equal(recontado.status, 200);
    const noBanco = api.db.caixas.find((c) => c.id === aberto.corpo.id);
    assert.equal(noBanco.situacao, 'FECHADO');
    assert.equal(noBanco.divergencia, 0);
  });
});

describe('cobrança criada pelo Administrador (A-13b)', () => {
  let api;
  before(async () => {
    api = await subir();
  });
  after(() => api.fechar());

  test('cria de uma consulta finalizada sem cobrança, edita antes do pagamento e não depois', async () => {
    const token = await api.entrar('admin');
    const consulta = api.db.consultas.find((c) => c.status === 'FINALIZADO' && !api.db.cobrancas.some((x) => x.idConsulta === c.id));
    assert.ok(consulta);
    const corpo = { idConsulta: consulta.id, idOrcamento: null, valorTotal: 80, vencimento: '2026-10-05' };
    const criada = await api.pedir('POST', '/cobrancas', { token, corpo });
    assert.equal(criada.status, 201);
    assert.equal(criada.corpo.situacao, 'ABERTA');
    const titulo = api.db.titulosReceber.find((t) => t.idCobranca === criada.corpo.id);
    assert.equal(titulo.valor, 80);
    assert.equal(titulo.vencimento, '2026-10-05');
    assert.equal((await api.pedir('POST', '/cobrancas', { token, corpo })).status, 422, 'a consulta já tem cobrança');

    const editada = await api.pedir('PATCH', `/cobrancas/${criada.corpo.id}`, { token, corpo: { valorTotal: 90, vencimento: '2026-10-06' } });
    assert.equal(editada.status, 200);
    assert.equal(titulo.valor, 90);

    const secretaria = await api.entrar('secretaria');
    await api.pedir('POST', `/checkout/${criada.corpo.id}/pos`, {
      token: secretaria,
      corpo: {
        valor: 90, modalidade: 'DEBITO', bandeira: 'VISA', ultimosDigitos: '0001', adquirente: 'Adquirente Fictícia A',
        nsu: '777777', codigoAutorizacao: 'QW1234',
      },
    });
    const tarde = await api.pedir('PATCH', `/cobrancas/${criada.corpo.id}`, { token, corpo: { valorTotal: 100, vencimento: '2026-10-06' } });
    assert.equal(tarde.status, 409);
  });
});
