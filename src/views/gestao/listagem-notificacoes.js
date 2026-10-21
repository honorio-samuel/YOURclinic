import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoSelect, Filtros } from '../../components/campos';
import { emBreve, salvarComAviso } from '../../components/confirmacao';
import { listar, pessoasPorId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { diaMesHora } from '../../utils/formatos';
import { CANAL, EVENTO_NOTIFICACAO, rotuloDe, SITUACAO_NOTIFICACAO } from '../../utils/rotulos';

// A-32 · Notificações. Reenvio manual das que falharam (RF59).
function Notificacoes() {
  const carregar = async () => {
    const notificacoes = await listar('notificacoes', { _sort: 'dataEnvio', _order: 'desc' });
    const pessoas = await pessoasPorId(notificacoes.map((n) => n.idPessoa));
    return notificacoes.map((n) => ({ ...n, destinatario: pessoas[n.idPessoa]?.nome ?? '—' }));
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [evento, setEvento] = React.useState('');
  const [canal, setCanal] = React.useState('');
  const [situacao, setSituacao] = React.useState('');

  const reenviar = async (n) => {
    if (await salvarComAviso('notificacoes', n.id, { situacao: 'ENVIADA', tentativas: (n.tentativas ?? 0) + 1 }, `Notificação reenviada para ${n.destinatario}.`)) recarregar();
  };
  const linhas = (dados ?? []).filter((n) => (!evento || n.evento === evento) && (!canal || n.canal === canal) && (!situacao || n.situacao === situacao));

  return (
    <Pagina
      titulo='Notificações'
      acoes={
        <button type='button' className='btn btn-outline-primary' onClick={() => emBreve('A edição de modelos e canais')}>
          Modelos e canais
        </button>
      }
    >
      <Filtros>
        <CampoSelect id='notEvento' rotulo='Evento' valor={evento} aoMudar={setEvento} opcoes={[['', 'Todos'], ...Object.entries(EVENTO_NOTIFICACAO)]} />
        <CampoSelect id='notCanal' rotulo='Canal' valor={canal} aoMudar={setCanal} opcoes={[['', 'Todos'], ['SMS', 'Mensagem de texto'], ['EMAIL', 'E-mail']]} />
        <CampoSelect
          id='notSituacao'
          rotulo='Situação'
          valor={situacao}
          aoMudar={setSituacao}
          opcoes={[['', 'Todas'], ...Object.entries(SITUACAO_NOTIFICACAO).map(([k, v]) => [k, v.rotulo])]}
        />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhuma notificação nesta seleção.'
        colunas={[
          { titulo: 'Evento', render: (n) => EVENTO_NOTIFICACAO[n.evento] ?? n.evento },
          { titulo: 'Canal', render: (n) => CANAL[n.canal] ?? n.canal },
          { titulo: 'Destinatário', render: (n) => n.destinatario },
          { titulo: 'Enviado em', render: (n) => diaMesHora(n.dataEnvio) },
          {
            titulo: 'Situação',
            render: (n) => (
              <PilulaStatus
                {...rotuloDe(SITUACAO_NOTIFICACAO, n.situacao)}
                transicoes={['FALHOU', 'FALHA'].includes(n.situacao) ? [{ rotulo: 'Reenviar', aoEscolher: () => reenviar(n) }] : null}
              />
            ),
          },
          { titulo: 'Ações', render: (n) => <AcoesLinha acoes={[{ tipo: 'ver', alvo: `notificação para ${n.destinatario}`, aoClicar: () => emBreve('O detalhe da notificação') }]} /> },
        ]}
      />
    </Pagina>
  );
}

export default Notificacoes;
