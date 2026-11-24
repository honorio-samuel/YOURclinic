import { api } from '../config/axios';

// Recibo (RF33) e NFS-e (RF34): a API numera, monta e guarda o documento.

export async function carregarDocumentoFiscal(id) {
  const { data } = await api.get(`/financeiro/documentos/${id}`);
  return data;
}

// tipo: 'RECIBO' ou 'NFSE'; corpo: { idTituloReceber, idPagador? }.
export async function emitirDocumento(tipo, corpo) {
  const { data } = await api.post(`/financeiro/documentos/${tipo === 'NFSE' ? 'nfse' : 'recibo'}`, corpo);
  return data;
}

export async function reenviarNfse(id) {
  const { data } = await api.post(`/financeiro/documentos/${id}/reenviar`);
  return data;
}
