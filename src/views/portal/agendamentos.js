import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import { salvarComAviso, useConfirmacao } from '../../components/confirmacao';
import { DATA_DE_HOJE } from '../../config/axios';
import { useCarregar } from '../../hooks/use-carregar';
import { diaMesHora, diasEntre } from '../../utils/formatos';
import { carregarConsultasDoTitular, ExigeRepresentado, useTitular } from './comum';

const ANTECEDENCIA_CANCELAMENTO = 24; // horas (X08)

// P-03 e R-03 · Agendamentos. O titular cancela até X08 horas antes; depois
// disso, só pela recepção. Remarcar é cancelar e agendar de novo.
function AgendamentosPortal() {
  const { id, ehResponsavel } = useTitular();
  const navigate = useNavigate();
  const { dados, carregando, erro, recarregar } = useCarregar(async () => (id ? (await carregarConsultasDoTitular(id)).reverse() : []), [id]);
  const [modal, confirmar] = useConfirmacao();

  const podeCancelar = (c) => c.status === 'AGENDADO' && diasEntre(DATA_DE_HOJE, c.dataHora) * 24 >= ANTECEDENCIA_CANCELAMENTO;
  const cancelar = async (c) => {
    const ok = await confirmar({ titulo: 'Cancelar esta consulta?', texto: `${diaMesHora(c.dataHora)} com ${c.medico}. O horário fica livre para outra pessoa.`, rotuloConfirmar: 'Cancelar consulta', perigo: true });
    if (ok && (await salvarComAviso('consultas', c.id, { status: 'CANCELADO', motivoCancelamento: 'Cancelado pelo titular pelo portal' }, 'Consulta cancelada.'))) recarregar();
  };

  return (
    <ExigeRepresentado>
      <Pagina
        titulo={ehResponsavel ? 'Agendamentos' : 'Meus agendamentos'}
        acoes={
          <button type='button' className='btn btn-primary' onClick={() => navigate('/portal/agendar')}>
            Agendar consulta
          </button>
        }
      >
        <Listagem
          carregando={carregando}
          erro={erro}
          aoTentarDeNovo={recarregar}
          linhas={dados ?? []}
          vazio='Nenhum agendamento.'
          legenda={`O cancelamento pelo portal vale até ${ANTECEDENCIA_CANCELAMENTO} horas antes da consulta. Para remarcar, cancele e agende de novo.`}
          colunas={[
            { titulo: 'Data e hora', render: (c) => diaMesHora(c.dataHora) },
            { titulo: 'Médico', render: (c) => c.medico },
            { titulo: 'Tipo', render: (c) => c.tipo },
            { titulo: 'Situação', render: (c) => <PilulaStatus estado={c.status} /> },
            {
              titulo: '',
              render: (c) =>
                podeCancelar(c) ? (
                  <button type='button' className='btn btn-link btn-sm p-0' onClick={() => cancelar(c)}>
                    Cancelar
                  </button>
                ) : c.status === 'AGENDADO' ? (
                  'Ligue para a recepção'
                ) : (
                  '—'
                ),
            },
          ]}
        />
        {modal}
      </Pagina>
    </ExigeRepresentado>
  );
}

export default AgendamentosPortal;
