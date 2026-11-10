import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import { CampoBusca, CampoSelect, Filtros } from '../../components/campos';
import { useAlternarSituacao } from '../../components/confirmacao';
import { listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useCaminhosDaListagem } from '../../navegacao/caminhos';
import { corresponde, moeda } from '../../utils/formatos';
import { colunasDeSituacao, TIPO_PROCEDIMENTO } from './comum';

// A-06 · Cadastro › Procedimentos e preços. O preço negociado por operadora
// fica no contrato (A-20).
function Procedimentos() {
  const navigate = useNavigate();
  const caminhos = useCaminhosDaListagem('procedimentos');
  const { dados, carregando, erro, recarregar } = useCarregar(() => listar('procedimentos', { _sort: 'nome' }));
  const [modal, alternar] = useAlternarSituacao('procedimentos', recarregar);
  const [busca, setBusca] = React.useState('');
  const [tipo, setTipo] = React.useState('');
  const linhas = (dados ?? []).filter(
    (p) => (!tipo || p.tipo === tipo) && corresponde(busca, p.codigoInterno, p.codigo, p.nome)
  );

  return (
    <Pagina
      titulo='Procedimentos e preços'
      acoes={
        <button type='button' className='btn btn-primary' onClick={() => navigate(caminhos.novo)}>
          + Novo procedimento
        </button>
      }
    >
      <Filtros>
        <CampoBusca id='buscaProcedimento' rotulo='Buscar por código, TUSS ou descrição' valor={busca} aoMudar={setBusca} />
        <CampoSelect
          id='tipoProcedimento'
          rotulo='Tipo'
          valor={tipo}
          aoMudar={setTipo}
          opcoes={[['', 'Todos'], ...Object.entries(TIPO_PROCEDIMENTO)]}
        />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhum procedimento encontrado.'
        colunas={[
          { titulo: 'Código', render: (p) => p.codigoInterno ?? '—' },
          { titulo: 'TUSS', render: (p) => p.codigo },
          { titulo: 'Descrição', render: (p) => p.nome },
          { titulo: 'Duração', render: (p) => `${p.duracaoPadrao} min` },
          { titulo: 'Preço part.', classe: 'text-end', render: (p) => moeda(p.precoParticular) },
          ...colunasDeSituacao(alternar, (p) => p.nome, { aoVer: (l) => navigate(caminhos.ver(l.id)), aoEditar: (l) => navigate(caminhos.editar(l.id)) }),
        ]}
      />
      {modal}
    </Pagina>
  );
}

export default Procedimentos;
