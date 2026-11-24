import { api } from '../config/axios';

// Checkout (RF43 a RF47). Cada resposta de pagamento traz a cobrança inteira
// de novo: itens, total, pago, saldo e pagamentos.

export async function carregarCheckout(idCobranca) {
  const { data } = await api.get(`/checkout/${idCobranca}`);
  return data;
}

// meio: 'dinheiro', 'pix', 'tef' ou 'pos'.
export async function receber(idCobranca, meio, corpo) {
  const { data } = await api.post(`/checkout/${idCobranca}/${meio}`, corpo);
  return data;
}

// acao: 'verificar' ou 'cancelar'.
export async function consultarPix(idPagamento, acao = 'verificar') {
  const { data } = await api.post(`/checkout/pix/${idPagamento}/${acao}`);
  return data;
}

export async function confirmarTef(idPagamento) {
  const { data } = await api.post(`/checkout/tef/${idPagamento}/confirmar`);
  return data;
}

export async function listarConferencias() {
  const { data } = await api.get('/checkout/conferencias');
  return data;
}

export async function conferir(idPagamento, corpo) {
  const { data } = await api.post(`/checkout/pagamentos/${idPagamento}/conferir`, corpo);
  return data;
}

// RN-43.2: o menor entre X32, o limite do adquirente (12) e o valor dividido
// por X33. Abaixo de X33, não há parcelamento. O servidor confere de novo.
export function maximoDeParcelas(valor, { maximo, valorMinimo }) {
  if (!valor || (valorMinimo > 0 && valor < valorMinimo)) return 1;
  const pelaParcelaMinima = valorMinimo > 0 ? Math.floor(valor / valorMinimo) : Infinity;
  return Math.max(1, Math.min(maximo, 12, pelaParcelaMinima));
}

// Identificador da transação TEF, que torna o pedido idempotente (RN-43.5).
export function novaChave() {
  if (window.crypto?.randomUUID) return window.crypto.randomUUID();
  return `tef-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

// P-05a e R-05a: o titular paga a própria cobrança por Pix no PSP simulado.
// Pagar de novo devolve o QR que ainda espera.
export async function pagarPeloPortal(idCobranca) {
  const { data } = await api.post(`/checkout/${idCobranca}/pix-portal`);
  return data;
}

export async function verificarPixDoPortal(idPagamento) {
  const { data } = await api.post(`/checkout/pix/${idPagamento}/verificar`);
  return data;
}
