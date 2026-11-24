import { api } from '../config/axios';

// RF59: a recepção trata a notificação que falhou; o titular escolhe os
// avisos que não são obrigatórios (RF39).

export async function reenviarNotificacao(id) {
  const { data } = await api.post(`/notificacoes/${id}/reenviar`);
  return data;
}

export async function registrarAvisoPorTelefone(id) {
  const { data } = await api.post(`/notificacoes/${id}/aviso-por-telefone`);
  return data;
}

export async function carregarPreferencias() {
  const { data } = await api.get('/portal/preferencias');
  return data;
}

export async function salvarPreferencias(preferencias) {
  const { data } = await api.put('/portal/preferencias', preferencias);
  return data;
}
