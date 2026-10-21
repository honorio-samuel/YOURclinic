import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoBusca, CampoSelect, Filtros } from '../../components/campos';
import { emBreve, useAlternarSituacao } from '../../components/confirmacao';
import { DATA_DE_HOJE } from '../../config/axios';
import { useCarregar } from '../../hooks/use-carregar';
import { useCaminhosDaListagem } from '../../navegacao/caminhos';
import { useSessao } from '../../sessao/sessao';
import { corresponde, data, diasEntre, moeda } from '../../utils/formatos';
import { rotuloDe, SITUACAO_CADASTRO, TIPO_PRODUTO } from '../../utils/rotulos';
import { carregarProdutos } from './comum';

const ANTECEDENCIA_VALIDADE = 60; // dias (X14)

function situacaoDoLote(lote) {
  const dias = diasEntre(DATA_DE_HOJE, lote.validade);
  if (dias < 0) return { rotulo: 'Vencido', tom: 'perigo' };
  if (dias <= ANTECEDENCIA_VALIDADE) return { rotulo: 'A vencer', tom: 'aviso' };
  return { rotulo: 'Disponível', tom: 'sucesso' };
}

// A-26 e S-17 Produtos e lotes, e M-05a Estoque · disponibilidade. Só o
// Administrador vê o custo de aquisição (RC06, nível 3).
function Produtos() {
  const navigate = useNavigate();
  const caminhos = useCaminhosDaListagem('produtos');
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
          <button type='button' className='btn btn-primary' onClick={() => emBreve('A saída por lote')}>
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

export default Produtos;
