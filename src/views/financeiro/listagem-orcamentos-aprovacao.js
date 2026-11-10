import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { salvarComAviso, useConfirmacao } from '../../components/confirmacao';
import { useCarregar } from '../../hooks/use-carregar';
import { data, moeda } from '../../utils/formatos';
import { carregarOrcamentos, DetalheItens, total } from './orcamentos-comum';

// A-18 · Orçamentos · aprovação. O Administrador vê procedimento, quantidade e
// valor, sem justificativa clínica; aprova ou devolve, não edita.
function OrcamentosAprovacao() {
  const { dados, carregando, erro, recarregar } = useCarregar(() => carregarOrcamentos({ etapa: 'APROVACAO' }));
  const [modal, confirmar] = useConfirmacao();
  const [aberto, setAberto] = React.useState(null);

  const aprovar = async (o) => {
    const ok = await confirmar({ titulo: `Aprovar o orçamento de ${o.paciente}?`, texto: `Total de ${moeda(total(o))}. Depois da aprovação, o titular recebe o orçamento para aceite.`, rotuloConfirmar: 'Aprovar' });
    if (ok && (await salvarComAviso('orcamentos', o.id, { etapa: 'ACEITE' }, 'Orçamento aprovado e enviado ao titular.'))) {
      setAberto(null);
      recarregar();
    }
  };
  const devolver = async (o) => {
    const motivo = await confirmar({ titulo: 'Devolver o orçamento?', texto: 'Ele volta para a etapa de valores, com a sua observação.', campo: 'Observação', rotuloConfirmar: 'Devolver' });
    if (motivo && (await salvarComAviso('orcamentos', o.id, { etapa: 'VALORES', observacaoDevolucao: motivo }, 'Orçamento devolvido para a etapa de valores.'))) {
      setAberto(null);
      recarregar();
    }
  };

  return (
    <Pagina titulo='Orçamentos a aprovar'>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados ?? []}
        vazio='Nenhum orçamento aguardando aprovação.'
        colunas={[
          { titulo: 'Paciente', render: (o) => o.paciente },
          { titulo: 'Médico', render: (o) => o.medico },
          { titulo: 'Itens', classe: 'text-end', render: (o) => o.itens.length },
          { titulo: 'Total', classe: 'text-end', render: (o) => moeda(total(o)) },
          { titulo: 'Recebido em', render: (o) => data(o.dataEmissao) },
          {
            titulo: 'Situação',
            render: (o) => (
              <PilulaStatus
                rotulo='A aprovar'
                tom='aviso'
                transicoes={[
                  { rotulo: 'Aprovar', aoEscolher: () => aprovar(o) },
                  { rotulo: 'Devolver', aoEscolher: () => devolver(o) },
                ]}
              />
            ),
          },
          { titulo: 'Ações', render: (o) => <AcoesLinha acoes={[{ tipo: 'ver', alvo: `orçamento de ${o.paciente}`, aoClicar: () => setAberto(o) }]} /> },
        ]}
      />
      {aberto && (
        <>
          <div className='alert alert-info mb-0' role='status'>
            Você vê procedimento, quantidade e valor. A justificativa clínica não aparece, e cada abertura fica registrada no log.
          </div>
          <DetalheItens orcamento={aberto} comValores aoFechar={() => setAberto(null)} />
        </>
      )}
      {modal}
    </Pagina>
  );
}

export default OrcamentosAprovacao;
