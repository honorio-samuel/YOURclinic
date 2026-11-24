'use strict';

// Estoque (RF36 a RF38). O saldo de cada lote é a soma das movimentações
// (RN-36.2); o campo "quantidade" do lote só guarda o resultado dessa soma,
// refeito a cada movimentação.

const igual = (a, b) => a != null && b != null && String(a) === String(b);

const ORIGENS_DE_ENTRADA = ['COMPRA', 'DOACAO', 'AMOSTRA_FORNECEDOR'];
const DESTINOS_DE_SAIDA = ['DISPENSACAO', 'DESCARTE'];
const MOTIVOS_DE_DESCARTE = ['VENCIMENTO', 'AVARIA', 'RECOLHIMENTO', 'OUTRO'];
// RN-36.1: medicamento e amostra sempre têm lote e validade.
const TIPOS_COM_LOTE = ['MEDICAMENTO', 'AMOSTRA'];
// Consultas em que o item pode ser entregue ao paciente: ele está na clínica.
const STATUS_DE_ENTREGA = ['NA_RECEPCAO', 'EM_ATENDIMENTO', 'FINALIZADO'];

// Quanto cada movimentação soma ao lote. O ajuste pedido pela Secretária só
// conta depois de aprovado pelo Administrador (RF37).
function efeitoNoSaldo(m) {
  if (m.tipo === 'ENTRADA') return Math.abs(m.quantidade);
  if (m.tipo === 'SAIDA') return -Math.abs(m.quantidade);
  if (m.tipo === 'AJUSTE') return m.ajusteSituacao === 'APROVADO' ? m.quantidade : 0;
  return 0;
}

function saldoDoLote(db, idLote) {
  return db.movimentacoes.filter((m) => igual(m.idLote, idLote)).reduce((soma, m) => soma + efeitoNoSaldo(m), 0);
}

function atualizarSaldo(db, lote) {
  lote.quantidade = saldoDoLote(db, lote.id);
  return lote.quantidade;
}

const vencido = (lote, hoje) => Boolean(lote.validade) && lote.validade < hoje;

function diasAte(hoje, validade) {
  return Math.round((Date.parse(`${validade}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86400000);
}

// RF37: a sugestão é o lote de validade mais próxima entre os que podem sair,
// com saldo e dentro da validade. Lote sem validade fica por último.
function lotesParaSaida(db, idProduto, hoje) {
  return db.lotes
    .filter((l) => igual(l.idProduto, idProduto) && l.quantidade > 0 && !vencido(l, hoje))
    .sort((a, b) => (a.validade ?? '9999-12-31').localeCompare(b.validade ?? '9999-12-31') || a.id - b.id);
}

// Lote vencido não conta para o mínimo: o saldo dele só sai por descarte.
function saldoUtilizavel(db, idProduto, hoje) {
  return db.lotes
    .filter((l) => igual(l.idProduto, idProduto) && !vencido(l, hoje))
    .reduce((soma, l) => soma + Math.max(0, l.quantidade), 0);
}

// RF38 e RN-38.2: abre o alerta que passou a valer e resolve o que deixou de
// valer. Produto inativo não gera alerta. Devolve true quando algo mudou.
function recalcularAlertas(db, { hoje, antecedencia, inserir }) {
  const devidos = [];
  for (const p of db.produtos.filter((x) => x.situacao === 'ATIVO')) {
    if (saldoUtilizavel(db, p.id, hoje) <= (p.estoqueMinimo ?? 0)) devidos.push({ tipo: 'MINIMO', idProduto: p.id, idLote: null });
    for (const l of db.lotes.filter((x) => igual(x.idProduto, p.id) && x.quantidade > 0 && x.validade)) {
      const dias = diasAte(hoje, l.validade);
      if (dias < 0) devidos.push({ tipo: 'VENCIDO', idProduto: p.id, idLote: l.id });
      else if (dias < antecedencia) devidos.push({ tipo: 'VALIDADE', idProduto: p.id, idLote: l.id });
    }
  }
  const chave = (a) => `${a.tipo}:${a.idProduto}:${a.idLote ?? ''}`;
  const abertos = new Map(db.alertasEstoque.filter((a) => a.situacao === 'ABERTO').map((a) => [chave(a), a]));
  let mudou = false;
  for (const d of devidos) {
    if (abertos.delete(chave(d))) continue;
    inserir('alertasEstoque', { ...d, dataGeracao: hoje, situacao: 'ABERTO', dataResolucao: null });
    mudou = true;
  }
  for (const a of abertos.values()) {
    a.situacao = 'RESOLVIDO';
    a.dataResolucao = hoje;
    mudou = true;
  }
  return mudou;
}

const inteiroPositivo = (n) => Number.isInteger(n) && n > 0;
const dataValida = (texto) => typeof texto === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(texto) && !Number.isNaN(Date.parse(`${texto}T00:00:00Z`));
const texto = (valor) => (typeof valor === 'string' ? valor.trim() : '');
const dataBr = (iso) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '');

module.exports = {
  ORIGENS_DE_ENTRADA,
  DESTINOS_DE_SAIDA,
  MOTIVOS_DE_DESCARTE,
  TIPOS_COM_LOTE,
  STATUS_DE_ENTREGA,
  efeitoNoSaldo,
  saldoDoLote,
  atualizarSaldo,
  vencido,
  diasAte,
  lotesParaSaida,
  saldoUtilizavel,
  recalcularAlertas,
  inteiroPositivo,
  dataValida,
  texto,
  dataBr,
};
