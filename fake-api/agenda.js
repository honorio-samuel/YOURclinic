'use strict';

// Regras de agenda da API simulada: grade de horários (RF13), bloqueios
// (RF14), horários livres (RF16) e conflitos (RF18). São funções puras sobre o
// banco. Datas e horas são texto local "AAAA-MM-DDTHH:MM:SS", como no resto da
// API; as contas de intervalo tratam esse texto como UTC, só para somar minutos.

const igual = (a, b) => a != null && b != null && String(a) === String(b);

// RN-18.1: Cancelado e Não Compareceu não ocupam horário.
const ativa = (consulta) => !['CANCELADO', 'NAO_COMPARECEU'].includes(consulta.status);

// Consultas que um bloqueio ou uma grade menor atingem: as que ainda vão acontecer.
const POR_ACONTECER = ['AGENDADO', 'NA_RECEPCAO'];

const NOMES_DOS_DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

const paraMinutos = (hora) => {
  const [h, m] = hora.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};
const paraHora = (minutos) => `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`;

// Minutos desde 1970 de um texto de data e hora, para comparar intervalos.
const emMinutos = (texto) => Date.parse(`${texto.length === 16 ? `${texto}:00` : texto}Z`) / 60000;
const sobrepoe = (a, b) => a.inicio < b.fim && b.inicio < a.fim;

// 0 = domingo, como em Date.getDay e no campo diaSemana da grade.
const diaDaSemana = (data) => new Date(`${data}T12:00:00Z`).getUTCDay();

function somarDias(data, dias) {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const intervaloDaConsulta = (c) => {
  const inicio = emMinutos(c.dataHora);
  return { inicio, fim: inicio + (c.duracao || 30) };
};
const intervaloDoBloqueio = (b) => ({ inicio: emMinutos(b.dataInicio), fim: emMinutos(b.dataFim) });

// Bloqueios em vigor que valem para o médico: os dele e os da clínica inteira.
const bloqueiosDoMedico = (db, idMedico) =>
  db.bloqueiosAgenda.filter((b) => b.situacao === 'ATIVO' && (b.idMedico == null || igual(b.idMedico, idMedico)));

// Períodos da grade do médico no dia da semana da data, em ordem.
function periodosDoDia(db, idMedico, data) {
  const dia = diaDaSemana(data);
  return db.gradesHorario
    .filter((g) => igual(g.idMedico, idMedico) && g.diaSemana === dia)
    .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
}

// RF16, passo 2: horários de início livres para um atendimento da duração
// dada, já sem bloqueios e sem consultas ativas do médico. Um horário só é
// oferecido se o atendimento inteiro cabe no período da grade (E2).
function horariosLivres(db, { idMedico, data, duracao, aPartirDe = null, ignorarId = null }) {
  const ocupados = [
    ...bloqueiosDoMedico(db, idMedico).map(intervaloDoBloqueio),
    ...db.consultas
      .filter((c) => igual(c.idMedico, idMedico) && ativa(c) && !igual(c.id, ignorarId) && c.dataHora.startsWith(data))
      .map(intervaloDaConsulta),
  ];
  const livres = [];
  for (const periodo of periodosDoDia(db, idMedico, data)) {
    const passo = periodo.granularidade || 30;
    const fimDoPeriodo = paraMinutos(periodo.horaFim);
    for (let m = paraMinutos(periodo.horaInicio); m + duracao <= fimDoPeriodo; m += passo) {
      const dataHora = `${data}T${paraHora(m)}:00`;
      if (aPartirDe && dataHora < aPartirDe) continue;
      const inicio = emMinutos(dataHora);
      if (ocupados.some((o) => sobrepoe({ inicio, fim: inicio + duracao }, o))) continue;
      livres.push(paraHora(m));
    }
  }
  return livres;
}

// RF16 e RF18: confere o horário de uma consulta nova ou remarcada. A
// mensagem não diz quem ocupa o horário nem por que ele está bloqueado.
function conferirHorario(db, consulta, { agora, ignorarId = null }) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(consulta.dataHora ?? '')) return 'Escolha o dia e o horário.';
  if (consulta.dataHora < agora) return 'Escolha um horário a partir de agora.';
  const data = consulta.dataHora.slice(0, 10);
  const inicio = paraMinutos(consulta.dataHora.slice(11, 16));
  const fim = inicio + (consulta.duracao || 30);
  const alvo = intervaloDaConsulta(consulta);
  const naGrade = periodosDoDia(db, consulta.idMedico, data).some(
    (p) => inicio >= paraMinutos(p.horaInicio) && fim <= paraMinutos(p.horaFim)
  );
  if (!naGrade || bloqueiosDoMedico(db, consulta.idMedico).some((b) => sobrepoe(alvo, intervaloDoBloqueio(b)))) {
    return 'Este horário não está disponível na agenda do médico.';
  }
  const outras = db.consultas.filter((c) => !igual(c.id, ignorarId) && ativa(c));
  if (outras.some((c) => igual(c.idMedico, consulta.idMedico) && sobrepoe(alvo, intervaloDaConsulta(c)))) {
    return 'Este horário acabou de ser preenchido. Escolha outro.';
  }
  if (outras.some((c) => igual(c.idPaciente, consulta.idPaciente) && sobrepoe(alvo, intervaloDaConsulta(c)))) {
    return 'O paciente já tem consulta neste horário.';
  }
  return null;
}

// RF14: consultas ainda por acontecer que caem no período do bloqueio.
function afetadasPeloBloqueio(db, bloqueio) {
  const periodo = intervaloDoBloqueio(bloqueio);
  return db.consultas.filter(
    (c) =>
      POR_ACONTECER.includes(c.status) &&
      (bloqueio.idMedico == null || igual(c.idMedico, bloqueio.idMedico)) &&
      sobrepoe(intervaloDaConsulta(c), periodo)
  );
}

// RN-13.2: consultas futuras do médico que deixariam de caber na grade nova.
function foraDaGrade(db, idMedico, periodos, desde) {
  return db.consultas.filter((c) => {
    if (!igual(c.idMedico, idMedico) || !POR_ACONTECER.includes(c.status) || c.dataHora < desde) return false;
    const dia = diaDaSemana(c.dataHora.slice(0, 10));
    const inicio = paraMinutos(c.dataHora.slice(11, 16));
    const fim = inicio + (c.duracao || 30);
    return !periodos.some((p) => p.diaSemana === dia && inicio >= paraMinutos(p.horaInicio) && fim <= paraMinutos(p.horaFim));
  });
}

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;

// A-10 e S-05a: a grade inteira de um médico. A granularidade é o X11.
function validarGrade(corpo) {
  const { granularidade, periodos } = corpo ?? {};
  if (!Number.isInteger(granularidade) || granularidade < 5 || granularidade > 120) {
    return 'A duração de cada horário vai de 5 a 120 minutos.';
  }
  if (!Array.isArray(periodos)) return 'Informe os períodos da grade.';
  for (const p of periodos) {
    if (!Number.isInteger(p?.diaSemana) || p.diaSemana < 0 || p.diaSemana > 6) return 'Dia da semana inválido.';
    if (!HORA.test(p.horaInicio ?? '') || !HORA.test(p.horaFim ?? '')) return 'Informe o início e o fim de cada período.';
    if (paraMinutos(p.horaFim) - paraMinutos(p.horaInicio) < granularidade) {
      return `O período de ${NOMES_DOS_DIAS[p.diaSemana]} termina antes de caber um horário.`;
    }
  }
  for (let dia = 0; dia < 7; dia += 1) {
    const doDia = periodos.filter((p) => p.diaSemana === dia).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    if (doDia.some((p, i) => i > 0 && p.horaInicio < doDia[i - 1].horaFim)) return `Os períodos de ${NOMES_DOS_DIAS[dia]} se sobrepõem.`;
  }
  return null;
}

// Horas entre dois textos de data e hora (positivo quando "ate" vem depois).
const horasEntre = (de, ate) => (emMinutos(ate) - emMinutos(de)) / 60;

module.exports = {
  ativa,
  POR_ACONTECER,
  somarDias,
  horariosLivres,
  conferirHorario,
  afetadasPeloBloqueio,
  foraDaGrade,
  validarGrade,
  horasEntre,
};
