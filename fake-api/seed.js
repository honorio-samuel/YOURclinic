'use strict';

// Gera o banco sintético da API simulada. Nenhum valor vem da API do Render
// nem dos repositórios fakeJson: os nomes saem das listas abaixo, os CPFs têm
// dígito verificador errado de propósito, os telefones são 90000-NNNN e os
// e-mails usam o domínio reservado .test. O sorteio usa semente fixa, então
// o mesmo comando gera sempre os mesmos dados (só o sal das senhas muda).
//
// Uso: node seed.js [--data AAAA-MM-DD] [--saida caminho/db.json]

const fs = require('node:fs');
const path = require('node:path');

const { COLECOES, ADMINISTRADOR, MEDICO, SECRETARIA, PACIENTE, RESPONSAVEL_LEGAL } = require('./permissoes');
const { gerarHash } = require('./sessao');

// O app trata 28/09/2026 como "hoje" (src/config/axios.js).
const DATA_PADRAO = '2026-09-28';
const SEMENTE = 20260928;

const NOMES = {
  F: ['Ana', 'Beatriz', 'Camila', 'Daniela', 'Eduarda', 'Fernanda', 'Gabriela', 'Helena', 'Isabela',
    'Juliana', 'Larissa', 'Mariana', 'Natália', 'Patrícia', 'Renata', 'Sofia', 'Tatiana', 'Vanessa'],
  M: ['André', 'Bruno', 'Carlos', 'Diego', 'Eduardo', 'Felipe', 'Gustavo', 'Henrique', 'Igor', 'João',
    'Leonardo', 'Marcelo', 'Nicolas', 'Otávio', 'Paulo', 'Rafael', 'Sérgio', 'Tiago'],
};
const SOBRENOMES = ['Almeida', 'Barros', 'Cardoso', 'Dias', 'Esteves', 'Freitas', 'Gomes', 'Lima', 'Macedo',
  'Nogueira', 'Oliveira', 'Pereira', 'Queiroz', 'Ramos', 'Souza', 'Teixeira', 'Vieira'];

const ESPECIALIDADES = ['Clínica Médica', 'Pediatria', 'Cardiologia', 'Dermatologia', 'Ortopedia', 'Ginecologia'];

const OBSERVACOES = [
  'Prefere ser contatado por WhatsApp.',
  'Precisa de acesso para cadeira de rodas.',
  'Chega sempre acompanhado de um familiar.',
  'Pediu lembrete por e-mail na véspera.',
  'Prefere horários no início da manhã.',
];

const ATENDIMENTOS = [
  { queixas: 'Dor de cabeça há três dias, sem febre.', exameFisico: 'Bom estado geral; pressão 120/80 mmHg.', diagnostico: 'Cefaleia tensional', cid: 'G44.2', conduta: 'Analgésico se necessário; retorno se piorar.' },
  { queixas: 'Tosse seca há uma semana.', exameFisico: 'Ausculta pulmonar sem ruídos adventícios.', diagnostico: 'Infecção de vias aéreas superiores', cid: 'J06.9', conduta: 'Hidratação e sintomáticos.' },
  { queixas: 'Dor lombar após esforço físico.', exameFisico: 'Dor à palpação paravertebral, sem déficit neurológico.', diagnostico: 'Lombalgia', cid: 'M54.5', conduta: 'Anti-inflamatório por cinco dias e alongamento.' },
  { queixas: 'Consulta de rotina.', exameFisico: 'Exame físico sem alterações.', diagnostico: 'Exame médico geral', cid: 'Z00.0', conduta: 'Exames laboratoriais de rotina.' },
  { queixas: 'Lesão de pele com coceira no antebraço.', exameFisico: 'Placa eritematosa de 2 cm.', diagnostico: 'Dermatite de contato', cid: 'L25.9', conduta: 'Corticoide tópico por sete dias.' },
  { queixas: 'Palpitações ocasionais.', exameFisico: 'Ritmo cardíaco regular; sem sopros.', diagnostico: 'Palpitações', cid: 'R00.2', conduta: 'Eletrocardiograma e retorno com o resultado.' },
  { queixas: 'Febre e dor de garganta.', exameFisico: 'Hiperemia de orofaringe.', diagnostico: 'Faringite aguda', cid: 'J02.9', conduta: 'Sintomáticos e hidratação.' },
];

const MEDICAMENTOS = [
  { medicamento: 'Paracetamol', concentracao: '500 mg', posologia: '1 comprimido a cada 6 horas, se dor', quantidade: 20, classificacao: 'COMUM' },
  { medicamento: 'Ibuprofeno', concentracao: '400 mg', posologia: '1 comprimido a cada 8 horas por 5 dias', quantidade: 15, classificacao: 'COMUM' },
  { medicamento: 'Loratadina', concentracao: '10 mg', posologia: '1 comprimido ao dia por 7 dias', quantidade: 7, classificacao: 'COMUM' },
  { medicamento: 'Dexametasona creme', concentracao: '0,1%', posologia: 'Aplicar 2 vezes ao dia por 7 dias', quantidade: 1, classificacao: 'COMUM' },
  { medicamento: 'Clonazepam', concentracao: '0,5 mg', posologia: '1 comprimido à noite', quantidade: 30, classificacao: 'CONTROLE_ESPECIAL' },
];

const ANOTACOES = [
  'Relata ansiedade ligada ao trabalho; acompanhar nas próximas consultas.',
  'Lembrar de perguntar sobre a adesão ao tratamento.',
  'Família pediu discrição sobre o diagnóstico.',
  'Avaliar encaminhamento se não houver melhora em 30 dias.',
];

const GLOSAS = [
  'Carteirinha vencida na data do atendimento',
  'Procedimento sem autorização prévia',
  'Divergência no código do procedimento',
  'Guia sem assinatura do beneficiário',
];

// Gerador pseudoaleatório com semente (mulberry32).
function sorteador(semente) {
  let estado = semente >>> 0;
  const numero = () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const inteiro = (min, max) => min + Math.floor(numero() * (max - min + 1));
  return {
    inteiro,
    chance: (p) => numero() < p,
    escolher: (lista) => lista[inteiro(0, lista.length - 1)],
    embaralhar: (lista) => {
      const copia = [...lista];
      for (let i = copia.length - 1; i > 0; i--) {
        const j = inteiro(0, i);
        [copia[i], copia[j]] = [copia[j], copia[i]];
      }
      return copia;
    },
  };
}

const zeros = (n, tamanho) => String(n).padStart(tamanho, '0');
const somarDias = (data, dias) => {
  const d = new Date(`${data}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
};
const diaDaSemana = (data) => new Date(`${data}T12:00:00Z`).getUTCDay();
const somarMinutos = (dataHora, minutos) => {
  const d = new Date(`${dataHora}Z`);
  d.setUTCMinutes(d.getUTCMinutes() + minutos);
  return d.toISOString().slice(0, 19);
};
const dinheiro = (valor) => Math.round(valor * 100) / 100;
const semAcento = (texto) => texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// CPF no formato certo e com os dígitos verificadores errados de propósito:
// não coincide com o de ninguém.
function cpfInvalido(sequencia) {
  const base = zeros(sequencia, 9).split('').map(Number);
  const digito = (numeros) => {
    const soma = numeros.reduce((total, n, i) => total + n * (numeros.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d1 = digito(base);
  const d2 = digito([...base, d1]);
  const texto = `${base.join('')}${(d1 + 1) % 10}${d2}`;
  return `${texto.slice(0, 3)}.${texto.slice(3, 6)}.${texto.slice(6, 9)}-${texto.slice(9)}`;
}

function lerContas() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'usuarios-de-teste.json'), 'utf8'));
}

function gerarBanco({ data = DATA_PADRAO, contas = lerContas() } = {}) {
  const s = sorteador(SEMENTE);
  const db = Object.fromEntries(COLECOES.map((c) => [c, []]));
  const novo = (colecao, dados) => {
    const registro = { id: db[colecao].length + 1, ...dados };
    db[colecao].push(registro);
    return registro;
  };
  const dia = (deslocamento) => somarDias(data, deslocamento);
  const anoBase = Number(data.slice(0, 4));

  // ── Pessoas ──────────────────────────────────────────────────────────────
  const nomesUsados = new Set();
  function novoNome(sexo) {
    for (;;) {
      const nome = `${s.escolher(NOMES[sexo])} ${s.escolher(SOBRENOMES)} ${s.escolher(SOBRENOMES)}`;
      const partes = nome.split(' ');
      if (partes[1] !== partes[2] && !nomesUsados.has(nome)) {
        nomesUsados.add(nome);
        return nome;
      }
    }
  }
  function novaPessoa({ idadeMin, idadeMax, nascimento, semCpf = false }) {
    const id = db.pessoas.length + 1;
    const sexo = s.chance(0.5) ? 'F' : 'M';
    const nome = novoNome(sexo);
    const dataNascimento =
      nascimento ?? `${anoBase - s.inteiro(idadeMin, idadeMax)}-${zeros(s.inteiro(1, 12), 2)}-${zeros(s.inteiro(1, 28), 2)}`;
    const [primeiro, , ultimo] = semAcento(nome).split(' ');
    return novo('pessoas', {
      nome,
      cpf: semCpf ? null : cpfInvalido(id),
      dataNascimento,
      sexo,
      telefone: `(11) 90000-${zeros(id, 4)}`,
      email: `${primeiro}.${ultimo}.${id}@exemplo.test`,
      endereco: `Rua Fictícia ${s.inteiro(1, 80)}, nº ${s.inteiro(10, 999)}, São Paulo/SP`,
    });
  }

  const administradores = [1, 2].map(() => novaPessoa({ idadeMin: 35, idadeMax: 55 }));
  administradores.forEach((p) => db.administradores.push({ id: p.id, situacao: 'ATIVO' }));

  const secretarias = ['MANHA', 'TARDE', 'INTEGRAL'].map((turno) => {
    const p = novaPessoa({ idadeMin: 22, idadeMax: 45 });
    db.secretarias.push({ id: p.id, turno, situacao: 'ATIVO' });
    return p;
  });

  // Cinco médicos em atividade e um recém-cadastrado, com convite pendente.
  const medicos = ESPECIALIDADES.map((especialidade, i) => {
    const p = novaPessoa({ idadeMin: 30, idadeMax: 60 });
    db.medicos.push({ id: p.id, crm: zeros(i + 1, 6), ufCrm: 'SP', especialidade, situacao: i < 5 ? 'ATIVO' : 'INATIVO' });
    return p;
  });
  const ativos = medicos.slice(0, 5);

  // 30 pacientes: 25 adultos, 4 menores e 1 que fez 18 anos em março.
  const adultos = Array.from({ length: 25 }, (_, i) =>
    novaPessoa({ idadeMin: 19, idadeMax: 80, semCpf: i === 23 || i === 24 })
  );
  const menores = Array.from({ length: 4 }, () => novaPessoa({ idadeMin: 5, idadeMax: 15 }));
  const maior = novaPessoa({ nascimento: `${anoBase - 18}-03-10` });
  const pacientes = [...adultos, ...menores, maior];
  pacientes.forEach((p, i) => {
    db.pacientes.push({
      id: p.id,
      nomeSocial: i === 4 ? `${s.escolher(NOMES.F)} ${p.nome.split(' ')[2]}` : null,
      observacoesGerais: i % 3 === 0 ? OBSERVACOES[i % OBSERVACOES.length] : null,
      situacao: i === 22 ? 'INATIVO' : 'ATIVO',
      pendenteDeCpf: p.cpf === null,
    });
  });
  const demo = adultos[0];
  const representada = menores[0];

  // Responsáveis: o primeiro representa uma criança; o segundo, duas (para o
  // seletor G-09); o terceiro, uma criança e o ex-representado que fez 18 anos.
  const responsaveis = [1, 2, 3].map(() => novaPessoa({ idadeMin: 30, idadeMax: 55 }));
  responsaveis.forEach((p) =>
    db.responsaveisLegais.push({ id: p.id, documentoComprobatorio: 'Certidão de nascimento (cópia fictícia)', situacao: 'ATIVO' })
  );
  const representacoes = [
    [responsaveis[0], representada, 'MAE'],
    [responsaveis[1], menores[1], 'PAI'],
    [responsaveis[1], menores[2], 'PAI'],
    [responsaveis[2], menores[3], 'MAE'],
    [responsaveis[2], maior, 'MAE'],
  ];
  representacoes.forEach(([responsavel, paciente, grauParentesco]) =>
    novo('representacoes', {
      grauParentesco,
      inicioVigencia: paciente.dataNascimento,
      fimVigencia: null,
      documento: 'Certidão de nascimento (cópia fictícia)',
      idResponsavelLegal: responsavel.id,
      idPaciente: paciente.id,
    })
  );
  const responsavelDe = (paciente) =>
    db.representacoes.find((r) => r.idPaciente === paciente.id)?.idResponsavelLegal ?? null;

  // ── Usuários ─────────────────────────────────────────────────────────────
  // As contas de demonstração e a senha de todas estão em usuarios-de-teste.json.
  const pessoasDoPapel = {
    [ADMINISTRADOR]: administradores,
    [SECRETARIA]: secretarias,
    [MEDICO]: medicos,
    [PACIENTE]: [demo, ...adultos.slice(1, 6)],
    [RESPONSAVEL_LEGAL]: responsaveis,
  };
  const loginsDeDemonstracao = new Map();
  for (const [papel, pessoas] of Object.entries(pessoasDoPapel)) {
    contas.contas
      .filter((c) => c.papel === papel)
      .forEach((conta, i) => pessoas[i] && loginsDeDemonstracao.set(pessoas[i].id, conta.login));
  }
  const usuarioDe = new Map();
  for (const [papel, pessoas] of Object.entries(pessoasDoPapel)) {
    for (const pessoa of pessoas) {
      const pendente = pessoa.id === medicos[5].id;
      const [primeiro, , ultimo] = semAcento(pessoa.nome).split(' ');
      const usuario = novo('usuarios', {
        login: loginsDeDemonstracao.get(pessoa.id) ?? `${primeiro}.${ultimo}${pessoa.id}`,
        email: pessoa.email,
        senhaHash: pendente ? null : gerarHash(contas.senhaDemonstracao),
        papel,
        situacao: pendente ? 'CONVITE_PENDENTE' : 'ATIVO',
        tentativasFalhas: 0,
        bloqueadoAte: null,
        ultimoAcesso: null,
        idPessoa: pessoa.id,
      });
      usuarioDe.set(pessoa.id, usuario);
    }
  }

  // ── Parâmetros ───────────────────────────────────────────────────────────
  [
    ['X01', 'Acesso', 'Tentativas de login antes do bloqueio', 5, 'tentativas', 3, 10, false],
    ['X02', 'Acesso', 'Janela de contagem das tentativas', 15, 'min', 5, 60, false],
    ['X03', 'Acesso', 'Duração do bloqueio de login', 15, 'min', 5, 120, false],
    ['X04', 'Acesso', 'Validade do convite de portal', 72, 'h', 24, 168, true],
    ['X05', 'Acesso', 'Validade do link de recuperação de senha', 30, 'min', 10, 60, false],
    ['X07', 'Prontuário', 'Duração do acesso de exceção', 60, 'min', 15, 240, true],
    ['X08', 'Agenda', 'Antecedência mínima para cancelar pelo portal', 24, 'h', 2, 72, true],
    ['X10', 'Agenda', 'Atraso para marcar Não Compareceu', 15, 'min', 5, 60, true],
    ['X11', 'Agenda', 'Granularidade da grade de horários', 30, 'min', 10, 60, true],
    ['X15', 'Acesso', 'Inatividade até a sessão expirar', 30, 'min', 5, 60, true],
    ['X28', 'Agenda', 'Intervalo de atualização da fila do dia', 30, 's', 10, 120, true],
    ['X42', 'Privacidade', 'Validade do link de exportação', 24, 'h', 1, 72, true],
    ['X46', 'Estoque', 'Antecedência do alerta de validade', 30, 'dias', 7, 90, true],
  ].forEach(([chave, grupo, descricao, valor, unidade, faixaMinima, faixaMaxima, editavel]) =>
    novo('parametros', {
      chave, grupo, descricao, valor, valorSugerido: valor, unidade, faixaMinima, faixaMaxima, editavel,
      idAdministrador: administradores[0].id,
    })
  );

  // ── Convênios e procedimentos ────────────────────────────────────────────
  const convenios = [
    ['Operadora Fictícia Alfa S.A.', 'Alfa Saúde Essencial', 'ATIVO'],
    ['Operadora Fictícia Beta Ltda.', 'Beta Mais', 'ATIVO'],
    ['Operadora Fictícia Gama S.A.', 'Gama Clássico', 'INATIVO'],
  ].map(([razaoSocial, nome, situacao], i) =>
    novo('convenios', { razaoSocial, nome, registroAns: zeros(i + 1, 6), situacao })
  );
  const conveniosAtivos = convenios.filter((c) => c.situacao === 'ATIVO');

  const procedimentos = [
    ['CON-01', 'Consulta médica', 'CONSULTA', 30, 250, false, 'ATIVO'],
    ['CON-02', 'Retorno', 'CONSULTA', 20, 120, false, 'ATIVO'],
    ['EXA-01', 'Eletrocardiograma', 'EXAME', 20, 150, false, 'ATIVO'],
    ['EXA-02', 'Dermatoscopia', 'EXAME', 30, 180, false, 'ATIVO'],
    ['PRO-01', 'Pequena cirurgia ambulatorial', 'PROCEDIMENTO', 60, 900, true, 'ATIVO'],
    ['PRO-02', 'Infiltração articular', 'PROCEDIMENTO', 30, 450, true, 'ATIVO'],
    ['PRO-03', 'Curativo', 'PROCEDIMENTO', 20, 80, false, 'INATIVO'],
  ].map(([codigoInterno, nome, tipo, duracaoPadrao, precoParticular, exigeAutorizacao, situacao], i) =>
    novo('procedimentos', {
      codigo: `9${zeros(i + 1, 7)}`, codigoInterno, nome, tipo, duracaoPadrao, precoParticular, exigeAutorizacao, situacao,
    })
  );
  const [consulta, retorno, ecg, dermatoscopia, cirurgia, infiltracao] = procedimentos;
  const exameDaEspecialidade = { Cardiologia: ecg, Dermatologia: dermatoscopia, Ortopedia: infiltracao, 'Clínica Médica': cirurgia };

  // ── Grade e bloqueios ────────────────────────────────────────────────────
  medicos.forEach((m, i) => {
    for (let diaSemana = 1; diaSemana <= 5; diaSemana++) {
      novo('gradesHorario', { diaSemana, horaInicio: '08:00', horaFim: '12:00', granularidade: 30, idMedico: m.id });
      if ((diaSemana + i) % 2 === 0) {
        novo('gradesHorario', { diaSemana, horaInicio: '14:00', horaFim: '17:00', granularidade: 30, idMedico: m.id });
      }
    }
  });

  const feriado = '2026-10-12';
  const bloqueios = [
    { inicio: `${feriado}T00:00:00`, fim: `${feriado}T23:59:59`, motivo: 'FERIADO', idMedico: null, situacao: 'ATIVO' },
    { inicio: `${dia(7)}T00:00:00`, fim: `${dia(11)}T23:59:59`, motivo: 'FERIAS', idMedico: ativos[2].id, situacao: 'ATIVO' },
    { inicio: `${dia(15)}T00:00:00`, fim: `${dia(15)}T23:59:59`, motivo: 'CONGRESSO', idMedico: ativos[0].id, situacao: 'ATIVO' },
    { inicio: `${dia(-10)}T00:00:00`, fim: `${dia(-10)}T23:59:59`, motivo: 'CAPACITACAO', idMedico: ativos[1].id, situacao: 'ENCERRADO' },
  ].map((b) =>
    novo('bloqueiosAgenda', { dataInicio: b.inicio, dataFim: b.fim, motivo: b.motivo, idMedico: b.idMedico, situacao: b.situacao, consultasAfetadas: 0 })
  );

  // ── Consultas ────────────────────────────────────────────────────────────
  // Cada médico atende uma carteira de pacientes. O paciente de demonstração
  // é da carteira do primeiro médico; a representada, da pediatra.
  const carteiras = [
    adultos.slice(0, 10),
    [...menores, maior, adultos[10], adultos[11]],
    adultos.slice(5, 15),
    [adultos[0], ...adultos.slice(12, 21)],
    adultos.slice(15, 25),
  ];
  const ocupados = new Set();
  const horario = (data, hora, minuto) => `${data}T${zeros(hora, 2)}:${zeros(minuto, 2)}:00`;
  const SLOTS = [8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5];

  function marcar({ medico, paciente, dataHora, status, procedimento, convenio = null }) {
    const chave = `${medico.id}|${dataHora}`;
    if (ocupados.has(chave)) return null;
    ocupados.add(chave);
    return novo('consultas', {
      dataHora,
      duracao: procedimento.duracaoPadrao,
      status,
      canalOrigem: s.escolher(['RECEPCAO', 'TELEFONE', 'PORTAL']),
      motivoCancelamento: status === 'CANCELADO' ? s.escolher(['Solicitação do paciente', 'Imprevisto do paciente', 'Remarcada pela clínica']) : null,
      idPaciente: paciente.id,
      idMedico: medico.id,
      idProcedimento: procedimento.id,
      idConvenio: convenio ? convenio.id : null,
    });
  }

  // Consultas fixas da demonstração, marcadas antes das sorteadas.
  marcar({ medico: ativos[0], paciente: demo, dataHora: horario(dia(-20), 9, 0), status: 'FINALIZADO', procedimento: consulta });
  marcar({ medico: ativos[3], paciente: demo, dataHora: horario(dia(-12), 10, 0), status: 'FINALIZADO', procedimento: dermatoscopia });
  marcar({ medico: ativos[0], paciente: demo, dataHora: horario(dia(-6), 9, 30), status: 'FINALIZADO', procedimento: retorno });
  marcar({ medico: ativos[0], paciente: demo, dataHora: horario(dia(3), 9, 0), status: 'AGENDADO', procedimento: retorno });
  marcar({ medico: ativos[3], paciente: demo, dataHora: horario(dia(16), 10, 30), status: 'AGENDADO', procedimento: consulta });
  marcar({ medico: ativos[1], paciente: representada, dataHora: horario(dia(-14), 8, 30), status: 'FINALIZADO', procedimento: consulta });
  // Procedimento por convênio que ainda espera a justificativa do médico (M-06).
  marcar({ medico: ativos[0], paciente: adultos[2], dataHora: horario(dia(9), 11, 0), status: 'AGENDADO', procedimento: cirurgia, convenio: convenios[0] });
  // Consultas que caem nas férias do terceiro médico (A-11a, S-05b).
  marcar({ medico: ativos[2], paciente: adultos[6], dataHora: horario(dia(8), 9, 0), status: 'AGENDADO', procedimento: retorno });
  marcar({ medico: ativos[2], paciente: adultos[7], dataHora: horario(dia(10), 10, 30), status: 'AGENDADO', procedimento: ecg });
  marcar({ medico: ativos[1], paciente: representada, dataHora: horario(dia(-3), 9, 0), status: 'FINALIZADO', procedimento: retorno });
  marcar({ medico: ativos[1], paciente: representada, dataHora: horario(dia(4), 10, 0), status: 'AGENDADO', procedimento: retorno });

  // Hoje: os seis status da fila (RF22). A paciente que está na recepção do
  // primeiro médico ainda não tem vínculo com ele: o vínculo nasce ao chamar.
  const filaDeHoje = [
    ['FINALIZADO', 'EM_ATENDIMENTO', 'NA_RECEPCAO', 'AGENDADO', 'AGENDADO'],
    ['FINALIZADO', 'NA_RECEPCAO', 'AGENDADO', 'CANCELADO'],
    ['NAO_COMPARECEU', 'FINALIZADO', 'AGENDADO'],
    ['FINALIZADO', 'NA_RECEPCAO', 'AGENDADO'],
    ['CANCELADO', 'FINALIZADO', 'EM_ATENDIMENTO', 'AGENDADO'],
  ];
  const semVinculoNaRecepcao = adultos[20];
  filaDeHoje.forEach((estados, m) => {
    const fila = s.embaralhar(carteiras[m]);
    estados.forEach((status, i) => {
      const paciente = m === 0 && status === 'NA_RECEPCAO' ? semVinculoNaRecepcao : fila[i % fila.length];
      marcar({
        medico: ativos[m],
        paciente,
        dataHora: horario(data, 8 + Math.floor(i / 2), (i % 2) * 30),
        status,
        procedimento: i === 0 ? retorno : consulta,
        convenio: s.chance(0.35) ? s.escolher(conveniosAtivos) : null,
      });
    });
  });

  // De 40 dias atrás a 3 semanas à frente, em dias úteis, sem o feriado.
  for (let d = -40; d <= 21; d++) {
    const data_ = dia(d);
    if (d === 0 || [0, 6].includes(diaDaSemana(data_)) || data_ === feriado) continue;
    ativos.forEach((medico, m) => {
      const quantas = d < 0 ? s.inteiro(1, 3) : s.inteiro(0, 2);
      for (let k = 0; k < quantas; k++) {
        const slot = s.escolher(SLOTS);
        const convenio = s.chance(0.35) ? s.escolher(conveniosAtivos) : null;
        const especial = exameDaEspecialidade[ESPECIALIDADES[m]];
        const procedimento = especial && s.chance(0.1) ? especial : s.chance(0.3) ? retorno : consulta;
        let status = 'AGENDADO';
        if (d < 0) {
          const sorte = s.inteiro(1, 10);
          status = sorte <= 8 ? 'FINALIZADO' : sorte === 9 ? 'CANCELADO' : 'NAO_COMPARECEU';
        } else if (s.chance(0.05)) {
          status = 'CANCELADO';
        }
        marcar({
          medico,
          paciente: s.escolher(carteiras[m]),
          dataHora: horario(data_, Math.floor(slot), (slot % 1) * 60),
          status,
          procedimento,
          convenio,
        });
      }
    });
  }
  db.consultas.sort((a, b) => a.dataHora.localeCompare(b.dataHora));
  db.consultas.forEach((c, i) => {
    c.id = i + 1;
  });

  const consultasDe = (paciente) => db.consultas.filter((c) => c.idPaciente === paciente.id);
  const finalizadas = db.consultas.filter((c) => c.status === 'FINALIZADO');
  const procedimentoDe = (c) => db.procedimentos.find((p) => p.id === c.idProcedimento);
  const dataDe = (c) => c.dataHora.slice(0, 10);

  for (const bloqueio of bloqueios) {
    bloqueio.consultasAfetadas = db.consultas.filter(
      (c) =>
        (bloqueio.idMedico === null || c.idMedico === bloqueio.idMedico) &&
        c.status === 'AGENDADO' &&
        c.dataHora >= bloqueio.dataInicio &&
        c.dataHora <= bloqueio.dataFim
    ).length;
  }

  // ── Vínculos e prontuário ────────────────────────────────────────────────
  // O vínculo nasce na primeira consulta finalizada (RF05). Do primeiro
  // médico, um vínculo é Histórico (ainda dá acesso) e outro foi Encerrado.
  const primeiraConsulta = new Map();
  for (const c of finalizadas) {
    const chave = `${c.idPaciente}|${c.idMedico}`;
    if (!primeiraConsulta.has(chave)) primeiraConsulta.set(chave, c);
  }
  for (const c of primeiraConsulta.values()) {
    let estado = 'ATIVO';
    if (c.idMedico === ativos[0].id && c.idPaciente === adultos[8].id) estado = 'HISTORICO';
    if (c.idMedico === ativos[0].id && c.idPaciente === adultos[9].id) estado = 'ENCERRADO';
    novo('vinculos', {
      estado,
      dataInicio: dataDe(c),
      dataFim: estado === 'ENCERRADO' ? dia(-2) : null,
      motivoEncerramento: estado === 'ENCERRADO' ? 'Paciente transferido para outro serviço' : null,
      idPaciente: c.idPaciente,
      idMedico: c.idMedico,
    });
  }
  // Quem está em atendimento hoje já foi chamado: tem vínculo.
  for (const c of db.consultas.filter((x) => x.status === 'EM_ATENDIMENTO')) {
    if (!db.vinculos.some((v) => v.idPaciente === c.idPaciente && v.idMedico === c.idMedico)) {
      novo('vinculos', { estado: 'ATIVO', dataInicio: dataDe(c), dataFim: null, motivoEncerramento: null, idPaciente: c.idPaciente, idMedico: c.idMedico });
    }
  }

  const prontuarioDe = new Map();
  for (const v of [...db.vinculos].sort((a, b) => a.dataInicio.localeCompare(b.dataInicio))) {
    if (!prontuarioDe.has(v.idPaciente)) {
      prontuarioDe.set(v.idPaciente, novo('prontuarios', { dataAbertura: v.dataInicio, situacao: 'ATIVO', idPaciente: v.idPaciente }));
    }
  }

  const registroDe = new Map();
  for (const c of db.consultas.filter((x) => ['FINALIZADO', 'EM_ATENDIMENTO'].includes(x.status))) {
    const atendimento = s.escolher(ATENDIMENTOS);
    const registro = novo('registrosClinicos', {
      dataHora: somarMinutos(c.dataHora, 25),
      ...atendimento,
      selado: c.status === 'FINALIZADO',
      idProntuario: prontuarioDe.get(c.idPaciente).id,
      idConsulta: c.id,
    });
    registroDe.set(c.id, registro);
  }
  const registrosDoMedico = (medico) =>
    db.registrosClinicos.filter((r) => db.consultas[r.idConsulta - 1].idMedico === medico.id && r.selado);
  registrosDoMedico(ativos[0]).slice(0, 2).forEach((r) =>
    novo('retificacoes', {
      dataHora: somarMinutos(r.dataHora, 60 * 24),
      motivo: 'Correção de digitação na conduta',
      textoAnterior: r.conduta,
      textoCorrigido: `${r.conduta} Retorno em 30 dias.`,
      idRegistroClinico: r.id,
    })
  );

  db.registrosClinicos.forEach((r, i) => {
    if (i % 5 > 1) return;
    const itens = s.embaralhar(MEDICAMENTOS).slice(0, s.inteiro(1, 2));
    const prescricao = novo('prescricoes', {
      dataEmissao: r.dataHora.slice(0, 10),
      validade: somarDias(r.dataHora.slice(0, 10), 30),
      tipoReceita: itens.some((m) => m.classificacao === 'CONTROLE_ESPECIAL') ? 'CONTROLE_ESPECIAL' : 'SIMPLES',
      assinaturaDigital: true,
      idRegistroClinico: r.id,
      idPaciente: db.consultas[r.idConsulta - 1].idPaciente,
    });
    itens.forEach((item) => novo('itensPrescricao', { ...item, idPrescricao: prescricao.id }));
  });

  [[ativos[0], 3], [ativos[1], 2], [ativos[3], 1]].forEach(([medico, quantas]) => {
    const pacientesDoMedico = db.vinculos.filter((v) => v.idMedico === medico.id && v.estado !== 'ENCERRADO');
    pacientesDoMedico.slice(0, quantas).forEach((v, i) =>
      novo('anotacoesPrivadas', {
        dataHora: `${somarDias(v.dataInicio, 1)}T18:00:00`,
        texto: ANOTACOES[(i + medico.id) % ANOTACOES.length],
        idMedico: medico.id,
        idPaciente: v.idPaciente,
      })
    );
  });

  // Anexos: do paciente de demonstração e da representada há exames enviados
  // pelo portal aguardando o aceite do médico (A5-R10).
  [
    [demo, 'hemograma-2026-09.pdf', MEDICO, 'DISPONIVEL', -20],
    [demo, 'exame-enviado-pelo-paciente.pdf', PACIENTE, 'A_ACEITAR', -1],
    [demo, 'raio-x-torax.jpg', SECRETARIA, 'DISPONIVEL', -6],
    [representada, 'carteira-de-vacinacao.pdf', RESPONSAVEL_LEGAL, 'A_ACEITAR', -2],
    [representada, 'hemograma-infantil.pdf', RESPONSAVEL_LEGAL, 'ACEITO', -14],
    [adultos[5], 'eletrocardiograma.pdf', MEDICO, 'DISPONIVEL', -9],
    [adultos[12], 'foto-da-lesao.jpg', PACIENTE, 'ACEITO', -11],
    [adultos[16], 'ressonancia-joelho.pdf', SECRETARIA, 'DISPONIVEL', -4],
  ].forEach(([paciente, nomeArquivo, enviadoPor, situacao, d]) => {
    const prontuario = prontuarioDe.get(paciente.id);
    if (!prontuario) return;
    novo('anexos', {
      nomeArquivo,
      tipoMime: nomeArquivo.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg',
      tamanho: s.inteiro(80, 2400) * 1024,
      dataEnvio: `${dia(d)}T${zeros(s.inteiro(8, 18), 2)}:15:00`,
      statusVarredura: 'LIMPO',
      enviadoPor,
      situacao,
      idPaciente: paciente.id,
      idProntuario: prontuario.id,
    });
  });

  // Acessos de exceção já vencidos: um revisado e um aguardando revisão.
  [[ativos[1], adultos[2], true, -9], [ativos[0], adultos[14], false, -1]].forEach(([medico, paciente, revisado, d]) => {
    const dataHora = `${dia(d)}T15:00:00`;
    novo('acessosExcecao', {
      dataHora,
      justificativa: 'Paciente atendido em urgência; consulta ao histórico de alergias.',
      duracao: 60,
      expiraEm: somarMinutos(dataHora, 60),
      revisado,
      idMedico: medico.id,
      idPaciente: paciente.id,
    });
  });

  // ── Titular: solicitações, exportações e notificações ───────────────────
  const solicitacoes = [
    [demo, 'ACESSO', 'ABERTA', -2, null],
    [representada, 'CORRECAO', 'RESPONDIDA', -12, -5],
    [adultos[7], 'PORTABILIDADE', 'EM_ANALISE', -4, null],
  ].map(([paciente, tipo, situacao, d, resposta]) =>
    novo('solicitacoesTitular', {
      tipo, dataSolicitacao: dia(d), dataResposta: resposta === null ? null : dia(resposta), situacao, idPaciente: paciente.id,
    })
  );
  novo('exportacoes', {
    tipo: 'HISTORICO', formato: 'PDF', dataSolicitacao: `${dia(-2)}T10:00:00`, dataConclusao: `${dia(-2)}T10:02:00`,
    situacao: 'CONCLUIDA', idProntuario: null, idSolicitacaoTitular: solicitacoes[0].id, idPaciente: demo.id,
  });
  novo('exportacoes', {
    tipo: 'PRONTUARIO', formato: 'PDF', dataSolicitacao: `${dia(-1)}T16:00:00`, dataConclusao: `${dia(-1)}T16:05:00`,
    situacao: 'CONCLUIDA', idProntuario: prontuarioDe.get(demo.id).id, idSolicitacaoTitular: null, idPaciente: demo.id,
  });

  const destinatarioDe = (paciente) => {
    const idResponsavel = responsavelDe(paciente);
    return db.pessoas.find((p) => p.id === (idResponsavel ?? paciente.id));
  };
  const avisaveis = db.consultas.filter(
    (c) =>
      c.dataHora >= `${dia(-3)}T00:00:00` &&
      (s.chance(0.25) || [demo.id, representada.id].includes(c.idPaciente))
  );
  for (const c of avisaveis) {
    const paciente = db.pessoas.find((p) => p.id === c.idPaciente);
    const destino = destinatarioDe(paciente);
    const canal = s.escolher(['EMAIL', 'WHATSAPP', 'SMS']);
    const falhou = s.chance(0.12);
    novo('notificacoes', {
      evento: c.status === 'CANCELADO' ? 'CANCELAMENTO' : c.dataHora.slice(0, 10) > data ? 'LEMBRETE_CONSULTA' : 'CONFIRMACAO_AGENDAMENTO',
      canal,
      destino: canal === 'EMAIL' ? destino.email : destino.telefone,
      dataEnvio: `${somarDias(dataDe(c), -1)}T09:00:00`,
      situacao: falhou ? 'FALHA' : 'ENVIADA',
      tentativas: falhou ? 3 : 1,
      idPessoa: destino.id,
      idConsulta: c.id,
      idParametro: null,
    });
  }

  // ── Orçamentos ───────────────────────────────────────────────────────────
  // Um em cada etapa do RF31; o paciente de demonstração e a representada
  // têm um orçamento aguardando aceite.
  const valorDe = (procedimento) => procedimento.precoParticular;
  // O médico só orça para quem tem vínculo com ele.
  const comVinculo = (medico, n) => {
    const v = db.vinculos.filter(
      (x) => x.idMedico === medico.id && x.estado === 'ATIVO' && ![demo.id, representada.id].includes(x.idPaciente)
    )[n];
    return db.pessoas.find((p) => p.id === v.idPaciente);
  };
  const orcamentos = [
    [demo, ativos[0], 'ACEITE', [[cirurgia, 1]], -5],
    [demo, ativos[3], 'ACEITO', [[dermatoscopia, 2]], -18],
    [representada, ativos[1], 'ACEITE', [[cirurgia, 1]], -3],
    [comVinculo(ativos[0], 1), ativos[0], 'ESCOPO', [[cirurgia, 1], [ecg, 1]], -1],
    [comVinculo(ativos[3], 1), ativos[3], 'VALORES', [[dermatoscopia, 1]], -2],
    [comVinculo(ativos[4], 1), ativos[4], 'APROVACAO', [[infiltracao, 2]], -4],
    [comVinculo(ativos[2], 1), ativos[2], 'DEVOLVIDO', [[ecg, 1]], -6],
    [comVinculo(ativos[4], 2), ativos[4], 'RECUSADO', [[infiltracao, 1]], -25],
  ].map(([paciente, medico, etapa, itens, d]) => {
    const comValores = !['ESCOPO', 'VALORES', 'DEVOLVIDO'].includes(etapa);
    const orcamento = novo('orcamentos', {
      dataEmissao: dia(d),
      validade: dia(d + 30),
      valorTotal: comValores ? itens.reduce((t, [p, q]) => t + valorDe(p) * q, 0) : null,
      situacao: ['ACEITO', 'RECUSADO', 'EXPIRADO'].includes(etapa) ? 'ENCERRADO' : 'ABERTO',
      idPaciente: paciente.id,
      idMedico: medico.id,
      etapa,
      observacaoDevolucao: etapa === 'DEVOLVIDO' ? 'Confirmar se o eletrocardiograma entra neste orçamento ou em outro.' : null,
    });
    itens.forEach(([procedimento, quantidade]) =>
      novo('itensOrcamento', {
        descricao: procedimento.nome,
        quantidade,
        valorUnitario: comValores ? valorDe(procedimento) : null,
        idOrcamento: orcamento.id,
        idProcedimento: procedimento.id,
      })
    );
    return orcamento;
  });

  // ── Cobrança, caixa e pagamentos ─────────────────────────────────────────
  const caixas = [];
  // Caixas dos dois últimos dias úteis (o dia de referência é uma segunda-feira).
  [[secretarias[0], -4, 0], [secretarias[0], -3, -10], [secretarias[1], -3, 0]].forEach(([secretaria, d, diferenca]) =>
    caixas.push(
      novo('caixas', {
        dataAbertura: `${dia(d)}T07:50:00`, dataFechamento: `${dia(d)}T18:10:00`, saldoInicial: 200,
        saldoApurado: null, saldoContado: null, divergencia: diferenca,
        situacao: diferenca === 0 ? 'FECHADO' : 'A_APROVAR',
        justificativa: diferenca === 0 ? null : 'Troco entregue a mais em um atendimento.',
        idSecretaria: secretaria.id, turno: db.secretarias.find((x) => x.id === secretaria.id).turno,
      })
    )
  );
  const caixaDeHoje = novo('caixas', {
    dataAbertura: `${data}T07:45:00`, dataFechamento: null, saldoInicial: 200, saldoApurado: null, saldoContado: null,
    divergencia: null, situacao: 'ABERTO', justificativa: null, idSecretaria: secretarias[0].id, turno: 'MANHA',
  });
  caixas.push(caixaDeHoje);
  const caixaDoDia = (data_) => caixas.find((c) => c.dataAbertura.startsWith(data_));

  const titulosDaCobranca = new Map();
  function pagar(cobranca, dataHora, meio) {
    const pagamento = novo('pagamentos', { valor: cobranca.valorTotal, dataHora, situacao: 'CONFIRMADO', idCobranca: cobranca.id, meio });
    if (meio === 'PIX') {
      db.pagamentosPix.push({
        id: pagamento.id, txid: `TXTESTE${zeros(pagamento.id, 8)}`, brcode: `00020126TESTE${zeros(pagamento.id, 6)}`,
        endToEndId: `E00000000TESTE${zeros(pagamento.id, 10)}`, expiracao: somarMinutos(dataHora, 30),
      });
    } else if (meio === 'CARTAO') {
      const valorBruto = cobranca.valorTotal;
      db.pagamentosCartao.push({
        id: pagamento.id, bandeira: s.escolher(['VISA', 'MASTERCARD', 'ELO']), nsu: zeros(pagamento.id, 6),
        codigoAutorizacao: `A${zeros(pagamento.id, 5)}`, modalidade: s.chance(0.6) ? 'CREDITO' : 'DEBITO', parcelas: 1,
        viaTef: s.chance(0.8), adquirente: s.escolher(['Adquirente Fictícia A', 'Adquirente Fictícia B']),
        valorBruto, valorLiquido: dinheiro(valorBruto * 0.97),
        situacaoConciliacao: s.escolher(['CONCILIADO', 'CONCILIADO', 'CONCILIADO', 'PENDENTE', 'DIVERGENTE']), dataHora,
      });
    } else {
      const valorRecebido = Math.ceil(cobranca.valorTotal / 50) * 50;
      db.pagamentosDinheiro.push({
        id: pagamento.id, valorRecebido, troco: dinheiro(valorRecebido - cobranca.valorTotal), idCaixa: caixaDoDia(dataHora.slice(0, 10)).id,
      });
    }
    return pagamento;
  }

  const particulares = finalizadas.filter((c) => c.idConvenio === null);
  for (const c of particulares) {
    const hoje = dataDe(c) === data;
    const paga = !hoje && (s.chance(0.9) || c.idPaciente === demo.id);
    const cobranca = novo('cobrancas', {
      dataEmissao: dataDe(c), valorTotal: procedimentoDe(c).precoParticular, situacao: paga ? 'PAGA' : 'ABERTA', idConsulta: c.id, idOrcamento: null,
    });
    const titulo = novo('titulosReceber', {
      origem: 'PARTICULAR', vencimento: dataDe(c), valor: cobranca.valorTotal, situacao: paga ? 'PAGO' : 'ABERTO',
      idCobranca: cobranca.id, idLoteCobranca: null, idCoparticipacao: null,
    });
    titulosDaCobranca.set(cobranca.id, titulo);
    if (paga) {
      const comCaixa = Boolean(caixaDoDia(dataDe(c)));
      const meio = comCaixa && s.chance(0.5) ? 'DINHEIRO' : s.chance(0.5) ? 'PIX' : 'CARTAO';
      pagar(cobranca, somarMinutos(c.dataHora, 45), meio);
    }
  }
  // Cobrança do orçamento aceito do paciente de demonstração, ainda em aberto.
  const orcamentoAceito = orcamentos.find((o) => o.etapa === 'ACEITO');
  const cobrancaDoOrcamento = novo('cobrancas', {
    dataEmissao: orcamentoAceito.dataEmissao, valorTotal: orcamentoAceito.valorTotal, situacao: 'ABERTA', idConsulta: null, idOrcamento: orcamentoAceito.id,
  });
  titulosDaCobranca.set(
    cobrancaDoOrcamento.id,
    novo('titulosReceber', {
      origem: 'PARTICULAR', vencimento: dia(10), valor: cobrancaDoOrcamento.valorTotal, situacao: 'ABERTO',
      idCobranca: cobrancaDoOrcamento.id, idLoteCobranca: null, idCoparticipacao: null,
    })
  );

  // Fechamento: o esperado sai dos pagamentos em dinheiro de cada caixa.
  for (const caixa of caixas) {
    const esperado = db.pagamentosDinheiro
      .filter((p) => p.idCaixa === caixa.id)
      .reduce((t, p) => t + p.valorRecebido - p.troco, caixa.saldoInicial);
    if (caixa.situacao === 'ABERTO') continue;
    caixa.saldoApurado = dinheiro(esperado);
    caixa.saldoContado = dinheiro(esperado + caixa.divergencia);
  }

  const pagamentoDoPaciente = (paciente) =>
    db.pagamentos.find((p) => {
      const cobranca = db.cobrancas[p.idCobranca - 1];
      return cobranca.idConsulta && db.consultas[cobranca.idConsulta - 1].idPaciente === paciente.id;
    });
  const usuarioSecretaria = usuarioDe.get(secretarias[0].id).id;
  [
    [pagamentoDoPaciente(demo), 'ESTORNO', 'ESTORNADO', -4],
    [db.pagamentos[db.pagamentos.length - 3], 'CANCELAMENTO', 'A_APROVAR', -1],
    [db.pagamentos[db.pagamentos.length - 8], 'ESTORNO', 'RECUSADO', -7],
  ].forEach(([pagamento, tipo, situacao, d], i) => {
    if (!pagamento) return;
    novo('estornos', {
      dataHora: situacao === 'ESTORNADO' ? `${dia(d + 1)}T11:00:00` : null,
      valor: pagamento.valor,
      motivo: ['Cobrança em duplicidade', 'Paciente desistiu do procedimento', 'Valor cobrado diferente do combinado'][i],
      protocolo: situacao === 'ESTORNADO' ? `EST-${zeros(i + 1, 6)}` : null,
      idPagamento: pagamento.id,
      idTituloReceber: titulosDaCobranca.get(pagamento.idCobranca)?.id ?? null,
      tipo,
      situacao,
      idSolicitante: usuarioSecretaria,
      dataPedido: `${dia(d)}T14:00:00`,
    });
  });

  // Recibo para os pagamentos dos últimos dez dias; NFS-e para metade deles.
  let numeroFiscal = 1;
  for (const pagamento of db.pagamentos) {
    if (pagamento.dataHora < `${dia(-10)}T00:00:00`) continue;
    const titulo = titulosDaCobranca.get(pagamento.idCobranca);
    const tipos = numeroFiscal % 2 === 0 ? ['RECIBO', 'NFSE'] : ['RECIBO'];
    for (const tipo of tipos) {
      novo('documentosFiscais', {
        tipo, numero: zeros(numeroFiscal++, 8), dataEmissao: pagamento.dataHora.slice(0, 10), valor: pagamento.valor,
        ibs: tipo === 'NFSE' ? dinheiro(pagamento.valor * 0.001) : null,
        cbs: tipo === 'NFSE' ? dinheiro(pagamento.valor * 0.009) : null,
        situacao: 'EMITIDO', idTituloReceber: titulo.id,
      });
    }
  }

  const titulosPagar = [
    ['Distribuidora Fictícia de Materiais Ltda.', 'MATERIAL', -12, 1840, 'PAGO'],
    ['Distribuidora Fictícia de Materiais Ltda.', 'MATERIAL', 8, 960, 'ABERTO'],
    ['Imobiliária Fictícia S.A.', 'ALUGUEL', 5, 7500, 'ABERTO'],
    ['Limpeza Fictícia Serviços Ltda.', 'SERVICOS', -3, 2200, 'PAGO'],
    ['Adquirente Fictícia A', 'TAXA_ADQUIRENTE', -1, 0, 'PAGO'],
  ].map(([fornecedor, categoria, d, valor, situacao]) =>
    novo('titulosPagar', {
      fornecedor, categoria, vencimento: dia(d), valor, situacao, idAdministrador: administradores[0].id, idPagamentoCartao: null,
    })
  );
  const taxa = titulosPagar[4];
  const cartoes = db.pagamentosCartao.slice(-5);
  taxa.valor = dinheiro(cartoes.reduce((t, c) => t + c.valorBruto - c.valorLiquido, 0));
  taxa.idPagamentoCartao = cartoes[0]?.id ?? null;

  // ── Convênio e TISS ──────────────────────────────────────────────────────
  const contratos = convenios.map((convenio, i) =>
    novo('contratosOperadora', {
      numero: `CT-${zeros(i + 1, 4)}`, vigenciaInicio: `${anoBase - 1}-01-01`,
      vigenciaFim: convenio.situacao === 'ATIVO' ? `${anoBase + 1}-12-31` : `${anoBase}-06-30`,
      versaoTiss: '4.01.00', meioTransmissao: i === 0 ? 'WEBSERVICE' : 'PORTAL',
      prazoApresentacao: 30, prazoPagamento: 30, prazoRecurso: 30,
      idConvenio: convenio.id, situacao: convenio.situacao === 'ATIVO' ? 'VIGENTE' : 'ENCERRADO',
    })
  );
  const contratoDe = (idConvenio) => contratos.find((c) => c.idConvenio === idConvenio);
  for (const contrato of contratos) {
    for (const procedimento of [consulta, retorno, ecg, dermatoscopia, cirurgia, infiltracao]) {
      novo('itensTabelaPreco', {
        valorNegociado: dinheiro(procedimento.precoParticular * (contrato.id === 1 ? 0.7 : 0.65)),
        vigenciaInicio: contrato.vigenciaInicio, vigenciaFim: contrato.vigenciaFim,
        idContratoOperadora: contrato.id, idProcedimento: procedimento.id,
      });
    }
  }
  const precoNegociado = (c) =>
    db.itensTabelaPreco.find((i) => i.idContratoOperadora === contratoDe(c.idConvenio).id && i.idProcedimento === c.idProcedimento)
      .valorNegociado;

  const comConvenio = db.consultas.filter((c) => c.idConvenio !== null && c.status !== 'CANCELADO');
  const elegibilidadeDe = new Map();
  for (const c of comConvenio) {
    elegibilidadeDe.set(
      c.id,
      novo('elegibilidades', {
        dataConsulta: somarDias(dataDe(c), -1),
        carteirinha: `0000${zeros(c.idPaciente, 4)}${zeros(c.idConvenio, 2)}`,
        situacao: s.chance(0.95) ? 'ELEGIVEL' : 'NAO_ELEGIVEL',
        validade: `${anoBase + 1}-12-31`,
        idPaciente: c.idPaciente,
        idConvenio: c.idConvenio,
      })
    );
  }

  // Autorizações: as de procedimento futuro do primeiro médico aguardam a
  // justificativa clínica (M-06). A senha da operadora é fictícia e a API
  // nunca a devolve.
  const autorizacaoDe = new Map();
  const precisamAutorizar = comConvenio.filter((c) => procedimentoDe(c).exigeAutorizacao || (c.status === 'AGENDADO' && s.chance(0.15)));
  precisamAutorizar.forEach((c, i) => {
    const futura = c.status === 'AGENDADO';
    const pendente = futura && (i % 3 === 0 || c.idMedico === ativos[0].id);
    const situacao = pendente ? 'PENDENTE_JUSTIFICATIVA' : futura ? s.escolher(['EM_ANALISE', 'AUTORIZADA']) : 'AUTORIZADA';
    const registro = registroDe.get(c.id);
    autorizacaoDe.set(
      c.id,
      novo('autorizacoes', {
        senha: situacao === 'AUTORIZADA' ? `AUT-TESTE-${zeros(i + 1, 5)}` : null,
        dataSolicitacao: somarDias(dataDe(c), -5),
        dataResposta: situacao === 'AUTORIZADA' ? somarDias(dataDe(c), -3) : null,
        situacao,
        validade: situacao === 'AUTORIZADA' ? somarDias(dataDe(c), 30) : null,
        idConsulta: c.id,
        cid: pendente ? null : registro?.cid ?? 'Z00.0',
        justificativa: pendente ? null : 'Indicação clínica registrada no prontuário.',
      })
    );
  });
  if (!db.autorizacoes.some((a) => a.situacao === 'PENDENTE_JUSTIFICATIVA')) {
    throw new Error('O seed precisa de ao menos uma autorização pendente de justificativa.');
  }

  const lotes = [];
  conveniosAtivos.forEach((convenio, i) => {
    lotes.push(novo('lotesCobranca', {
      numero: `LOTE-${zeros(i * 2 + 1, 4)}`, dataEnvio: dia(-20), protocolo: `PROT-${zeros(i + 1, 8)}`,
      valorApresentado: 0, situacao: 'PROTOCOLADO', idConvenio: convenio.id,
    }));
    lotes.push(novo('lotesCobranca', {
      numero: `LOTE-${zeros(i * 2 + 2, 4)}`, dataEnvio: null, protocolo: null,
      valorApresentado: 0, situacao: 'A_ENVIAR', idConvenio: convenio.id,
    }));
  });
  const finalizadasComConvenio = comConvenio.filter((c) => c.status === 'FINALIZADO');
  for (const c of finalizadasComConvenio) {
    const antiga = dataDe(c) < dia(-21);
    const deHoje = dataDe(c) === data;
    const lote = deHoje ? null : lotes.find((l) => l.idConvenio === c.idConvenio && l.situacao === (antiga ? 'PROTOCOLADO' : 'A_ENVIAR'));
    const valor = precoNegociado(c);
    const guia = novo('guiasTiss', {
      tipo: procedimentoDe(c).tipo === 'CONSULTA' ? 'CONSULTA' : 'SP_SADT',
      numero: `G${zeros(c.id, 9)}`,
      dataEmissao: dataDe(c),
      versaoTiss: '4.01.00',
      situacao: deHoje ? 'EM_DIGITACAO' : antiga ? 'ENVIADA' : 'LIBERADA',
      idConsulta: c.id,
      idContratoOperadora: contratoDe(c.idConvenio).id,
      idElegibilidade: elegibilidadeDe.get(c.id).id,
      idAutorizacao: autorizacaoDe.get(c.id)?.id ?? null,
      idLoteCobranca: lote?.id ?? null,
      valor,
      cid: registroDe.get(c.id)?.cid ?? null,
    });
    if (lote) {
      lote.valorApresentado = dinheiro(lote.valorApresentado + valor);
      novo('titulosReceber', {
        origem: 'CONVENIO', vencimento: somarDias(dataDe(c), 60), valor, situacao: 'ABERTO',
        idCobranca: null, idLoteCobranca: lote.id, idCoparticipacao: null,
      });
    }
  }

  // O recurso que aguarda fundamentação é de uma guia do primeiro médico.
  const guiasEnviadas = db.guiasTiss.filter((g) => g.situacao === 'ENVIADA');
  const medicoDaGuia = (g) => db.consultas[g.idConsulta - 1].idMedico;
  const guiaDoPrimeiro = guiasEnviadas.find((g) => medicoDaGuia(g) === ativos[0].id);
  const outrasGuias = guiasEnviadas.filter((g) => g !== guiaDoPrimeiro);
  const guiasGlosadas = [outrasGuias[0], guiaDoPrimeiro, outrasGuias[2], outrasGuias[4]];
  ['GLOSADO', 'EM_RECURSO', 'EM_RECURSO', 'PERDA'].forEach((situacao, i) => {
    const guia = guiasGlosadas[i];
    if (!guia) return;
    const glosa = novo('glosas', {
      codigo: `GT-${zeros(i + 1, 4)}`, motivo: GLOSAS[i], valorGlosado: guia.valor, dataDemonstrativo: dia(-8),
      idGuiaTiss: guia.id, situacao,
    });
    if (situacao !== 'EM_RECURSO') return;
    const consultaDaGuia = db.consultas[guia.idConsulta - 1];
    novo('recursosGlosa', {
      dataInterposicao: dia(-5),
      justificativa: 'Autorização e documentação anexadas ao recurso.',
      situacao: i === 1 ? 'AGUARDANDO_FUNDAMENTACAO' : 'EM_ANALISE',
      valorRecuperado: null,
      idGlosa: glosa.id,
      rodada: i === 1 ? 1 : 2,
      prazo: dia(25),
      aguardaFundamentacao: i === 1,
      idMedico: consultaDaGuia.idMedico,
    });
  });

  finalizadasComConvenio.slice(0, 6).forEach((c) => {
    const valorApurado = dinheiro(precoNegociado(c) * 0.2);
    const copart = novo('coparticipacoes', { percentual: 20, valorApurado, dataApuracao: dataDe(c), idConsulta: c.id });
    novo('titulosReceber', {
      origem: 'COPARTICIPACAO', vencimento: somarDias(dataDe(c), 10), valor: valorApurado, situacao: 'ABERTO',
      idCobranca: null, idLoteCobranca: null, idCoparticipacao: copart.id,
    });
  });

  // ── Estoque ──────────────────────────────────────────────────────────────
  const produtos = [
    ['Seringa descartável 5 ml', 'MATERIAL', 'UN', 100, 0.45, 'ATIVO'],
    ['Luva de procedimento (caixa com 100)', 'MATERIAL', 'CX', 10, 32.9, 'ATIVO'],
    ['Gaze estéril (pacote)', 'MATERIAL', 'PCT', 50, 1.8, 'ATIVO'],
    ['Lidocaína 2% (frasco 20 ml)', 'MEDICAMENTO', 'FR', 15, 9.5, 'ATIVO'],
    ['Vacina contra gripe (dose)', 'MEDICAMENTO', 'DOSE', 20, 41, 'ATIVO'],
    ['Atadura de crepe 10 cm', 'MATERIAL', 'UN', 30, 2.2, 'ATIVO'],
    ['Antisséptico (frasco 1 L)', 'MATERIAL', 'FR', 5, 18, 'INATIVO'],
  ].map(([descricao, tipo, unidade, estoqueMinimo, custoAquisicao, situacao]) =>
    novo('produtos', { descricao, tipo, unidade, estoqueMinimo, controlaLote: true, custoAquisicao, situacao })
  );
  const lotesDeEstoque = [];
  produtos.forEach((produto, i) => {
    lotesDeEstoque.push(novo('lotes', {
      numero: `L${zeros(i * 2 + 1, 5)}`, validade: dia(i === 4 ? 20 : 200 + i * 15),
      quantidade: i === 3 ? 8 : produto.estoqueMinimo * 3, idProduto: produto.id,
    }));
    if (i === 0 || i === 6) {
      lotesDeEstoque.push(novo('lotes', {
        numero: `L${zeros(i * 2 + 2, 5)}`, validade: dia(i === 0 ? -5 : 90), quantidade: 12, idProduto: produto.id,
      }));
    }
  });
  const compra = titulosPagar[0];
  lotesDeEstoque.forEach((lote) =>
    novo('movimentacoes', {
      dataHora: `${dia(-30)}T09:00:00`, tipo: 'ENTRADA', quantidade: lote.quantidade + 10, origem: 'COMPRA',
      justificativa: null, idLote: lote.id, idConsulta: null, idTituloPagar: compra.id, ajusteSituacao: null,
    })
  );
  const dispensaveis = lotesDeEstoque.filter((l) => [1, 4, 5].includes(l.idProduto) && l.validade > data);
  const comDispensacao = [
    ...finalizadas.filter((c) => [demo.id, representada.id].includes(c.idPaciente)).slice(0, 3),
    ...s.embaralhar(finalizadas).slice(0, 10),
  ];
  comDispensacao.forEach((c) =>
    novo('movimentacoes', {
      dataHora: somarMinutos(c.dataHora, 20), tipo: 'SAIDA', quantidade: s.inteiro(1, 2), origem: 'DISPENSACAO',
      justificativa: null, idLote: s.escolher(dispensaveis).id, idConsulta: c.id, idTituloPagar: null, ajusteSituacao: null,
    })
  );
  const vencido = lotesDeEstoque.find((l) => l.validade < data);
  novo('movimentacoes', {
    dataHora: `${dia(-4)}T17:00:00`, tipo: 'SAIDA', quantidade: vencido.quantidade, origem: 'DESCARTE',
    justificativa: 'Lote vencido', idLote: vencido.id, idConsulta: null, idTituloPagar: null, ajusteSituacao: null,
  });
  [['A_APROVAR', -1, -2], ['APROVADO', -9, 3]].forEach(([ajusteSituacao, d, quantidade]) =>
    novo('movimentacoes', {
      dataHora: `${dia(d)}T16:30:00`, tipo: 'AJUSTE', quantidade, origem: 'AJUSTE_INVENTARIO',
      justificativa: 'Diferença encontrada na contagem de inventário.', idLote: lotesDeEstoque[2].id,
      idConsulta: null, idTituloPagar: null, ajusteSituacao,
    })
  );
  novo('alertasEstoque', { tipo: 'MINIMO', dataGeracao: dia(-1), situacao: 'ABERTO', idProduto: 4, idLote: null });
  novo('alertasEstoque', { tipo: 'VALIDADE', dataGeracao: dia(-2), situacao: 'ABERTO', idProduto: 5, idLote: lotesDeEstoque.find((l) => l.idProduto === 5).id });
  novo('alertasEstoque', { tipo: 'VALIDADE', dataGeracao: dia(-6), situacao: 'RESOLVIDO', idProduto: 1, idLote: vencido.id });

  // ── Gestão ───────────────────────────────────────────────────────────────
  const administrador = usuarioDe.get(administradores[0].id).id;
  [
    ['Atendimentos por médico', -30, -1, 'PRONTO', 'PDF'],
    ['Glosas por operadora', -60, -1, 'PRONTO', 'CSV'],
    ['Recebimentos por meio de pagamento', -7, -1, 'GERANDO', 'XLSX'],
  ].forEach(([nome, inicio, fim, situacao, formato]) =>
    novo('relatorios', {
      nome, periodoInicio: dia(inicio), periodoFim: dia(fim),
      geradoEm: situacao === 'PRONTO' ? `${dia(-1)}T07:00:00` : null, situacao, formato, idUsuario: administrador,
    })
  );

  // Alguns registros de log anteriores, para a tela A-31 não nascer vazia.
  [
    ['LOGIN', SECRETARIA, 'POST /login', `usuarios/${usuarioSecretaria}`, 'PERMITIDO', null, usuarioSecretaria],
    ['LER', SECRETARIA, `GET /registrosClinicos`, 'registrosClinicos', 'NEGADO', 'PAPEL', usuarioSecretaria],
    ['LER', null, 'GET /db', 'db', 'NEGADO', 'SEM_SESSAO', null],
    ['LER', MEDICO, `GET /prontuarios/${prontuarioDe.get(adultos[24].id)?.id ?? 1}`, `prontuarios/${prontuarioDe.get(adultos[24].id)?.id ?? 1}`, 'NEGADO', 'FORA_DO_ALCANCE', usuarioDe.get(ativos[0].id).id],
  ].forEach(([acao, papel, rota, registroAlvo, resultado, motivo, idUsuario], i) =>
    novo('logsAuditoria', { dataHora: `${dia(-1)}T${zeros(8 + i, 2)}:00:00`, acao, papel, rota, registroAlvo, resultado, motivo, idUsuario })
  );

  for (const colecao of COLECOES) {
    if (!Array.isArray(db[colecao])) throw new Error(`Coleção ausente: ${colecao}`);
  }
  return db;
}

function principal() {
  const argumentos = process.argv.slice(2);
  const valorDe = (nome) => {
    const i = argumentos.indexOf(nome);
    return i >= 0 ? argumentos[i + 1] : undefined;
  };
  const data = valorDe('--data') ?? DATA_PADRAO;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('Use --data AAAA-MM-DD.');
  const saida = valorDe('--saida') ?? path.join(__dirname, 'db.json');
  const db = gerarBanco({ data });
  fs.writeFileSync(saida, JSON.stringify(db, null, 2));
  const total = COLECOES.reduce((soma, c) => soma + db[c].length, 0);
  console.log(`${COLECOES.length} coleções e ${total} registros sintéticos gravados em ${saida}`);
}

if (require.main === module) principal();

module.exports = { gerarBanco, DATA_PADRAO };
