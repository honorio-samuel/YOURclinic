'use strict';

// Cobrança e checkout (RF32, RF43 a RF47, RF58). O PSP do Pix e o gerenciador
// TEF não existem na API local: são simulados aqui, com resultados previsíveis
// para a demonstração (README, "Checkout simulado").

const igual = (a, b) => a != null && b != null && String(a) === String(b);
const centavos = (valor) => Math.round(Number(valor) * 100);
const reais = (c) => c / 100;
const zeros = (n, tamanho) => String(n).padStart(tamanho, '0');

const MEIOS = ['DINHEIRO', 'PIX', 'CARTAO'];
const MODALIDADES = ['DEBITO', 'CREDITO', 'CREDITO_PARCELADO_LOJISTA', 'CREDITO_PARCELADO_EMISSOR'];
const PARCELADAS = ['CREDITO_PARCELADO_LOJISTA', 'CREDITO_PARCELADO_EMISSOR'];
const BANDEIRAS = ['VISA', 'MASTERCARD', 'ELO', 'AMEX', 'HIPERCARD'];
const ADQUIRENTES = ['Adquirente Fictícia A', 'Adquirente Fictícia B'];
// Limite contratual de parcelas do adquirente (RN-43.2), igual nos dois fictícios.
const LIMITE_DO_ADQUIRENTE = 12;
// Taxa simulada do adquirente por modalidade (X47), só para o valor líquido.
const TAXA = { DEBITO: 0.015, CREDITO: 0.03, CREDITO_PARCELADO_LOJISTA: 0.045, CREDITO_PARCELADO_EMISSOR: 0.03 };

// Só pagamento confirmado conta para quitar. O lançamento da maquininha avulsa
// acima do limite espera a conferência de outro usuário (RN-46.3).
function resumoDaCobranca(db, cobranca) {
  const pagamentos = db.pagamentos.filter((p) => igual(p.idCobranca, cobranca.id));
  const pago = pagamentos.filter((p) => p.situacao === 'CONFIRMADO').reduce((soma, p) => soma + centavos(p.valor), 0);
  const emAndamento = pagamentos
    .filter((p) => ['PENDENTE', 'INDEFINIDO', 'AGUARDANDO_CONFERENCIA'].includes(p.situacao))
    .reduce((soma, p) => soma + centavos(p.valor), 0);
  return {
    pagamentos,
    pago: reais(pago),
    emAndamento: reais(emAndamento),
    saldo: reais(Math.max(0, centavos(cobranca.valorTotal) - pago)),
    // O que ainda pode entrar num meio novo: o saldo menos o que espera desfecho.
    disponivel: reais(Math.max(0, centavos(cobranca.valorTotal) - pago - emAndamento)),
  };
}

// RN-43.2: o menor entre X32, o limite do adquirente e o valor dividido por
// X33. Abaixo de X33, não há parcelamento.
function maximoDeParcelas(valor, { maximo, valorMinimo }) {
  if (valorMinimo > 0 && valor < valorMinimo) return 1;
  const pelaParcelaMinima = valorMinimo > 0 ? Math.floor(valor / valorMinimo) : Infinity;
  return Math.max(1, Math.min(maximo, LIMITE_DO_ADQUIRENTE, pelaParcelaMinima));
}

// TEF simulado: aprova. Valor com centavos ,13 é negado pelo emissor (E1). Com
// ,49 o terminal não responde (E2) e a confirmação diz que foi aprovada (E3);
// com ,48 também não responde, e a confirmação diz que não houve transação (E4).
function respostaDoTef(valor) {
  const resto = centavos(valor) % 100;
  if (resto === 13) return 'NEGADO';
  if (resto === 48 || resto === 49) return 'INDEFINIDO';
  return 'APROVADO';
}
const confirmacaoDoTef = (valor) => (centavos(valor) % 100 === 48 ? 'NAO_REALIZADO' : 'APROVADO');

// Dados que o terminal devolveria; nenhum vem da tela (RN-43.4).
function cartaoDoTerminal(idPagamento) {
  return {
    bandeira: ['VISA', 'MASTERCARD', 'ELO'][idPagamento % 3],
    nsu: zeros(700000 + idPagamento, 6),
    codigoAutorizacao: `T${zeros(idPagamento, 5)}`,
    ultimosDigitos: zeros((idPagamento * 7919) % 10000, 4),
    adquirente: ADQUIRENTES[0],
  };
}

// BR Code simulado: o formato lembra o do Pix, mas nenhum banco o aceita.
function brcodeSimulado(txid, valor) {
  const v = Number(valor).toFixed(2);
  return `00020101021226770014BR.GOV.BCB.PIX2555pix.simulado.local/qr/v2/${txid}520480115303986540${v.length}${v}5802BR5917CLINICA YOURCLINIC6009SAO PAULO62070503***6304SIMU`;
}

const valorLiquido = (valor, modalidade) => reais(Math.round(centavos(valor) * (1 - (TAXA[modalidade] ?? 0.03))));

module.exports = {
  MEIOS,
  MODALIDADES,
  PARCELADAS,
  BANDEIRAS,
  ADQUIRENTES,
  centavos,
  reais,
  resumoDaCobranca,
  maximoDeParcelas,
  respostaDoTef,
  confirmacaoDoTef,
  cartaoDoTerminal,
  brcodeSimulado,
  valorLiquido,
};
