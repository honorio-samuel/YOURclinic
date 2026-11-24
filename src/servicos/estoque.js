import { api } from '../config/axios';

// Estoque (RF37). Entrada, saída e ajuste passam pelas rotas /estoque, que
// aplicam as regras; cada resposta traz a movimentação e o saldo do lote.

export async function registrarEntrada(corpo) {
  const { data } = await api.post('/estoque/entradas', corpo);
  return data;
}

// destino: 'DISPENSACAO' (paciente atendido hoje) ou 'DESCARTE'.
export async function registrarSaida(corpo) {
  const { data } = await api.post('/estoque/saidas', corpo);
  return data;
}

// O ajuste do Administrador vale na hora; o da Secretária vira pedido.
export async function registrarAjuste(corpo) {
  const { data } = await api.post('/estoque/ajustes', corpo);
  return data;
}

// decisao: 'aprovar' ou 'recusar' (com motivo).
export async function decidirAjuste(id, decisao, motivo) {
  const { data } = await api.post(`/estoque/ajustes/${id}/${decisao}`, motivo ? { motivo } : {});
  return data;
}
