import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { mensagemDeErro, salvarComAviso, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { atualizar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { data, moeda } from '../../utils/formatos';
import { ETAPA_ORCAMENTO, rotuloDe } from '../../utils/rotulos';
import { carregarOrcamentos, DetalheItens, total } from './orcamentos-comum';

// S-10 · Orçamentos pendentes (etapa 2). A Secretária aplica os preços e não
// altera o escopo; se discordar, devolve ao Médico com observação.
function OrcamentosValores() {
  const { dados, carregando, erro, recarregar } = useCarregar(() => carregarOrcamentos({ etapa: 'VALORES' }, true));
  const [modal, confirmar] = useConfirmacao();
  const [aberto, setAberto] = React.useState(null);

  const enviar = async (o) => {
    const ok = await confirmar({ titulo: 'Enviar para aprovação?', texto: `Total de ${moeda(total(o))}. O Administrador aprova ou devolve.`, rotuloConfirmar: 'Enviar para aprovação' });
    if (!ok) return;
    try {
      for (const i of o.itens.filter((x) => x.semPreco)) await atualizar('itensOrcamento', i.id, { valorUnitario: i.valorUnitario });
      await atualizar('orcamentos', o.id, { etapa: 'APROVACAO', valorTotal: total(o) });
      mensagemSucesso('Orçamento enviado para aprovação.');
      setAberto(null);
      recarregar();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    }
  };
  const devolver = async (o) => {
    const motivo = await confirmar({ titulo: 'Devolver ao médico?', texto: 'O escopo volta para o médico com a sua observação.', campo: 'Observação', rotuloConfirmar: 'Devolver ao médico' });
    if (motivo && (await salvarComAviso('orcamentos', o.id, { etapa: 'DEVOLVIDO', observacaoDevolucao: motivo }, 'Orçamento devolvido ao médico.'))) {
      setAberto(null);
      recarregar();
    }
  };

  return (
    <Pagina titulo='Orçamentos pendentes'>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados ?? []}
        vazio='Nenhum orçamento aguardando valores.'
        legenda='Devolvidos pelo Administrador voltam para esta lista.'
        colunas={[
          { titulo: 'Paciente', render: (o) => o.paciente },
          { titulo: 'Médico', render: (o) => o.medico },
          { titulo: 'Recebido em', render: (o) => data(o.dataEmissao) },
          { titulo: 'Situação', render: (o) => <PilulaStatus {...rotuloDe(ETAPA_ORCAMENTO, o.etapa)} /> },
          {
            titulo: 'Ações',
            render: (o) => (
              <AcoesLinha
                acoes={[
                  { tipo: 'ver', alvo: `orçamento de ${o.paciente}`, aoClicar: () => setAberto(o) },
                  { tipo: 'editar', alvo: `orçamento de ${o.paciente}`, aoClicar: () => setAberto(o) },
                ]}
              />
            ),
          },
        ]}
      />
      {aberto && (
        <>
          {aberto.observacaoDevolucao && (
            <div className='alert alert-warning mb-0' role='status'>
              Devolvido com a observação: {aberto.observacaoDevolucao}
            </div>
          )}
          <DetalheItens orcamento={aberto} comValores rotuloValor='Preço de tabela' aoFechar={() => setAberto(null)} />
          <div className='d-flex flex-wrap justify-content-end gap-2'>
            <button type='button' className='btn btn-outline-primary' onClick={() => devolver(aberto)}>
              Devolver ao médico
            </button>
            <button type='button' className='btn btn-primary' onClick={() => enviar(aberto)}>
              Enviar para aprovação
            </button>
          </div>
        </>
      )}
      {modal}
    </Pagina>
  );
}

export default OrcamentosValores;
