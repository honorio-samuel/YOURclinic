import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoSelect, Filtros } from '../../components/campos';
import JanelaDetalhe from '../../components/janela-detalhe';
import { emBreve, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { criar, listar, porId } from '../../servicos/dados';
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
  const [modal, confirmar] = useConfirmacao();
  // RF57: o recurso sai com a justificativa da recepção; se o item glosado
  // pede argumento clínico, espera antes a fundamentação do médico.
  const abrirRecurso = async (g) => {
    const justificativa = await confirmar({
      titulo: `Abrir recurso da glosa da guia ${g.guia}?`,
      texto: `${g.codigo} · ${g.motivo}. Valor glosado: ${moeda(g.valorGlosado)}. Prazo de 30 dias.`,
      campo: 'Justificativa do recurso',
      rotuloConfirmar: 'Abrir recurso',
    });
    if (!justificativa) return;
    const pedirMedico = await confirmar({
      titulo: 'Pedir a fundamentação do médico?',
      texto: 'Se o motivo da glosa é clínico, o recurso espera o médico da consulta escrever a fundamentação antes de seguir.',
      rotuloConfirmar: 'Pedir ao médico',
      rotuloCancelar: 'Enviar sem fundamentação',
    });
    try {
      await criar('recursosGlosa', { idGlosa: g.id, justificativa, aguardaFundamentacao: Boolean(pedirMedico) });
      mensagemSucesso(pedirMedico ? 'Recurso aberto. Fica esperando a fundamentação do médico.' : 'Recurso aberto e enviado à operadora.');
      recarregar();
    } catch (e) {
      mensagemErro(e.response?.data?.erro ?? 'Não foi possível abrir o recurso agora.');
    }
  };
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
                transicoes={!ehAdmin && g.situacao === 'GLOSADO' ? [{ rotulo: 'Abrir recurso', aoEscolher: () => abrirRecurso(g) }] : null}
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
      {modal}
    </Pagina>
  );
}

export default Glosas;
