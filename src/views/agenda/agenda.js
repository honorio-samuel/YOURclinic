import React from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import Pagina from '../../components/pagina';
import Modal from '../../components/modal';
import EstadoErro from '../../components/estado-erro';
import { CampoSelect } from '../../components/campos';
import { CampoSelecao, CampoTexto, useFormulario } from '../../components/formulario';
import { mensagemDeErro } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { DATA_DE_HOJE } from '../../config/axios';
import { criar, listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { prefixoDoPapel } from '../../navegacao/caminhos';
import { useSessao } from '../../sessao/sessao';
import { data as dataBR, diaMes } from '../../utils/formatos';
import { MOTIVO_BLOQUEIO } from '../../utils/rotulos';
import {
  agoraDaClinica,
  carregarConsultas,
  carregarHorarios,
  carregarMedicosAtivos,
  DIAS_DA_SEMANA,
  diaDaSemana,
  doPeriodo,
  inicioDaSemana,
  MOTIVOS_DA_CLINICA,
  nomeDoMes,
  somarDias,
  ultimoDiaDoMes,
  useMudarStatus,
} from './comum';
import { useReagendar } from './reagendar';
import { VisaoAno, VisaoDia, VisaoMes, VisaoSemana } from './agenda-visoes';

// Visões de cada papel: o Médico só vê a própria agenda, em Semana e Mês
// (M-03); a visão Ano é só do Administrador e sem nomes (A-07b).
const VISOES = {
  ADMINISTRADOR: ['dia', 'semana', 'mes', 'ano'],
  SECRETARIA: ['dia', 'semana', 'mes'],
  MEDICO: ['semana', 'mes'],
};
const ROTULO_VISAO = { dia: 'Dia', semana: 'Semana', mes: 'Mês', ano: 'Ano' };
const ANTERIOR = { dia: 'Dia anterior', semana: 'Semana anterior', mes: 'Mês anterior', ano: 'Ano anterior' };
const PROXIMO = { dia: 'Próximo dia', semana: 'Próxima semana', mes: 'Próximo mês', ano: 'Próximo ano' };

function periodo(visao, dia) {
  if (visao === 'dia') return { de: dia, ate: dia };
  if (visao === 'semana') {
    const de = inicioDaSemana(dia);
    return { de, ate: somarDias(de, 6) };
  }
  if (visao === 'mes') return { de: `${dia.slice(0, 7)}-01`, ate: ultimoDiaDoMes(dia) };
  return { de: `${dia.slice(0, 4)}-01-01`, ate: `${dia.slice(0, 4)}-12-31` };
}

function deslocar(visao, dia, sentido) {
  if (visao === 'dia') return somarDias(dia, sentido);
  if (visao === 'semana') return somarDias(dia, 7 * sentido);
  const [ano, mes] = dia.slice(0, 7).split('-').map(Number);
  if (visao === 'mes') return new Date(Date.UTC(ano, mes - 1 + sentido, 1)).toISOString().slice(0, 10);
  return `${ano + sentido}-01-01`;
}

function tituloDoPeriodo(visao, dia) {
  const { de, ate } = periodo(visao, dia);
  if (visao === 'dia') return `${DIAS_DA_SEMANA[diaDaSemana(dia)]}, ${dataBR(dia)}`;
  if (visao === 'semana') return `Semana de ${diaMes(de)} a ${dataBR(ate)}`;
  if (visao === 'mes') return `${nomeDoMes(dia)} de ${dia.slice(0, 4)}`;
  return dia.slice(0, 4);
}

// Dia e Semana mostram o nome do paciente; Mês e Ano, só contagens (A-07b, A-07d).
async function carregarAgenda({ visao, de, ate, medico, ehMedico }) {
  const comNomes = visao === 'dia' || visao === 'semana';
  const filtro = { ...doPeriodo(de, ate), ...(medico ? { idMedico: medico } : {}) };
  const [todos, grades, bloqueios, consultas] = await Promise.all([
    carregarMedicosAtivos(),
    visao === 'ano' ? [] : listar('gradesHorario'),
    listar('bloqueiosAgenda', { situacao: 'ATIVO' }),
    comNomes ? carregarConsultas(filtro) : listar('consultas', filtro),
  ]);
  const medicos = medico ? todos.filter((m) => String(m.id) === medico) : todos;
  // No mês de um médico, a recepção vê quantos horários ainda estão livres.
  let livres = null;
  if (visao === 'mes' && medico && !ehMedico && ate >= DATA_DE_HOJE) {
    const tipos = await listar('procedimentos', { situacao: 'ATIVO', _sort: 'duracaoPadrao' });
    if (tipos.length) {
      const r = await carregarHorarios({ idMedico: medico, idProcedimento: tipos[0].id, de: de < DATA_DE_HOJE ? DATA_DE_HOJE : de, ate });
      livres = Object.fromEntries(r.dias.map((d) => [d.data, d.horarios.length]));
    }
  }
  return {
    todos,
    medicos,
    grades,
    bloqueios: bloqueios.filter(
      (b) =>
        b.dataInicio.slice(0, 10) <= ate && b.dataFim.slice(0, 10) >= de && (!medico || b.idMedico === null || String(b.idMedico) === medico)
    ),
    consultas: consultas.filter((c) => c.status !== 'CANCELADO'),
    livres,
  };
}

// M-03 · O Médico registra a própria indisponibilidade (RF14). Quem trata as
// consultas atingidas é a recepção (RF20); o servidor conta quantas são.
function JanelaIndisponibilidade({ aoFechar, aoConcluir }) {
  const form = useFormulario({ dataInicio: '', dataFim: '', motivo: '' }, 'indisponibilidade-');
  const v = form.valores;
  const [salvando, setSalvando] = React.useState(false);

  const salvar = async () => {
    const ok = form.validar({
      dataInicio: v.dataInicio ? null : 'Informe o início.',
      dataFim: !v.dataFim ? 'Informe o fim.' : v.dataInicio && v.dataFim <= v.dataInicio ? 'O fim vem depois do início.' : null,
      motivo: v.motivo ? null : 'Escolha o motivo.',
    });
    if (!ok) return;
    setSalvando(true);
    try {
      const salvo = await criar('bloqueiosAgenda', { dataInicio: `${v.dataInicio}:00`, dataFim: `${v.dataFim}:00`, motivo: v.motivo });
      const n = salvo.consultasAfetadas ?? 0;
      mensagemSucesso(
        n
          ? `Indisponibilidade registrada. ${n} ${n === 1 ? 'consulta agendada fica' : 'consultas agendadas ficam'} com a recepção, que reagenda ou cancela com o paciente.`
          : 'Indisponibilidade registrada.'
      );
      aoConcluir();
    } catch (falha) {
      mensagemErro(mensagemDeErro(falha));
      setSalvando(false);
    }
  };

  return (
    <Modal
      titulo='Registrar indisponibilidade'
      aoFechar={aoFechar}
      rodape={
        <>
          <button type='button' className='btn btn-outline-secondary' onClick={aoFechar} disabled={salvando}>
            Voltar
          </button>
          <button type='button' className='btn btn-primary' onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Registrar'}
          </button>
        </>
      }
    >
      <form
        noValidate
        aria-label='Indisponibilidade'
        className='row g-3'
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <p className='col-12 mb-0'>
          A agenda fica fechada no período. Se houver consulta marcada, a recepção reagenda ou cancela com o paciente.
        </p>
        <CampoTexto {...form.campo('dataInicio')} tipo='datetime-local' rotulo='Início' largura='col-sm-6' />
        <CampoTexto {...form.campo('dataFim')} tipo='datetime-local' rotulo='Fim' largura='col-sm-6' min={v.dataInicio || undefined} />
        <CampoSelecao
          {...form.campo('motivo')}
          rotulo='Motivo'
          largura='col-12'
          opcoes={Object.entries(MOTIVO_BLOQUEIO)}
          ajuda='Lista fechada: o motivo não leva informação clínica.'
        />
      </form>
    </Modal>
  );
}

// A-07, A-07b, A-07c e A-07d (Administrador, só consulta), S-02 (Secretária,
// com reagendar e cancelar no dia) e M-03 (Médico, a própria agenda). O estado
// da tela fica no endereço: ?visao=dia&data=2026-09-28&medico=6.
function Agenda() {
  const { sessao } = useSessao();
  const papel = sessao.usuario.papel;
  const ehMedico = papel === 'MEDICO';
  const ehSecretaria = papel === 'SECRETARIA';
  const prefixo = prefixoDoPapel(papel);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const visoes = VISOES[papel];
  const visao = visoes.includes(params.get('visao')) ? params.get('visao') : visoes[0];
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(params.get('data') ?? '') ? params.get('data') : DATA_DE_HOJE;
  const medico = ehMedico ? String(sessao.usuario.idPessoa) : params.get('medico') ?? '';
  const { de, ate } = periodo(visao, dia);
  const [indisponibilidade, setIndisponibilidade] = React.useState(false);

  const { dados, carregando, erro, recarregar } = useCarregar(
    () => carregarAgenda({ visao, de, ate, medico, ehMedico }),
    [visao, de, ate, medico]
  );
  const [modalStatus, mudar] = useMudarStatus(recarregar);
  const [modalReagendar, reagendar] = useReagendar(recarregar);

  const ir = (mudancas) =>
    setParams((atual) => {
      const novos = new URLSearchParams(atual);
      Object.entries(mudancas).forEach(([k, valor]) => (valor ? novos.set(k, valor) : novos.delete(k)));
      return novos;
    });

  const aoAbrirDia = (d, idMedico) =>
    ehMedico ? ir({ visao: 'semana', data: d }) : ir({ visao: 'dia', data: d, ...(idMedico ? { medico: String(idMedico) } : {}) });

  const acoes = {
    agendar: ehMedico ? null : (idMedico, d, hora) => `${prefixo}/cadastro-agendamentos?medico=${idMedico}&data=${d}&hora=${hora}`,
    daConsulta: ehSecretaria
      ? (c) => [
          { tipo: 'reagendar', alvo: `consulta de ${c.paciente}`, aoClicar: () => reagendar(c) },
          {
            tipo: 'cancelar',
            alvo: `consulta de ${c.paciente}`,
            aoClicar: () =>
              mudar(c, 'CANCELADO', {
                titulo: `Cancelar a consulta de ${c.paciente}?`,
                texto: 'O paciente recebe o aviso de cancelamento. A consulta fica no histórico como cancelada pela clínica.',
                motivos: MOTIVOS_DA_CLINICA,
                rotuloMotivo: 'Motivo do cancelamento',
                rotuloConfirmar: 'Cancelar consulta',
                perigo: true,
              }),
          },
        ]
      : null,
  };

  const agora = agoraDaClinica();
  let conteudo = null;
  if (erro) conteudo = <EstadoErro erro={erro} aoTentarDeNovo={recarregar} />;
  else if (!dados) conteudo = <p className='text-body-secondary mb-0'>Carregando…</p>;
  else if (dados.medicos.length === 0) conteudo = <p className='mb-0'>Nenhum médico ativo para mostrar.</p>;
  else if (visao === 'dia') conteudo = <VisaoDia dia={dia} dados={dados} acoes={acoes} agora={agora} />;
  else if (visao === 'semana') conteudo = <VisaoSemana dia={dia} dados={dados} acoes={acoes} agora={agora} aoAbrirDia={aoAbrirDia} />;
  else if (visao === 'mes') conteudo = <VisaoMes dia={dia} dados={dados} aoAbrirDia={aoAbrirDia} />;
  else conteudo = <VisaoAno dia={dia} dados={dados} aoAbrirDia={aoAbrirDia} />;

  return (
    <Pagina
      titulo={ehMedico ? 'Minha agenda' : 'Agenda da clínica'}
      acoes={
        ehMedico ? (
          <button type='button' className='btn btn-primary' onClick={() => setIndisponibilidade(true)}>
            Registrar indisponibilidade
          </button>
        ) : (
          <button type='button' className='btn btn-primary' onClick={() => navigate(`${prefixo}/cadastro-agendamentos`)}>
            + Novo agendamento
          </button>
        )
      }
    >
      <div className='d-flex flex-wrap align-items-end gap-3'>
        <div>
          <span className='form-label d-block' id='agendaRotuloVisao'>
            Visão
          </span>
          <div className='btn-group' role='group' aria-labelledby='agendaRotuloVisao'>
            {visoes.map((v) => (
              <button
                key={v}
                type='button'
                className={`btn ${v === visao ? 'btn-primary' : 'btn-outline-primary'}`}
                aria-pressed={v === visao}
                onClick={() => ir({ visao: v })}
              >
                {ROTULO_VISAO[v]}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className='form-label d-block' id='agendaRotuloPeriodo'>
            Período
          </span>
          <div className='btn-group' role='group' aria-labelledby='agendaRotuloPeriodo'>
            <button type='button' className='btn btn-outline-secondary' aria-label={ANTERIOR[visao]} title={ANTERIOR[visao]} onClick={() => ir({ data: deslocar(visao, dia, -1) })}>
              <ChevronLeftIcon fontSize='small' aria-hidden='true' />
            </button>
            <button type='button' className='btn btn-outline-secondary' onClick={() => ir({ data: DATA_DE_HOJE })}>
              Hoje
            </button>
            <button type='button' className='btn btn-outline-secondary' aria-label={PROXIMO[visao]} title={PROXIMO[visao]} onClick={() => ir({ data: deslocar(visao, dia, 1) })}>
              <ChevronRightIcon fontSize='small' aria-hidden='true' />
            </button>
          </div>
        </div>
        {!ehMedico && (
          <CampoSelect
            id='agendaMedico'
            rotulo='Médico'
            valor={medico}
            aoMudar={(m) => ir({ medico: m })}
            opcoes={[['', 'Todos os médicos'], ...(dados?.todos ?? []).map((m) => [String(m.id), m.nome])]}
          />
        )}
        <div className='filtro'>
          <label htmlFor='agendaData' className='form-label'>
            Ir para a data
          </label>
          <input
            id='agendaData'
            type='date'
            className='form-control'
            value={dia}
            onChange={(e) => e.target.value && ir({ data: e.target.value })}
          />
        </div>
      </div>
      <h2 className='h5 mb-0' aria-live='polite'>
        {tituloDoPeriodo(visao, dia)}
        {carregando && dados && <span className='small fw-normal text-body-secondary'> · atualizando…</span>}
      </h2>
      {conteudo}
      {indisponibilidade && (
        <JanelaIndisponibilidade
          aoFechar={() => setIndisponibilidade(false)}
          aoConcluir={() => {
            setIndisponibilidade(false);
            recarregar();
          }}
        />
      )}
      {modalStatus}
      {modalReagendar}
    </Pagina>
  );
}

export default Agenda;
