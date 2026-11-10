import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoBusca, CampoSelect, Filtros } from '../../components/campos';
import { emBreve } from '../../components/confirmacao';
import { listar, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { corresponde, data, moeda } from '../../utils/formatos';
import { ORIGEM_TITULO, rotuloDe, SITUACAO_TITULO } from '../../utils/rotulos';
import { carregarCobrancasComPaciente, situacaoDoTitulo } from './comum';

// A-13a · Contas a receber. Sem "dar baixa": a baixa vem do checkout (D27).
function ContasReceber() {
  const navigate = useNavigate();
  const carregar = async () => {
    const [titulos, cobrancas] = await Promise.all([listar('titulosReceber', { _sort: 'vencimento', _order: 'desc' }), carregarCobrancasComPaciente()]);
    const cobranca = porId(cobrancas);
    return titulos.map((t) => ({ ...t, devedor: cobranca[t.idCobranca]?.paciente ?? 'Operadora', situacaoEfetiva: situacaoDoTitulo(t) }));
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [busca, setBusca] = React.useState('');
  const [situacao, setSituacao] = React.useState('');
  const [origem, setOrigem] = React.useState('');
  const linhas = (dados ?? []).filter(
    (t) => corresponde(busca, t.devedor) && (!situacao || t.situacaoEfetiva === situacao) && (!origem || t.origem === origem)
  );

  return (
    <Pagina
      titulo='Contas a receber'
      acoes={
        <button type='button' className='btn btn-primary' onClick={() => emBreve('A criação de cobrança')}>
          + Nova cobrança
        </button>
      }
    >
      <Filtros>
        <CampoBusca id='receberBusca' rotulo='Buscar por devedor' valor={busca} aoMudar={setBusca} />
        <CampoSelect
          id='receberSituacao'
          rotulo='Situação'
          valor={situacao}
          aoMudar={setSituacao}
          opcoes={[['', 'Todas'], ['ABERTO', 'Aberto'], ['VENCIDO', 'Vencido'], ['PAGO', 'Pago']]}
        />
        <CampoSelect
          id='receberOrigem'
          rotulo='Origem'
          valor={origem}
          aoMudar={setOrigem}
          opcoes={[['', 'Todas'], ...Object.entries(ORIGEM_TITULO)]}
        />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhum título nesta seleção.'
        colunas={[
          { titulo: 'Devedor', render: (t) => t.devedor },
          { titulo: 'Origem', render: (t) => ORIGEM_TITULO[t.origem] ?? t.origem },
          { titulo: 'Vencimento', render: (t) => data(t.vencimento) },
          { titulo: 'Valor', classe: 'text-end', render: (t) => moeda(t.valor) },
          { titulo: 'Situação', render: (t) => <PilulaStatus {...rotuloDe(SITUACAO_TITULO, t.situacaoEfetiva)} /> },
          {
            titulo: 'Ações',
            render: (t) => {
              const alvo = `título de ${t.devedor}`;
              const ver = { tipo: 'ver', alvo, aoClicar: () => emBreve('O detalhe do título') };
              if (t.situacao === 'PAGO') return <AcoesLinha acoes={[ver, { tipo: 'estornar', alvo, aoClicar: () => navigate('/admin/listagem-estornos') }]} />;
              if (t.situacao === 'ESTORNADO') return <AcoesLinha acoes={[ver]} />;
              return <AcoesLinha acoes={[ver, { tipo: 'editar', alvo, aoClicar: () => emBreve('A edição da cobrança') }]} />;
            },
          },
        ]}
      />
    </Pagina>
  );
}

export default ContasReceber;
