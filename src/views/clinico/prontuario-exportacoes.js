import React from 'react';

import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { emBreve } from '../../components/confirmacao';
import { listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { diaMesHora } from '../../utils/formatos';

const TIPO_EXPORTACAO = {
  PRONTUARIO_COMPLETO: 'Prontuário completo',
  PRONTUARIO: 'Prontuário completo',
  HISTORICO_ATENDIMENTOS: 'Histórico de atendimentos',
  HISTORICO: 'Histórico de atendimentos',
};

// M-02g · Exportações (RF29, RF30). Anotações privadas nunca entram (RC04).
function Exportacoes({ idPaciente }) {
  const { dados, carregando, erro, recarregar } = useCarregar(
    () => listar('exportacoes', { idPaciente, _sort: 'dataSolicitacao', _order: 'desc' }),
    [idPaciente]
  );
  const pronto = (e) => ['CONCLUIDA', 'PRONTO'].includes(e.situacao);
  return (
    <>
      <div className='d-flex flex-wrap justify-content-end gap-2'>
        <button type='button' className='btn btn-outline-primary' onClick={() => emBreve('A exportação do histórico')}>
          Exportar histórico
        </button>
        <button type='button' className='btn btn-primary' onClick={() => emBreve('A exportação do prontuário completo')}>
          Exportar prontuário completo
        </button>
      </div>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados ?? []}
        vazio='Nenhuma exportação pedida.'
        colunas={[
          { titulo: 'Documento', render: (e) => TIPO_EXPORTACAO[e.tipo] ?? e.tipo },
          { titulo: 'Pedido em', render: (e) => diaMesHora(e.dataSolicitacao) },
          { titulo: 'Situação', render: (e) => <PilulaStatus rotulo={pronto(e) ? 'Pronto' : 'Gerando'} tom={pronto(e) ? 'sucesso' : 'info'} /> },
          {
            titulo: 'Ações',
            render: (e) =>
              !pronto(e) ? null : <AcoesLinha acoes={[{ tipo: 'baixar', alvo: TIPO_EXPORTACAO[e.tipo], aoClicar: () => emBreve('O download pelo link que expira') }]} />,
          },
        ]}
      />
    </>
  );
}

export default Exportacoes;
