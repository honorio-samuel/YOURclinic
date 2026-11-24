import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoBusca, CampoSelect, Filtros } from '../../components/campos';
import { useAlternarSituacao } from '../../components/confirmacao';
import { useCarregar } from '../../hooks/use-carregar';
import { useCaminhosDaListagem } from '../../navegacao/caminhos';
import { useSessao } from '../../sessao/sessao';
import { corresponde, data, moeda } from '../../utils/formatos';
import { rotuloDe, SITUACAO_CADASTRO, TIPO_PRODUTO } from '../../utils/rotulos';
import { carregarAntecedencia, carregarProdutos, situacaoDoLote } from './comum';
import { useJanelaDeEstoque } from './janelas';

// Saldo que pode sair; o que está em lote vencido aparece à parte (RN-38.1).
function saldo(p) {
  const vencido = p.saldo - p.utilizavel;
  return vencido > 0 ? `${p.utilizavel} (+${vencido} vencido)` : p.utilizavel;
}

// A-26 e S-17 Produtos e lotes, e M-05a/M-05b Estoque · disponibilidade e
// saída por lote. Só o Administrador vê o custo de aquisição (RC06, nível 3).
function Produtos() {
  const navigate = useNavigate();
  const caminhos = useCaminhosDaListagem('produtos');
  const { sessao } = useSessao();
  const papel = sessao.usuario.papel;
  const ehAdmin = papel === 'ADMINISTRADOR';
  const ehMedico = papel === 'MEDICO';
  const { dados, carregando, erro, recarregar } = useCarregar(async () => {
    const [produtos, antecedencia] = await Promise.all([carregarProdutos(), carregarAntecedencia()]);
    return { produtos, antecedencia };
  });
  const produtos = dados?.produtos;
  const antecedencia = dados?.antecedencia ?? 60;
  const [modal, alternar] = useAlternarSituacao('produtos', recarregar);
  const [janela, abrir] = useJanelaDeEstoque(produtos, recarregar);
  const [busca, setBusca] = React.useState('');
  const [tipo, setTipo] = React.useState('');
  const [status, setStatus] = React.useState(ehMedico ? '' : 'ATIVO');
  const [idAberto, setIdAberto] = React.useState(null);
  const aberto = (produtos ?? []).find((p) => p.id === idAberto);

  const linhas = (produtos ?? []).filter(
    (p) => corresponde(busca, p.descricao) && (!tipo || p.tipo === tipo) && (ehMedico ? p.situacao === 'ATIVO' : !status || p.situacao === status)
  );

  const colunasMedico = [
    { titulo: 'Produto', render: (p) => p.descricao },
    { titulo: 'Tipo', render: (p) => TIPO_PRODUTO[p.tipo] ?? p.tipo },
    { titulo: 'Disponível', classe: 'text-end', render: saldo },
    { titulo: 'Lote sugerido', render: (p) => (p.sugerido ? p.sugerido.numero ?? 'Sem lote' : '—') },
    { titulo: 'Validade', render: (p) => (p.sugerido ? <PilulaStatus {...situacaoDoLote(p.sugerido, antecedencia)} /> : '—') },
    { titulo: 'Lotes', render: (p) => <AcoesLinha acoes={[{ tipo: 'ver', alvo: `lotes de ${p.descricao}`, aoClicar: () => setIdAberto(p.id) }]} /> },
  ];
  const colunasGestao = [
    { titulo: 'Produto', render: (p) => p.descricao },
    { titulo: 'Tipo', render: (p) => TIPO_PRODUTO[p.tipo] ?? p.tipo },
    { titulo: 'Saldo', classe: 'text-end', render: saldo },
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
        const ver = { tipo: 'ver', alvo: `lotes de ${p.descricao}`, aoClicar: () => setIdAberto(p.id) };
        if (p.situacao === 'INATIVO') return <AcoesLinha acoes={[ver, { tipo: 'reativar', alvo: p.descricao, aoClicar: () => alternar(p, p.descricao, 'ATIVO') }]} />;
        return (
          <AcoesLinha
            acoes={[
              ver,
              { tipo: 'editar', alvo: p.descricao, aoClicar: () => navigate(caminhos.editar(p.id)) },
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
          <button type='button' className='btn btn-primary' disabled={!produtos} onClick={() => abrir('saida')}>
            Registrar saída
          </button>
        ) : (
          <button type='button' className='btn btn-primary' onClick={() => navigate(caminhos.novo)}>
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
            <div className='d-flex justify-content-between align-items-center gap-2 flex-wrap'>
              <h2 className='h5 mb-0'>Lotes de {aberto.descricao}</h2>
              <button type='button' className='btn btn-sm btn-outline-secondary' onClick={() => setIdAberto(null)}>
                Fechar
              </button>
            </div>
            {aberto.controleEspecial && <p className='mb-0 small'>Item de controle especial: a saída pede a conferência manual.</p>}
            <Listagem
              linhas={aberto.lotes}
              vazio='Nenhuma entrada registrada ainda.'
              colunas={[
                { titulo: 'Lote', render: (l) => l.numero ?? 'Sem lote' },
                { titulo: 'Validade', render: (l) => (l.validade ? data(l.validade) : '—') },
                { titulo: 'Quantidade', classe: 'text-end', render: (l) => l.quantidade },
                {
                  titulo: 'Situação',
                  render: (l) =>
                    l.quantidade > 0 ? (
                      <PilulaStatus {...situacaoDoLote(l, antecedencia)} rotulo={`${situacaoDoLote(l, antecedencia).rotulo}${aberto.sugerido?.id === l.id ? ' · sugerido' : ''}`} />
                    ) : (
                      <PilulaStatus rotulo='Esgotado' tom='neutro' />
                    ),
                },
              ]}
            />
          </div>
        </div>
      )}
      {janela}
      {modal}
    </Pagina>
  );
}

export default Produtos;
