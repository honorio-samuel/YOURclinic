import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoBusca, CampoSelect, Filtros } from '../../components/campos';
import { emBreve, mensagemDeErro, useAlternarSituacao, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { api, DATA_DE_HOJE } from '../../config/axios';
import { atualizar, listar, pessoasPorId, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { corresponde, data, diaMesHora, hora, nomeMedico } from '../../utils/formatos';
import { MOTIVO_BLOQUEIO, SITUACAO_CADASTRO, STATUS_CONSULTA, rotuloDe } from '../../utils/rotulos';

const doDia = (dia) => ({ dataHora_gte: `${dia}T00:00:00`, dataHora_lte: `${dia}T23:59:59`, _sort: 'dataHora' });

// Consultas com nomes de paciente e médico, tipo de atendimento e convênio.
async function carregarConsultas(params) {
  const [consultas, procedimentos, convenios] = await Promise.all([
    listar('consultas', params),
    listar('procedimentos'),
    listar('convenios'),
  ]);
  const pessoas = await pessoasPorId(consultas.flatMap((c) => [c.idPaciente, c.idMedico]));
  const proc = porId(procedimentos);
  const conv = porId(convenios);
  return consultas.map((c) => ({
    ...c,
    paciente: pessoas[c.idPaciente]?.nome ?? '—',
    medico: nomeMedico(pessoas[c.idMedico]),
    tipo: proc[c.idProcedimento]?.nome ?? '—',
    atendimento: `${proc[c.idProcedimento]?.tipo === 'CONSULTA' || !proc[c.idProcedimento] ? 'Consulta' : 'Procedimento'} · ${
      c.idConvenio ? conv[c.idConvenio]?.nome ?? 'convênio' : 'particular'
    }`,
  }));
}

function opcoesDeMedico(consultas) {
  const mapa = new Map((consultas ?? []).map((c) => [String(c.idMedico), c.medico]));
  return [['', 'Todos os médicos'], ...[...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))];
}

// Muda o status da consulta. O servidor confere se a transição é permitida ao papel.
function useMudarStatus(recarregar) {
  const [modal, confirmar] = useConfirmacao();
  const mudar = async (consulta, status, pedirConfirmacao) => {
    let motivo = null;
    if (pedirConfirmacao) {
      const resposta = await confirmar(pedirConfirmacao);
      if (!resposta) return;
      if (typeof resposta === 'string') motivo = resposta;
    }
    try {
      const campos = { status };
      if (status === 'CANCELADO') campos.motivoCancelamento = motivo ?? 'Cancelado pela clínica';
      // Volta de status (retroativa) leva motivo e fica destacada no log (RF22).
      else if (motivo) campos.motivoTransicao = motivo;
      await atualizar('consultas', consulta.id, campos);
      mensagemSucesso(`${consulta.paciente}: ${STATUS_CONSULTA[status].rotulo.toLowerCase()}.`);
      recarregar();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    }
  };
  return [modal, mudar];
}

async function carregarPendenciasRecepcao(consultasDoDia) {
  const [notificacoes, alertas, representacoes] = await Promise.all([
    listar('notificacoes', { situacao: 'FALHOU' }),
    listar('alertasEstoque', { situacao: 'ABERTO' }),
    listar('representacoes'),
  ]);
  const pessoas = await pessoasPorId(representacoes.map((r) => r.idPaciente));
  const maiores = representacoes.filter((r) => {
    const nasc = pessoas[r.idPaciente]?.dataNascimento;
    return !r.fimVigencia && nasc && Number(DATA_DE_HOJE.slice(0, 4)) - Number(nasc.slice(0, 4)) >= 18 && nasc.slice(5) <= DATA_DE_HOJE.slice(5);
  });
  const convenioAConferir = (consultasDoDia ?? []).filter(
    (c) => c.idConvenio && ['AGENDADO', 'NA_RECEPCAO'].includes(c.status)
  );
  return [
    { id: 1, pendencia: 'Convênios a conferir', itens: convenioAConferir.length, rota: '/secretaria/elegibilidade', acao: 'Abrir' },
    { id: 2, pendencia: 'Notificações sem entrega', itens: notificacoes.length, rota: null, acao: 'Reenviar ou ligar' },
    { id: 3, pendencia: 'Titulares a habilitar por maioridade', itens: maiores.length, rota: '/secretaria/pacientes', acao: 'Abrir' },
    { id: 4, pendencia: 'Alertas de estoque', itens: alertas.length, rota: '/secretaria/alertas', acao: 'Abrir' },
  ];
}

// S-06 Fila do dia e A-09 Fila do dia · leitura. Nenhuma coluna, cor ou ordem
// deriva de conteúdo clínico (RN-22.2). A Secretária faz check-in, marca Não
// compareceu e cancela; nunca move para Em atendimento (D1).
export function FilaDoDia() {
  const { sessao } = useSessao();
  const navigate = useNavigate();
  const ehSecretaria = sessao.usuario.papel === 'SECRETARIA';
  const { dados, carregando, erro, recarregar } = useCarregar(() => carregarConsultas(doDia(DATA_DE_HOJE)));
  const pend = useCarregar(() => (ehSecretaria && dados ? carregarPendenciasRecepcao(dados) : Promise.resolve(null)), [dados]);
  const [modal, mudar] = useMudarStatus(recarregar);
  const [medico, setMedico] = React.useState('');
  const linhas = (dados ?? []).filter((c) => !medico || String(c.idMedico) === medico);

  const transicoes = (c) => {
    if (!ehSecretaria) return null;
    const cancelar = {
      rotulo: 'Cancelar consulta',
      aoEscolher: () =>
        mudar(c, 'CANCELADO', {
          titulo: `Cancelar a consulta de ${c.paciente}?`,
          texto: 'O paciente recebe o aviso de cancelamento. A consulta fica no histórico como cancelada pela clínica.',
          rotuloConfirmar: 'Cancelar consulta',
          perigo: true,
        }),
    };
    const faltou = { rotulo: 'Não compareceu', aoEscolher: () => mudar(c, 'NAO_COMPARECEU') };
    if (c.status === 'AGENDADO') return [{ rotulo: 'Fazer check-in', aoEscolher: () => mudar(c, 'NA_RECEPCAO') }, faltou, cancelar];
    if (c.status === 'NA_RECEPCAO') return [faltou, cancelar];
    return null;
  };

  const colunas = [
    { titulo: 'Paciente', render: (c) => c.paciente },
    { titulo: 'Horário', render: (c) => hora(c.dataHora) },
    { titulo: 'Médico', render: (c) => c.medico },
    { titulo: 'Atendimento', render: (c) => c.atendimento },
    { titulo: 'Status', render: (c) => <PilulaStatus estado={c.status} transicoes={transicoes(c)} /> },
  ];
  if (ehSecretaria) {
    colunas.push({
      titulo: '',
      render: (c) =>
        c.status === 'FINALIZADO' ? (
          <button type='button' className='btn btn-link btn-sm p-0' onClick={() => navigate('/secretaria/cobrancas')}>
            Cobrar
          </button>
        ) : (
          '—'
        ),
    });
  }

  return (
    <Pagina titulo={ehSecretaria ? 'Fila do dia' : 'Fila do dia · leitura'}>
      <Filtros>
        <CampoSelect id='filaMedico' rotulo='Médico' valor={medico} aoMudar={setMedico} opcoes={opcoesDeMedico(dados)} />
        <div className='filtro'>
          <span className='form-label d-block'>Data</span>
          <span className='form-control-plaintext'>Hoje, {data(DATA_DE_HOJE)}</span>
        </div>
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        itensPorPagina={50}
        vazio='Nenhuma consulta marcada para hoje.'
        colunas={colunas}
      />
      {ehSecretaria && (
        <Listagem
          titulo='Pendências da recepção'
          carregando={pend.carregando}
          erro={pend.erro}
          linhas={pend.dados ?? []}
          colunas={[
            { titulo: 'Pendência', render: (p) => p.pendencia },
            { titulo: 'Itens', classe: 'text-end', render: (p) => p.itens },
            {
              titulo: '',
              render: (p) =>
                p.rota ? (
                  <Link to={p.rota}>{p.acao}</Link>
                ) : (
                  <button type='button' className='btn btn-link btn-sm p-0' onClick={() => emBreve('O reenvio de notificações')}>
                    {p.acao}
                  </button>
                ),
            },
          ]}
        />
      )}
      {modal}
    </Pagina>
  );
}

// M-01 Atendimentos do dia. O Médico vê só os próprios atendimentos e não vê valores.
export function AtendimentosDoDia() {
  const { sessao } = useSessao();
  const navigate = useNavigate();
  const idMedico = sessao.usuario.idPessoa;
  const { dados, carregando, erro, recarregar } = useCarregar(() =>
    carregarConsultas({ ...doDia(DATA_DE_HOJE), idMedico })
  );
  const [modal, mudar] = useMudarStatus(recarregar);

  const transicoes = (c) => {
    if (c.status === 'NA_RECEPCAO') return [{ rotulo: 'Chamar paciente', aoEscolher: () => mudar(c, 'EM_ATENDIMENTO') }];
    if (c.status === 'EM_ATENDIMENTO')
      return [
        {
          rotulo: 'Finalizar e selar',
          aoEscolher: () =>
            mudar(c, 'FINALIZADO', {
              titulo: `Finalizar o atendimento de ${c.paciente}?`,
              texto: 'O registro clínico é selado. Correções depois disso só por retificação versionada.',
              rotuloConfirmar: 'Finalizar e selar',
            }),
        },
        {
          rotulo: 'Voltar para a recepção',
          aoEscolher: () =>
            mudar(c, 'NA_RECEPCAO', {
              titulo: 'Voltar o paciente para a recepção?',
              texto: 'A mudança fica destacada no log. O vínculo já ativado não muda.',
              campo: 'Motivo',
              rotuloConfirmar: 'Voltar para a recepção',
            }),
        },
      ];
    if (c.status === 'FINALIZADO')
      return [
        {
          rotulo: 'Voltar para Em atendimento',
          aoEscolher: () =>
            mudar(c, 'EM_ATENDIMENTO', {
              titulo: 'Voltar o atendimento para Em atendimento?',
              texto: 'A mudança fica destacada no log. O registro continua selado e só muda por retificação.',
              campo: 'Motivo',
              rotuloConfirmar: 'Voltar para Em atendimento',
            }),
        },
      ];
    return null;
  };

  return (
    <Pagina titulo='Atendimentos do dia'>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados ?? []}
        itensPorPagina={50}
        vazio='Nenhum atendimento marcado para hoje.'
        colunas={[
          { titulo: 'Paciente', render: (c) => c.paciente },
          { titulo: 'Horário', render: (c) => hora(c.dataHora) },
          { titulo: 'Tipo', render: (c) => c.tipo },
          { titulo: 'Status', render: (c) => <PilulaStatus estado={c.status} transicoes={transicoes(c)} /> },
          {
            titulo: 'Prontuário',
            render: (c) =>
              ['EM_ATENDIMENTO', 'FINALIZADO'].includes(c.status) ? (
                <button type='button' className='btn btn-link btn-sm p-0' onClick={() => navigate(`/medico/pacientes/${c.idPaciente}`)}>
                  Abrir
                </button>
              ) : (
                '—'
              ),
          },
        ]}
      />
      {modal}
    </Pagina>
  );
}

// A-11a e S-05b · Bloqueios de agenda. A lixeira só aparece no bloqueio que
// ainda não atingiu nenhuma consulta (A1-R09, hipótese 1).
export function Bloqueios() {
  const { sessao } = useSessao();
  const ehAdmin = sessao.usuario.papel === 'ADMINISTRADOR';
  const carregar = async () => {
    const bloqueios = await listar('bloqueiosAgenda', { _sort: 'dataInicio' });
    const pessoas = await pessoasPorId(bloqueios.map((b) => b.idMedico));
    return bloqueios.map((b) => ({ ...b, medico: b.idMedico ? nomeMedico(pessoas[b.idMedico]) : 'Toda a clínica' }));
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [modalSituacao, alternar] = useAlternarSituacao('bloqueiosAgenda', recarregar);
  const [modalExcluir, confirmar] = useConfirmacao();
  const [medico, setMedico] = React.useState('');
  const [status, setStatus] = React.useState('ATIVO');

  const excluir = async (b) => {
    const ok = await confirmar({
      titulo: 'Excluir este bloqueio?',
      texto: 'Ele ainda não atingiu nenhuma consulta. A exclusão fica registrada no log.',
      rotuloConfirmar: 'Excluir',
      perigo: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/bloqueiosAgenda/${b.id}`);
      mensagemSucesso('Bloqueio excluído.');
      recarregar();
    } catch (e) {
      mensagemErro('Não foi possível excluir agora. Tente de novo.');
    }
  };

  const nomeDoBloqueio = (b) => `bloqueio de ${b.medico} (${MOTIVO_BLOQUEIO[b.motivo] ?? b.motivo})`;
  const linhas = (dados ?? []).filter(
    (b) =>
      (!status || (status === 'ATIVO' ? b.situacao === 'ATIVO' : b.situacao !== 'ATIVO')) &&
      (!medico || String(b.idMedico ?? 'clinica') === medico)
  );
  const afetando = (dados ?? []).filter((b) => b.situacao === 'ATIVO' && b.consultasAfetadas > 0);
  const opcoes = [
    ['', 'Todos os médicos'],
    ...[...new Map((dados ?? []).map((b) => [String(b.idMedico ?? 'clinica'), b.medico])).entries()],
  ];

  return (
    <Pagina
      titulo='Bloqueios de agenda'
      acoes={
        <button type='button' className='btn btn-primary' onClick={() => emBreve('O cadastro de bloqueio')}>
          + Novo bloqueio
        </button>
      }
    >
      <Filtros>
        <CampoSelect id='bloqueioMedico' rotulo='Médico' valor={medico} aoMudar={setMedico} opcoes={opcoes} />
        <CampoSelect
          id='bloqueioStatus'
          rotulo='Status'
          valor={status}
          aoMudar={setStatus}
          opcoes={[['ATIVO', 'Ativos'], ['INATIVO', 'Inativos'], ['', 'Todos']]}
        />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhum bloqueio nesta seleção.'
        legenda='A lixeira só aparece enquanto o bloqueio não atingiu nenhuma consulta. Depois disso, inative.'
        colunas={[
          { titulo: 'Médico', render: (b) => b.medico },
          { titulo: 'Início', render: (b) => data(b.dataInicio) },
          { titulo: 'Fim', render: (b) => data(b.dataFim) },
          { titulo: 'Motivo', render: (b) => MOTIVO_BLOQUEIO[b.motivo] ?? b.motivo },
          {
            titulo: 'Status',
            render: (b) => (
              <PilulaStatus
                {...rotuloDe(SITUACAO_CADASTRO, b.situacao)}
                transicoes={[
                  b.situacao === 'ATIVO'
                    ? { rotulo: 'Inativar', aoEscolher: () => alternar(b, nomeDoBloqueio(b), 'INATIVO') }
                    : { rotulo: 'Reativar', aoEscolher: () => alternar(b, nomeDoBloqueio(b), 'ATIVO') },
                ]}
              />
            ),
          },
          {
            titulo: 'Ações',
            render: (b) => {
              const alvo = nomeDoBloqueio(b);
              if (b.situacao !== 'ATIVO')
                return (
                  <AcoesLinha
                    acoes={[
                      { tipo: 'ver', alvo, aoClicar: () => emBreve('O detalhe do bloqueio') },
                      { tipo: 'reativar', alvo, aoClicar: () => alternar(b, alvo, 'ATIVO') },
                    ]}
                  />
                );
              const base = [
                { tipo: 'editar', alvo, aoClicar: () => emBreve('A edição do bloqueio') },
                { tipo: 'inativar', alvo, aoClicar: () => alternar(b, alvo, 'INATIVO') },
              ];
              return (
                <AcoesLinha
                  acoes={
                    b.consultasAfetadas > 0
                      ? [{ tipo: 'ver', alvo, aoClicar: () => emBreve('O detalhe do bloqueio') }, ...base]
                      : [...base, { tipo: 'excluir', alvo, aoClicar: () => excluir(b) }]
                  }
                />
              );
            },
          },
        ]}
      />
      {afetando.map((b) => (
        <div key={b.id} className='alert alert-warning d-flex flex-wrap align-items-center justify-content-between gap-2 mb-0' role='status'>
          <span>
            O bloqueio de {b.medico} atinge {b.consultasAfetadas} consultas já agendadas. Trate cada uma antes de salvar.
          </span>
          <button
            type='button'
            className='btn btn-sm btn-primary'
            onClick={() => emBreve(ehAdmin ? 'O reagendamento em lote' : 'O tratamento das consultas afetadas')}
          >
            Tratar consultas afetadas
          </button>
        </div>
      ))}
      {modalSituacao}
      {modalExcluir}
    </Pagina>
  );
}

// S-04 · Reagendar ou cancelar. Lista as consultas agendadas a partir de hoje.
export function ReagendarOuCancelar() {
  const { dados, carregando, erro, recarregar } = useCarregar(() =>
    carregarConsultas({ status: 'AGENDADO', dataHora_gte: `${DATA_DE_HOJE}T00:00:00`, _sort: 'dataHora' })
  );
  const [modal, mudar] = useMudarStatus(recarregar);
  const [busca, setBusca] = React.useState('');
  const [medico, setMedico] = React.useState('');
  const [dia, setDia] = React.useState('');
  const linhas = (dados ?? []).filter(
    (c) =>
      corresponde(busca, c.paciente) &&
      (!medico || String(c.idMedico) === medico) &&
      (!dia || c.dataHora.startsWith(dia))
  );

  return (
    <Pagina titulo='Reagendar ou cancelar'>
      <Filtros>
        <CampoBusca id='reagendarBusca' rotulo='Buscar por paciente' valor={busca} aoMudar={setBusca} />
        <CampoSelect id='reagendarMedico' rotulo='Médico' valor={medico} aoMudar={setMedico} opcoes={opcoesDeMedico(dados)} />
        <div className='filtro'>
          <label htmlFor='reagendarData' className='form-label'>
            Data
          </label>
          <input id='reagendarData' type='date' className='form-control' value={dia} onChange={(e) => setDia(e.target.value)} />
        </div>
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhuma consulta agendada nesta seleção.'
        colunas={[
          { titulo: 'Paciente', render: (c) => c.paciente },
          { titulo: 'Data e hora', render: (c) => diaMesHora(c.dataHora) },
          { titulo: 'Médico', render: (c) => c.medico },
          { titulo: 'Status', render: (c) => <PilulaStatus estado={c.status} /> },
          {
            titulo: 'Ações',
            render: (c) => (
              <AcoesLinha
                acoes={[
                  { tipo: 'ver', alvo: `consulta de ${c.paciente}`, aoClicar: () => emBreve('O reagendamento') },
                  {
                    tipo: 'cancelar',
                    alvo: `consulta de ${c.paciente}`,
                    aoClicar: () =>
                      mudar(c, 'CANCELADO', {
                        titulo: `Cancelar a consulta de ${c.paciente}?`,
                        texto: 'O paciente recebe o aviso de cancelamento. A consulta fica no histórico como cancelada pela clínica.',
                        rotuloConfirmar: 'Cancelar consulta',
                        perigo: true,
                      }),
                  },
                ]}
              />
            ),
          },
        ]}
      />
      {modal}
    </Pagina>
  );
}
