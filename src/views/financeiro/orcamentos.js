import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { emBreve, mensagemDeErro, salvarComAviso, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { atualizar, listar, pessoasPorId, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { data, moeda, nomeMedico } from '../../utils/formatos';
import { ETAPA_ORCAMENTO, rotuloDe } from '../../utils/rotulos';

// Orçamentos com paciente, médico e itens. O Médico nunca recebe valores do
// servidor; as telas dele também não os mostram.
async function carregarOrcamentos(params, comPrecoDeTabela = false) {
  const [orcamentos, itensBrutos, procedimentos] = await Promise.all([
    listar('orcamentos', { _sort: 'dataEmissao', _order: 'desc', ...params }),
    listar('itensOrcamento'),
    comPrecoDeTabela ? listar('procedimentos') : Promise.resolve([]),
  ]);
  // Na etapa de valores, o preço vem da tabela do procedimento (RC06, nível 2).
  const proc = porId(procedimentos);
  const itens = comPrecoDeTabela
    ? itensBrutos.map((i) => ({ ...i, valorUnitario: i.valorUnitario ?? proc[i.idProcedimento]?.precoParticular ?? null, semPreco: i.valorUnitario === null }))
    : itensBrutos;
  const pessoas = await pessoasPorId(orcamentos.flatMap((o) => [o.idPaciente, o.idMedico]));
  return orcamentos.map((o) => ({
    ...o,
    paciente: pessoas[o.idPaciente]?.nome ?? '—',
    medico: nomeMedico(pessoas[o.idMedico]),
    itens: itens.filter((i) => i.idOrcamento === o.id),
  }));
}

const subtotal = (i) => (i.valorUnitario === null || i.valorUnitario === undefined ? null : i.valorUnitario * i.quantidade);
const total = (o) => o.itens.reduce((s, i) => s + (subtotal(i) ?? 0), 0);

function DetalheItens({ orcamento, comValores, rotuloValor = 'Valor', aoFechar }) {
  const colunas = [
    { titulo: 'Procedimento', render: (i) => i.descricao },
    { titulo: comValores ? 'Qtd.' : 'Quantidade', classe: 'text-end', render: (i) => i.quantidade },
  ];
  if (comValores) {
    colunas.push({ titulo: rotuloValor, classe: 'text-end', render: (i) => moeda(i.valorUnitario) });
    colunas.push({ titulo: 'Subtotal', classe: 'text-end', render: (i) => moeda(subtotal(i)) });
  }
  return (
    <div className='card'>
      <div className='card-body d-flex flex-column gap-3'>
        <div className='d-flex justify-content-between align-items-center'>
          <h2 className='h5 mb-0'>Orçamento de {orcamento.paciente}</h2>
          <button type='button' className='btn btn-sm btn-outline-secondary' onClick={aoFechar}>
            Fechar
          </button>
        </div>
        <Listagem linhas={orcamento.itens} colunas={colunas} vazio='Nenhum item.' />
        {comValores && <p className='mb-0 text-end'>Total do orçamento: <strong>{moeda(total(orcamento))}</strong></p>}
      </div>
    </div>
  );
}

// A-18 · Orçamentos · aprovação. O Administrador vê procedimento, quantidade e
// valor, sem justificativa clínica; aprova ou devolve, não edita.
export function OrcamentosAprovacao() {
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

// S-10 · Orçamentos pendentes (etapa 2). A Secretária aplica os preços e não
// altera o escopo; se discordar, devolve ao Médico com observação.
export function OrcamentosValores() {
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

// M-04 · Orçamentos · etapa 1 · escopo clínico. Nenhuma coluna de preço: o
// Médico não vê nem define valores. O Ver das etapas seguintes abre só o escopo.
export function OrcamentosMedico() {
  const { sessao } = useSessao();
  const { dados, carregando, erro, recarregar } = useCarregar(() => carregarOrcamentos({ idMedico: sessao.usuario.idPessoa }));
  const [modal, confirmar] = useConfirmacao();
  const [aberto, setAberto] = React.useState(null);

  const enviar = async (o) => {
    const ok = await confirmar({ titulo: 'Enviar para valores?', texto: 'A Secretária aplica os preços. Depois disso, o escopo não pode mais ser editado.', rotuloConfirmar: 'Enviar para valores' });
    if (ok && (await salvarComAviso('orcamentos', o.id, { etapa: 'VALORES' }, 'Escopo enviado para a etapa de valores.'))) {
      setAberto(null);
      recarregar();
    }
  };

  return (
    <Pagina
      titulo='Orçamentos'
      acoes={
        <button type='button' className='btn btn-primary' onClick={() => emBreve('A criação de orçamento')}>
          + Novo orçamento
        </button>
      }
    >
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados ?? []}
        vazio='Você ainda não criou orçamentos.'
        colunas={[
          { titulo: 'Paciente', render: (o) => o.paciente },
          { titulo: 'Criado em', render: (o) => data(o.dataEmissao) },
          { titulo: 'Itens', classe: 'text-end', render: (o) => o.itens.length },
          { titulo: 'Situação', render: (o) => <PilulaStatus {...rotuloDe(ETAPA_ORCAMENTO, o.etapa)} /> },
          {
            titulo: 'Ações',
            render: (o) => {
              const alvo = `orçamento de ${o.paciente}`;
              const ver = { tipo: 'ver', alvo, aoClicar: () => setAberto(o) };
              return <AcoesLinha acoes={['ESCOPO', 'DEVOLVIDO'].includes(o.etapa) ? [ver, { tipo: 'editar', alvo, aoClicar: () => setAberto(o) }] : [ver]} />;
            },
          },
        ]}
      />
      {aberto && (
        <>
          {aberto.observacaoDevolucao && aberto.etapa === 'DEVOLVIDO' && (
            <div className='alert alert-warning mb-0' role='status'>
              Devolvido com a observação: {aberto.observacaoDevolucao}
            </div>
          )}
          <DetalheItens orcamento={aberto} comValores={false} aoFechar={() => setAberto(null)} />
          {['ESCOPO', 'DEVOLVIDO'].includes(aberto.etapa) && (
            <div className='d-flex justify-content-end'>
              <button type='button' className='btn btn-primary' onClick={() => enviar(aberto)}>
                Enviar para valores
              </button>
            </div>
          )}
        </>
      )}
      {modal}
    </Pagina>
  );
}
