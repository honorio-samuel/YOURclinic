import React from 'react';
import { useNavigate } from 'react-router-dom';

import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mostrarMensagem } from '../../components/toastr';
import { criar, listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { diaMesHora } from '../../utils/formatos';

const TIPO_EXPORTACAO = {
  PRONTUARIO_COMPLETO: 'Prontuário completo',
  PRONTUARIO: 'Prontuário completo',
  HISTORICO_ATENDIMENTOS: 'Histórico de atendimentos',
  HISTORICO: 'Histórico de atendimentos',
};
const pronto = (e) => ['CONCLUIDA', 'PRONTO'].includes(e.situacao);

// M-02g · Exportações (RF29, RF30). O pedido gera o documento em segundo
// plano; a lista se atualiza sozinha até ficar pronto. Anotações privadas
// nunca entram (RC04).
function Exportacoes({ idPaciente }) {
  const navigate = useNavigate();
  const { dados, carregando, erro, recarregar } = useCarregar(
    () => listar('exportacoes', { idPaciente, _sort: 'dataSolicitacao', _order: 'desc' }),
    [idPaciente]
  );
  const [modal, confirmar] = useConfirmacao();
  const gerando = (dados ?? []).some((e) => !pronto(e));

  React.useEffect(() => {
    if (!gerando) return undefined;
    const espera = setTimeout(recarregar, 3000);
    return () => clearTimeout(espera);
  }, [gerando, dados, recarregar]);

  const pedir = async (tipo) => {
    const completo = tipo === 'PRONTUARIO';
    const ok = await confirmar({
      titulo: completo ? 'Exportar o prontuário completo?' : 'Exportar o histórico de atendimentos?',
      texto: completo
        ? 'O documento traz os registros selados, com retificações e prescrições, sem as anotações privadas. O link vale por 24 horas e só para você.'
        : 'O documento traz só datas, tipo de atendimento, médico, especialidade e situação, sem conteúdo clínico.',
      rotuloConfirmar: 'Exportar',
    });
    if (!ok) return;
    try {
      await criar('exportacoes', { tipo, formato: 'PDF', idPaciente });
      mostrarMensagem('Exportação pedida', 'O documento fica pronto em alguns segundos.', 'info');
      recarregar();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    }
  };

  return (
    <>
      <div className='d-flex flex-wrap justify-content-end gap-2'>
        <button type='button' className='btn btn-outline-primary' onClick={() => pedir('HISTORICO')}>
          Exportar histórico
        </button>
        <button type='button' className='btn btn-primary' onClick={() => pedir('PRONTUARIO')}>
          Exportar prontuário completo
        </button>
      </div>
      <Listagem
        carregando={carregando && !dados}
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
              !pronto(e) ? null : (
                <AcoesLinha
                  acoes={[
                    {
                      tipo: 'baixar',
                      alvo: TIPO_EXPORTACAO[e.tipo],
                      aoClicar: () => navigate(`/medico/prontuario/${idPaciente}/exportacoes/${e.id}`),
                    },
                  ]}
                />
              ),
          },
        ]}
      />
      {modal}
    </>
  );
}

export default Exportacoes;
