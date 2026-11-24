import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoSelect, Filtros } from '../../components/campos';
import JanelaDetalhe from '../../components/janela-detalhe';
import Modal from '../../components/modal';
import { CampoSelecao } from '../../components/formulario';
import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { api } from '../../config/axios';
import { criar, listar, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { data, moeda } from '../../utils/formatos';
import { rotuloDe } from '../../utils/rotulos';
import { carregarGuias, nomeOperadora, opcoesOperadora, useEhAdmin } from './comum';

const SITUACAO_GLOSA = {
  GLOSADO: { rotulo: 'Glosado', tom: 'aviso' },
  EM_RECURSO: { rotulo: 'Em recurso', tom: 'info' },
  RECUPERADO: { rotulo: 'Recuperado', tom: 'sucesso' },
  PERDA: { rotulo: 'Baixado como perda', tom: 'neutro' },
};

// RF56: o demonstrativo de retorno vem da operadora simulada para um lote já
// protocolado: cada guia volta paga ou glosada, e a glosa nova pode ir a recurso.
function JanelaDemonstrativo({ aoFechar, aoImportar }) {
  const carregar = async () => {
    const [lotes, convenios] = await Promise.all([listar('lotesCobranca', { _sort: 'numero', _order: 'desc' }), listar('convenios')]);
    const convenio = porId(convenios);
    return lotes.filter((l) => l.situacao === 'PROTOCOLADO' && !l.demonstradoEm).map((l) => ({ ...l, operadora: nomeOperadora(convenio[l.idConvenio]) }));
  };
  const { dados, carregando, erro } = useCarregar(carregar);
  const [idLote, setIdLote] = React.useState('');
  const [importando, setImportando] = React.useState(false);
  const escolhido = idLote || (dados?.[0] ? String(dados[0].id) : '');
  const importar = async () => {
    setImportando(true);
    try {
      const { data: r } = await api.post('/tiss/demonstrativo', { idLoteCobranca: Number(escolhido) });
      mensagemSucesso(
        `Demonstrativo do ${r.lote}: ${r.pagas} ${r.pagas === 1 ? 'guia paga' : 'guias pagas'} e ${r.glosadas} ${r.glosadas === 1 ? 'glosada' : 'glosadas'}.`
      );
      aoImportar();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
      setImportando(false);
    }
  };
  return (
    <Modal
      titulo='Importar demonstrativo de retorno'
      aoFechar={aoFechar}
      rodape={
        <>
          <button type='button' className='btn btn-outline-secondary' onClick={aoFechar} disabled={importando}>
            Voltar
          </button>
          <button type='button' className='btn btn-primary' onClick={importar} disabled={importando || !escolhido}>
            {importando ? 'Importando…' : 'Importar'}
          </button>
        </>
      }
    >
      {carregando && <p className='text-body-secondary mb-0'>Carregando os lotes…</p>}
      {erro && <p className='text-danger mb-0'>Não foi possível carregar os lotes agora.</p>}
      {dados && dados.length === 0 && <p className='mb-0'>Nenhum lote protocolado esperando o demonstrativo. Envie um lote em Lotes e protocolos.</p>}
      {dados && dados.length > 0 && (
        <div className='row g-3'>
          <p className='col-12 small text-body-secondary mb-0'>A operadora devolve, guia a guia, o que paga e o que glosa, com o motivo.</p>
          <CampoSelecao
            id='demonstrativoLote'
            rotulo='Lote protocolado'
            valor={escolhido}
            aoMudar={setIdLote}
            largura='col-12'
            opcoes={dados.map((l) => [String(l.id), `${l.numero} · ${l.operadora} · protocolo ${l.protocolo}`])}
          />
        </div>
      )}
    </Modal>
  );
}

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
  const [importando, setImportando] = React.useState(false);
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
          <button type='button' className='btn btn-outline-primary' onClick={() => setImportando(true)}>
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
      {importando && (
        <JanelaDemonstrativo
          aoFechar={() => setImportando(false)}
          aoImportar={() => {
            setImportando(false);
            recarregar();
          }}
        />
      )}
      {modal}
    </Pagina>
  );
}

export default Glosas;
