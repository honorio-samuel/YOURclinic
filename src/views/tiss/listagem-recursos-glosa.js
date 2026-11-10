import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoSelect, Filtros } from '../../components/campos';
import { emBreve, salvarComAviso, useConfirmacao } from '../../components/confirmacao';
import { DATA_DE_HOJE } from '../../config/axios';
import { listar, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { diasEntre, moeda } from '../../utils/formatos';
import { rotuloDe } from '../../utils/rotulos';
import { carregarGuias, opcoesOperadora } from './comum';

const SITUACAO_RECURSO = {
  EM_PREPARO: { rotulo: 'Em preparo', tom: 'neutro' },
  AGUARDANDO_FUNDAMENTACAO: { rotulo: 'Aguarda o médico', tom: 'neutro' },
  ENVIADO: { rotulo: 'Enviado', tom: 'info' },
  EM_ANALISE: { rotulo: 'Em análise', tom: 'info' },
  MANTIDO: { rotulo: 'Mantido', tom: 'perigo' },
  REVERTIDO: { rotulo: 'Revertido', tom: 'sucesso' },
  PERDA: { rotulo: 'Baixado como perda', tom: 'neutro' },
};

// A-25 · Recursos de glosa. No recurso mantido, o Administrador decide:
// insistir em nova rodada ou baixar como perda, com justificativa.
function RecursosGlosa() {
  const carregar = async () => {
    const [recursos, glosas, guias] = await Promise.all([listar('recursosGlosa'), listar('glosas'), carregarGuias()]);
    const glosa = porId(glosas);
    const guia = porId(guias);
    return recursos.map((r) => {
      const gl = glosa[r.idGlosa];
      const gu = guia[gl?.idGuiaTiss];
      return { ...r, item: gu?.item ?? '—', operadora: gu?.operadora ?? '—', valor: gl?.valorGlosado };
    });
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [modal, confirmar] = useConfirmacao();
  const [situacao, setSituacao] = React.useState('');
  const [operadora, setOperadora] = React.useState('');

  const insistir = async (r) => {
    const ok = await confirmar({ titulo: 'Insistir em nova rodada?', texto: 'O recurso volta para a Secretária preparar a próxima rodada.', rotuloConfirmar: 'Insistir' });
    if (ok && (await salvarComAviso('recursosGlosa', r.id, { situacao: 'EM_PREPARO', rodada: (r.rodada ?? 1) + 1 }, 'Nova rodada aberta.'))) recarregar();
  };
  const baixar = async (r) => {
    const motivo = await confirmar({ titulo: 'Baixar como perda?', texto: `${moeda(r.valor)} deixam de ser cobrados da operadora.`, campo: 'Justificativa', rotuloConfirmar: 'Baixar como perda', perigo: true });
    if (motivo && (await salvarComAviso('recursosGlosa', r.id, { situacao: 'PERDA', justificativaPerda: motivo }, 'Glosa baixada como perda.'))) recarregar();
  };

  const linhas = (dados ?? []).filter((r) => (!situacao || r.situacao === situacao) && (!operadora || r.operadora === operadora));
  return (
    <Pagina titulo='Recursos de glosa'>
      <Filtros>
        <CampoSelect
          id='recursoSituacao'
          rotulo='Situação'
          valor={situacao}
          aoMudar={setSituacao}
          opcoes={[['', 'Todas'], ...Object.entries(SITUACAO_RECURSO).map(([k, v]) => [k, v.rotulo])]}
        />
        <CampoSelect id='recursoOperadora' rotulo='Operadora' valor={operadora} aoMudar={setOperadora} opcoes={opcoesOperadora(dados)} />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhum recurso nesta seleção.'
        colunas={[
          { titulo: 'Item glosado', render: (r) => r.item },
          { titulo: 'Operadora', render: (r) => r.operadora },
          { titulo: 'Valor', classe: 'text-end', render: (r) => moeda(r.valor) },
          { titulo: 'Prazo', render: (r) => (r.prazo && r.situacao !== 'MANTIDO' ? `${diasEntre(DATA_DE_HOJE, r.prazo)} dias` : '—') },
          { titulo: 'Rodada', render: (r) => `${r.rodada ?? 1}ª` },
          {
            titulo: 'Situação',
            render: (r) => (
              <PilulaStatus
                {...rotuloDe(SITUACAO_RECURSO, r.situacao)}
                transicoes={
                  r.situacao === 'MANTIDO'
                    ? [
                        { rotulo: 'Insistir em nova rodada', aoEscolher: () => insistir(r) },
                        { rotulo: 'Baixar como perda', aoEscolher: () => baixar(r) },
                      ]
                    : null
                }
              />
            ),
          },
          { titulo: 'Ações', render: (r) => <AcoesLinha acoes={[{ tipo: 'ver', alvo: `recurso de ${r.item}`, aoClicar: () => emBreve('O detalhe do recurso') }]} /> },
        ]}
      />
      {modal}
    </Pagina>
  );
}

export default RecursosGlosa;
