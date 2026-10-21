import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoSelect, Filtros } from '../../components/campos';
import { emBreve } from '../../components/confirmacao';
import { listar, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { moeda } from '../../utils/formatos';
import { rotuloDe } from '../../utils/rotulos';
import { carregarGuias, opcoesOperadora, useEhAdmin } from './comum';

const SITUACAO_GLOSA = {
  GLOSADO: { rotulo: 'Glosado', tom: 'aviso' },
  EM_RECURSO: { rotulo: 'Em recurso', tom: 'info' },
  RECUPERADO: { rotulo: 'Recuperado', tom: 'sucesso' },
  PERDA: { rotulo: 'Baixado como perda', tom: 'neutro' },
};

// A-24 Demonstrativos e glosas e S-16a Demonstrativo e glosas. O índice de
// glosa não aparece para a Secretária.
function Glosas() {
  const ehAdmin = useEhAdmin();
  const carregar = async () => {
    const [glosas, guias] = await Promise.all([listar('glosas', { _sort: 'dataDemonstrativo', _order: 'desc' }), carregarGuias()]);
    const guia = porId(guias);
    return glosas.map((g) => ({ ...g, guia: guia[g.idGuiaTiss]?.numero ?? '—', operadora: guia[g.idGuiaTiss]?.operadora ?? '—', item: guia[g.idGuiaTiss]?.item ?? '—' }));
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [operadora, setOperadora] = React.useState('');
  const [situacao, setSituacao] = React.useState(ehAdmin ? '' : 'GLOSADO');
  const linhas = (dados ?? []).filter((g) => (!operadora || g.operadora === operadora) && (!situacao || g.situacao === situacao));

  return (
    <Pagina
      titulo={ehAdmin ? 'Demonstrativos e glosas' : 'Demonstrativo e glosas'}
      acoes={
        !ehAdmin && (
          <button type='button' className='btn btn-outline-primary' onClick={() => emBreve('A importação do demonstrativo')}>
            Importar demonstrativo
          </button>
        )
      }
    >
      <Filtros>
        <CampoSelect id='glosaOperadora' rotulo='Operadora' valor={operadora} aoMudar={setOperadora} opcoes={opcoesOperadora(dados)} />
        <CampoSelect
          id='glosaSituacao'
          rotulo='Situação'
          valor={situacao}
          aoMudar={setSituacao}
          opcoes={[['', 'Todas'], ...Object.entries(SITUACAO_GLOSA).map(([k, v]) => [k, v.rotulo])]}
        />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhuma glosa nesta seleção.'
        colunas={[
          { titulo: 'Guia', render: (g) => g.guia },
          { titulo: 'Operadora', render: (g) => g.operadora },
          { titulo: 'Item', render: (g) => g.item },
          { titulo: 'Motivo', render: (g) => <span title={g.motivo}>{g.codigo} · {g.motivo}</span> },
          { titulo: 'Glosado', classe: 'text-end', render: (g) => moeda(g.valorGlosado) },
          {
            titulo: 'Situação',
            render: (g) => (
              <PilulaStatus
                {...rotuloDe(SITUACAO_GLOSA, g.situacao)}
                transicoes={!ehAdmin && g.situacao === 'GLOSADO' ? [{ rotulo: 'Abrir recurso', aoEscolher: () => emBreve('O recurso de glosa') }] : null}
              />
            ),
          },
          ...(ehAdmin ? [{ titulo: 'Ações', render: (g) => <AcoesLinha acoes={[{ tipo: 'ver', alvo: `glosa da guia ${g.guia}`, aoClicar: () => emBreve('O detalhe da glosa') }]} /> }] : []),
        ]}
      />
    </Pagina>
  );
}

export default Glosas;
