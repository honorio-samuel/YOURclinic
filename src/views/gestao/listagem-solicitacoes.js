import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoSelect, Filtros } from '../../components/campos';
import JanelaDetalhe from '../../components/janela-detalhe';
import Modal from '../../components/modal';
import { CampoTextoLongo, useFormulario } from '../../components/formulario';
import { salvarComAviso, useConfirmacao } from '../../components/confirmacao';
import { DATA_DE_HOJE } from '../../config/axios';
import { listar, pessoasPorId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { data, diasEntre } from '../../utils/formatos';
import { rotuloDe, SITUACAO_SOLICITACAO, TIPO_SOLICITACAO } from '../../utils/rotulos';
import { PRAZO_TITULAR } from './comum';
import { somarDias } from '../agenda/comum';

const EM_ABERTO = ['ABERTA', 'EM_ANALISE'];

// A resposta ao titular: o texto que ele lê e a conclusão do pedido.
function JanelaResposta({ solicitacao, aoFechar, aoResponder }) {
  const form = useFormulario({ resposta: '' }, 'resposta-');
  const [salvando, setSalvando] = React.useState(false);
  const enviar = async () => {
    if (!form.validar({ resposta: form.valores.resposta.trim().length >= 10 ? null : 'Escreva a resposta ao titular.' })) return;
    setSalvando(true);
    const ok = await salvarComAviso(
      'solicitacoesTitular',
      solicitacao.id,
      { situacao: 'RESPONDIDA', resposta: form.valores.resposta.trim(), dataResposta: DATA_DE_HOJE },
      'Resposta enviada ao titular.'
    );
    if (ok) aoResponder();
    else setSalvando(false);
  };
  return (
    <Modal
      titulo={`Responder a ${solicitacao.titular}`}
      aoFechar={aoFechar}
      largo
      rodape={
        <>
          <button type='button' className='btn btn-outline-secondary' onClick={aoFechar} disabled={salvando}>
            Voltar
          </button>
          <button type='button' className='btn btn-primary' onClick={enviar} disabled={salvando}>
            {salvando ? 'Enviando…' : 'Enviar resposta'}
          </button>
        </>
      }
    >
      <form
        noValidate
        aria-label='Resposta ao titular'
        className='row g-3'
        onSubmit={(e) => {
          e.preventDefault();
          enviar();
        }}
      >
        <p className='col-12 mb-0'>
          Pedido de {(TIPO_SOLICITACAO[solicitacao.tipo] ?? solicitacao.tipo).toLowerCase()}, aberto em {data(solicitacao.dataSolicitacao)}. A resposta aparece no portal do titular e conclui o pedido.
        </p>
        <CampoTextoLongo {...form.campo('resposta')} rotulo='Resposta ao titular' linhas={5} />
      </form>
    </Modal>
  );
}

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
  const [aberta, setAberta] = React.useState(null);
  const [respondendo, setRespondendo] = React.useState(null);

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
                  { tipo: 'ver', alvo: `solicitação de ${s.titular}`, aoClicar: () => setAberta(s) },
                  ...(EM_ABERTO.includes(s.situacao) ? [{ tipo: 'editar', alvo: `resposta a ${s.titular}`, aoClicar: () => setRespondendo(s) }] : []),
                ]}
              />
            ),
          },
        ]}
      />
      {aberta && (
        <JanelaDetalhe
          titulo={`Solicitação de ${aberta.titular}`}
          aoFechar={() => setAberta(null)}
          itens={[
            ['Direito', TIPO_SOLICITACAO[aberta.tipo] ?? aberta.tipo],
            ['Aberta em', data(aberta.dataSolicitacao)],
            ['Prazo', `${data(somarDias(aberta.dataSolicitacao.slice(0, 10), PRAZO_TITULAR))} (${PRAZO_TITULAR} dias)`],
            ['Situação', rotuloDe(SITUACAO_SOLICITACAO, aberta.situacao).rotulo],
            ['Respondida em', aberta.dataResposta ? data(aberta.dataResposta) : undefined],
            ['Resposta', aberta.resposta ?? undefined],
            ['Motivo da recusa', aberta.motivoRecusa ?? undefined],
          ]}
        />
      )}
      {respondendo && (
        <JanelaResposta
          solicitacao={respondendo}
          aoFechar={() => setRespondendo(null)}
          aoResponder={() => {
            setRespondendo(null);
            recarregar();
          }}
        />
      )}
      {modal}
    </Pagina>
  );
}

export default SolicitacoesTitulares;
