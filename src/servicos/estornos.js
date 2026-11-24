import { api } from '../config/axios';

// Cancelamento e estorno (RF48). A API avalia o que o meio permite, recebe o
// pedido da Secretária e a decisão do Administrador.

export async function avaliarEstorno(idPagamento) {
  const { data } = await api.get(`/financeiro/estornos/avaliar/${idPagamento}`);
  return data;
}

// corpo: { idPagamento, valor, motivo, meioDevolucao? } ou, para registrar
// chargeback, { idPagamento, valor, motivo, chargeback: true }.
export async function pedirEstorno(corpo) {
  const { data } = await api.post('/financeiro/estornos', corpo);
  return data;
}

// decisao: 'aprovar' ou 'recusar' (com motivo).
export async function decidirEstorno(id, decisao, motivo) {
  const { data } = await api.post(`/financeiro/estornos/${id}/${decisao}`, motivo ? { motivo } : {});
  return data;
}
