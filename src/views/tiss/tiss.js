import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoBusca, CampoSelect, Filtros } from '../../components/campos';
import { emBreve, salvarComAviso, useConfirmacao } from '../../components/confirmacao';
import { DATA_DE_HOJE } from '../../config/axios';
import { listar, pessoasPorId, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { corresponde, data, diasEntre, mesAno, moeda } from '../../utils/formatos';
import { SITUACAO_GUIA, rotuloDe } from '../../utils/rotulos';

const useEhAdmin = () => useSessao().sessao.usuario.papel === 'ADMINISTRADOR';
const nomeOperadora = (c) => c?.nome ?? c?.razaoSocial ?? '—';
const opcoesOperadora = (linhas) => [['', 'Todas'], ...[...new Map((linhas ?? []).map((l) => [l.operadora, l.operadora])).entries()]];

// Guias com consulta, paciente, operadora e procedimento.
async function carregarGuias() {
  const [guias, consultas, contratos, convenios, procedimentos] = await Promise.all([
    listar('guiasTiss', { _sort: 'numero', _order: 'desc' }),
    listar('consultas'),
    listar('contratosOperadora'),
    listar('convenios'),
    listar('procedimentos'),
  ]);
  const consulta = porId(consultas);
  const contrato = porId(contratos);
  const convenio = porId(convenios);
  const proc = porId(procedimentos);
  const pessoas = await pessoasPorId(guias.map((g) => consulta[g.idConsulta]?.idPaciente));
  return guias.map((g) => {
    const c = consulta[g.idConsulta];
    const p = proc[c?.idProcedimento];
    return {
      ...g,
      paciente: pessoas[c?.idPaciente]?.nome ?? '—',
      operadora: nomeOperadora(convenio[contrato[g.idContratoOperadora]?.idConvenio]),
      item: p ? `${p.codigo} · ${p.nome}` : '—',
    };
  });
}

// A-20 · Contratos e tabelas.
export function Contratos() {
  const carregar = async () => {
    const [contratos, convenios] = await Promise.all([listar('contratosOperadora', { _sort: 'vigenciaInicio', _order: 'desc' }), listar('convenios')]);
    const convenio = porId(convenios);
    return contratos.map((c) => ({ ...c, operadora: nomeOperadora(convenio[c.idConvenio]) }));
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  return (
    <Pagina
      titulo='Contratos e tabelas'
      acoes={
        <button type='button' className='btn btn-primary' onClick={() => emBreve('O cadastro de contrato')}>
          + Novo contrato
        </button>
      }
    >
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados ?? []}
        vazio='Nenhum contrato cadastrado.'
        legenda='Prazos na ordem: apresentação do lote, pagamento após o protocolo e recurso de glosa.'
        colunas={[
          { titulo: 'Operadora', render: (c) => c.operadora },
          { titulo: 'Nº do contrato', render: (c) => c.numero },
          { titulo: 'Vigência', render: (c) => `${mesAno(c.vigenciaInicio)} a ${mesAno(c.vigenciaFim)}` },
          { titulo: 'Versão TISS', render: (c) => c.versaoTiss },
          { titulo: 'Prazos', render: (c) => `${c.prazoApresentacao} · ${c.prazoPagamento} · ${c.prazoRecurso} dias` },
          {
            titulo: 'Status',
            render: (c) => {
              const vigente = ['ATIVO', 'VIGENTE'].includes(c.situacao);
              return <PilulaStatus rotulo={vigente ? 'Vigente' : 'Encerrado'} tom={vigente ? 'sucesso' : 'neutro'} />;
            },
          },
          {
            titulo: 'Ações',
            render: (c) => (
              <AcoesLinha
                acoes={[
                  { tipo: 'ver', alvo: `contrato ${c.numero}`, aoClicar: () => emBreve('A tabela de preços do contrato') },
                  { tipo: 'editar', alvo: `contrato ${c.numero}`, aoClicar: () => emBreve('A edição do contrato') },
                ]}
              />
            ),
          },
        ]}
      />
    </Pagina>
  );
}

const ELEGIBILIDADE = {
  ELEGIVEL: { rotulo: 'Elegível', tom: 'sucesso' },
  A_VERIFICAR: { rotulo: 'A verificar', tom: 'aviso' },
  INELEGIVEL: { rotulo: 'Inelegível', tom: 'perigo' },
  NAO_ELEGIVEL: { rotulo: 'Inelegível', tom: 'perigo' },
};
const AUTORIZACAO = {
  APROVADA: { rotulo: 'Autorizada', tom: 'sucesso' },
  AUTORIZADA: { rotulo: 'Autorizada', tom: 'sucesso' },
  EM_ANALISE: { rotulo: 'Em análise', tom: 'info' },
  PARCIAL: { rotulo: 'Parcial', tom: 'aviso' },
  PENDENTE_JUSTIFICATIVA: { rotulo: 'Aguarda o médico', tom: 'info' },
  NEGADA: { rotulo: 'Negada', tom: 'perigo' },
  NAO_EXIGE: { rotulo: 'Não exige', tom: 'neutro' },
};

// A-21 e S-13 · Elegibilidade e autorização das próximas consultas por convênio.
// O CID aparece só como código.
export function Elegibilidade() {
  const ehAdmin = useEhAdmin();
  const carregar = async () => {
    const [consultas, elegibilidades, autorizacoes, convenios, procedimentos] = await Promise.all([
      listar('consultas', { status: 'AGENDADO', dataHora_gte: `${DATA_DE_HOJE}T00:00:00`, _sort: 'dataHora' }),
      listar('elegibilidades', { _sort: 'dataConsulta', _order: 'desc' }),
      listar('autorizacoes'),
      listar('convenios'),
      listar('procedimentos'),
    ]);
    const comConvenio = consultas.filter((c) => c.idConvenio);
    const pessoas = await pessoasPorId(comConvenio.map((c) => c.idPaciente));
    const convenio = porId(convenios);
    const proc = porId(procedimentos);
    return comConvenio.map((c) => {
      const eleg = elegibilidades.find((e) => e.idPaciente === c.idPaciente && e.idConvenio === c.idConvenio);
      const aut = autorizacoes.find((a) => a.idConsulta === c.id);
      return {
        ...c,
        paciente: pessoas[c.idPaciente]?.nome ?? '—',
        operadora: nomeOperadora(convenio[c.idConvenio]),
        procedimento: proc[c.idProcedimento]?.nome ?? '—',
        cid: aut?.cid ?? '—',
        elegibilidade: eleg?.situacao ?? 'A_VERIFICAR',
        autorizacao: aut?.situacao ?? (proc[c.idProcedimento]?.exigeAutorizacao ? 'PENDENTE_JUSTIFICATIVA' : 'NAO_EXIGE'),
      };
    });
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [busca, setBusca] = React.useState('');
  const [operadora, setOperadora] = React.useState('');
  const [situacao, setSituacao] = React.useState('');
  const linhas = (dados ?? []).filter(
    (l) => corresponde(busca, l.paciente) && (!operadora || l.operadora === operadora) && (!situacao || l.elegibilidade === situacao)
  );

  return (
    <Pagina titulo={ehAdmin ? 'Elegibilidade e autorizações' : 'Elegibilidade e autorização'}>
      <Filtros>
        <CampoBusca id='elegBusca' rotulo='Buscar por paciente' valor={busca} aoMudar={setBusca} />
        <CampoSelect id='elegOperadora' rotulo='Operadora' valor={operadora} aoMudar={setOperadora} opcoes={opcoesOperadora(dados)} />
        <CampoSelect
          id='elegSituacao'
          rotulo='Elegibilidade'
          valor={situacao}
          aoMudar={setSituacao}
          opcoes={[['', 'Todas'], ...Object.entries(ELEGIBILIDADE).map(([k, v]) => [k, v.rotulo])]}
        />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhuma consulta por convênio nesta seleção.'
        colunas={[
          { titulo: 'Paciente', render: (l) => l.paciente },
          { titulo: 'Operadora', render: (l) => l.operadora },
          { titulo: 'Procedimento', render: (l) => l.procedimento },
          { titulo: 'CID', render: (l) => l.cid },
          {
            titulo: 'Elegibilidade',
            render: (l) => (
              <PilulaStatus
                {...rotuloDe(ELEGIBILIDADE, l.elegibilidade)}
                transicoes={!ehAdmin && l.elegibilidade === 'A_VERIFICAR' ? [{ rotulo: 'Verificar na operadora', aoEscolher: () => emBreve('A consulta de elegibilidade') }] : null}
              />
            ),
          },
          { titulo: 'Autorização', render: (l) => <PilulaStatus {...rotuloDe(AUTORIZACAO, l.autorizacao)} /> },
        ]}
      />
    </Pagina>
  );
}

// A-22 (leitura) e S-14 · Guias TISS. A Secretária cria, edita antes da liberação
// e libera depois da crítica prévia.
export function Guias() {
  const ehAdmin = useEhAdmin();
  const { dados, carregando, erro, recarregar } = useCarregar(carregarGuias);
  const [modal, confirmar] = useConfirmacao();
  const [busca, setBusca] = React.useState('');
  const [operadora, setOperadora] = React.useState('');
  const [situacao, setSituacao] = React.useState('');

  const liberar = async (g) => {
    const ok = await confirmar({ titulo: `Liberar a guia ${g.numero}?`, texto: 'A crítica prévia confere os oito bloqueios do faturamento antes de liberar.', rotuloConfirmar: 'Liberar' });
    if (ok && (await salvarComAviso('guiasTiss', g.id, { situacao: 'LIBERADA' }, `Guia ${g.numero} liberada.`))) recarregar();
  };
  const cancelar = async (g) => {
    const motivo = await confirmar({ titulo: `Cancelar a guia ${g.numero}?`, texto: 'A guia fica no histórico como cancelada.', campo: 'Motivo do cancelamento', rotuloConfirmar: 'Cancelar guia', perigo: true });
    if (motivo && (await salvarComAviso('guiasTiss', g.id, { situacao: 'CANCELADA', motivoCancelamento: motivo }, `Guia ${g.numero} cancelada.`))) recarregar();
  };

  const linhas = (dados ?? []).filter(
    (g) => corresponde(busca, g.numero, g.paciente) && (!operadora || g.operadora === operadora) && (!situacao || g.situacao === situacao)
  );

  return (
    <Pagina
      titulo='Guias TISS'
      acoes={
        !ehAdmin && (
          <button type='button' className='btn btn-primary' onClick={() => emBreve('A criação de guia')}>
            + Nova guia
          </button>
        )
      }
    >
      <Filtros>
        <CampoBusca id='guiaBusca' rotulo='Buscar por guia ou paciente' valor={busca} aoMudar={setBusca} />
        {ehAdmin && <CampoSelect id='guiaOperadora' rotulo='Operadora' valor={operadora} aoMudar={setOperadora} opcoes={opcoesOperadora(dados)} />}
        <CampoSelect
          id='guiaSituacao'
          rotulo='Situação'
          valor={situacao}
          aoMudar={setSituacao}
          opcoes={[['', 'Todas'], ...Object.entries(SITUACAO_GUIA).map(([k, v]) => [k, v.rotulo])]}
        />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhuma guia nesta seleção.'
        colunas={[
          { titulo: 'Guia', render: (g) => g.numero },
          { titulo: 'Paciente', render: (g) => g.paciente },
          { titulo: 'Operadora', render: (g) => g.operadora },
          { titulo: 'CID', render: (g) => g.cid ?? '—' },
          { titulo: 'Valor', classe: 'text-end', render: (g) => moeda(g.valor) },
          {
            titulo: 'Situação',
            render: (g) => (
              <PilulaStatus
                {...rotuloDe(SITUACAO_GUIA, g.situacao)}
                transicoes={!ehAdmin && ['RASCUNHO', 'EM_DIGITACAO'].includes(g.situacao) ? [{ rotulo: 'Liberar', aoEscolher: () => liberar(g) }] : null}
              />
            ),
          },
          {
            titulo: 'Ações',
            render: (g) => {
              const alvo = `guia ${g.numero}`;
              const ver = { tipo: 'ver', alvo, aoClicar: () => emBreve('O detalhe da guia') };
              if (ehAdmin || !['RASCUNHO', 'EM_DIGITACAO', 'BLOQUEADA', 'LIBERADA'].includes(g.situacao)) return <AcoesLinha acoes={[ver]} />;
              return (
                <AcoesLinha
                  acoes={[ver, { tipo: 'editar', alvo, aoClicar: () => emBreve('A edição da guia') }, { tipo: 'cancelar', alvo, aoClicar: () => cancelar(g) }]}
                />
              );
            },
          },
        ]}
      />
      {modal}
    </Pagina>
  );
}

// A-23 e S-15 · Lotes e protocolos. A Secretária vê o valor de cada guia, mas
// não o total do lote (D9).
export function Lotes() {
  const ehAdmin = useEhAdmin();
  const carregar = async () => {
    const [lotes, guias, convenios] = await Promise.all([listar('lotesCobranca', { _sort: 'numero', _order: 'desc' }), listar('guiasTiss'), listar('convenios')]);
    const convenio = porId(convenios);
    return lotes.map((l) => ({ ...l, operadora: nomeOperadora(convenio[l.idConvenio]), guias: guias.filter((g) => g.idLoteCobranca === l.id).length }));
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [modal, confirmar] = useConfirmacao();
  const [operadora, setOperadora] = React.useState('');
  const [situacao, setSituacao] = React.useState('');

  const enviar = async (l) => {
    const ok = await confirmar({ titulo: `Enviar o lote ${l.numero}?`, texto: `${l.guias} guias para ${l.operadora}. O protocolo da operadora fica registrado no lote.`, rotuloConfirmar: 'Enviar lote' });
    if (ok && (await salvarComAviso('lotesCobranca', l.id, { situacao: 'ENVIADO', dataEnvio: `${DATA_DE_HOJE}T12:00:00` }, `Lote ${l.numero} enviado.`))) recarregar();
  };

  const SITUACAO = { A_ENVIAR: { rotulo: 'A enviar', tom: 'aviso' }, ENVIADO: { rotulo: 'Enviado', tom: 'info' }, PROTOCOLADO: { rotulo: 'Protocolado', tom: 'sucesso' } };
  const linhas = (dados ?? []).filter((l) => (!operadora || l.operadora === operadora) && (!situacao || l.situacao === situacao));
  const colunas = [
    { titulo: 'Lote', render: (l) => l.numero },
    { titulo: 'Operadora', render: (l) => l.operadora },
    { titulo: 'Guias', classe: 'text-end', render: (l) => l.guias },
  ];
  if (ehAdmin) colunas.push({ titulo: 'Total', classe: 'text-end', render: (l) => moeda(l.valorApresentado) });
  colunas.push(
    { titulo: 'Enviado em', render: (l) => data(l.dataEnvio) },
    { titulo: 'Protocolo', render: (l) => l.protocolo ?? '—' },
    {
      titulo: 'Situação',
      render: (l) => (
        <PilulaStatus {...rotuloDe(SITUACAO, l.situacao)} transicoes={l.situacao === 'A_ENVIAR' ? [{ rotulo: 'Enviar lote', aoEscolher: () => enviar(l) }] : null} />
      ),
    }
  );

  return (
    <Pagina
      titulo='Lotes e protocolos'
      acoes={
        !ehAdmin && (
          <button type='button' className='btn btn-primary' onClick={() => emBreve('A montagem de lote')}>
            + Novo lote
          </button>
        )
      }
    >
      <Filtros>
        <CampoSelect id='loteOperadora' rotulo='Operadora' valor={operadora} aoMudar={setOperadora} opcoes={opcoesOperadora(dados)} />
        <CampoSelect id='loteSituacao' rotulo='Situação' valor={situacao} aoMudar={setSituacao} opcoes={[['', 'Todas'], ...Object.entries(SITUACAO).map(([k, v]) => [k, v.rotulo])]} />
      </Filtros>
      <Listagem carregando={carregando} erro={erro} aoTentarDeNovo={recarregar} linhas={linhas} vazio='Nenhum lote nesta seleção.' colunas={colunas} />
      {modal}
    </Pagina>
  );
}

const SITUACAO_GLOSA = {
  GLOSADO: { rotulo: 'Glosado', tom: 'aviso' },
  EM_RECURSO: { rotulo: 'Em recurso', tom: 'info' },
  RECUPERADO: { rotulo: 'Recuperado', tom: 'sucesso' },
  PERDA: { rotulo: 'Baixado como perda', tom: 'neutro' },
};

// A-24 Demonstrativos e glosas e S-16a Demonstrativo e glosas. O índice de
// glosa não aparece para a Secretária.
export function Glosas() {
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
export function RecursosGlosa() {
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
