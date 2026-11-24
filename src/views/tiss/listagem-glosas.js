import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoSelect, Filtros } from '../../components/campos';
import JanelaDetalhe from '../../components/janela-detalhe';
import { emBreve } from '../../components/confirmacao';
import { listar, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { data, moeda } from '../../utils/formatos';
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
    const [glosas, guias, recursos] = await Promise.all([
      listar('glosas', { _sort: 'dataDemonstrativo', _order: 'desc' }),
      carregarGuias(),
      listar('recursosGlosa').catch(() => []),
    ]);
    const guia = porId(guias);
    return glosas.map((g) => ({
      ...g,
      guia: guia[g.idGuiaTiss]?.numero ?? '—',
      operadora: guia[g.idGuiaTiss]?.operadora ?? '—',
      item: guia[g.idGuiaTiss]?.item ?? '—',
      recurso: recursos.filter((r) => r.idGlosa === g.id).sort((a, b) => (b.rodada ?? 1) - (a.rodada ?? 1))[0] ?? null,
    }));
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [operadora, setOperadora] = React.useState('');
  const [situacao, setSituacao] = React.useState(ehAdmin ? '' : 'GLOSADO');
  const [aberta, setAberta] = React.useState(null);
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
          ...(ehAdmin ? [{ titulo: 'Ações', render: (g) => <AcoesLinha acoes={[{ tipo: 'ver', alvo: `glosa da guia ${g.guia}`, aoClicar: () => setAberta(g) }]} /> }] : []),
        ]}
      />
      {aberta && (
        <JanelaDetalhe
          titulo={`Glosa da guia ${aberta.guia}`}
          aoFechar={() => setAberta(null)}
          itens={[
            ['Operadora', aberta.operadora],
            ['Item', aberta.item],
            ['Código', aberta.codigo],
            ['Motivo', aberta.motivo],
            ['Valor glosado', moeda(aberta.valorGlosado)],
            ['Demonstrativo de', data(aberta.dataDemonstrativo)],
            ['Situação', rotuloDe(SITUACAO_GLOSA, aberta.situacao).rotulo],
            ['Recurso', aberta.recurso ? `${aberta.recurso.rodada ?? 1}ª rodada, interposto em ${data(aberta.recurso.dataInterposicao)}` : 'Sem recurso'],
          ]}
        />
      )}
    </Pagina>
  );
}

export default Glosas;
