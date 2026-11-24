'use strict';

// Estoque (RF36 a RF38): saldo pela soma das movimentações, entrada por lote,
// saída com sugestão do lote que vence primeiro e bloqueio do lote vencido,
// descarte com motivo, ajuste com aprovação e alertas recalculados.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { gerarBanco } = require('../seed');
const { criarApi } = require('../servidor');
const { saldoDoLote, recalcularAlertas } = require('../estoque');
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

const pessoaDe = (db, login) => db.usuarios.find((u) => u.login === login).idPessoa;
const produto = (db, inicio) => db.produtos.find((p) => p.descricao.startsWith(inicio));
const lotesDe = (db, p) => db.lotes.filter((l) => l.idProduto === p.id);
const loteValido = (db, p) => lotesDe(db, p).find((l) => l.validade >= HOJE && l.quantidade > 0);
const consultaDeHoje = (db, status, idMedico) =>
  db.consultas.find((c) => c.dataHora.startsWith(HOJE) && c.status === status && (idMedico == null || c.idMedico === idMedico));
const alertasAbertos = (db, tipo, idProduto) =>
  db.alertasEstoque.filter((a) => a.situacao === 'ABERTO' && a.tipo === tipo && a.idProduto === idProduto);

describe('saldo e alertas do banco sintético', () => {
  test('o saldo de cada lote é a soma das movimentações (RN-36.2)', () => {
    for (const lote of BANCO.lotes) assert.equal(saldoDoLote(BANCO, lote.id), lote.quantidade, `lote ${lote.numero}`);
  });

  test('os alertas do banco são os que o sistema abriria (RN-38.2)', () => {
    const db = structuredClone(BANCO);
    const mudou = recalcularAlertas(db, { hoje: HOJE, antecedencia: 60, inserir: () => assert.fail('alerta novo') });
    assert.equal(mudou, false);
    assert.deepEqual(
      db.alertasEstoque.filter((a) => a.situacao === 'ABERTO').map((a) => a.tipo).sort(),
      ['MINIMO', 'VALIDADE', 'VENCIDO']
    );
  });

  test('o X14 é a antecedência do alerta de validade, com a faixa da especificação', () => {
    const x14 = BANCO.parametros.find((p) => p.chave === 'X14');
    assert.equal(x14.valor, 60);
    assert.equal(x14.faixaMinima, 7);
    assert.equal(x14.faixaMaxima, 180);
    assert.equal(BANCO.parametros.find((p) => p.chave === 'X46'), undefined);
  });
});

describe('quem grava no estoque', () => {
  let api;
  before(async () => {
    api = await subir();
  });
  after(() => api.fechar());

  test('ninguém grava movimentação nem lote pela coleção genérica', async () => {
    const lote = api.db.lotes[0];
    for (const login of ['admin', 'secretaria', 'medico']) {
      const token = await api.entrar(login);
      const mov = await api.pedir('POST', '/movimentacoes', { token, corpo: { tipo: 'ENTRADA', quantidade: 1, idLote: lote.id } });
      assert.equal(mov.status, 403, login);
      assert.equal((await api.pedir('POST', '/lotes', { token, corpo: { numero: 'X', idProduto: 1 } })).status, 403, login);
      assert.equal((await api.pedir('PATCH', `/lotes/${lote.id}`, { token, corpo: { quantidade: 999 } })).status, 403, login);
    }
    assert.notEqual(lote.quantidade, 999);
  });

  test('entrada é de Administrador e Secretária; saída, de Secretária e Médico', async () => {
    const medico = await api.entrar('medico');
    const admin = await api.entrar('admin');
    const p = produto(api.db, 'Seringa');
    const entrada = { idProduto: p.id, numeroLote: 'L00001', validade: loteValido(api.db, p).validade, quantidade: 1, origem: 'COMPRA' };
    assert.equal((await api.pedir('POST', '/estoque/entradas', { token: medico, corpo: entrada })).status, 403);
    const descarte = { idLote: loteValido(api.db, p).id, quantidade: 1, destino: 'DESCARTE', motivoDescarte: 'AVARIA' };
    assert.equal((await api.pedir('POST', '/estoque/saidas', { token: admin, corpo: descarte })).status, 403);
    assert.equal((await api.pedir('POST', '/estoque/ajustes', { token: medico, corpo: { idLote: 1, quantidadeContada: 1, justificativa: 'Contagem' } })).status, 403);
  });
});

describe('entrada (RF37)', () => {
  let api;
  let token;
  before(async () => {
    api = await subir();
    token = await api.entrar('secretaria');
  });
  after(() => api.fechar());

  test('lote existente recebe a quantidade, e o saldo vem das movimentações', async () => {
    const p = produto(api.db, 'Lidocaína');
    const lote = loteValido(api.db, p);
    const antes = lote.quantidade;
    const r = await api.pedir('POST', '/estoque/entradas', {
      token,
      corpo: { idProduto: p.id, numeroLote: lote.numero.toLowerCase(), validade: lote.validade, quantidade: 20, origem: 'DOACAO' },
    });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    assert.equal(r.corpo.lote.id, lote.id);
    assert.equal(lote.quantidade, antes + 20);
    assert.equal(saldoDoLote(api.db, lote.id), lote.quantidade);
    const m = api.db.movimentacoes.find((x) => x.id === r.corpo.movimentacao.id);
    assert.equal(m.idUsuario, api.db.usuarios.find((u) => u.login === 'secretaria').id);
    assert.equal(m.origem, 'DOACAO');
  });

  test('lote novo nasce da entrada', async () => {
    const p = produto(api.db, 'Vacina');
    const r = await api.pedir('POST', '/estoque/entradas', {
      token,
      corpo: { idProduto: p.id, numeroLote: 'VG2027A', validade: '2027-03-31', quantidade: 40, origem: 'COMPRA' },
    });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    const lote = api.db.lotes.find((l) => l.numero === 'VG2027A');
    assert.ok(lote);
    assert.equal(lote.quantidade, 40);
    assert.equal(lote.idProduto, p.id);
  });

  test('medicamento sem lote ou validade é recusado (RN-36.1)', async () => {
    const p = produto(api.db, 'Lidocaína');
    const base = { idProduto: p.id, quantidade: 5, origem: 'COMPRA' };
    assert.equal((await api.pedir('POST', '/estoque/entradas', { token, corpo: { ...base, validade: '2027-01-31' } })).status, 422);
    assert.equal((await api.pedir('POST', '/estoque/entradas', { token, corpo: { ...base, numeroLote: 'NOVO1' } })).status, 422);
  });

  test('o mesmo lote não muda de validade, e lote vencido não entra', async () => {
    const p = produto(api.db, 'Lidocaína');
    const lote = loteValido(api.db, p);
    const outra = await api.pedir('POST', '/estoque/entradas', {
      token,
      corpo: { idProduto: p.id, numeroLote: lote.numero, validade: '2030-01-01', quantidade: 1, origem: 'COMPRA' },
    });
    assert.equal(outra.status, 422);
    assert.match(outra.corpo.erro, /já está cadastrado com validade/);
    const vencida = await api.pedir('POST', '/estoque/entradas', {
      token,
      corpo: { idProduto: p.id, numeroLote: 'VELHO', validade: '2026-09-27', quantidade: 1, origem: 'COMPRA' },
    });
    assert.equal(vencida.status, 422);
  });

  test('quantidade inválida e produto inativo são recusados', async () => {
    const p = produto(api.db, 'Seringa');
    const lote = loteValido(api.db, p);
    for (const quantidade of [0, -3, 1.5, 'dez']) {
      const r = await api.pedir('POST', '/estoque/entradas', {
        token,
        corpo: { idProduto: p.id, numeroLote: lote.numero, validade: lote.validade, quantidade, origem: 'COMPRA' },
      });
      assert.equal(r.status, 422, String(quantidade));
    }
    const inativo = api.db.produtos.find((x) => x.situacao === 'INATIVO');
    const r = await api.pedir('POST', '/estoque/entradas', {
      token,
      corpo: { idProduto: inativo.id, numeroLote: 'Z1', validade: '2027-01-01', quantidade: 1, origem: 'COMPRA' },
    });
    assert.equal(r.status, 409);
  });

  test('só o Administrador vincula o título a pagar, e só na compra', async () => {
    const admin = await api.entrar('admin');
    const p = produto(api.db, 'Gaze');
    const lote = loteValido(api.db, p);
    const titulo = api.db.titulosPagar[1];
    const base = { idProduto: p.id, numeroLote: lote.numero, validade: lote.validade, quantidade: 2, idTituloPagar: titulo.id };
    assert.equal((await api.pedir('POST', '/estoque/entradas', { token: admin, corpo: { ...base, origem: 'DOACAO' } })).status, 422);
    const doAdmin = await api.pedir('POST', '/estoque/entradas', { token: admin, corpo: { ...base, origem: 'COMPRA' } });
    assert.equal(doAdmin.status, 201);
    assert.equal(api.db.movimentacoes.find((m) => m.id === doAdmin.corpo.movimentacao.id).idTituloPagar, titulo.id);
    const daSecretaria = await api.pedir('POST', '/estoque/entradas', { token, corpo: { ...base, origem: 'COMPRA' } });
    assert.equal(daSecretaria.status, 201);
    assert.equal(api.db.movimentacoes.find((m) => m.id === daSecretaria.corpo.movimentacao.id).idTituloPagar, null);
    assert.equal('idTituloPagar' in daSecretaria.corpo.movimentacao, false);
  });
});

describe('saída (RF37 e RF38)', () => {
  let api;
  let token;
  before(async () => {
    api = await subir();
    token = await api.entrar('secretaria');
  });
  after(() => api.fechar());

  test('dispensação no lote sugerido, sem o paciente nas buscas da Secretária (RN-37.1)', async () => {
    const p = produto(api.db, 'Seringa');
    const lote = loteValido(api.db, p);
    const consulta = consultaDeHoje(api.db, 'NA_RECEPCAO');
    const antes = lote.quantidade;
    const r = await api.pedir('POST', '/estoque/saidas', {
      token,
      corpo: { idLote: lote.id, quantidade: 2, destino: 'DISPENSACAO', idConsulta: consulta.id },
    });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    assert.equal(lote.quantidade, antes - 2);
    assert.equal('idConsulta' in r.corpo.movimentacao, false);
    const gravada = api.db.movimentacoes.find((m) => m.id === r.corpo.movimentacao.id);
    assert.equal(gravada.idConsulta, consulta.id);
    const lista = (await api.pedir('GET', '/movimentacoes', { token })).corpo;
    assert.ok(lista.every((m) => !('idConsulta' in m)));
    const porConsulta = await api.pedir('GET', `/movimentacoes?idConsulta=${consulta.id}`, { token });
    assert.deepEqual(porConsulta.corpo, []);
  });

  test('trocar o lote sugerido exige justificativa, que Administrador e Secretária não leem', async () => {
    const p = produto(api.db, 'Vacina');
    const novo = await api.pedir('POST', '/estoque/entradas', {
      token,
      corpo: { idProduto: p.id, numeroLote: 'VG-LONGE', validade: '2027-08-31', quantidade: 10, origem: 'COMPRA' },
    });
    assert.equal(novo.status, 201);
    const consulta = consultaDeHoje(api.db, 'FINALIZADO');
    const corpo = { idLote: novo.corpo.lote.id, quantidade: 1, destino: 'DISPENSACAO', idConsulta: consulta.id };
    const semMotivo = await api.pedir('POST', '/estoque/saidas', { token, corpo });
    assert.equal(semMotivo.status, 422);
    assert.match(semMotivo.corpo.erro, /vence antes/);
    const comMotivo = await api.pedir('POST', '/estoque/saidas', { token, corpo: { ...corpo, justificativa: 'Lote aberto para a campanha da tarde.' } });
    assert.equal(comMotivo.status, 201);
    const id = comMotivo.corpo.movimentacao.id;
    assert.equal(api.db.movimentacoes.find((m) => m.id === id).justificativa, 'Lote aberto para a campanha da tarde.');
    for (const login of ['secretaria', 'admin']) {
      const m = (await api.pedir('GET', `/movimentacoes/${id}`, { token: await api.entrar(login) })).corpo;
      assert.equal('justificativa' in m, false, login);
      assert.equal('idConsulta' in m, false, login);
    }
  });

  test('lote vencido não sai para o paciente; sai por descarte e resolve o alerta (RN-38.1)', async () => {
    const vencido = api.db.lotes.find((l) => l.validade < HOJE && l.quantidade > 0);
    const consulta = consultaDeHoje(api.db, 'NA_RECEPCAO');
    const paraPaciente = await api.pedir('POST', '/estoque/saidas', {
      token,
      corpo: { idLote: vencido.id, quantidade: 1, destino: 'DISPENSACAO', idConsulta: consulta.id, justificativa: 'Tentativa de sobrepor' },
    });
    assert.equal(paraPaciente.status, 409);
    assert.match(paraPaciente.corpo.erro, /só sai por descarte/);
    assert.equal(alertasAbertos(api.db, 'VENCIDO', vencido.idProduto).length, 1);
    const descarte = await api.pedir('POST', '/estoque/saidas', {
      token,
      corpo: { idLote: vencido.id, quantidade: vencido.quantidade, destino: 'DESCARTE', motivoDescarte: 'VENCIMENTO' },
    });
    assert.equal(descarte.status, 201);
    assert.equal(vencido.quantidade, 0);
    assert.equal(alertasAbertos(api.db, 'VENCIDO', vencido.idProduto).length, 0);
  });

  test('descarte pede motivo da lista; "vencimento" só para lote vencido; "outro" pede descrição', async () => {
    const lote = loteValido(api.db, produto(api.db, 'Atadura'));
    const base = { idLote: lote.id, quantidade: 1, destino: 'DESCARTE' };
    assert.equal((await api.pedir('POST', '/estoque/saidas', { token, corpo: base })).status, 422);
    assert.equal((await api.pedir('POST', '/estoque/saidas', { token, corpo: { ...base, motivoDescarte: 'QUEBRA' } })).status, 422);
    assert.equal((await api.pedir('POST', '/estoque/saidas', { token, corpo: { ...base, motivoDescarte: 'VENCIMENTO' } })).status, 422);
    assert.equal((await api.pedir('POST', '/estoque/saidas', { token, corpo: { ...base, motivoDescarte: 'OUTRO' } })).status, 422);
    const ok = await api.pedir('POST', '/estoque/saidas', { token, corpo: { ...base, motivoDescarte: 'AVARIA' } });
    assert.equal(ok.status, 201);
    assert.equal(api.db.movimentacoes.find((m) => m.id === ok.corpo.movimentacao.id).motivoDescarte, 'AVARIA');
  });

  test('não sai mais do que o lote tem, nem para consulta de outro dia', async () => {
    const lote = loteValido(api.db, produto(api.db, 'Luva'));
    const consulta = consultaDeHoje(api.db, 'NA_RECEPCAO');
    const demais = await api.pedir('POST', '/estoque/saidas', {
      token,
      corpo: { idLote: lote.id, quantidade: lote.quantidade + 1, destino: 'DISPENSACAO', idConsulta: consulta.id },
    });
    assert.equal(demais.status, 422);
    const ontem = api.db.consultas.find((c) => c.dataHora < HOJE && c.status === 'FINALIZADO');
    const r = await api.pedir('POST', '/estoque/saidas', {
      token,
      corpo: { idLote: lote.id, quantidade: 1, destino: 'DISPENSACAO', idConsulta: ontem.id },
    });
    assert.equal(r.status, 422);
  });

  test('item de controle especial exige a conferência manual (RN-37.3)', async () => {
    const p = api.db.produtos.find((x) => x.controleEspecial);
    const lote = loteValido(api.db, p);
    const consulta = consultaDeHoje(api.db, 'FINALIZADO');
    const corpo = { idLote: lote.id, quantidade: 1, destino: 'DISPENSACAO', idConsulta: consulta.id };
    assert.equal((await api.pedir('POST', '/estoque/saidas', { token, corpo })).status, 422);
    const r = await api.pedir('POST', '/estoque/saidas', { token, corpo: { ...corpo, conferenciaManual: true } });
    assert.equal(r.status, 201);
    assert.equal(api.db.movimentacoes.find((m) => m.id === r.corpo.movimentacao.id).conferenciaManual, true);
  });

  test('o Médico entrega só no próprio atendimento de hoje', async () => {
    const medico = await api.entrar('medico');
    const eu = pessoaDe(api.db, 'medico');
    const lote = loteValido(api.db, produto(api.db, 'Gaze'));
    const meu = consultaDeHoje(api.db, 'EM_ATENDIMENTO', eu);
    const naRecepcao = consultaDeHoje(api.db, 'NA_RECEPCAO', eu);
    const deOutro = api.db.consultas.find((c) => c.dataHora.startsWith(HOJE) && c.status === 'FINALIZADO' && c.idMedico !== eu);
    const pedir = (idConsulta) =>
      api.pedir('POST', '/estoque/saidas', { token: medico, corpo: { idLote: lote.id, quantidade: 1, destino: 'DISPENSACAO', idConsulta } });
    assert.equal((await pedir(deOutro.id)).status, 422);
    assert.equal((await pedir(naRecepcao.id)).status, 422);
    const r = await pedir(meu.id);
    assert.equal(r.status, 201);
    assert.equal(r.corpo.movimentacao.idConsulta, meu.id);
  });

  test('a saída que leva o produto ao mínimo abre o alerta, e a entrada o resolve', async () => {
    const p = produto(api.db, 'Atadura');
    const lote = loteValido(api.db, p);
    assert.equal(alertasAbertos(api.db, 'MINIMO', p.id).length, 0);
    const baixa = lote.quantidade - p.estoqueMinimo;
    const r = await api.pedir('POST', '/estoque/saidas', {
      token,
      corpo: { idLote: lote.id, quantidade: baixa, destino: 'DESCARTE', motivoDescarte: 'RECOLHIMENTO' },
    });
    assert.equal(r.status, 201);
    assert.equal(alertasAbertos(api.db, 'MINIMO', p.id).length, 1);
    const repor = await api.pedir('POST', '/estoque/entradas', {
      token,
      corpo: { idProduto: p.id, numeroLote: lote.numero, validade: lote.validade, quantidade: 10, origem: 'COMPRA' },
    });
    assert.equal(repor.status, 201);
    assert.equal(alertasAbertos(api.db, 'MINIMO', p.id).length, 0);
  });
});

describe('ajuste de inventário (RF37)', () => {
  let api;
  let secretaria;
  let admin;
  before(async () => {
    api = await subir();
    secretaria = await api.entrar('secretaria');
    admin = await api.entrar('admin');
  });
  after(() => api.fechar());

  test('o pedido da Secretária não muda o saldo até a aprovação', async () => {
    const lote = loteValido(api.db, produto(api.db, 'Seringa'));
    const antes = lote.quantidade;
    const r = await api.pedir('POST', '/estoque/ajustes', {
      token: secretaria,
      corpo: { idLote: lote.id, quantidadeContada: antes - 4, justificativa: 'Contagem de fim de mês.' },
    });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    assert.equal(r.corpo.movimentacao.ajusteSituacao, 'A_APROVAR');
    assert.equal(r.corpo.movimentacao.quantidade, -4);
    assert.equal(lote.quantidade, antes);
    const repetido = await api.pedir('POST', '/estoque/ajustes', {
      token: secretaria,
      corpo: { idLote: lote.id, quantidadeContada: antes - 1, justificativa: 'Outra contagem.' },
    });
    assert.equal(repetido.status, 409);
    const aprovado = await api.pedir('POST', `/estoque/ajustes/${r.corpo.movimentacao.id}/aprovar`, { token: admin });
    assert.equal(aprovado.status, 200);
    assert.equal(lote.quantidade, antes - 4);
    assert.equal(saldoDoLote(api.db, lote.id), lote.quantidade);
    assert.equal((await api.pedir('POST', `/estoque/ajustes/${r.corpo.movimentacao.id}/recusar`, { token: admin, corpo: { motivo: 'Tarde demais' } })).status, 409);
  });

  test('só o Administrador decide; recusar pede motivo', async () => {
    const pendente = api.db.movimentacoes.find((m) => m.ajusteSituacao === 'A_APROVAR');
    assert.equal((await api.pedir('POST', `/estoque/ajustes/${pendente.id}/aprovar`, { token: secretaria })).status, 403);
    assert.equal((await api.pedir('POST', `/estoque/ajustes/${pendente.id}/recusar`, { token: admin, corpo: {} })).status, 422);
    const r = await api.pedir('POST', `/estoque/ajustes/${pendente.id}/recusar`, { token: admin, corpo: { motivo: 'Contagem refeita bateu com o sistema.' } });
    assert.equal(r.status, 200);
    assert.equal(pendente.ajusteSituacao, 'RECUSADO');
    assert.equal(pendente.idAprovador, api.db.usuarios.find((u) => u.login === 'admin').id);
  });

  test('o ajuste do Administrador vale na hora; contagem igual ao saldo é recusada', async () => {
    const lote = loteValido(api.db, produto(api.db, 'Gaze'));
    assert.equal(
      (await api.pedir('POST', '/estoque/ajustes', { token: admin, corpo: { idLote: lote.id, quantidadeContada: lote.quantidade, justificativa: 'Conferido' } })).status,
      422
    );
    const r = await api.pedir('POST', '/estoque/ajustes', {
      token: admin,
      corpo: { idLote: lote.id, quantidadeContada: lote.quantidade + 5, justificativa: 'Caixa achada no depósito.' },
    });
    assert.equal(r.status, 201);
    assert.equal(r.corpo.movimentacao.ajusteSituacao, 'APROVADO');
    assert.equal(r.corpo.lote.quantidade, lote.quantidade);
    assert.equal(lote.quantidade, r.corpo.movimentacao.quantidadeContada);
  });

  test('a aprovação que deixaria o saldo negativo é recusada', async () => {
    const lote = loteValido(api.db, produto(api.db, 'Lidocaína'));
    const pedido = await api.pedir('POST', '/estoque/ajustes', {
      token: secretaria,
      corpo: { idLote: lote.id, quantidadeContada: 0, justificativa: 'Frascos não encontrados.' },
    });
    assert.equal(pedido.status, 201);
    const consulta = consultaDeHoje(api.db, 'NA_RECEPCAO');
    const saida = await api.pedir('POST', '/estoque/saidas', {
      token: secretaria,
      corpo: { idLote: lote.id, quantidade: 1, destino: 'DISPENSACAO', idConsulta: consulta.id },
    });
    assert.equal(saida.status, 201);
    const r = await api.pedir('POST', `/estoque/ajustes/${pedido.corpo.movimentacao.id}/aprovar`, { token: admin });
    assert.equal(r.status, 409);
    assert.match(r.corpo.erro, /saldo negativo/);
  });
});

describe('alertas por papel e recálculo (RF38)', () => {
  let api;
  before(async () => {
    api = await subir();
  });
  after(() => api.fechar());

  test('o Médico vê validade e vencido, não o estoque mínimo', async () => {
    const medico = await api.entrar('medico');
    const tipos = new Set((await api.pedir('GET', '/alertasEstoque?situacao=ABERTO', { token: medico })).corpo.map((a) => a.tipo));
    assert.deepEqual([...tipos].sort(), ['VALIDADE', 'VENCIDO']);
  });

  test('mudar o X14 refaz os alertas de validade', async () => {
    const admin = await api.entrar('admin');
    const x14 = api.db.parametros.find((p) => p.chave === 'X14');
    const vacina = produto(api.db, 'Vacina');
    assert.equal(alertasAbertos(api.db, 'VALIDADE', vacina.id).length, 1);
    assert.equal((await api.pedir('PATCH', `/parametros/${x14.id}`, { token: admin, corpo: { valor: 7 } })).status, 200);
    assert.equal(alertasAbertos(api.db, 'VALIDADE', vacina.id).length, 0);
    assert.equal((await api.pedir('PATCH', `/parametros/${x14.id}`, { token: admin, corpo: { valor: 60 } })).status, 200);
    assert.equal(alertasAbertos(api.db, 'VALIDADE', vacina.id).length, 1);
  });

  test('inativar o produto resolve os alertas dele; mudar o mínimo abre o alerta', async () => {
    const secretaria = await api.entrar('secretaria');
    const lidocaina = produto(api.db, 'Lidocaína');
    assert.equal(alertasAbertos(api.db, 'MINIMO', lidocaina.id).length, 1);
    assert.equal((await api.pedir('PATCH', `/produtos/${lidocaina.id}`, { token: secretaria, corpo: { situacao: 'INATIVO' } })).status, 200);
    assert.equal(alertasAbertos(api.db, 'MINIMO', lidocaina.id).length, 0);
    const luva = produto(api.db, 'Luva');
    assert.equal((await api.pedir('PATCH', `/produtos/${luva.id}`, { token: secretaria, corpo: { estoqueMinimo: 500 } })).status, 200);
    assert.equal(alertasAbertos(api.db, 'MINIMO', luva.id).length, 1);
  });

  test('medicamento controla lote; o controle não muda depois da primeira entrada', async () => {
    const secretaria = await api.entrar('secretaria');
    const novo = await api.pedir('POST', '/produtos', {
      token: secretaria,
      corpo: { descricao: 'Dipirona gotas', tipo: 'MEDICAMENTO', unidade: 'FR', estoqueMinimo: 5, controlaLote: false },
    });
    assert.equal(novo.status, 422);
    const seringa = produto(api.db, 'Seringa');
    const r = await api.pedir('PATCH', `/produtos/${seringa.id}`, { token: secretaria, corpo: { controlaLote: false } });
    assert.equal(r.status, 422);
  });

  test('produto sem controle de lote usa um lote só, sem número nem validade', async () => {
    const secretaria = await api.entrar('secretaria');
    const criado = await api.pedir('POST', '/produtos', {
      token: secretaria,
      corpo: { descricao: 'Abaixador de língua', tipo: 'MATERIAL', unidade: 'PCT', estoqueMinimo: 2, controlaLote: false, situacao: 'ATIVO' },
    });
    assert.equal(criado.status, 201);
    assert.equal(alertasAbertos(api.db, 'MINIMO', criado.corpo.id).length, 1);
    for (const quantidade of [3, 4]) {
      const r = await api.pedir('POST', '/estoque/entradas', {
        token: secretaria,
        corpo: { idProduto: criado.corpo.id, numeroLote: 'ignorado', validade: '2020-01-01', quantidade, origem: 'COMPRA' },
      });
      assert.equal(r.status, 201, JSON.stringify(r.corpo));
    }
    const lotes = api.db.lotes.filter((l) => l.idProduto === criado.corpo.id);
    assert.equal(lotes.length, 1);
    assert.equal(lotes[0].numero, null);
    assert.equal(lotes[0].quantidade, 7);
    assert.equal(alertasAbertos(api.db, 'MINIMO', criado.corpo.id).length, 0);
  });
});
