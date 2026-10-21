import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import { DATA_DE_HOJE } from '../../config/axios';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { hora } from '../../utils/formatos';
import { carregarConsultas, doDia, useMudarStatus } from './comum';

// M-01 Atendimentos do dia. O Médico vê só os próprios atendimentos e não vê valores.
function AtendimentosDoDia() {
  const { sessao } = useSessao();
  const navigate = useNavigate();
  const idMedico = sessao.usuario.idPessoa;
  const { dados, carregando, erro, recarregar } = useCarregar(() =>
    carregarConsultas({ ...doDia(DATA_DE_HOJE), idMedico })
  );
  const [modal, mudar] = useMudarStatus(recarregar);

  const transicoes = (c) => {
    if (c.status === 'NA_RECEPCAO') return [{ rotulo: 'Chamar paciente', aoEscolher: () => mudar(c, 'EM_ATENDIMENTO') }];
    if (c.status === 'EM_ATENDIMENTO')
      return [
        {
          rotulo: 'Finalizar e selar',
          aoEscolher: () =>
            mudar(c, 'FINALIZADO', {
              titulo: `Finalizar o atendimento de ${c.paciente}?`,
              texto: 'O registro clínico é selado. Correções depois disso só por retificação versionada.',
              rotuloConfirmar: 'Finalizar e selar',
            }),
        },
        {
          rotulo: 'Voltar para a recepção',
          aoEscolher: () =>
            mudar(c, 'NA_RECEPCAO', {
              titulo: 'Voltar o paciente para a recepção?',
              texto: 'A mudança fica destacada no log. O vínculo já ativado não muda.',
              campo: 'Motivo',
              rotuloConfirmar: 'Voltar para a recepção',
            }),
        },
      ];
    if (c.status === 'FINALIZADO')
      return [
        {
          rotulo: 'Voltar para Em atendimento',
          aoEscolher: () =>
            mudar(c, 'EM_ATENDIMENTO', {
              titulo: 'Voltar o atendimento para Em atendimento?',
              texto: 'A mudança fica destacada no log. O registro continua selado e só muda por retificação.',
              campo: 'Motivo',
              rotuloConfirmar: 'Voltar para Em atendimento',
            }),
        },
      ];
    return null;
  };

  return (
    <Pagina titulo='Atendimentos do dia'>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados ?? []}
        itensPorPagina={50}
        vazio='Nenhum atendimento marcado para hoje.'
        colunas={[
          { titulo: 'Paciente', render: (c) => c.paciente },
          { titulo: 'Horário', render: (c) => hora(c.dataHora) },
          { titulo: 'Tipo', render: (c) => c.tipo },
          { titulo: 'Status', render: (c) => <PilulaStatus estado={c.status} transicoes={transicoes(c)} /> },
          {
            titulo: 'Prontuário',
            render: (c) =>
              ['EM_ATENDIMENTO', 'FINALIZADO'].includes(c.status) ? (
                <button type='button' className='btn btn-link btn-sm p-0' onClick={() => navigate(`/medico/prontuario/${c.idPaciente}`)}>
                  Abrir
                </button>
              ) : (
                '—'
              ),
          },
        ]}
      />
      {modal}
    </Pagina>
  );
}

export default AtendimentosDoDia;
