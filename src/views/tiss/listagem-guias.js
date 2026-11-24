import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoBusca, CampoSelect, Filtros } from '../../components/campos';
import JanelaDetalhe from '../../components/janela-detalhe';
import Modal from '../../components/modal';
import { CampoSelecao } from '../../components/formulario';
import { mensagemDeErro, salvarComAviso, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { api } from '../../config/axios';
import { listar, pessoasPorId, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { corresponde, data, diaMesHora, moeda } from '../../utils/formatos';
import { rotuloDe, SITUACAO_GUIA } from '../../utils/rotulos';
import { carregarGuias, nomeOperadora, opcoesOperadora, useEhAdmin } from './comum';

// Situações em que a Secretária ainda revisa a guia (RF54).
const EM_REVISAO = ['RASCUNHO', 'EM_DIGITACAO', 'BLOQUEADA'];

const ELEGIBILIDADE = { ELEGIVEL: 'Elegível', NAO_ELEGIVEL: 'Inelegível', INELEGIVEL: 'Inelegível' };
const AUTORIZACAO = { AUTORIZADA: 'Autorizada, com senha', EM_ANALISE: 'Em análise na operadora', PENDENTE_JUSTIFICATIVA: 'Aguarda o médico', NEGADA: 'Negada' };

// RF54: a revisão mostra o que o sistema preencheu e a crítica prévia, com os
// oito bloqueios numerados; cada um diz o item e como corrigir (RN-54.1). O
// CID aparece só como código (RN-54.3).
function JanelaRevisao({ guia, aoFechar, aoMudar }) {
  const { dados, carregando, erro } = useCarregar(async () => (await api.get(`/tiss/guias/${guia.id}/critica`)).data, [guia.id]);
  const [estado, setEstado] = React.useState(null);
  const [trabalhando, setTrabalhando] = React.useState(false);
  const atual = estado ?? dados;
  const g = atual?.guia;
  const bloqueios = atual?.bloqueios ?? [];

  const atualizar = async () => {
    setTrabalhando(true);
    try {
      const { data: r } = await api.post(`/tiss/guias/${guia.id}/atualizar`);
      setEstado(r);
      mensagemSucesso(r.bloqueios.length ? 'Dados atualizados. Ainda há bloqueios.' : 'Dados atualizados. A guia pode ser liberada.');
      aoMudar();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    } finally {
      setTrabalhando(false);
    }
  };
  const liberar = async () => {
    setTrabalhando(true);
    try {
      await api.post(`/tiss/guias/${guia.id}/liberar`);
      mensagemSucesso(`Guia ${guia.numero} liberada para o lote.`);
      aoMudar();
      aoFechar();
    } catch (e) {
      if (e.response?.data?.bloqueios) setEstado({ ...atual, guia: { ...atual.guia, situacao: 'BLOQUEADA' }, bloqueios: e.response.data.bloqueios });
      mensagemErro(mensagemDeErro(e));
      aoMudar();
      setTrabalhando(false);
    }
  };

  return (
    <Modal
      titulo={`Revisar a guia ${guia.numero}`}
      aoFechar={aoFechar}
      largo
      rodape={
        <>
          <button type='button' className='btn btn-outline-secondary' onClick={aoFechar} disabled={trabalhando}>
            Voltar
          </button>
          <button type='button' className='btn btn-outline-primary' onClick={atualizar} disabled={trabalhando || !g}>
            Atualizar dados
          </button>
          <button type='button' className='btn btn-primary' onClick={liberar} disabled={trabalhando || !g || bloqueios.length > 0}>
            Liberar guia
          </button>
        </>
      }
    >
      {carregando && !estado && <p className='text-body-secondary mb-0'>Conferindo a guia…</p>}
      {erro && !estado && <p className='text-danger mb-0'>Não foi possível conferir a guia agora.</p>}
      {g && (
        <>
          <dl className='row mb-3'>
            <dt className='col-sm-4'>Paciente</dt>
            <dd className='col-sm-8'>{guia.paciente}</dd>
            <dt className='col-sm-4'>Operadora</dt>
            <dd className='col-sm-8'>{guia.operadora}</dd>
            <dt className='col-sm-4'>Atendimento</dt>
            <dd className='col-sm-8'>{atual.atendimento.data ? diaMesHora(atual.atendimento.data) : '—'}</dd>
            <dt className='col-sm-4'>Procedimento (TUSS)</dt>
            <dd className='col-sm-8'>{atual.atendimento.procedimento ?? '—'}</dd>
            <dt className='col-sm-4'>Tipo de guia</dt>
            <dd className='col-sm-8'>{g.tipo === 'CONSULTA' ? 'Consulta' : 'SP/SADT'}</dd>
            <dt className='col-sm-4'>CID</dt>
            <dd className='col-sm-8'>{g.cid ?? '—'}</dd>
            <dt className='col-sm-4'>Valor da guia</dt>
            <dd className='col-sm-8'>{g.valor == null ? '—' : moeda(g.valor)}</dd>
            <dt className='col-sm-4'>Elegibilidade</dt>
            <dd className='col-sm-8'>{ELEGIBILIDADE[atual.atendimento.elegibilidade] ?? 'Não verificada'}</dd>
            <dt className='col-sm-4'>Autorização</dt>
            <dd className='col-sm-8'>
              {AUTORIZACAO[atual.atendimento.autorizacao] ?? (atual.atendimento.exigeAutorizacao ? 'Sem pedido' : 'Não exige')}
            </dd>
          </dl>
          <h3 className='h6'>Crítica prévia</h3>
          {bloqueios.length === 0 ? (
            <div className='alert alert-success mb-0' role='status'>
              Nenhum bloqueio. A guia pode ser liberada para o lote.
            </div>
          ) : (
            <div className='alert alert-warning mb-0' role='status'>
              <p className='mb-2'>
                {bloqueios.length === 1 ? 'Um bloqueio impede a liberação:' : `${bloqueios.length} bloqueios impedem a liberação:`}
              </p>
              <ul className='mb-0'>
                {bloqueios.map((b) => (
                  <li key={b.numero}>
                    <strong>Bloqueio {b.numero}.</strong> {b.item} {b.correcao}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

// RF54: a guia nova de um atendimento de convênio finalizado que está sem
// guia ativa, como depois de cancelar uma guia liberada para corrigi-la.
function JanelaNovaGuia({ aoFechar, aoGerar }) {
  const carregar = async () => {
    const [consultas, guias, procedimentos, convenios] = await Promise.all([
      listar('consultas', { status: 'FINALIZADO' }),
      listar('guiasTiss'),
      listar('procedimentos'),
      listar('convenios'),
    ]);
    const proc = porId(procedimentos);
    const convenio = porId(convenios);
    const semGuia = consultas
      .filter((c) => c.idConvenio && !guias.some((g) => g.idConsulta === c.id && g.situacao !== 'CANCELADA'))
      .sort((a, b) => b.dataHora.localeCompare(a.dataHora));
    const pessoas = await pessoasPorId(semGuia.map((c) => c.idPaciente));
    return semGuia.map((c) => ({
      id: c.id,
      rotulo: `${diaMesHora(c.dataHora)} · ${pessoas[c.idPaciente]?.nome ?? '—'} · ${proc[c.idProcedimento]?.nome ?? '—'} · ${nomeOperadora(convenio[c.idConvenio])}`,
      paciente: pessoas[c.idPaciente]?.nome ?? '—',
      operadora: nomeOperadora(convenio[c.idConvenio]),
    }));
  };
  const { dados, carregando, erro } = useCarregar(carregar);
  const [idConsulta, setIdConsulta] = React.useState('');
  const [gerando, setGerando] = React.useState(false);
  const escolhida = idConsulta || (dados?.[0] ? String(dados[0].id) : '');
  const gerar = async () => {
    setGerando(true);
    try {
      const { data: r } = await api.post('/tiss/guias', { idConsulta: Number(escolhida) });
      const atendimento = dados.find((d) => String(d.id) === escolhida);
      mensagemSucesso(`Guia ${r.guia.numero} gerada em rascunho.`);
      aoGerar({ ...r.guia, paciente: atendimento?.paciente, operadora: atendimento?.operadora });
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
      setGerando(false);
    }
  };
  return (
    <Modal
      titulo='Nova guia TISS'
      aoFechar={aoFechar}
      largo
      rodape={
        <>
          <button type='button' className='btn btn-outline-secondary' onClick={aoFechar} disabled={gerando}>
            Voltar
          </button>
          <button type='button' className='btn btn-primary' onClick={gerar} disabled={gerando || !escolhida}>
            {gerando ? 'Gerando…' : 'Gerar guia'}
          </button>
        </>
      }
    >
      {carregando && <p className='text-body-secondary mb-0'>Carregando os atendimentos…</p>}
      {erro && <p className='text-danger mb-0'>Não foi possível carregar os atendimentos agora.</p>}
      {dados && dados.length === 0 && (
        <p className='mb-0'>
          Todo atendimento de convênio finalizado já tem guia: ela nasce em rascunho quando o médico finaliza. Para corrigir uma guia liberada,
          cancele-a e gere a nova aqui.
        </p>
      )}
      {dados && dados.length > 0 && (
        <div className='row g-3'>
          <p className='col-12 small text-body-secondary mb-0'>
            O sistema preenche operadora, beneficiário, procedimento, valor da tabela vigente e a senha da autorização, quando houver.
          </p>
          <CampoSelecao
            id='novaGuiaAtendimento'
            rotulo='Atendimento de convênio sem guia'
            valor={escolhida}
            aoMudar={setIdConsulta}
            largura='col-12'
            opcoes={dados.map((d) => [String(d.id), d.rotulo])}
          />
        </div>
      )}
    </Modal>
  );
}

// A-22 (leitura) e S-14 · Guias TISS. A guia nasce em rascunho ao finalizar o
// atendimento; a Secretária revisa, atualiza e libera depois da crítica prévia.
function Guias() {
  const ehAdmin = useEhAdmin();
  const { dados, carregando, erro, recarregar } = useCarregar(carregarGuias);
  const [modal, confirmar] = useConfirmacao();
  const [busca, setBusca] = React.useState('');
  const [operadora, setOperadora] = React.useState('');
  const [situacao, setSituacao] = React.useState('');
  const [aberta, setAberta] = React.useState(null);
  const [revisando, setRevisando] = React.useState(null);
  const [gerando, setGerando] = React.useState(false);

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
          <button type='button' className='btn btn-primary' onClick={() => setGerando(true)}>
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
                transicoes={!ehAdmin && EM_REVISAO.includes(g.situacao) ? [{ rotulo: 'Revisar e liberar', aoEscolher: () => setRevisando(g) }] : null}
              />
            ),
          },
          {
            titulo: 'Ações',
            render: (g) => {
              const alvo = `guia ${g.numero}`;
              const ver = { tipo: 'ver', alvo, aoClicar: () => setAberta(g) };
              if (ehAdmin) return <AcoesLinha acoes={[ver]} />;
              // Liberada, a guia não se edita: a correção é cancelar e gerar outra.
              const acoes = [ver];
              if (EM_REVISAO.includes(g.situacao)) acoes.push({ tipo: 'editar', alvo, aoClicar: () => setRevisando(g) });
              if ((EM_REVISAO.includes(g.situacao) || g.situacao === 'LIBERADA') && !g.lote) acoes.push({ tipo: 'cancelar', alvo, aoClicar: () => cancelar(g) });
              return <AcoesLinha acoes={acoes} />;
            },
          },
        ]}
      />
      {aberta && (
        <JanelaDetalhe
          titulo={`Guia ${aberta.numero}`}
          aoFechar={() => setAberta(null)}
          itens={[
            ['Tipo', aberta.tipo === 'CONSULTA' ? 'Consulta' : 'SP/SADT'],
            ['Paciente', aberta.paciente],
            ['Operadora', aberta.operadora],
            ['Procedimento', aberta.item],
            ['Emissão', data(aberta.dataEmissao)],
            ['Versão TISS', aberta.versaoTiss],
            ['CID', aberta.cid],
            ['Valor', moeda(aberta.valor)],
            ['Lote', aberta.lote ?? 'Ainda fora de lote'],
            ['Situação', rotuloDe(SITUACAO_GUIA, aberta.situacao).rotulo],
            ['Motivo do cancelamento', aberta.motivoCancelamento ?? undefined],
          ]}
        />
      )}
      {revisando && (
        <JanelaRevisao
          guia={revisando}
          aoFechar={() => setRevisando(null)}
          aoMudar={recarregar}
        />
      )}
      {gerando && (
        <JanelaNovaGuia
          aoFechar={() => setGerando(false)}
          aoGerar={(guia) => {
            setGerando(false);
            recarregar();
            setRevisando(guia);
          }}
        />
      )}
      {modal}
    </Pagina>
  );
}

export default Guias;
