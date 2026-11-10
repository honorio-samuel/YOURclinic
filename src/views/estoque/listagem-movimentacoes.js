import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import { CampoSelect, Filtros } from '../../components/campos';
import { emBreve } from '../../components/confirmacao';
import { listar, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { data, mesAno, quantidadeComSinal } from '../../utils/formatos';

const TIPO_MOVIMENTO = {
  ENTRADA: 'Entrada',
  SAIDA: 'Saída',
  DESCARTE: 'Descarte',
  AJUSTE: 'Ajuste',
};
const ORIGEM = {
  COMPRA: 'compra',
  DOACAO: 'doação',
  AMOSTRA_FORNECEDOR: 'amostra do fornecedor',
  CONSUMO_INTERNO: 'consumo interno',
};

function tipoDoMovimento(m) {
  if (m.origem === 'DESCARTE') return 'DESCARTE';
  if (m.tipo === 'AJUSTE' || m.origem === 'AJUSTE_INVENTARIO') return 'AJUSTE';
  return m.tipo;
}

// A-27 e S-18 · Movimentações. Ao Administrador, as saídas em atendimento chegam
// somadas por item e por mês, sem paciente (D31). A Secretária vê cada
// movimentação física, com o destino "Paciente" sem nome (RC08).
function Movimentacoes() {
  const { sessao } = useSessao();
  const ehAdmin = sessao.usuario.papel === 'ADMINISTRADOR';
  const carregar = async () => {
    const [movimentos, lotes, produtos] = await Promise.all([listar('movimentacoes', { _sort: 'dataHora', _order: 'desc' }), listar('lotes'), listar('produtos')]);
    const lote = porId(lotes);
    const produto = porId(produtos);
    const linhas = [];
    const somadas = new Map();
    for (const m of movimentos) {
      const l = lote[m.idLote];
      const nomeProduto = produto[l?.idProduto]?.descricao ?? '—';
      const tipo = tipoDoMovimento(m);
      // Entrada soma, saída e descarte subtraem; o ajuste já vem com o sinal.
      const qtd = tipo === 'ENTRADA' ? Math.abs(m.quantidade) : tipo === 'AJUSTE' ? m.quantidade : -Math.abs(m.quantidade);
      if (ehAdmin && m.origem === 'DISPENSACAO') {
        const chave = `${l?.idProduto}:${m.dataHora.slice(0, 7)}`;
        const atual = somadas.get(chave) ?? { id: `soma-${chave}`, quando: mesAno(m.dataHora), ordem: m.dataHora.slice(0, 7) + '-99', produto: nomeProduto, lote: '—', tipo: 'Saídas em atendimento', qtd: 0, detalhe: 'Total do mês' };
        atual.qtd -= Math.abs(m.quantidade);
        somadas.set(chave, atual);
        continue;
      }
      linhas.push({
        id: m.id,
        quando: data(m.dataHora),
        ordem: m.dataHora,
        produto: nomeProduto,
        lote: l?.numero ?? '—',
        tipoCodigo: tipo,
        tipo: tipo === 'ENTRADA' && ORIGEM[m.origem] ? `Entrada · ${ORIGEM[m.origem]}` : tipo === 'AJUSTE' ? 'Ajuste de inventário' : TIPO_MOVIMENTO[tipo],
        qtd,
        detalhe:
          m.origem === 'DISPENSACAO'
            ? 'Paciente'
            : tipo === 'AJUSTE' && m.ajusteSituacao === 'EM_APROVACAO'
              ? 'Em aprovação'
              : m.justificativa ?? '—',
      });
    }
    return [...linhas, ...somadas.values()].sort((a, b) => b.ordem.localeCompare(a.ordem));
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [tipo, setTipo] = React.useState('');
  const linhas = (dados ?? []).filter(
    (m) => !tipo || m.tipoCodigo === tipo || (tipo === 'SAIDA' && m.tipo === 'Saídas em atendimento')
  );

  return (
    <Pagina
      titulo='Movimentações'
      acoes={
        ehAdmin ? (
          <>
            <button type='button' className='btn btn-outline-primary' onClick={() => emBreve('O ajuste de inventário')}>
              Ajuste de inventário
            </button>
            <button type='button' className='btn btn-primary' onClick={() => emBreve('O registro de entrada')}>
              + Nova entrada
            </button>
          </>
        ) : (
          <>
            <button type='button' className='btn btn-outline-primary' onClick={() => emBreve('O pedido de ajuste')}>
              Pedir ajuste
            </button>
            <button type='button' className='btn btn-outline-primary' onClick={() => emBreve('O registro de entrada')}>
              + Entrada
            </button>
            <button type='button' className='btn btn-primary' onClick={() => emBreve('O registro de saída')}>
              Registrar saída
            </button>
          </>
        )
      }
    >
      <Filtros>
        <CampoSelect id='movTipo' rotulo='Tipo' valor={tipo} aoMudar={setTipo} opcoes={[['', 'Todos'], ...Object.entries(TIPO_MOVIMENTO)]} />
      </Filtros>
      {ehAdmin && (
        <div className='alert alert-info mb-0' role='status'>
          As saídas em atendimento aparecem somadas por mês, sem o paciente. Entradas, descartes e ajustes aparecem um a um.
        </div>
      )}
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhuma movimentação nesta seleção.'
        colunas={[
          { titulo: ehAdmin ? 'Data ou período' : 'Data', render: (m) => m.quando },
          { titulo: 'Produto', render: (m) => m.produto },
          { titulo: 'Lote', render: (m) => m.lote },
          { titulo: 'Tipo', render: (m) => m.tipo },
          { titulo: 'Qtd.', classe: 'text-end', render: (m) => quantidadeComSinal(m.qtd) },
          { titulo: ehAdmin ? 'Detalhe' : 'Destino', render: (m) => m.detalhe },
        ]}
      />
    </Pagina>
  );
}

export default Movimentacoes;
