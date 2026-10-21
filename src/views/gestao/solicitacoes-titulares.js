import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoSelect, Filtros } from '../../components/campos';
import { emBreve, salvarComAviso, useConfirmacao } from '../../components/confirmacao';
import { DATA_DE_HOJE } from '../../config/axios';
import { listar, pessoasPorId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { data, diasEntre } from '../../utils/formatos';
import { rotuloDe, SITUACAO_SOLICITACAO, TIPO_SOLICITACAO } from '../../utils/rotulos';
import { PRAZO_TITULAR } from './comum';

// A-33 · Solicitações dos titulares (LGPD). Prazo de 15 dias para a declaração
// completa (LGPD, art. 19, II), com alerta antes do vencimento.
function SolicitacoesTitulares() {
  const carregar = async () => {
    const solicitacoes = await listar('solicitacoesTitular', { _sort: 'dataSolicitacao', _order: 'desc' });
    const pessoas = await pessoasPorId(solicitacoes.map((s) => s.idPaciente));
    return solicitacoes.map((s) => ({ ...s, titular: pessoas[s.idPaciente]?.nome ?? '—', restante: PRAZO_TITULAR - diasEntre(s.dataSolicitacao, DATA_DE_HOJE) }));
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [modal, confirmar] = useConfirmacao();
  const [direito, setDireito] = React.useState('');
  const [situacao, setSituacao] = React.useState('EM_ABERTO');

  const mudar = async (s, nova, extra = {}) => {
    if (await salvarComAviso('solicitacoesTitular', s.id, { situacao: nova, ...extra }, 'Solicitação atualizada.')) recarregar();
  };
  const recusar = async (s) => {
    const motivo = await confirmar({ titulo: 'Recusar a solicitação?', texto: 'O titular recebe o motivo da recusa.', campo: 'Motivo', rotuloConfirmar: 'Recusar', perigo: true });
    if (motivo) mudar(s, 'RECUSADA', { motivoRecusa: motivo, dataResposta: DATA_DE_HOJE });
  };

  const linhas = (dados ?? []).filter(
    (s) => (!direito || s.tipo === direito) && (situacao === 'EM_ABERTO' ? ['ABERTA', 'EM_ANALISE'].includes(s.situacao) : !situacao || s.situacao === situacao)
  );
  const aVencer = (dados ?? []).filter((s) => ['ABERTA', 'EM_ANALISE'].includes(s.situacao) && s.restante <= 3);

  return (
    <Pagina titulo='Solicitações dos titulares'>
      <Filtros>
        <CampoSelect id='solDireito' rotulo='Direito' valor={direito} aoMudar={setDireito} opcoes={[['', 'Todos'], ...Object.entries(TIPO_SOLICITACAO)]} />
        <CampoSelect
          id='solSituacao'
          rotulo='Situação'
          valor={situacao}
          aoMudar={setSituacao}
          opcoes={[['EM_ABERTO', 'Em aberto'], ['', 'Todas'], ...Object.entries(SITUACAO_SOLICITACAO).map(([k, v]) => [k, v.rotulo])]}
        />
      </Filtros>
      {aVencer.length > 0 && (
        <div className='alert alert-warning mb-0' role='status'>
          {aVencer.length === 1 ? '1 solicitação vence' : `${aVencer.length} solicitações vencem`} em até 3 dias.
        </div>
      )}
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhuma solicitação nesta seleção.'
        colunas={[
          { titulo: 'Titular', render: (s) => s.titular },
          { titulo: 'Direito', render: (s) => TIPO_SOLICITACAO[s.tipo] ?? s.tipo },
          { titulo: 'Aberta em', render: (s) => data(s.dataSolicitacao) },
          { titulo: 'Prazo', render: (s) => (['ABERTA', 'EM_ANALISE'].includes(s.situacao) ? `${s.restante} dias` : '—') },
          {
            titulo: 'Situação',
            render: (s) => (
              <PilulaStatus
                {...rotuloDe(SITUACAO_SOLICITACAO, s.situacao)}
                transicoes={
                  s.situacao === 'ABERTA'
                    ? [{ rotulo: 'Iniciar análise', aoEscolher: () => mudar(s, 'EM_ANALISE') }]
                    : s.situacao === 'EM_ANALISE'
                      ? [
                          { rotulo: 'Concluir', aoEscolher: () => mudar(s, 'RESPONDIDA', { dataResposta: DATA_DE_HOJE }) },
                          { rotulo: 'Recusar', aoEscolher: () => recusar(s) },
                        ]
                      : null
                }
              />
            ),
          },
          {
            titulo: 'Ações',
            render: (s) => (
              <AcoesLinha
                acoes={[
                  { tipo: 'ver', alvo: `solicitação de ${s.titular}`, aoClicar: () => emBreve('O detalhe da solicitação') },
                  { tipo: 'editar', alvo: `solicitação de ${s.titular}`, aoClicar: () => emBreve('A resposta ao titular') },
                ]}
              />
            ),
          },
        ]}
      />
      {modal}
    </Pagina>
  );
}

export default SolicitacoesTitulares;
