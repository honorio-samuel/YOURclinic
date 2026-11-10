import { useParams, useSearchParams } from 'react-router-dom';

import { useSessao } from '../sessao/sessao';

// Rotas no padrão da disciplina: /<papel>/listagem-<entidade> e
// /<papel>/cadastro-<entidade>/:idParam?. Sem idParam, o cadastro cria; com
// ele, edita; com ?consulta, só mostra.

const PREFIXO = {
  ADMINISTRADOR: '/admin',
  MEDICO: '/medico',
  SECRETARIA: '/secretaria',
  PACIENTE: '/portal',
  RESPONSAVEL_LEGAL: '/portal',
};

export function caminhoListagem(papel, entidade) {
  return `${PREFIXO[papel]}/listagem-${entidade}`;
}

export function caminhoCadastro(papel, entidade, id = null, { consulta = false } = {}) {
  return `${PREFIXO[papel]}/cadastro-${entidade}${id ? `/${id}` : ''}${consulta ? '?consulta' : ''}`;
}

// Na listagem: para onde vão Novo, Ver e Editar.
export function useCaminhosDaListagem(entidade) {
  const { sessao } = useSessao();
  const papel = sessao.usuario.papel;
  return {
    novo: caminhoCadastro(papel, entidade),
    ver: (id) => caminhoCadastro(papel, entidade, id, { consulta: true }),
    editar: (id) => caminhoCadastro(papel, entidade, id),
  };
}

// No cadastro: o id da rota, o modo consulta e os caminhos de volta.
export function useCadastro(entidade) {
  const { idParam } = useParams();
  const [busca] = useSearchParams();
  const { sessao } = useSessao();
  const papel = sessao.usuario.papel;
  const id = idParam ? Number(idParam) : null;
  return {
    id,
    consulta: Boolean(id) && busca.has('consulta'),
    listagem: caminhoListagem(papel, entidade),
    editar: (outro = id) => caminhoCadastro(papel, entidade, outro),
  };
}
