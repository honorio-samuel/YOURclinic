import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import { CampoBusca, CampoSelect, Filtros } from '../../components/campos';
import { useAlternarSituacao } from '../../components/confirmacao';
import { listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { corresponde } from '../../utils/formatos';
import { colunasDeSituacao, OPCOES_STATUS } from './comum';

// A-05 · Cadastro › Convênios.
function Convenios() {
  const navigate = useNavigate();
  const { dados, carregando, erro, recarregar } = useCarregar(() => listar('convenios', { _sort: 'nome' }));
  const [modal, alternar] = useAlternarSituacao('convenios', recarregar);
  const [busca, setBusca] = React.useState('');
  const [status, setStatus] = React.useState('');
  const linhas = (dados ?? []).filter(
    (c) => (!status || c.situacao === status) && corresponde(busca, c.nome, c.razaoSocial, c.registroAns)
  );

  return (
    <Pagina
      titulo='Convênios'
      acoes={
        <button type='button' className='btn btn-primary' onClick={() => navigate('/admin/convenios/novo')}>
          + Novo convênio
        </button>
      }
    >
      <Filtros>
        <CampoBusca id='buscaConvenio' rotulo='Buscar por nome ou operadora' valor={busca} aoMudar={setBusca} />
        <CampoSelect id='statusConvenio' rotulo='Status' valor={status} aoMudar={setStatus} opcoes={OPCOES_STATUS} />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhum convênio encontrado.'
        colunas={[
          { titulo: 'Nome', render: (c) => c.nome ?? c.razaoSocial },
          { titulo: 'Operadora', render: (c) => c.razaoSocial },
          { titulo: 'Registro ANS', render: (c) => c.registroAns },
          ...colunasDeSituacao(alternar, (c) => c.nome ?? c.razaoSocial, { aoVer: (l) => navigate(`/admin/convenios/${l.id}`), aoEditar: (l) => navigate(`/admin/convenios/${l.id}/editar`) }),
        ]}
      />
      {modal}
    </Pagina>
  );
}

export default Convenios;
