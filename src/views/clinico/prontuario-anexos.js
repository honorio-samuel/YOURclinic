import React from 'react';

import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { BotaoEnviarArquivo, baixarAnexo, VisualizadorDeAnexo } from '../../components/anexos';
import { salvarComAviso, useConfirmacao } from '../../components/confirmacao';
import { listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { data } from '../../utils/formatos';
import { rotuloDe } from '../../utils/rotulos';
import { ENVIADO_POR } from './comum';

const SITUACAO_ANEXO = {
  DISPONIVEL: { rotulo: 'Disponível', tom: 'sucesso' },
  A_ACEITAR: { rotulo: 'A aceitar', tom: 'aviso' },
  ACEITO: { rotulo: 'Aceito', tom: 'sucesso' },
  RECUSADO: { rotulo: 'Recusado', tom: 'neutro' },
};

// M-02e · Anexos (RF26, RF27). O Médico abre e baixa os exames do paciente
// no alcance dele e envia os próprios. O exame enviado pelo titular só entra
// no prontuário depois do aceite; a recusa pede motivo (RN-26.6).
function AnexosClinicos({ idPaciente }) {
  const { dados, carregando, erro, recarregar } = useCarregar(() => listar('anexos', { idPaciente, _sort: 'dataEnvio', _order: 'desc' }), [idPaciente]);
  const [modal, confirmar] = useConfirmacao();
  const [aberto, setAberto] = React.useState(null);

  const aceitar = async (a) => {
    if (await salvarComAviso('anexos', a.id, { situacao: 'ACEITO' }, 'Exame aceito no prontuário.')) recarregar();
  };
  const recusar = async (a) => {
    const motivo = await confirmar({
      titulo: `Recusar ${a.nomeArquivo}?`,
      texto: 'O exame não entra no prontuário. O titular vê o motivo no portal.',
      campo: 'Motivo da recusa',
      rotuloConfirmar: 'Recusar exame',
      perigo: true,
    });
    if (motivo && (await salvarComAviso('anexos', a.id, { situacao: 'RECUSADO', motivoRecusa: motivo }, 'Exame recusado.'))) recarregar();
  };

  return (
    <>
      <div className='d-flex flex-wrap justify-content-between align-items-center gap-2'>
        <p className='mb-0 small text-body-secondary'>PDF, JPG ou PNG de até 5 MB. Cada abertura e cada download ficam no log.</p>
        <BotaoEnviarArquivo idPaciente={idPaciente} aoEnviar={recarregar} classe='btn btn-outline-primary' />
      </div>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados ?? []}
        vazio='Nenhum anexo para este paciente.'
        colunas={[
          { titulo: 'Arquivo', render: (a) => a.nomeArquivo },
          { titulo: 'Enviado em', render: (a) => data(a.dataEnvio) },
          { titulo: 'Enviado por', render: (a) => ENVIADO_POR[a.enviadoPor] ?? '—' },
          {
            titulo: 'Situação',
            render: (a) => (
              <PilulaStatus
                {...rotuloDe(SITUACAO_ANEXO, a.situacao)}
                transicoes={a.situacao === 'A_ACEITAR' ? [{ rotulo: 'Aceitar', aoEscolher: () => aceitar(a) }, { rotulo: 'Recusar', aoEscolher: () => recusar(a) }] : null}
              />
            ),
          },
          {
            titulo: 'Ações',
            render: (a) => (
              <AcoesLinha
                acoes={[
                  { tipo: 'ver', alvo: a.nomeArquivo, aoClicar: () => setAberto(a) },
                  { tipo: 'baixar', alvo: a.nomeArquivo, aoClicar: () => baixarAnexo(a) },
                ]}
              />
            ),
          },
        ]}
      />
      {aberto && <VisualizadorDeAnexo anexo={aberto} aoFechar={() => setAberto(null)} />}
      {modal}
    </>
  );
}

export default AnexosClinicos;
