'use strict';

// Cancelamento e estorno (RF48). Cada meio tem a própria regra de reversão,
// imposta por terceiros; aqui ela vira uma avaliação que diz ao operador o
// que é possível e como. O lançamento original nunca muda (RN-48.1): a
// reversão aprovada é o lançamento de sinal oposto.

const igual = (a, b) => a != null && b != null && String(a) === String(b);
const centavos = (valor) => Math.round(Number(valor) * 100);
const reais = (c) => c / 100;

// O arranjo Pix aceita devolução até 90 dias depois do pagamento; o PSP
// simulado usa esse prazo (README, "Checkout simulado").
const PRAZO_PIX_DIAS = 90;
const MEIOS_DE_DEVOLUCAO = ['PIX', 'DINHEIRO'];
// Situações que reservam ou já devolveram parte do pagamento.
const RESERVAM = ['A_APROVAR', 'CANCELADO', 'ESTORNADO'];
const EXECUTADAS = ['CANCELADO', 'ESTORNADO'];

function diasEntre(inicio, fim) {
  return Math.round((Date.parse(`${fim.slice(0, 10)}T00:00:00Z`) - Date.parse(`${inicio.slice(0, 10)}T00:00:00Z`)) / 86400000);
}

const doPagamento = (db, idPagamento, situacoes, ignorar) =>
  db.estornos.filter(
    (e) => igual(e.idPagamento, idPagamento) && e.tipo !== 'CHARGEBACK' && situacoes.includes(e.situacao) && !igual(e.id, ignorar)
  );

// Quanto já saiu de volta de cada pagamento da cobrança (o sinal oposto).
function estornadoDaCobranca(db, idsDePagamento) {
  return (db.estornos ?? [])
    .filter((e) => e.tipo !== 'CHARGEBACK' && EXECUTADAS.includes(e.situacao) && idsDePagamento.some((id) => igual(id, e.idPagamento)))
    .reduce((soma, e) => soma + centavos(e.valor), 0);
}

// RF48, matriz de reversibilidade: o que este pagamento admite hoje.
// Cancelamento é no mesmo dia; estorno, depois (RN-48.3). "ignorar" deixa de
// fora o pedido que está sendo decidido.
function avaliarReversao(db, pagamento, { hoje, prazoCredito, ignorar = null }) {
  const dias = diasEntre(pagamento.dataHora, hoje);
  const reservado = doPagamento(db, pagamento.id, RESERVAM, ignorar).reduce((soma, e) => soma + centavos(e.valor), 0);
  const base = {
    idPagamento: pagamento.id,
    meio: pagamento.meio,
    valor: pagamento.valor,
    dataHora: pagamento.dataHora,
    disponivel: reais(Math.max(0, centavos(pagamento.valor) - reservado)),
    pedidoAberto: doPagamento(db, pagamento.id, ['A_APROVAR'], ignorar).length > 0,
    tipo: dias === 0 ? 'CANCELAMENTO' : 'ESTORNO',
    chargeback: pagamento.meio === 'CARTAO',
  };
  const negar = (orientacao) => ({ ...base, possivel: false, parcial: false, forma: null, exigeMeio: false, orientacao });
  if (pagamento.situacao !== 'CONFIRMADO' || !(pagamento.valor > 0)) return negar('Só pagamento confirmado pode ser devolvido.');
  if (base.disponivel <= 0) return negar('Este pagamento já foi devolvido por inteiro, ou o resto dele já está num pedido.');
  const pode = (forma, parcial, orientacao, exigeMeio = false) => ({ ...base, possivel: true, parcial, forma, exigeMeio, orientacao });

  if (pagamento.meio === 'DINHEIRO') {
    const recebimento = db.pagamentosDinheiro.find((d) => igual(d.id, pagamento.id));
    const caixa = db.caixas.find((c) => igual(c.id, recebimento?.idCaixa));
    return caixa?.situacao === 'ABERTO'
      ? pode('SAIDA_DE_CAIXA', true, 'Devolução em espécie no balcão, como saída do caixa em que o dinheiro entrou.')
      : pode('DEVOLUCAO_CAIXA_SEGUINTE', true, 'O caixa do recebimento já fechou: a devolução em espécie sai do caixa aberto no dia, como lançamento de devolução.');
  }
  if (pagamento.meio === 'PIX') {
    const pix = db.pagamentosPix.find((p) => igual(p.id, pagamento.id));
    return dias <= PRAZO_PIX_DIAS
      ? pode('DEVOLUCAO_PSP', true, `Devolução pelo PSP, pelo identificador ${pix?.endToEndId ?? 'do pagamento'}.`)
      : pode('TRANSFERENCIA_MANUAL', true, `Passou o prazo de devolução do Pix (${PRAZO_PIX_DIAS} dias): a devolução é uma transferência avulsa, com o comprovante guardado.`);
  }
  const cartao = db.pagamentosCartao.find((c) => igual(c.id, pagamento.id));
  if (cartao?.modalidade === 'DEBITO') {
    // RN-48.2: no débito, nada de parcial.
    return dias === 0
      ? pode('CANCELAMENTO_TERMINAL', false, 'Cancelamento no terminal, ainda hoje, com o cartão presente. Só pelo valor total.')
      : pode('DEVOLUCAO_OUTRO_MEIO', false, 'Débito não se cancela depois do dia da venda. A devolução precisa ser feita por Pix ou em dinheiro, pelo valor total.', true);
  }
  return dias <= prazoCredito
    ? pode(
        'CANCELAMENTO_ADQUIRENTE',
        true,
        `Cancelamento junto ao adquirente, com o NSU ${cartao?.nsu ?? '—'} e a autorização ${cartao?.codigoAutorizacao ?? '—'}. Vale até ${prazoCredito} dias da venda.`
      )
    : pode('DEVOLUCAO_OUTRO_MEIO', true, `Passou o prazo do adquirente (${prazoCredito} dias). A devolução precisa ser feita por Pix ou em dinheiro.`, true);
}

module.exports = { PRAZO_PIX_DIAS, MEIOS_DE_DEVOLUCAO, EXECUTADAS, avaliarReversao, estornadoDaCobranca };
