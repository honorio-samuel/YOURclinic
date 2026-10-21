import { api } from '../config/axios';

// Lê uma coleção da API. Os filtros seguem o formato da API: campo=valor
// (repetível), campo_gte, campo_lte, _sort e _order.
export async function listar(colecao, params) {
  const { data } = await api.get(`/${colecao}`, { params });
  return data;
}

export async function buscar(colecao, id) {
  const { data } = await api.get(`/${colecao}/${id}`);
  return data;
}

export async function criar(colecao, campos) {
  const { data } = await api.post(`/${colecao}`, campos);
  return data;
}

export async function atualizar(colecao, id, campos) {
  const { data } = await api.patch(`/${colecao}/${id}`, campos);
  return data;
}

export function porId(lista) {
  return Object.fromEntries((lista ?? []).map((item) => [item.id, item]));
}

// Busca só as pessoas citadas, em vez da coleção inteira.
export async function pessoasPorId(ids) {
  const unicos = [...new Set(ids.filter((id) => id !== null && id !== undefined))];
  if (unicos.length === 0) return {};
  return porId(await listar('pessoas', { id: unicos }));
}

// Titular das telas do portal: o próprio paciente ou o representado escolhido.
export function idTitular(sessao) {
  if (sessao?.usuario?.papel === 'RESPONSAVEL_LEGAL') return sessao.idRepresentado;
  return sessao?.usuario?.idPessoa;
}
