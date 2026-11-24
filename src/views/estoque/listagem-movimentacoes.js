import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import { CampoSelect, Filtros } from '../../components/campos';
import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { listar, pessoasPorId, porId } from '../../servicos/dados';
import { decidirAjuste } from '../../servicos/estoque';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { data, mesAno, quantidadeComSinal } from '../../utils/formatos';
import { carregarProdutos, MOTIVO_DESCARTE, ORIGEM_ENTRADA } from './comum';
import { useJanelaDeEstoque } from './janelas';

const TIPO_MOVIMENTO = {
  ENTRADA: 'Entrada',
  SAIDA: 'Saída',
  DESCARTE: 'Descarte',
  AJUSTE: 'Ajuste',
};

function tipoDoMovimento(m) {
  if (m.origem === 'DESCARTE') return 'DESCARTE';
  if (m.tipo === 'AJUSTE' || m.origem === 'AJUSTE_INVENTARIO') return 'AJUSTE';
  return m.tipo;
}

function detalheDoAjuste(m) {
  if (m.ajusteSituacao === 'A_APROVAR') return `Em aprovação · ${m.justificativa}`;
  if (m.ajusteSituacao === 'RECUSADO') return `Recusado: ${m.motivoRecusa ?? '—'}`;
  return m.justificativa ?? '—';
}

function detalheDoDescarte(m) {
  const motivo = MOTIVO_DESCARTE[m.motivoDescarte];
  if (motivo && m.justificativa) return `${motivo}: ${m.justificativa}`;
  return motivo ?? m.justificativa ?? '—';
}

// Nomes de quem pediu os ajustes: o Administrador decide sabendo de quem é o pedido.
async function nomesDosUsuarios(ids) {
  if (ids.length === 0) return {};
  const usuarios = await listar('usuarios', { id: [...new Set(ids)] });
  const pessoas = await pessoasPorId(usuarios.map((u) => u.idPessoa));
  return Object.fromEntries(usuarios.map((u) => [u.id, pessoas[u.idPessoa]?.nome ?? '—']));
}

// A-27 e S-18 · Movimentações. Ao Administrador, as saídas em atendimento chegam
// somadas por item e por mês, sem paciente (D31). A Secretária vê cada
// movimentação física, com o destino "Paciente" sem nome (RC08). O ajuste da
// Secretária espera a aprovação do Administrador (RF37).
function Movimentacoes() {
  const { sessao } = useSessao();
  const ehAdmin = sessao.usuario.papel === 'ADMINISTRADOR';
  const carregar = async () => {
    const [movimentos, produtos] = await Promise.all([listar('movimentacoes', { _sort: 'dataHora', _order: 'desc' }), carregarProdutos()]);
    const lote = porId(produtos.flatMap((p) => p.lotes));
    const produto = porId(produtos);
    const pendentes = movimentos.filter((m) => m.tipo === 'AJUSTE' && m.ajusteSituacao === 'A_APROVAR');
    const nomes = ehAdmin ? await nomesDosUsuarios(pendentes.map((m) => m.idUsuario).filter(Boolean)) : {};
    // RF50: a compra ligada ao título a pagar mostra o fornecedor (só o Administrador vê títulos).
    const titulos = ehAdmin && movimentos.some((m) => m.idTituloPagar) ? porId(await listar('titulosPagar')) : {};
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
        const atual = somadas.get(chave) ?? {
          id: `soma-${chave}`,
          quando: mesAno(m.dataHora),
          ordem: m.dataHora.slice(0, 7) + '-99',
          produto: nomeProduto,
          lote: '—',
          tipoCodigo: 'SAIDA',
          tipo: 'Saídas em atendimento',
          qtd: 0,
          aplicado: true,
          detalhe: 'Total do mês',
        };
        atual.qtd -= Math.abs(m.quantidade);
        somadas.set(chave, atual);
        continue;
      }
      let detalhe = '—';
      if (m.origem === 'DISPENSACAO') detalhe = 'Paciente';
      else if (tipo === 'DESCARTE') detalhe = detalheDoDescarte(m);
      else if (tipo === 'AJUSTE') detalhe = detalheDoAjuste(m);
      else if (titulos[m.idTituloPagar]) detalhe = `Título a pagar: ${titulos[m.idTituloPagar].fornecedor}`;
      linhas.push({
        id: m.id,
        quando: data(m.dataHora),
        ordem: m.dataHora,
        produto: nomeProduto,
        lote: l?.numero ?? '—',
        tipoCodigo: tipo,
        tipo: tipo === 'ENTRADA' && ORIGEM_ENTRADA[m.origem] ? `Entrada · ${ORIGEM_ENTRADA[m.origem].toLowerCase()}` : tipo === 'AJUSTE' ? 'Ajuste de inventário' : TIPO_MOVIMENTO[tipo],
        qtd,
        // O ajuste pendente ou recusado fica no histórico, mas não muda o saldo.
        aplicado: tipo !== 'AJUSTE' || m.ajusteSituacao === 'APROVADO',
        detalhe,
      });
    }
    const pedidos = pendentes.map((m) => {
      const l = lote[m.idLote];
      return {
        id: m.id,
        quando: data(m.dataHora),
        produto: produto[l?.idProduto]?.descricao ?? '—',
        lote: l?.numero ?? '—',
        saldoAtual: l?.quantidade ?? 0,
        saldoNaContagem: m.saldoNaContagem,
        contada: m.quantidadeContada,
        qtd: m.quantidade,
        motivo: m.justificativa,
        pedidoPor: nomes[m.idUsuario] ?? '—',
      };
    });
    return { linhas: [...linhas, ...somadas.values()].sort((a, b) => b.ordem.localeCompare(a.ordem)), pedidos, produtos };
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [janela, abrir] = useJanelaDeEstoque(dados?.produtos, recarregar);
  const [modal, confirmar] = useConfirmacao();
  const [tipo, setTipo] = React.useState('');
  const linhas = (dados?.linhas ?? []).filter((m) => !tipo || m.tipoCodigo === tipo);
  const pedidos = dados?.pedidos ?? [];

  const aprovar = async (p) => {
    const ok = await confirmar({
      titulo: `Aprovar o ajuste de ${p.produto}?`,
      texto: `Lote ${p.lote}: o saldo muda ${quantidadeComSinal(p.qtd)} e passa de ${p.saldoAtual} para ${p.saldoAtual + p.qtd}.`,
      rotuloConfirmar: 'Aprovar ajuste',
    });
    if (!ok) return;
    try {
      await decidirAjuste(p.id, 'aprovar');
      mensagemSucesso('Ajuste aprovado. O saldo do lote foi atualizado.');
      recarregar();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    }
  };
  const recusar = async (p) => {
    const motivo = await confirmar({
      titulo: `Recusar o ajuste de ${p.produto}?`,
      texto: 'O saldo não muda. Quem pediu vê o motivo na lista de movimentações.',
      campo: 'Motivo da recusa',
      rotuloConfirmar: 'Recusar ajuste',
      perigo: true,
    });
    if (!motivo) return;
    try {
      await decidirAjuste(p.id, 'recusar', motivo);
      mensagemSucesso('Ajuste recusado. O saldo não mudou.');
      recarregar();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    }
  };

  const pronto = Boolean(dados);
  return (
    <Pagina
      titulo='Movimentações'
      acoes={
        ehAdmin ? (
          <>
            <button type='button' className='btn btn-outline-primary' disabled={!pronto} onClick={() => abrir('ajuste')}>
              Ajuste de inventário
            </button>
            <button type='button' className='btn btn-primary' disabled={!pronto} onClick={() => abrir('entrada')}>
              + Nova entrada
            </button>
          </>
        ) : (
          <>
            <button type='button' className='btn btn-outline-primary' disabled={!pronto} onClick={() => abrir('ajuste')}>
              Pedir ajuste
            </button>
            <button type='button' className='btn btn-outline-primary' disabled={!pronto} onClick={() => abrir('entrada')}>
              + Entrada
            </button>
            <button type='button' className='btn btn-primary' disabled={!pronto} onClick={() => abrir('saida')}>
              Registrar saída
            </button>
          </>
        )
      }
    >
      {ehAdmin && pedidos.length > 0 && (
        <Listagem
          titulo='Pedidos de ajuste para aprovar'
          linhas={pedidos}
          colunas={[
            {
              titulo: 'Pedido',
              render: (p) => (
                <>
                  {p.quando}
                  <div className='small text-body-secondary'>{p.pedidoPor}</div>
                </>
              ),
            },
            {
              titulo: 'Produto e lote',
              render: (p) => (
                <>
                  {p.produto}
                  <div className='small text-body-secondary'>Lote {p.lote}</div>
                </>
              ),
            },
            {
              titulo: 'Contagem',
              render: (p) => (
                <>
                  {p.saldoNaContagem ?? '—'} no sistema, {p.contada ?? '—'} contados
                  <div className='small text-body-secondary'>Diferença {quantidadeComSinal(p.qtd)}</div>
                </>
              ),
            },
            { titulo: 'Motivo', render: (p) => p.motivo },
            {
              titulo: 'Decisão',
              render: (p) => (
                <div className='d-flex flex-wrap gap-2'>
                  <button type='button' className='btn btn-sm btn-outline-primary' onClick={() => aprovar(p)} aria-label={`Aprovar o ajuste de ${p.produto}, lote ${p.lote}`}>
                    Aprovar
                  </button>
                  <button type='button' className='btn btn-sm btn-outline-danger' onClick={() => recusar(p)} aria-label={`Recusar o ajuste de ${p.produto}, lote ${p.lote}`}>
                    Recusar
                  </button>
                </div>
              ),
            },
          ]}
        />
      )}
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
          {
            titulo: 'Qtd.',
            classe: 'text-end',
            render: (m) =>
              m.aplicado ? (
                quantidadeComSinal(m.qtd)
              ) : (
                <span className='text-body-secondary' title='Não altera o saldo'>
                  ({quantidadeComSinal(m.qtd)})
                </span>
              ),
          },
          { titulo: ehAdmin ? 'Detalhe' : 'Destino ou detalhe', render: (m) => m.detalhe },
        ]}
      />
      {janela}
      {modal}
    </Pagina>
  );
}

export default Movimentacoes;
