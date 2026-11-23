import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { api, DATA_DE_HOJE } from '../../config/axios';
import { atualizar, listar, pessoasPorId, porId } from '../../servicos/dados';
import { nomeMedico } from '../../utils/formatos';
import { STATUS_CONSULTA } from '../../utils/rotulos';

// Partes usadas por mais de uma tela desta pasta.

export const doDia = (dia) => ({ dataHora_gte: `${dia}T00:00:00`, dataHora_lte: `${dia}T23:59:59`, _sort: 'dataHora' });
export const doPeriodo = (de, ate) => ({ dataHora_gte: `${de}T00:00:00`, dataHora_lte: `${ate}T23:59:59`, _sort: 'dataHora' });

// RF20: motivo de lista fechada, com campo livre em "Outro".
export const MOTIVOS_DA_CLINICA = [
  'Pedido do paciente',
  'Indisponibilidade do médico',
  'Bloqueio de agenda',
  'Ajuste da agenda da clínica',
  'Outro',
];

// Recusas do servidor ligadas ao horário escolhido (RF18): a tela avisa sem
// dizer quem ocupou o horário e relê os horários livres.
export const ERROS_DE_HORARIO = [
  'Este horário acabou de ser preenchido. Escolha outro.',
  'Este horário não está disponível na agenda do médico.',
  'Escolha um horário a partir de agora.',
  'O paciente já tem consulta neste horário.',
];

// "Agora" das regras de agenda: o dia de referência dos dados simulados com a
// hora do relógio, como na API ("AAAA-MM-DDTHH:mm").
export const agoraDaClinica = () => `${DATA_DE_HOJE}T${new Date().toTimeString().slice(0, 5)}`;

// Datas como texto "AAAA-MM-DD", sem fuso: as contas usam UTC só para somar dias.
const comoData = (dia) => new Date(`${dia}T12:00:00Z`);
export const somarDias = (dia, n) => {
  const d = comoData(dia);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
// 0 = domingo, como na grade de horários.
export const diaDaSemana = (dia) => comoData(dia).getUTCDay();
export const inicioDaSemana = (dia) => somarDias(dia, -diaDaSemana(dia));
export const DIAS_DA_SEMANA = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
export const DIAS_CURTOS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const formatoMes = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' });
export const nomeDoMes = (dia) => {
  const nome = formatoMes.format(comoData(dia));
  return nome[0].toUpperCase() + nome.slice(1);
};
export const ultimoDiaDoMes = (dia) => {
  const d = comoData(dia);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
};
export const minutosDe = (hora) => {
  const [h, m] = hora.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};
export const horaDe = (minutos) => `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;

// Horários livres de um médico para um tipo de atendimento, dia a dia (RF16).
// Na remarcação, idConsulta faz a própria consulta não ocupar o seu horário.
export async function carregarHorarios({ idMedico, idProcedimento, de, ate = de, idConsulta }) {
  const { data } = await api.get('/agenda/horarios', {
    params: { idMedico, idProcedimento, de, ate, ...(idConsulta ? { idConsulta } : {}) },
  });
  return data;
}

// Médicos ativos com nome e especialidade, em ordem de nome (sem o "Dr.").
export async function carregarMedicosAtivos() {
  const medicos = (await listar('medicos')).filter((m) => m.situacao === 'ATIVO');
  const pessoas = await pessoasPorId(medicos.map((m) => m.id));
  return medicos
    .map((m) => ({ id: m.id, especialidade: m.especialidade, nome: nomeMedico(pessoas[m.id]), ordem: pessoas[m.id]?.nome ?? '' }))
    .sort((a, b) => a.ordem.localeCompare(b.ordem, 'pt-BR'));
}

// Consultas com nomes de paciente e médico, tipo de atendimento e convênio.
export async function carregarConsultas(params) {
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

export function opcoesDeMedico(consultas) {
  const mapa = new Map((consultas ?? []).map((c) => [String(c.idMedico), c.medico]));
  return [['', 'Todos os médicos'], ...[...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))];
}

// Muda o status da consulta. O servidor confere se a transição é permitida ao papel.
export function useMudarStatus(recarregar) {
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
