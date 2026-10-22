import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoBusca, CampoSelect, Filtros } from '../../components/campos';
import { emBreve } from '../../components/confirmacao';
import { DATA_DE_HOJE } from '../../config/axios';
import { useCarregar } from '../../hooks/use-carregar';
import { corresponde, diaMesHora } from '../../utils/formatos';
import { carregarConsultas, opcoesDeMedico, useMudarStatus } from './comum';

// S-04 · Reagendar ou cancelar. Lista as consultas agendadas a partir de hoje.
function ReagendarOuCancelar() {
  const { dados, carregando, erro, recarregar } = useCarregar(() =>
    carregarConsultas({ status: 'AGENDADO', dataHora_gte: `${DATA_DE_HOJE}T00:00:00`, _sort: 'dataHora' })
  );
  const [modal, mudar] = useMudarStatus(recarregar);
  const [busca, setBusca] = React.useState('');
  const [medico, setMedico] = React.useState('');
  const [dia, setDia] = React.useState('');
  const linhas = (dados ?? []).filter(
    (c) =>
      corresponde(busca, c.paciente) &&
      (!medico || String(c.idMedico) === medico) &&
      (!dia || c.dataHora.startsWith(dia))
  );

  return (
    <Pagina titulo='Reagendar ou cancelar'>
      <Filtros>
        <CampoBusca id='reagendarBusca' rotulo='Buscar por paciente' valor={busca} aoMudar={setBusca} />
        <CampoSelect id='reagendarMedico' rotulo='Médico' valor={medico} aoMudar={setMedico} opcoes={opcoesDeMedico(dados)} />
        <div className='filtro'>
          <label htmlFor='reagendarData' className='form-label'>
            Data
          </label>
          <input id='reagendarData' type='date' className='form-control' value={dia} onChange={(e) => setDia(e.target.value)} />
        </div>
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhuma consulta agendada nesta seleção.'
        colunas={[
          { titulo: 'Paciente', render: (c) => c.paciente },
          { titulo: 'Data e hora', render: (c) => diaMesHora(c.dataHora) },
          { titulo: 'Médico', render: (c) => c.medico },
          { titulo: 'Status', render: (c) => <PilulaStatus estado={c.status} /> },
          {
            titulo: 'Ações',
            render: (c) => (
              <AcoesLinha
                acoes={[
                  { tipo: 'ver', alvo: `consulta de ${c.paciente}`, aoClicar: () => emBreve('O reagendamento') },
                  {
                    tipo: 'cancelar',
                    alvo: `consulta de ${c.paciente}`,
                    aoClicar: () =>
                      mudar(c, 'CANCELADO', {
                        titulo: `Cancelar a consulta de ${c.paciente}?`,
                        texto: 'O paciente recebe o aviso de cancelamento. A consulta fica no histórico como cancelada pela clínica.',
                        rotuloConfirmar: 'Cancelar consulta',
                        perigo: true,
                      }),
                  },
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

export default ReagendarOuCancelar;
