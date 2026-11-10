import React from 'react';

import Listagem from '../../components/listagem';
import { listar, pessoasPorId, porId } from '../../servicos/dados';
import { moeda, nomeMedico } from '../../utils/formatos';

// Partes usadas por mais de uma tela desta pasta.

// Orçamentos com paciente, médico e itens. O Médico nunca recebe valores do
// servidor; as telas dele também não os mostram.
export async function carregarOrcamentos(params, comPrecoDeTabela = false) {
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

export const subtotal = (i) => (i.valorUnitario === null || i.valorUnitario === undefined ? null : i.valorUnitario * i.quantidade);
export const total = (o) => o.itens.reduce((s, i) => s + (subtotal(i) ?? 0), 0);

export function DetalheItens({ orcamento, comValores, rotuloValor = 'Valor', aoFechar }) {
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
