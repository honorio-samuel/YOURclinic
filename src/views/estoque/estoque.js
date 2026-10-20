import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoBusca, CampoSelect, Filtros } from '../../components/campos';
import { emBreve, useAlternarSituacao } from '../../components/confirmacao';
import { DATA_DE_HOJE } from '../../config/axios';
import { listar, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { corresponde, data, diasEntre, mesAno, moeda, quantidadeComSinal } from '../../utils/formatos';
import { SITUACAO_CADASTRO, TIPO_PRODUTO, rotuloDe } from '../../utils/rotulos';

const ANTECEDENCIA_VALIDADE = 60; // dias (X14)

function situacaoDoLote(lote) {
  const dias = diasEntre(DATA_DE_HOJE, lote.validade);
  if (dias < 0) return { rotulo: 'Vencido', tom: 'perigo' };
  if (dias <= ANTECEDENCIA_VALIDADE) return { rotulo: 'A vencer', tom: 'aviso' };
  return { rotulo: 'Disponível', tom: 'sucesso' };
}

async function carregarProdutos() {
  const [produtos, lotes] = await Promise.all([listar('produtos', { _sort: 'descricao' }), listar('lotes', { _sort: 'validade' })]);
  return produtos.map((p) => {
    const dele = lotes.filter((l) => l.idProduto === p.id);
    return { ...p, lotes: dele, saldo: dele.reduce((s, l) => s + l.quantidade, 0), proximoLote: dele.find((l) => l.quantidade > 0) };
  });
}

// A-26 e S-17 Produtos e lotes, e M-05a Estoque · disponibilidade. Só o
// Administrador vê o custo de aquisição (RC06, nível 3).
export function Produtos() {
  const { sessao } = useSessao();
  const papel = sessao.usuario.papel;
  const ehAdmin = papel === 'ADMINISTRADOR';
  const ehMedico = papel === 'MEDICO';
  const { dados, carregando, erro, recarregar } = useCarregar(carregarProdutos);
  const [modal, alternar] = useAlternarSituacao('produtos', recarregar);
  const [busca, setBusca] = React.useState('');
  const [tipo, setTipo] = React.useState('');
  const [status, setStatus] = React.useState(ehMedico ? '' : 'ATIVO');
  const [aberto, setAberto] = React.useState(null);

  const linhas = (dados ?? []).filter(
    (p) => corresponde(busca, p.descricao) && (!tipo || p.tipo === tipo) && (ehMedico ? p.situacao === 'ATIVO' : !status || p.situacao === status)
  );

  const colunasMedico = [
    { titulo: 'Produto', render: (p) => p.descricao },
    { titulo: 'Tipo', render: (p) => TIPO_PRODUTO[p.tipo] ?? p.tipo },
    { titulo: 'Saldo', classe: 'text-end', render: (p) => p.saldo },
    { titulo: 'Lote', render: (p) => p.proximoLote?.numero ?? '—' },
    { titulo: 'Situação do lote', render: (p) => (p.proximoLote ? <PilulaStatus {...situacaoDoLote(p.proximoLote)} /> : '—') },
  ];
  const colunasGestao = [
    { titulo: 'Produto', render: (p) => p.descricao },
    { titulo: 'Tipo', render: (p) => TIPO_PRODUTO[p.tipo] ?? p.tipo },
    { titulo: 'Saldo', classe: 'text-end', render: (p) => p.saldo },
    { titulo: 'Mínimo', classe: 'text-end', render: (p) => p.estoqueMinimo },
    ...(ehAdmin ? [{ titulo: 'Custo', classe: 'text-end', render: (p) => (p.custoAquisicao ? moeda(p.custoAquisicao) : '—') }] : []),
    {
      titulo: 'Status',
      render: (p) => (
        <PilulaStatus
          {...rotuloDe(SITUACAO_CADASTRO, p.situacao)}
          transicoes={[
            p.situacao === 'ATIVO'
              ? { rotulo: 'Inativar', aoEscolher: () => alternar(p, p.descricao, 'INATIVO') }
              : { rotulo: 'Reativar', aoEscolher: () => alternar(p, p.descricao, 'ATIVO') },
          ]}
        />
      ),
    },
    {
      titulo: 'Ações',
      render: (p) => {
        const ver = { tipo: 'ver', alvo: p.descricao, aoClicar: () => setAberto(p) };
        if (p.situacao === 'INATIVO') return <AcoesLinha acoes={[ver, { tipo: 'reativar', alvo: p.descricao, aoClicar: () => alternar(p, p.descricao, 'ATIVO') }]} />;
        return (
          <AcoesLinha
            acoes={[
              ver,
              { tipo: 'editar', alvo: p.descricao, aoClicar: () => emBreve('A edição do produto') },
              { tipo: 'inativar', alvo: p.descricao, aoClicar: () => alternar(p, p.descricao, 'INATIVO') },
            ]}
          />
        );
      },
    },
  ];

  return (
    <Pagina
      titulo={ehMedico ? 'Estoque' : 'Produtos e lotes'}
      acoes={
        ehMedico ? (
          <button type='button' className='btn btn-primary' onClick={() => emBreve('A saída por lote')}>
            Registrar saída
          </button>
        ) : (
          <button type='button' className='btn btn-primary' onClick={() => emBreve('O cadastro de produto')}>
            + Novo produto
          </button>
        )
      }
    >
      <Filtros>
        <CampoBusca id='produtoBusca' rotulo='Buscar por produto' valor={busca} aoMudar={setBusca} />
        <CampoSelect id='produtoTipo' rotulo='Tipo' valor={tipo} aoMudar={setTipo} opcoes={[['', 'Todos'], ...Object.entries(TIPO_PRODUTO)]} />
        {!ehMedico && (
          <CampoSelect id='produtoStatus' rotulo='Status' valor={status} aoMudar={setStatus} opcoes={[['ATIVO', 'Ativos'], ['INATIVO', 'Inativos'], ['', 'Todos']]} />
        )}
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhum produto nesta seleção.'
        colunas={ehMedico ? colunasMedico : colunasGestao}
      />
      {aberto && (
        <div className='card'>
          <div className='card-body d-flex flex-column gap-3'>
            <div className='d-flex justify-content-between align-items-center'>
              <h2 className='h5 mb-0'>Lotes de {aberto.descricao}</h2>
              <button type='button' className='btn btn-sm btn-outline-secondary' onClick={() => setAberto(null)}>
                Fechar
              </button>
            </div>
            <Listagem
              linhas={aberto.lotes}
              vazio='Produto sem controle de lote.'
              colunas={[
                { titulo: 'Lote', render: (l) => l.numero },
                { titulo: 'Validade', render: (l) => data(l.validade) },
                { titulo: 'Quantidade', classe: 'text-end', render: (l) => l.quantidade },
                { titulo: 'Situação', render: (l) => <PilulaStatus {...situacaoDoLote(l)} /> },
              ]}
            />
          </div>
        </div>
      )}
      {modal}
    </Pagina>
  );
}

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
export function Movimentacoes() {
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

const ALERTA = {
  ESTOQUE_MINIMO: { rotulo: 'Estoque mínimo', tom: 'aviso' },
  VALIDADE_PROXIMA: { rotulo: 'A vencer', tom: 'aviso' },
  MINIMO: { rotulo: 'Estoque mínimo', tom: 'aviso' },
  VALIDADE: { rotulo: 'A vencer', tom: 'aviso' },
};

// A-28 e S-19 · Alertas de estoque, recalculados pelo sistema a cada movimentação.
export function Alertas() {
  const { sessao } = useSessao();
  const navigate = useNavigate();
  const prefixo = sessao.usuario.papel === 'ADMINISTRADOR' ? '/admin' : '/secretaria';
  const carregar = async () => {
    const [alertas, produtos] = await Promise.all([listar('alertasEstoque', { situacao: 'ABERTO' }), carregarProdutos()]);
    const produto = porId(produtos);
    return alertas.map((a) => {
      const p = produto[a.idProduto];
      const lote = p?.lotes.find((l) => l.id === a.idLote);
      return {
        ...a,
        produto: p?.descricao ?? '—',
        lote: lote?.numero ?? '—',
        detalhe:
          ['ESTOQUE_MINIMO', 'MINIMO'].includes(a.tipo)
            ? `Saldo ${p?.saldo ?? 0}, mínimo ${p?.estoqueMinimo ?? '—'}`
            : lote
              ? `Vence em ${diasEntre(DATA_DE_HOJE, lote.validade)} dias`
              : 'Validade próxima',
      };
    });
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [tipo, setTipo] = React.useState('');
  const linhas = (dados ?? []).filter((a) => !tipo || a.tipo === tipo);

  return (
    <Pagina titulo='Alertas de estoque'>
      <Filtros>
        <CampoSelect id='alertaTipo' rotulo='Alerta' valor={tipo} aoMudar={setTipo} opcoes={[['', 'Todos'], ...[...new Set((dados ?? []).map((a) => a.tipo))].map((k) => [k, rotuloDe(ALERTA, k).rotulo])]} />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhum alerta aberto.'
        colunas={[
          { titulo: 'Produto', render: (a) => a.produto },
          { titulo: 'Lote', render: (a) => a.lote },
          { titulo: 'Alerta', render: (a) => <PilulaStatus {...rotuloDe(ALERTA, a.tipo)} /> },
          { titulo: 'Detalhe', render: (a) => a.detalhe },
          { titulo: 'Ações', render: (a) => <AcoesLinha acoes={[{ tipo: 'ver', alvo: a.produto, aoClicar: () => navigate(`${prefixo}/produtos`) }]} /> },
        ]}
      />
    </Pagina>
  );
}
