import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import { CampoSelect, Filtros } from '../../components/campos';
import { DATA_DE_HOJE } from '../../config/axios';
import { listar, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { data, diasEntre } from '../../utils/formatos';
import { ALERTA, carregarProdutos } from './comum';
import { useJanelaDeEstoque } from './janelas';

function detalhe(a, p, lote) {
  if (a.tipo === 'MINIMO') return `Saldo ${p?.utilizavel ?? 0}, mínimo ${p?.estoqueMinimo ?? '—'}`;
  if (!lote) return '—';
  const dias = diasEntre(DATA_DE_HOJE, lote.validade);
  if (a.tipo === 'VENCIDO') return `Venceu em ${data(lote.validade)}, ${lote.quantidade} no lote: só sai por descarte`;
  return `Vence em ${dias} ${dias === 1 ? 'dia' : 'dias'} (${data(lote.validade)}): use este lote primeiro`;
}

// A-28 e S-19 · Alertas de estoque (RF38), recalculados pela API a cada
// movimentação e uma vez por dia. Cada alerta leva à ação que o resolve:
// entrada para o mínimo e descarte para o lote vencido (a Secretária; o
// Administrador não registra saída).
function Alertas() {
  const { sessao } = useSessao();
  const navigate = useNavigate();
  const ehSecretaria = sessao.usuario.papel === 'SECRETARIA';
  const prefixo = ehSecretaria ? '/secretaria' : '/admin';
  const carregar = async () => {
    const [alertas, produtos] = await Promise.all([listar('alertasEstoque', { situacao: 'ABERTO', _sort: 'dataGeracao', _order: 'desc' }), carregarProdutos()]);
    const produto = porId(produtos);
    const linhas = alertas.map((a) => {
      const p = produto[a.idProduto];
      const lote = p?.lotes.find((l) => l.id === a.idLote);
      return { ...a, produto: p?.descricao ?? '—', lote, numeroLote: lote?.numero ?? '—', detalhe: detalhe(a, p, lote) };
    });
    return { linhas, produtos };
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [janela, abrir] = useJanelaDeEstoque(dados?.produtos, recarregar);
  const [tipo, setTipo] = React.useState('');
  const linhas = (dados?.linhas ?? []).filter((a) => !tipo || a.tipo === tipo);

  const acao = (a) => {
    if (a.tipo === 'MINIMO') {
      return (
        <button type='button' className='btn btn-link btn-sm p-0' onClick={() => abrir('entrada', { idProduto: a.idProduto })}>
          Registrar entrada
        </button>
      );
    }
    if (a.tipo === 'VENCIDO' && ehSecretaria && a.lote) {
      return (
        <button
          type='button'
          className='btn btn-link btn-sm p-0'
          onClick={() => abrir('saida', { idProduto: a.idProduto, idLote: a.lote.id, destino: 'DESCARTE', motivoDescarte: 'VENCIMENTO' })}
        >
          Descartar
        </button>
      );
    }
    return (
      <button type='button' className='btn btn-link btn-sm p-0' onClick={() => navigate(`${prefixo}/listagem-produtos`)}>
        Ver produtos
      </button>
    );
  };

  return (
    <Pagina titulo='Alertas de estoque'>
      <Filtros>
        <CampoSelect
          id='alertaTipo'
          rotulo='Alerta'
          valor={tipo}
          aoMudar={setTipo}
          opcoes={[['', 'Todos'], ...Object.entries(ALERTA).map(([k, v]) => [k, v.rotulo])]}
        />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhum alerta aberto.'
        colunas={[
          { titulo: 'Desde', render: (a) => data(a.dataGeracao) },
          { titulo: 'Produto', render: (a) => a.produto },
          { titulo: 'Lote', render: (a) => a.numeroLote },
          { titulo: 'Alerta', render: (a) => <PilulaStatus {...(ALERTA[a.tipo] ?? { rotulo: a.tipo, tom: 'neutro' })} /> },
          { titulo: 'Detalhe', render: (a) => a.detalhe },
          { titulo: 'Ação', render: acao },
        ]}
      />
      {janela}
    </Pagina>
  );
}

export default Alertas;
