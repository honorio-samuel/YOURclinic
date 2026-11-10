import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoSelect, Filtros } from '../../components/campos';
import { emBreve } from '../../components/confirmacao';
import { DATA_DE_HOJE } from '../../config/axios';
import { listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { data, diaMes } from '../../utils/formatos';

// A-30 · Relatórios. Recortes com poucos registros não são exibidos (RF42).
function Relatorios() {
  const { dados, carregando, erro, recarregar } = useCarregar(() => listar('relatorios', { _sort: 'geradoEm', _order: 'desc' }));
  const [dimensao, setDimensao] = React.useState('Atendimentos por convênio');
  return (
    <Pagina titulo='Relatórios'>
      <Filtros>
        <CampoSelect
          id='relDimensao'
          rotulo='Dimensão'
          valor={dimensao}
          aoMudar={setDimensao}
          opcoes={['Atendimentos por convênio', 'Faturamento por médico', 'Glosas por motivo', 'Estoque por item'].map((d) => [d, d])}
        />
        <div className='filtro'>
          <label htmlFor='relDe' className='form-label'>
            De
          </label>
          <input id='relDe' type='date' className='form-control' defaultValue='2026-09-01' />
        </div>
        <div className='filtro'>
          <label htmlFor='relAte' className='form-label'>
            Até
          </label>
          <input id='relAte' type='date' className='form-control' defaultValue={DATA_DE_HOJE} />
        </div>
        <button type='button' className='btn btn-primary' onClick={() => emBreve('A geração de relatório')}>
          Gerar relatório
        </button>
      </Filtros>
      <div className='alert alert-info mb-0' role='status'>
        Recortes com menos de 5 registros não aparecem no relatório, para não identificar ninguém.
      </div>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados ?? []}
        vazio='Nenhum relatório gerado.'
        colunas={[
          { titulo: 'Relatório', render: (r) => r.nome },
          { titulo: 'Período', render: (r) => `${diaMes(r.periodoInicio)} a ${diaMes(r.periodoFim)}` },
          { titulo: 'Gerado em', render: (r) => data(r.geradoEm) },
          { titulo: 'Situação', render: (r) => <PilulaStatus rotulo={r.situacao === 'PRONTO' ? 'Pronto' : 'Gerando'} tom={r.situacao === 'PRONTO' ? 'sucesso' : 'info'} /> },
          {
            titulo: 'Ações',
            render: (r) =>
              r.situacao === 'PRONTO' ? <AcoesLinha acoes={[{ tipo: 'baixar', alvo: r.nome, aoClicar: () => emBreve('O download do relatório') }]} /> : null,
          },
        ]}
      />
    </Pagina>
  );
}

export default Relatorios;
