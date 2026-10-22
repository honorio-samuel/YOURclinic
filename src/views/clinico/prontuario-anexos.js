import React from 'react';

import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { emBreve, salvarComAviso } from '../../components/confirmacao';
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

// M-02e · Anexos. Exame enviado pelo titular fica pendente de aceite médico.
function AnexosClinicos({ idPaciente }) {
  const { dados, carregando, erro, recarregar } = useCarregar(() => listar('anexos', { idPaciente, _sort: 'dataEnvio', _order: 'desc' }), [idPaciente]);
  const mudar = async (a, situacao) => {
    if (await salvarComAviso('anexos', a.id, { situacao }, situacao === 'ACEITO' ? 'Exame aceito no prontuário.' : 'Exame recusado.')) recarregar();
  };
  return (
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
              transicoes={a.situacao === 'A_ACEITAR' ? [{ rotulo: 'Aceitar', aoEscolher: () => mudar(a, 'ACEITO') }, { rotulo: 'Recusar', aoEscolher: () => mudar(a, 'RECUSADO') }] : null}
            />
          ),
        },
        {
          titulo: 'Ações',
          render: (a) => (
            <AcoesLinha
              acoes={[
                { tipo: 'ver', alvo: a.nomeArquivo, aoClicar: () => emBreve('A visualização do anexo') },
                { tipo: 'baixar', alvo: a.nomeArquivo, aoClicar: () => emBreve('O download do anexo') },
              ]}
            />
          ),
        },
      ]}
    />
  );
}

export default AnexosClinicos;
