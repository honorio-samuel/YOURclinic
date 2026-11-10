import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoSelect, Filtros } from '../../components/campos';
import { DATA_DE_HOJE } from '../../config/axios';
import { listar, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { diasEntre } from '../../utils/formatos';
import { rotuloDe } from '../../utils/rotulos';
import { carregarProdutos } from './comum';

const ALERTA = {
  ESTOQUE_MINIMO: { rotulo: 'Estoque mínimo', tom: 'aviso' },
  VALIDADE_PROXIMA: { rotulo: 'A vencer', tom: 'aviso' },
  MINIMO: { rotulo: 'Estoque mínimo', tom: 'aviso' },
  VALIDADE: { rotulo: 'A vencer', tom: 'aviso' },
};

// A-28 e S-19 · Alertas de estoque, recalculados pelo sistema a cada movimentação.
function Alertas() {
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
          { titulo: 'Ações', render: (a) => <AcoesLinha acoes={[{ tipo: 'ver', alvo: a.produto, aoClicar: () => navigate(`${prefixo}/listagem-produtos`) }]} /> },
        ]}
      />
    </Pagina>
  );
}

export default Alertas;
