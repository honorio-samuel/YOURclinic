'use strict';

// Agenda: horários livres, agendamento, conflitos, cancelamento pelo portal,
// remarcação, grade e tratamento em lote (RF13, RF14, RF16 a RF20).

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { gerarBanco } = require('../seed');
const { criarApi } = require('../servidor');
const { afetadasPeloBloqueio } = require('../agenda');
const contas = require('../usuarios-de-teste.json');

const BANCO = gerarBanco();
const SENHA = contas.senhaDemonstracao;

// Relógio parado em 28/09/2026, 10h, o "hoje" dos dados simulados.
const DEZ_HORAS = () => new Date(2026, 8, 28, 10, 0, 0);

async function subir() {
  const db = structuredClone(BANCO);
  const servidor = http.createServer(criarApi({ db, relogio: DEZ_HORAS }));
  await new Promise((pronto) => servidor.listen(0, '127.0.0.1', pronto));
  const { port } = servidor.address();

  async function pedir(metodo, caminho, { token, corpo } = {}) {
    const res = await fetch(`http://127.0.0.1:${port}${caminho}`, {
      method: metodo,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const texto = await res.text();
    return { status: res.status, corpo: texto ? JSON.parse(texto) : null };
  }

  async function entrar(login) {
    const r = await pedir('POST', '/login', { corpo: { login, senha: SENHA } });
    assert.equal(r.status, 200, `login de ${login} falhou`);
    return r.corpo.token;
  }

  return { db, pedir, entrar, fechar: () => new Promise((fim) => servidor.close(fim)) };
}

const pessoaDe = (db, login) => db.usuarios.find((u) => u.login === login).idPessoa;
const horarios = (api, token, consulta) =>
  api.pedir('GET', `/agenda/horarios?${new URLSearchParams(consulta)}`, { token });

// Primeiro horário livre que a própria API oferece, como texto de data e hora.
async function primeiroLivre(api, token, { idMedico, data, idProcedimento = 1, idConsulta, depoisDe = '00:00' }) {
  const consulta = { idMedico, idProcedimento, de: data, ate: data, ...(idConsulta ? { idConsulta } : {}) };
  const r = await horarios(api, token, consulta);
  const hora = r.corpo.dias[0].horarios.find((h) => h >= depoisDe);
  assert.ok(hora, `sem horário livre para o médico ${idMedico} em ${data}`);
  return `${data}T${hora}:00`;
}

describe('horários livres (RF16, RF13)', () => {
  let api;
  before(async () => {
    api = await subir();
  });
  after(() => api.fechar());

  test('saem da grade, sem consultas ativas, sem bloqueios e sem horário passado', async () => {
    const token = await api.entrar('paciente');
    const quarta = await horarios(api, token, { idMedico: 9, idProcedimento: 1, de: '2026-09-30', ate: '2026-09-30' });
    assert.equal(quarta.status, 200);
    assert.equal(quarta.corpo.duracao, 30);
    assert.deepEqual(quarta.corpo.dias[0].horarios.slice(0, 2), ['08:00', '08:30']);

    // Médico 6 hoje: as consultas ativas não aparecem, e nada antes das 10h.
    const hoje = await horarios(api, token, { idMedico: 6, idProcedimento: 1 });
    const livres = hoje.corpo.dias[0].horarios;
    assert.ok(livres.every((h) => h >= '10:00'));
    const ocupadas = api.db.consultas
      .filter((c) => c.idMedico === 6 && c.dataHora.startsWith('2026-09-28') && !['CANCELADO', 'NAO_COMPARECEU'].includes(c.status))
      .map((c) => c.dataHora.slice(11, 16));
    assert.ok(ocupadas.every((h) => !livres.includes(h)));

    // Férias do médico 8 (5 a 9/10), feriado da clínica (12/10) e sábado.
    const ferias = await horarios(api, token, { idMedico: 8, idProcedimento: 1, de: '2026-10-06', ate: '2026-10-06' });
    assert.deepEqual(ferias.corpo.dias[0].horarios, []);
    const feriado = await horarios(api, token, { idMedico: 9, idProcedimento: 1, de: '2026-10-12', ate: '2026-10-12' });
    assert.deepEqual(feriado.corpo.dias[0].horarios, []);
    const sabado = await horarios(api, token, { idMedico: 9, idProcedimento: 1, de: '2026-10-03', ate: '2026-10-03' });
    assert.deepEqual(sabado.corpo.dias[0].horarios, []);
  });

  test('o atendimento longo só aparece onde cabe inteiro', async () => {
    const token = await api.entrar('secretaria');
    const longo = await horarios(api, token, { idMedico: 9, idProcedimento: 5, de: '2026-09-30', ate: '2026-09-30' });
    assert.equal(longo.corpo.duracao, 60);
    assert.ok(!longo.corpo.dias[0].horarios.includes('11:30'), '11h30 + 60 min passa do fim do período');
    assert.ok(longo.corpo.dias[0].horarios.includes('11:00'));
  });

  test('o Médico não consulta horários para agendar (RF16)', async () => {
    const token = await api.entrar('medico');
    assert.equal((await horarios(api, token, { idMedico: 6, idProcedimento: 1 })).status, 403);
  });
});

describe('agendamento (RF16 a RF18)', () => {
  let api;
  before(async () => {
    api = await subir();
  });
  after(() => api.fechar());

  test('o portal agenda: duração do procedimento, preço guardado sem aparecer, vínculo pendente e aviso', async () => {
    const token = await api.entrar('paciente');
    const eu = pessoaDe(api.db, 'paciente');
    const r = await api.pedir('POST', '/consultas', {
      token,
      corpo: { idMedico: 9, idProcedimento: 5, dataHora: '2026-09-30T08:00:00', valorReferencia: 1, duracao: 5 },
    });
    assert.equal(r.status, 201, r.corpo?.erro);
    assert.equal(r.corpo.duracao, 60);
    assert.equal(r.corpo.canalOrigem, 'PORTAL');
    assert.equal(r.corpo.valorReferencia, undefined, 'o preço não vai ao titular (RC06)');
    const noBanco = api.db.consultas.find((c) => c.id === r.corpo.id);
    assert.equal(noBanco.valorReferencia, api.db.procedimentos.find((p) => p.id === 5).precoParticular);
    const vinculo = api.db.vinculos.find((v) => v.idPaciente === eu && v.idMedico === 9);
    assert.ok(['PENDENTE', 'ATIVO', 'HISTORICO'].includes(vinculo.estado));
    const aviso = api.db.notificacoes.find((n) => n.idConsulta === r.corpo.id);
    assert.equal(aviso.evento, 'CONFIRMACAO_AGENDAMENTO');
  });

  test('o horário ocupado, inteiro ou em parte, é recusado com a mensagem do E1 (RF18)', async () => {
    const token = await api.entrar('secretaria');
    const outro = api.db.pacientes.find((p) => p.situacao === 'ATIVO' && p.id !== pessoaDe(api.db, 'paciente'));
    const mesmo = await api.pedir('POST', '/consultas', {
      token,
      corpo: { idPaciente: outro.id, idMedico: 9, idProcedimento: 1, dataHora: '2026-09-30T08:30:00', status: 'AGENDADO' },
    });
    assert.equal(mesmo.status, 422);
    assert.equal(mesmo.corpo.erro, 'Este horário acabou de ser preenchido. Escolha outro.');
  });

  test('o mesmo paciente não fica em dois lugares ao mesmo tempo', async () => {
    const token = await api.entrar('secretaria');
    const eu = pessoaDe(api.db, 'paciente');
    const r = await api.pedir('POST', '/consultas', {
      token,
      corpo: { idPaciente: eu, idMedico: 6, idProcedimento: 1, dataHora: '2026-09-30T08:30:00', status: 'AGENDADO' },
    });
    assert.equal(r.status, 422);
    assert.equal(r.corpo.erro, 'O paciente já tem consulta neste horário.');
  });

  test('horário passado, fora da grade ou bloqueado não é aceito', async () => {
    const token = await api.entrar('secretaria');
    const paciente = api.db.pacientes.find((p) => p.situacao === 'ATIVO' && p.id > 20);
    const tentar = (idMedico, dataHora) =>
      api.pedir('POST', '/consultas', { token, corpo: { idPaciente: paciente.id, idMedico, idProcedimento: 1, dataHora, status: 'AGENDADO' } });
    assert.equal((await tentar(9, '2026-09-28T08:00:00')).corpo.erro, 'Escolha um horário a partir de agora.');
    assert.equal((await tentar(9, '2026-10-03T09:00:00')).corpo.erro, 'Este horário não está disponível na agenda do médico.');
    assert.equal((await tentar(8, '2026-10-06T09:00:00')).corpo.erro, 'Este horário não está disponível na agenda do médico.');
  });

  test('convênio exige a carteirinha e nasce a conferir (RF17)', async () => {
    const token = await api.entrar('secretaria');
    const paciente = api.db.pacientes.find((p) => p.situacao === 'ATIVO' && p.id > 21);
    const dataHora = await primeiroLivre(api, token, { idMedico: 10, data: '2026-10-01' });
    const corpo = { idPaciente: paciente.id, idMedico: 10, idProcedimento: 1, dataHora, status: 'AGENDADO', idConvenio: 1 };
    const sem = await api.pedir('POST', '/consultas', { token, corpo });
    assert.equal(sem.corpo.erro, 'Informe o número da carteirinha.');
    const com = await api.pedir('POST', '/consultas', { token, corpo: { ...corpo, numeroCarteirinha: '0012 3456 7890' } });
    assert.equal(com.status, 201, com.corpo?.erro);
    assert.equal(com.corpo.convenioConferido, false);
  });
});

describe('cancelamento e remarcação (RF19, RF20)', () => {
  let api;
  before(async () => {
    api = await subir();
  });
  after(() => api.fechar());

  test('pelo portal, só até X08 horas antes', async () => {
    const secretaria = await api.entrar('secretaria');
    const eu = pessoaDe(api.db, 'paciente');
    const dataHora = await primeiroLivre(api, secretaria, { idMedico: 9, data: '2026-09-28', depoisDe: '14:00' });
    const hoje = await api.pedir('POST', '/consultas', {
      token: secretaria,
      corpo: { idPaciente: eu, idMedico: 9, idProcedimento: 1, dataHora, status: 'AGENDADO' },
    });
    assert.equal(hoje.status, 201, hoje.corpo?.erro);
    const paciente = await api.entrar('paciente');
    const tarde = await api.pedir('PATCH', `/consultas/${hoje.corpo.id}`, { token: paciente, corpo: { status: 'CANCELADO' } });
    assert.equal(tarde.status, 422);
    assert.match(tarde.corpo.erro, /até 24 horas antes/);
  });

  test('remarcar exige motivo, avisa o paciente e não troca de especialidade', async () => {
    const token = await api.entrar('secretaria');
    const consulta = api.db.consultas.find((c) => c.idMedico === 6 && c.status === 'AGENDADO' && c.dataHora >= '2026-10-01');
    const nova = await primeiroLivre(api, token, { idMedico: 6, data: '2026-10-07', idConsulta: consulta.id });
    const sem = await api.pedir('PATCH', `/consultas/${consulta.id}`, { token, corpo: { dataHora: nova } });
    assert.equal(sem.corpo.erro, 'Informe o motivo da remarcação.');
    const outraEspecialidade = await api.pedir('PATCH', `/consultas/${consulta.id}`, {
      token,
      corpo: { idMedico: 9, motivoRemarcacao: 'Pedido do paciente' },
    });
    assert.equal(outraEspecialidade.corpo.erro, 'Remarque com um médico da mesma especialidade.');
    const com = await api.pedir('PATCH', `/consultas/${consulta.id}`, {
      token,
      corpo: { dataHora: nova, motivoRemarcacao: 'Pedido do paciente' },
    });
    assert.equal(com.status, 200, com.corpo?.erro);
    assert.equal(api.db.notificacoes.at(-1).evento, 'REMARCACAO_CONSULTA');
  });
});

describe('grade de horários (RF13)', () => {
  let api;
  before(async () => {
    api = await subir();
  });
  after(() => api.fechar());

  const gradeDe = (db, idMedico) =>
    db.gradesHorario.filter((g) => g.idMedico === idMedico).map(({ diaSemana, horaInicio, horaFim }) => ({ diaSemana, horaInicio, horaFim }));

  test('reduzir sobre consulta agendada espera o reagendamento (RN-13.2)', async () => {
    const token = await api.entrar('admin');
    const semTerca = gradeDe(api.db, 6).filter((p) => p.diaSemana !== 2);
    const r = await api.pedir('PUT', '/agenda/grade/6', { token, corpo: { granularidade: 30, periodos: semTerca } });
    assert.equal(r.status, 409);
    assert.match(r.corpo.erro, /fora da nova grade/);
  });

  test('a grade inteira é trocada de uma vez, com conferência dos períodos', async () => {
    const token = await api.entrar('secretaria');
    const atual = gradeDe(api.db, 9);
    const sobreposta = await api.pedir('PUT', '/agenda/grade/9', {
      token,
      corpo: { granularidade: 30, periodos: [...atual, { diaSemana: 1, horaInicio: '11:00', horaFim: '13:00' }] },
    });
    assert.equal(sobreposta.corpo.erro, 'Os períodos de segunda-feira se sobrepõem.');
    const curta = await api.pedir('PUT', '/agenda/grade/9', { token, corpo: { granularidade: 2, periodos: atual } });
    assert.equal(curta.status, 422);
    const comSabado = await api.pedir('PUT', '/agenda/grade/9', {
      token,
      corpo: { granularidade: 30, periodos: [...atual, { diaSemana: 6, horaInicio: '08:00', horaFim: '12:00' }] },
    });
    assert.equal(comSabado.status, 200, comSabado.corpo?.erro);
    assert.equal(gradeDe(api.db, 9).length, atual.length + 1);
    const paciente = await api.entrar('paciente');
    const sabado = await horarios(api, paciente, { idMedico: 9, idProcedimento: 1, de: '2026-10-03', ate: '2026-10-03' });
    assert.equal(sabado.corpo.dias[0].horarios[0], '08:00');
  });

  test('o Médico não muda a grade', async () => {
    const token = await api.entrar('medico');
    assert.equal((await api.pedir('PUT', '/agenda/grade/6', { token, corpo: { granularidade: 30, periodos: [] } })).status, 403);
  });
});

describe('bloqueios e tratamento em lote (RF14, RF20)', () => {
  let api;
  before(async () => {
    api = await subir();
  });
  after(() => api.fechar());

  test('o lote é tudo ou nada (A4-R09)', async () => {
    const token = await api.entrar('secretaria');
    const bloqueio = api.db.bloqueiosAgenda.find((b) => b.id === 2);
    const [primeira, segunda] = afetadasPeloBloqueio(api.db, bloqueio);
    const antes = structuredClone([primeira, segunda]);
    const ruim = await api.pedir('POST', '/agenda/lote', {
      token,
      corpo: {
        idBloqueio: 2,
        motivo: 'Férias do médico',
        acoes: [
          { idConsulta: primeira.id, acao: 'REAGENDAR', dataHora: '2026-10-13T08:00:00' },
          { idConsulta: segunda.id, acao: 'REAGENDAR', dataHora: '2026-10-07T08:00:00' },
        ],
      },
    });
    assert.equal(ruim.status, 422);
    assert.deepEqual([primeira, segunda].map((c) => api.db.consultas.find((x) => x.id === c.id)), antes, 'nada mudou');

    const bom = await api.pedir('POST', '/agenda/lote', {
      token,
      corpo: {
        idBloqueio: 2,
        motivo: 'Férias do médico',
        acoes: [
          { idConsulta: primeira.id, acao: 'REAGENDAR', dataHora: '2026-10-13T08:00:00' },
          { idConsulta: segunda.id, acao: 'CANCELAR' },
        ],
      },
    });
    assert.equal(bom.status, 200, bom.corpo?.erro);
    assert.equal(bom.corpo.tratadas, 2);
    assert.equal(api.db.consultas.find((c) => c.id === primeira.id).dataHora, '2026-10-13T08:00:00');
    assert.equal(api.db.consultas.find((c) => c.id === segunda.id).status, 'CANCELADO');
    assert.equal(bloqueio.consultasAfetadas, 0);
    const avisos = api.db.notificacoes.filter((n) => [primeira.id, segunda.id].includes(n.idConsulta)).map((n) => n.evento);
    assert.ok(avisos.includes('REMARCACAO_CONSULTA') && avisos.includes('CANCELAMENTO_CONSULTA'));
  });

  test('o Médico registra a própria indisponibilidade, e o servidor conta as consultas atingidas (M-03)', async () => {
    const token = await api.entrar('medico');
    const eu = pessoaDe(api.db, 'medico');
    const r = await api.pedir('POST', '/bloqueiosAgenda', {
      token,
      corpo: { idMedico: 9, dataInicio: '2026-10-06T00:00:00', dataFim: '2026-10-06T23:59:59', motivo: 'CONGRESSO', consultasAfetadas: 0 },
    });
    assert.equal(r.status, 201, r.corpo?.erro);
    assert.equal(r.corpo.idMedico, eu);
    assert.equal(r.corpo.situacao, 'ATIVO');
    const esperadas = api.db.consultas.filter(
      (c) => c.idMedico === eu && c.dataHora.startsWith('2026-10-06') && ['AGENDADO', 'NA_RECEPCAO'].includes(c.status)
    ).length;
    assert.ok(esperadas > 0);
    assert.equal(r.corpo.consultasAfetadas, esperadas);
    const semMotivo = await api.pedir('POST', '/bloqueiosAgenda', {
      token,
      corpo: { dataInicio: '2026-10-20T00:00:00', dataFim: '2026-10-20T23:59:59', motivo: 'DOENCA' },
    });
    assert.equal(semMotivo.status, 422);
  });
});
