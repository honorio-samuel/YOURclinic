import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoSelect, Filtros } from '../../components/campos';
import { emBreve } from '../../components/confirmacao';
import { listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { diaMes, moeda } from '../../utils/formatos';
import { rotuloDe } from '../../utils/rotulos';

const CONCILIACAO = {
  CONCILIADO: { rotulo: 'Conciliado', tom: 'sucesso' },
  DIVERGENTE: { rotulo: 'Divergente', tom: 'perigo' },
  PENDENTE: { rotulo: 'Pendente', tom: 'aviso' },
};

// A-15 · Conciliação de recebíveis (RF49).
function Conciliacao() {
  const { dados, carregando, erro, recarregar } = useCarregar(() => listar('pagamentosCartao'));
  const [adquirente, setAdquirente] = React.useState('');
  const [situacao, setSituacao] = React.useState('');
  const adquirentes = [...new Set((dados ?? []).map((p) => p.adquirente).filter(Boolean))];
  const linhas = (dados ?? [])
    .filter((p) => (!adquirente || p.adquirente === adquirente) && (!situacao || p.situacaoConciliacao === situacao))
    .sort((a, b) => (b.dataHora ?? '').localeCompare(a.dataHora ?? ''));

  return (
    <Pagina
      titulo='Conciliação de recebíveis'
      acoes={
        <button type='button' className='btn btn-outline-primary' onClick={() => emBreve('A importação do extrato')}>
          Importar extrato
        </button>
      }
    >
      <Filtros>
        <CampoSelect id='concAdquirente' rotulo='Adquirente' valor={adquirente} aoMudar={setAdquirente} opcoes={[['', 'Todos'], ...adquirentes.map((a) => [a, a])]} />
        <CampoSelect
          id='concSituacao'
          rotulo='Situação'
          valor={situacao}
          aoMudar={setSituacao}
          opcoes={[['', 'Todas'], ...Object.entries(CONCILIACAO).map(([k, v]) => [k, v.rotulo])]}
        />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhuma transação nesta seleção.'
        colunas={[
          { titulo: 'Data', render: (p) => diaMes(p.dataHora) },
          { titulo: 'NSU', render: (p) => p.nsu },
          { titulo: 'Bandeira', render: (p) => p.bandeira },
          { titulo: 'Bruto', classe: 'text-end', render: (p) => moeda(p.valorBruto) },
          { titulo: 'Líquido', classe: 'text-end', render: (p) => moeda(p.valorLiquido) },
          {
            titulo: 'Situação',
            render: (p) => (
              <PilulaStatus
                {...rotuloDe(CONCILIACAO, p.situacaoConciliacao)}
                transicoes={p.situacaoConciliacao === 'DIVERGENTE' ? [{ rotulo: 'Tratar divergência', aoEscolher: () => emBreve('O tratamento da divergência') }] : null}
              />
            ),
          },
          { titulo: 'Ações', render: (p) => <AcoesLinha acoes={[{ tipo: 'ver', alvo: `NSU ${p.nsu}`, aoClicar: () => emBreve('O detalhe da transação') }]} /> },
        ]}
      />
    </Pagina>
  );
}

export default Conciliacao;
