'use strict';

// Matriz de acesso da API simulada: quem lê e escreve cada coleção, em que
// alcance e sem quais campos. Fonte: docs/redesenho/02-matriz-por-papel.md
// (matriz consolidada da Especificação v2.0 e decisões D1 a D28).
//
// Regras gerais (RC03):
// - papel sem regra para a coleção não lê nem escreve nela: a rota recusa
//   antes de qualquer busca e grava a negação;
// - registro fora do alcance do usuário responde como inexistente;
// - campo oculto não sai na resposta e não pode ser escrito;
// - nenhum campo cujo nome comece por "senha" sai em resposta alguma.

const { afetadasPeloBloqueio, conferirHorario, horasEntre, somarDias } = require('./agenda');

const A = 'ADMINISTRADOR';
const M = 'MEDICO';
const S = 'SECRETARIA';
const P = 'PACIENTE';
const R = 'RESPONSAVEL_LEGAL';
const PAPEIS = [A, M, S, P, R];

// As 52 coleções do banco, na ordem dos cinco arquivos de origem, mais
// relatorios (A-30).
const COLECOES = [
  // Pessoas
  'pessoas', 'administradores', 'secretarias', 'medicos', 'pacientes',
  'responsaveisLegais',
  // Acesso e autorização
  'usuarios', 'logsAuditoria', 'parametros', 'representacoes', 'vinculos',
  'acessosExcecao', 'solicitacoesTitular', 'notificacoes', 'exportacoes',
  // Agenda e prontuário
  'convenios', 'procedimentos', 'gradesHorario', 'bloqueiosAgenda',
  'consultas', 'prontuarios', 'anexos', 'registrosClinicos', 'retificacoes',
  'prescricoes', 'itensPrescricao', 'anotacoesPrivadas',
  // Cobrança e financeiro
  'orcamentos', 'itensOrcamento', 'cobrancas', 'caixas', 'movimentosCaixa', 'pagamentos',
  'pagamentosPix', 'pagamentosCartao', 'pagamentosDinheiro', 'titulosReceber',
  'estornos', 'documentosFiscais', 'titulosPagar',
  // Convênio, TISS e estoque
  'contratosOperadora', 'itensTabelaPreco', 'elegibilidades', 'autorizacoes',
  'lotesCobranca', 'guiasTiss', 'glosas', 'recursosGlosa', 'coparticipacoes',
  'produtos', 'lotes', 'movimentacoes', 'alertasEstoque',
  // Gestão
  'relatorios',
];

// Coleções cuja leitura também é registrada no log (RF40).
const CLINICAS = new Set([
  'prontuarios', 'anexos', 'registrosClinicos', 'retificacoes', 'prescricoes',
  'itensPrescricao', 'anotacoesPrivadas',
]);

const igual = (a, b) => a != null && b != null && String(a) === String(b);
const ehSenha = (campo) => /^senha/i.test(campo);

// Paciente a quem um registro pertence, seguindo as chaves estrangeiras.
// Coleções fora desta tabela usam o campo idPaciente.
const viaConsulta = (r, ctx) =>
  pacienteDe('consultas', ctx.buscar('consultas', r.idConsulta), ctx);
const viaProntuario = (r, ctx) => ctx.buscar('prontuarios', r.idProntuario)?.idPaciente;
const resolvePaciente = {
  pessoas: (r) => r.id,
  pacientes: (r) => r.id,
  registrosClinicos: viaProntuario,
  anexos: (r, ctx) => (r.idProntuario != null ? viaProntuario(r, ctx) : r.idPaciente),
  retificacoes: (r, ctx) =>
    pacienteDe('registrosClinicos', ctx.buscar('registrosClinicos', r.idRegistroClinico), ctx),
  prescricoes: (r, ctx) =>
    pacienteDe('registrosClinicos', ctx.buscar('registrosClinicos', r.idRegistroClinico), ctx),
  itensPrescricao: (r, ctx) =>
    pacienteDe('prescricoes', ctx.buscar('prescricoes', r.idPrescricao), ctx),
  exportacoes: (r, ctx) => {
    if (r.idProntuario != null) return viaProntuario(r, ctx);
    if (r.idSolicitacaoTitular != null) return ctx.buscar('solicitacoesTitular', r.idSolicitacaoTitular)?.idPaciente;
    return r.idPaciente;
  },
  itensOrcamento: (r, ctx) => ctx.buscar('orcamentos', r.idOrcamento)?.idPaciente,
  cobrancas: (r, ctx) =>
    r.idConsulta != null
      ? viaConsulta(r, ctx)
      : ctx.buscar('orcamentos', r.idOrcamento)?.idPaciente,
  pagamentos: (r, ctx) => pacienteDe('cobrancas', ctx.buscar('cobrancas', r.idCobranca), ctx),
  // Os três tipos de pagamento herdam de pagamentos pelo id.
  pagamentosPix: (r, ctx) => pacienteDe('pagamentos', ctx.buscar('pagamentos', r.id), ctx),
  pagamentosCartao: (r, ctx) => pacienteDe('pagamentos', ctx.buscar('pagamentos', r.id), ctx),
  pagamentosDinheiro: (r, ctx) => pacienteDe('pagamentos', ctx.buscar('pagamentos', r.id), ctx),
  titulosReceber: (r, ctx) =>
    r.idCobranca != null
      ? pacienteDe('cobrancas', ctx.buscar('cobrancas', r.idCobranca), ctx)
      : pacienteDe('coparticipacoes', ctx.buscar('coparticipacoes', r.idCoparticipacao), ctx),
  estornos: (r, ctx) =>
    r.idPagamento != null
      ? pacienteDe('pagamentos', ctx.buscar('pagamentos', r.idPagamento), ctx)
      : pacienteDe('titulosReceber', ctx.buscar('titulosReceber', r.idTituloReceber), ctx),
  documentosFiscais: (r, ctx) =>
    pacienteDe('titulosReceber', ctx.buscar('titulosReceber', r.idTituloReceber), ctx),
  notificacoes: (r, ctx) => (r.idConsulta != null ? viaConsulta(r, ctx) : r.idPessoa),
  autorizacoes: viaConsulta,
  guiasTiss: viaConsulta,
  coparticipacoes: viaConsulta,
  movimentacoes: viaConsulta,
  glosas: (r, ctx) => pacienteDe('guiasTiss', ctx.buscar('guiasTiss', r.idGuiaTiss), ctx),
  recursosGlosa: (r, ctx) => pacienteDe('glosas', ctx.buscar('glosas', r.idGlosa), ctx),
};

function pacienteDe(colecao, registro, ctx) {
  if (!registro) return undefined;
  const resolver = resolvePaciente[colecao];
  return resolver ? resolver(registro, ctx) : registro.idPaciente;
}

// Alcances de leitura.
const todos = () => true;
const proprio = (r, ctx) => igual(r.id, ctx.sessao.idPessoa);
const doMedico = (r, ctx) => igual(r.idMedico, ctx.sessao.idPessoa);
// Paciente do registro dentro do alcance da sessão: vínculo Ativo ou Histórico
// ou acesso de exceção vigente para o Médico (RC05); a própria pessoa para o
// Paciente; o representado selecionado para o Responsável Legal (A1-R11).
// Quando o registro também traz idPaciente, os dois caminhos precisam cair
// no alcance, para que uma chave não contradiga a outra.
const doPaciente = (colecao) => (r, ctx) => {
  const alcance = ctx.alcance();
  const id = pacienteDe(colecao, r, ctx);
  return (
    id != null &&
    alcance.has(String(id)) &&
    (r.idPaciente == null || alcance.has(String(r.idPaciente)))
  );
};
const e = (...fs) => (r, ctx) => fs.every((f) => f(r, ctx));
const ou = (...fs) => (r, ctx) => fs.some((f) => f(r, ctx));
const comCampo = (campo, valor) => (r) => r[campo] === valor;
const ehMedico = (r, ctx) => Boolean(ctx.buscar('medicos', r.id));

// Campos ocultos que dependem do registro: "só estes campos ficam".
const soMostrar = (...visiveis) => (r) =>
  Object.keys(r).filter((campo) => !visiveis.includes(campo));

const fixarPessoa = (campo) => (ctx) => ({ [campo]: ctx.sessao.idPessoa });
const fixarTitular = (ctx) => ({ idPaciente: ctx.titular() });

// Transições de status da consulta por papel (máquina de estados do RF22 na
// v2.0, D1 e PR-01). Só o Médico leva o paciente de Na Recepção a Em
// Atendimento, ao chamá-lo, e só ele faz as transições retroativas.
const TRANSICOES = {
  [A]: { AGENDADO: ['CANCELADO'], NA_RECEPCAO: ['CANCELADO'] },
  [S]: {
    AGENDADO: ['NA_RECEPCAO', 'CANCELADO', 'NAO_COMPARECEU'],
    NA_RECEPCAO: ['CANCELADO', 'NAO_COMPARECEU'],
  },
  [M]: {
    NA_RECEPCAO: ['EM_ATENDIMENTO'],
    EM_ATENDIMENTO: ['FINALIZADO', 'NA_RECEPCAO'],
    FINALIZADO: ['EM_ATENDIMENTO'],
  },
  [P]: { AGENDADO: ['CANCELADO'] },
  [R]: { AGENDADO: ['CANCELADO'] },
};
// Retroativas exigem motivo na própria requisição e ficam destacadas no log.
// Voltar de Finalizado não reabre o registro clínico selado.
const RETROATIVAS = new Set(['EM_ATENDIMENTO>NA_RECEPCAO', 'FINALIZADO>EM_ATENDIMENTO']);
const ehRetroativa = (novo, antigo) => RETROATIVAS.has(`${antigo.status}>${novo.status}`);
const textoInformado = (valor, minimo = 5) => typeof valor === 'string' && valor.trim().length >= minimo;

// Campos da consulta que a recepção muda depois de criada: status, remarcação
// (RF20) e convênio (RF17).
const EDITAVEIS_DA_RECEPCAO = [
  'status', 'motivoCancelamento', 'dataHora', 'idMedico', 'motivoRemarcacao',
  'idConvenio', 'numeroCarteirinha', 'convenioConferido',
];

// O que o servidor calcula ao agendar: a duração vem do procedimento (RF16,
// passo 3), o preço vigente fica como referência (RN-16.2) e o convênio nasce
// a conferir pela recepção (RN-17.3).
function completarConsulta(novo, ctx) {
  const procedimento = ctx.buscar('procedimentos', novo.idProcedimento);
  novo.duracao = procedimento?.duracaoPadrao ?? 30;
  novo.valorReferencia = procedimento?.precoParticular ?? null;
  novo.idConvenio = novo.idConvenio ?? null;
  novo.numeroCarteirinha = novo.idConvenio != null ? novo.numeroCarteirinha ?? null : null;
  novo.convenioConferido = novo.idConvenio != null ? false : null;
  novo.canalOrigem = novo.canalOrigem ?? 'RECEPCAO';
  novo.motivoCancelamento = novo.motivoCancelamento ?? null;
}

function validarConsulta(novo, antigo, ctx, mudancas) {
  if (!antigo && novo.status !== 'AGENDADO') return 'Uma consulta nova começa como Agendada.';
  const papel = ctx.sessao.papel;
  const trocouMedico = Boolean(antigo) && !igual(novo.idMedico, antigo.idMedico);
  const remarcacao = Boolean(antigo) && (novo.dataHora !== antigo.dataHora || trocouMedico);

  if (!antigo || remarcacao) {
    // RF20: só consulta agendada é remarcada, e sempre com motivo.
    if (remarcacao && antigo.status !== 'AGENDADO') return 'Só se remarca consulta agendada.';
    if (remarcacao && !textoInformado(mudancas.motivoRemarcacao)) return 'Informe o motivo da remarcação.';
    if (!antigo && ctx.buscar('pacientes', novo.idPaciente)?.situacao !== 'ATIVO') return 'Escolha um paciente ativo.';
    const medico = ctx.buscar('medicos', novo.idMedico);
    if (medico?.situacao !== 'ATIVO') return 'Escolha um médico ativo.';
    // RF20, passo 3: na falta de horário, outro médico da mesma especialidade.
    if (trocouMedico && ctx.buscar('medicos', antigo.idMedico)?.especialidade !== medico.especialidade) {
      return 'Remarque com um médico da mesma especialidade.';
    }
    if (!antigo && ctx.buscar('procedimentos', novo.idProcedimento)?.situacao !== 'ATIVO') {
      return 'Escolha o tipo de atendimento.';
    }
    const erro = conferirHorario(ctx.db, novo, { agora: ctx.agoraClinica(), ignorarId: antigo?.id });
    if (erro) return erro;
  }

  // RF17: convênio da consulta, com a carteirinha do beneficiário.
  if (!antigo || mudou('idConvenio', novo, antigo) || mudou('numeroCarteirinha', novo, antigo)) {
    if (novo.idConvenio != null) {
      if (ctx.buscar('convenios', novo.idConvenio)?.situacao !== 'ATIVO') return 'Escolha um convênio ativo.';
      if (!textoInformado(novo.numeroCarteirinha, 3)) return 'Informe o número da carteirinha.';
    }
  }

  if (!antigo) return null;
  if (novo.status !== antigo.status) {
    const permitidas = TRANSICOES[papel][antigo.status] ?? [];
    if (!permitidas.includes(novo.status)) {
      return 'Mudança de status não permitida.';
    }
    if (novo.status === 'CANCELADO' && [A, S].includes(papel) && !novo.motivoCancelamento) {
      return 'Informe o motivo do cancelamento.';
    }
    // RF19, E1: pelo portal, só até X08 horas antes.
    if (novo.status === 'CANCELADO' && [P, R].includes(papel)) {
      const minimo = ctx.parametro('X08', 24);
      if (horasEntre(ctx.agoraClinica(), antigo.dataHora) < minimo) {
        return `Cancelamento pelo portal disponível até ${minimo} horas antes. Entre em contato com a recepção.`;
      }
    }
    if (ehRetroativa(novo, antigo) && !textoInformado(mudancas.motivoTransicao)) {
      return 'Informe o motivo da volta de status.';
    }
  }
  return null;
}

// RF21: o aviso leva só data, hora, médico e local; o conteúdo não fica aqui.
// Vai por mensagem ao telefone do paciente ou, sem telefone, por e-mail.
function notificar(ctx, consulta, evento) {
  const pessoa = ctx.buscar('pessoas', consulta.idPaciente);
  const porTelefone = Boolean(pessoa?.telefone);
  ctx.inserir('notificacoes', {
    evento,
    canal: porTelefone ? 'WHATSAPP' : 'EMAIL',
    destino: porTelefone ? pessoa.telefone : pessoa?.email ?? null,
    dataEnvio: ctx.agoraClinica(),
    situacao: 'ENVIADA',
    tentativas: 1,
    idPessoa: consulta.idPaciente,
    idConsulta: consulta.id,
    idParametro: null,
  });
}

// RN-16.1: agendar cria o vínculo pendente com o médico. Vínculo Ativo ou
// Histórico fica como está, para não tirar do médico o acesso que ele já tem.
function vincularPendente(ctx, idPaciente, idMedico) {
  const vinculo = ctx.db.vinculos.find((v) => igual(v.idPaciente, idPaciente) && igual(v.idMedico, idMedico));
  const pendente = { estado: 'PENDENTE', dataInicio: ctx.hojeClinica(), dataFim: null, motivoEncerramento: null };
  if (!vinculo) ctx.inserir('vinculos', { ...pendente, idPaciente, idMedico });
  else if (vinculo.estado === 'ENCERRADO') Object.assign(vinculo, pendente);
}

// RF19, passo 3: sem consulta agendada com o médico, o vínculo pendente acaba.
function encerrarPendente(ctx, idPaciente, idMedico) {
  const vinculo = ctx.db.vinculos.find((v) => igual(v.idPaciente, idPaciente) && igual(v.idMedico, idMedico));
  if (vinculo?.estado !== 'PENDENTE') return;
  const resta = ctx.db.consultas.some(
    (c) => igual(c.idPaciente, idPaciente) && igual(c.idMedico, idMedico) && c.status === 'AGENDADO'
  );
  if (!resta) {
    Object.assign(vinculo, { estado: 'ENCERRADO', dataFim: ctx.hojeClinica(), motivoEncerramento: 'Consulta cancelada antes do atendimento' });
  }
}

function aposCriarConsulta(consulta, ctx) {
  vincularPendente(ctx, consulta.idPaciente, consulta.idMedico);
  notificar(ctx, consulta, 'CONFIRMACAO_AGENDAMENTO');
}

// Cancelamento e remarcação avisam o paciente (RF19, RF20); a troca de
// médico na remarcação passa o vínculo pendente para o novo (RN-20.2).
function aposEditarConsulta(novo, antigo, ctx) {
  aposMudarStatus(novo, antigo, ctx);
  if (novo.status === 'CANCELADO' && antigo.status !== 'CANCELADO') {
    notificar(ctx, novo, [P, R].includes(ctx.sessao.papel) ? 'CANCELAMENTO_PELO_TITULAR' : 'CANCELAMENTO_CONSULTA');
    encerrarPendente(ctx, novo.idPaciente, novo.idMedico);
    return;
  }
  const trocouMedico = !igual(novo.idMedico, antigo.idMedico);
  if (novo.dataHora !== antigo.dataHora || trocouMedico) {
    if (trocouMedico) {
      vincularPendente(ctx, novo.idPaciente, novo.idMedico);
      encerrarPendente(ctx, novo.idPaciente, antigo.idMedico);
    }
    notificar(ctx, novo, 'REMARCACAO_CONSULTA');
  }
}

// RF14: quantas consultas ainda por acontecer o bloqueio em vigor atinge.
function contarAtingidas(bloqueio, ctx) {
  bloqueio.consultasAfetadas = bloqueio.situacao === 'ATIVO' ? afetadasPeloBloqueio(ctx.db, bloqueio).length : 0;
}
const recontarAtingidas = (atual, antigo, ctx) => contarAtingidas(atual, ctx);

// RF32 e RF58: ao finalizar, o atendimento particular gera a cobrança do
// paciente pelo preço gravado no agendamento (RN-16.2); o de convênio, só se a
// coparticipação já foi apurada. Uma consulta não gera duas cobranças.
function gerarCobranca(ctx, consulta) {
  if (ctx.db.cobrancas.some((c) => igual(c.idConsulta, consulta.id))) return;
  const coparticipacao =
    consulta.idConvenio != null ? ctx.db.coparticipacoes.find((c) => igual(c.idConsulta, consulta.id)) : null;
  const valor =
    consulta.idConvenio == null
      ? consulta.valorReferencia ?? ctx.buscar('procedimentos', consulta.idProcedimento)?.precoParticular
      : coparticipacao?.valorApurado;
  if (!(valor > 0)) return;
  const hoje = ctx.hojeClinica();
  const cobranca = ctx.inserir('cobrancas', {
    dataEmissao: hoje, valorTotal: valor, situacao: 'ABERTA', idConsulta: consulta.id, idOrcamento: null, vencimento: hoje,
  });
  ctx.inserir('titulosReceber', {
    origem: coparticipacao ? 'COPARTICIPACAO' : 'PARTICULAR', vencimento: hoje, valor, situacao: 'ABERTO',
    idCobranca: cobranca.id, idLoteCobranca: null, idCoparticipacao: coparticipacao?.id ?? null,
  });
}

// Ao chamar o paciente, o vínculo com o médico passa a Ativo e o prontuário
// passa a existir (RF05). A transição retroativa ganha um registro próprio no
// log, só com a referência; o motivo fica na consulta.
function aposMudarStatus(novo, antigo, ctx) {
  if (ehRetroativa(novo, antigo)) {
    ctx.auditar({
      acao: 'TRANSICAO_RETROATIVA',
      registroAlvo: `consultas/${novo.id}`,
      resultado: 'PERMITIDO',
      motivo: `${antigo.status}>${novo.status}`,
    });
    return;
  }
  if (novo.status === 'FINALIZADO' && antigo.status !== 'FINALIZADO') {
    selarRegistros(ctx, novo);
    gerarCobranca(ctx, novo);
  }
  if (antigo.status !== 'NA_RECEPCAO' || novo.status !== 'EM_ATENDIMENTO') return;
  const hoje = ctx.agoraTexto().slice(0, 10);
  const vinculo = ctx.db.vinculos.find(
    (v) => igual(v.idPaciente, novo.idPaciente) && igual(v.idMedico, novo.idMedico)
  );
  if (vinculo) {
    Object.assign(vinculo, { estado: 'ATIVO', dataFim: null, motivoEncerramento: null });
  } else {
    ctx.inserir('vinculos', {
      estado: 'ATIVO', dataInicio: hoje, dataFim: null, motivoEncerramento: null,
      idPaciente: novo.idPaciente, idMedico: novo.idMedico,
    });
  }
  if (!ctx.db.prontuarios.some((p) => igual(p.idPaciente, novo.idPaciente))) {
    ctx.inserir('prontuarios', { dataAbertura: hoje, situacao: 'ATIVO', idPaciente: novo.idPaciente });
  }
}

// Orçamento em quatro etapas (RF31): o Médico define o escopo, a Secretária
// os valores, o Administrador aprova e o titular aceita ou recusa.
const ETAPAS_DO_TITULAR = ['ACEITE', 'ACEITO', 'RECUSADO', 'EXPIRADO'];
const AVANCOS_DO_ORCAMENTO = {
  [M]: { ESCOPO: ['VALORES'], DEVOLVIDO: ['VALORES'] },
  [S]: { VALORES: ['APROVACAO', 'DEVOLVIDO'] },
  [A]: { APROVACAO: ['ACEITE', 'VALORES'] },
  [P]: { ACEITE: ['ACEITO', 'RECUSADO'] },
  [R]: { ACEITE: ['ACEITO', 'RECUSADO'] },
};
const ETAPA_EDITAVEL = { [M]: ['ESCOPO', 'DEVOLVIDO'], [S]: ['VALORES'], [A]: ['APROVACAO'], [P]: ['ACEITE'], [R]: ['ACEITE'] };

function podeEditarOrcamento(atual, ctx) {
  return ETAPA_EDITAVEL[ctx.sessao.papel].includes(atual.etapa)
    ? null
    : 'O orçamento não está na sua etapa.';
}

// Devolver o orçamento pede uma observação para quem o recebe (RF31, D32).
const DEVOLUCOES = new Set(['VALORES>DEVOLVIDO', 'APROVACAO>VALORES']);

function validarOrcamento(novo, antigo, ctx, mudancas) {
  if (!antigo || novo.etapa === antigo.etapa) return null;
  const permitidas = AVANCOS_DO_ORCAMENTO[ctx.sessao.papel][antigo.etapa] ?? [];
  if (!permitidas.includes(novo.etapa)) return 'Mudança de etapa não permitida.';
  if (DEVOLUCOES.has(`${antigo.etapa}>${novo.etapa}`) && !textoInformado(mudancas.observacaoDevolucao)) {
    return 'Escreva a observação da devolução.';
  }
  return null;
}

// Fechamento cego do caixa (RF47, D5): a Secretária informa o valor contado;
// o servidor calcula o esperado e a divergência, que ela não vê. Reforço soma
// e sangria tira do esperado.
function saldoEsperado(caixa, ctx) {
  const recebido = ctx.db.pagamentosDinheiro
    .filter((p) => igual(p.idCaixa, caixa.id))
    .reduce((soma, p) => soma + (p.valorRecebido ?? 0) - (p.troco ?? 0), caixa.saldoInicial ?? 0);
  return (ctx.db.movimentosCaixa ?? [])
    .filter((m) => igual(m.idCaixa, caixa.id))
    .reduce((soma, m) => soma + (m.tipo === 'REFORCO' ? m.valor : -m.valor), recebido);
}

function validarFechamento(novo, antigo, ctx) {
  if (!antigo) {
    // RN-47.2: não se abre turno novo com o anterior aberto.
    if (ctx.db.caixas.some((c) => c.situacao === 'ABERTO' && igual(c.idSecretaria, novo.idSecretaria))) {
      return 'Feche o caixa aberto antes de abrir outro turno.';
    }
    return typeof novo.saldoInicial === 'number' && novo.saldoInicial >= 0 ? null : 'Informe o fundo de troco.';
  }
  if (novo.dataFechamento == null) return null;
  if (typeof novo.saldoContado !== 'number') return 'Informe o valor contado.';
  const divergente = Math.abs(novo.saldoContado - saldoEsperado(novo, ctx)) >= 0.005;
  return divergente && !novo.justificativa ? 'Justifique a diferença no fechamento.' : null;
}

// Fecha na primeira contagem e recalcula na recontagem pedida pelo Administrador.
function fecharCaixa(caixa, antigo, ctx) {
  const fechando = antigo.dataFechamento == null && caixa.dataFechamento != null;
  if (!fechando && antigo.situacao !== 'RECONTAGEM') return;
  const esperado = saldoEsperado(caixa, ctx);
  caixa.saldoApurado = esperado;
  caixa.divergencia = Math.round((caixa.saldoContado - esperado) * 100) / 100;
  caixa.situacao = caixa.divergencia === 0 ? 'FECHADO' : 'A_APROVAR';
}

function validarMovimentoCaixa(novo, antigo, ctx) {
  if (!['SANGRIA', 'REFORCO'].includes(novo.tipo)) return 'Escolha sangria ou reforço.';
  if (!(typeof novo.valor === 'number' && novo.valor > 0)) return 'Informe o valor.';
  if (!textoInformado(novo.motivo)) return 'Informe o motivo.';
  const caixa = ctx.buscar('caixas', novo.idCaixa);
  if (caixa?.situacao !== 'ABERTO' || !igual(caixa.idSecretaria, ctx.sessao.idPessoa)) return 'Lance só no seu caixa aberto.';
  return null;
}

// A-13b: cobrança de uma consulta finalizada ou de um orçamento aceito que
// ainda não têm cobrança, com valor e vencimento.
function validarCobranca(novo, antigo, ctx) {
  if (!(typeof novo.valorTotal === 'number' && novo.valorTotal > 0)) return 'Informe o valor.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(novo.vencimento ?? '')) return 'Informe o vencimento.';
  if (antigo) return null;
  if ([novo.idConsulta, novo.idOrcamento].filter((x) => x != null).length !== 1) {
    return 'Escolha a consulta ou o orçamento de origem.';
  }
  if (novo.idConsulta != null) {
    const consulta = ctx.buscar('consultas', novo.idConsulta);
    if (consulta?.status !== 'FINALIZADO') return 'Escolha uma consulta finalizada.';
    if (ctx.db.cobrancas.some((c) => igual(c.idConsulta, consulta.id))) return 'Esta consulta já tem cobrança.';
    return null;
  }
  const orcamento = ctx.buscar('orcamentos', novo.idOrcamento);
  if (orcamento?.etapa !== 'ACEITO') return 'Escolha um orçamento aceito.';
  if (ctx.db.cobrancas.some((c) => igual(c.idOrcamento, orcamento.id))) return 'Este orçamento já tem cobrança.';
  return null;
}

// Pagamento que não aconteceu (negado, expirado, recusado) não trava a edição.
const SEM_EFEITO = ['NEGADO', 'EXPIRADO', 'CANCELADO', 'NAO_REALIZADO', 'RECUSADO'];
const podeEditarCobranca = (atual, ctx) =>
  atual.situacao !== 'ABERTA' ||
  ctx.db.pagamentos.some((p) => igual(p.idCobranca, atual.id) && !SEM_EFEITO.includes(p.situacao))
    ? 'Cobrança com pagamento não se edita; a correção é por estorno.'
    : null;

function criarTituloDaCobranca(cobranca, ctx) {
  const consulta = ctx.buscar('consultas', cobranca.idConsulta);
  ctx.inserir('titulosReceber', {
    origem: cobranca.idOrcamento != null ? 'ORCAMENTO' : consulta?.idConvenio != null ? 'COPARTICIPACAO' : 'PARTICULAR',
    vencimento: cobranca.vencimento,
    valor: cobranca.valorTotal,
    situacao: 'ABERTO',
    idCobranca: cobranca.id,
    idLoteCobranca: null,
    idCoparticipacao: null,
  });
}

function acertarTituloDaCobranca(cobranca, antigo, ctx) {
  for (const t of ctx.db.titulosReceber.filter((x) => igual(x.idCobranca, cobranca.id) && x.situacao === 'ABERTO')) {
    t.valor = cobranca.valorTotal;
    t.vencimento = cobranca.vencimento;
  }
}

// Itens dispensados ao paciente no alcance da sessão.
function loteDispensadoAoTitular(idLote, ctx) {
  return ctx.db.movimentacoes.some(
    (m) => igual(m.idLote, idLote) && m.origem === 'DISPENSACAO' && doPaciente('movimentacoes')(m, ctx)
  );
}
const produtoDispensadoAoTitular = (r, ctx) =>
  ctx.db.lotes.some((l) => igual(l.idProduto, r.id) && loteDispensadoAoTitular(l.id, ctx));

// ── Prontuário (RF06, RF23 a RF25, RF28) ─────────────────────────────────
const CAMPOS_CLINICOS = ['queixas', 'exameFisico', 'diagnostico', 'cid', 'conduta'];
// A prescrição selada também só muda por retificação (RF25, passo 5).
const CAMPOS_RETIFICAVEIS = [...CAMPOS_CLINICOS, 'prescricao'];
const CLASSIFICACOES = ['COMUM', 'ANTIMICROBIANO', 'CONTROLE_ESPECIAL'];

// O autor é quem criou o registro; nos registros antigos, o médico da consulta.
const autorDoRegistro = (registro, ctx) => registro?.idMedico ?? ctx.buscar('consultas', registro?.idConsulta)?.idMedico;

// RF23: só há registro de consulta em atendimento, do próprio médico, um por
// consulta. O servidor liga o registro ao prontuário e marca o feito sob
// acesso de exceção (RN-06.2).
function completarRegistro(novo, ctx) {
  const consulta = ctx.buscar('consultas', novo.idConsulta);
  const idPaciente = consulta?.idPaciente;
  novo.idProntuario = ctx.db.prontuarios.find((p) => igual(p.idPaciente, idPaciente))?.id ?? null;
  novo.dataHora = ctx.agoraClinica();
  novo.selado = false;
  novo.idMedico = ctx.sessao.idPessoa;
  novo.sobExcecao = !ctx.db.vinculos.some(
    (v) => igual(v.idMedico, ctx.sessao.idPessoa) && igual(v.idPaciente, idPaciente) && v.estado === 'ATIVO'
  );
  for (const campo of CAMPOS_CLINICOS) if (typeof novo[campo] !== 'string') novo[campo] = '';
}

function validarRegistro(novo, antigo, ctx) {
  if (antigo) return null;
  const consulta = ctx.buscar('consultas', novo.idConsulta);
  if (!consulta || !igual(consulta.idMedico, ctx.sessao.idPessoa)) return 'Escolha uma consulta sua.';
  if (consulta.status !== 'EM_ATENDIMENTO') return 'Só existe registro clínico de consulta em atendimento.';
  if (ctx.db.registrosClinicos.some((r) => igual(r.idConsulta, consulta.id))) return 'Esta consulta já tem registro.';
  if (novo.idProntuario == null) return 'O paciente ainda não tem prontuário.';
  return null;
}

// A5-R03 e RF23, E2: selado ou fora de atendimento, só por retificação.
function podeEditarRegistro(atual, ctx) {
  if (atual.selado) return 'Registro selado: use a retificação.';
  if (!igual(autorDoRegistro(atual, ctx), ctx.sessao.idPessoa)) return 'Só o autor edita o registro.';
  const consulta = ctx.buscar('consultas', atual.idConsulta);
  if (consulta && consulta.status !== 'EM_ATENDIMENTO') return 'A consulta saiu de atendimento: use a retificação.';
  return null;
}

// RF22 e RN-23.2: finalizar sela o registro; voltar de Finalizado não dessela.
function selarRegistros(ctx, consulta) {
  for (const r of ctx.db.registrosClinicos.filter((x) => igual(x.idConsulta, consulta.id) && !x.selado)) {
    r.selado = true;
    r.dataSelagem = ctx.agoraClinica();
  }
}

// RF24: a retificação guarda o texto vigente antes dela e nunca apaga nada.
function valorVigente(ctx, registro, campo) {
  const ultima = ctx.db.retificacoes.filter((r) => igual(r.idRegistroClinico, registro.id) && r.campo === campo).at(-1);
  if (ultima) return ultima.textoCorrigido;
  return campo === 'prescricao' ? '' : registro[campo] ?? '';
}

function completarRetificacao(novo, ctx) {
  const registro = ctx.buscar('registrosClinicos', novo.idRegistroClinico);
  novo.dataHora = ctx.agoraClinica();
  novo.idMedico = ctx.sessao.idPessoa;
  novo.textoAnterior = registro && CAMPOS_RETIFICAVEIS.includes(novo.campo) ? valorVigente(ctx, registro, novo.campo) : null;
}

function validarRetificacao(novo, antigo, ctx) {
  const registro = ctx.buscar('registrosClinicos', novo.idRegistroClinico);
  if (!registro) return 'Escolha o registro.';
  if (!registro.selado) return 'O registro ainda está em edição: altere direto.';
  // RN-24.2: só o autor retifica; outro médico faz o próprio registro.
  if (!igual(autorDoRegistro(registro, ctx), ctx.sessao.idPessoa)) return 'Só o autor retifica o registro.';
  if (!CAMPOS_RETIFICAVEIS.includes(novo.campo)) return 'Escolha o que será retificado.';
  if (!textoInformado(novo.motivo)) return 'Informe o motivo da retificação.';
  // RN-24.3: cada retificação tem motivo próprio.
  const motivo = novo.motivo.trim().toLowerCase();
  if (ctx.db.retificacoes.some((r) => igual(r.idRegistroClinico, registro.id) && (r.motivo ?? '').trim().toLowerCase() === motivo)) {
    return 'Use um motivo diferente dos de retificações anteriores deste registro.';
  }
  if (typeof novo.textoCorrigido !== 'string' || !novo.textoCorrigido.trim()) return 'Escreva o texto corrigido.';
  if (novo.textoCorrigido.trim() === (novo.textoAnterior ?? '').trim()) return 'O texto corrigido é igual ao vigente.';
  return null;
}

// RF25: a prescrição nasce do registro da consulta em atendimento.
function completarPrescricao(novo, ctx) {
  const registro = ctx.buscar('registrosClinicos', novo.idRegistroClinico);
  const hoje = ctx.hojeClinica();
  novo.dataEmissao = hoje;
  novo.validade = somarDias(hoje, 30);
  novo.idPaciente = registro ? ctx.buscar('prontuarios', registro.idProntuario)?.idPaciente ?? null : null;
  novo.tipoReceita = 'SIMPLES';
  // A assinatura ICP-Brasil está fora do escopo do protótipo (RF25, passo 3).
  novo.assinaturaDigital = false;
  novo.idMedico = ctx.sessao.idPessoa;
}

function prescricaoAberta(registro, ctx) {
  if (!registro) return 'A prescrição sai do registro da consulta em atendimento.';
  if (registro.selado) return 'Prescrição selada: use a retificação.';
  if (!igual(autorDoRegistro(registro, ctx), ctx.sessao.idPessoa)) return 'Só o autor do registro prescreve nele.';
  return null;
}

const validarPrescricao = (novo, antigo, ctx) =>
  antigo ? null : prescricaoAberta(ctx.buscar('registrosClinicos', novo.idRegistroClinico), ctx);

const registroDoItem = (item, ctx) =>
  ctx.buscar('registrosClinicos', ctx.buscar('prescricoes', item.idPrescricao)?.idRegistroClinico);

// Classificação sempre escolhida, sem valor padrão (RF25, passo 2).
function validarItemPrescricao(novo, antigo, ctx) {
  const aberta = prescricaoAberta(registroDoItem(novo, ctx), ctx);
  if (aberta) return aberta;
  if (!preenchido(novo.medicamento, 2)) return 'Informe o medicamento.';
  if (!preenchido(novo.concentracao, 1)) return 'Informe a concentração.';
  if (!preenchido(novo.posologia, 3)) return 'Informe a posologia.';
  if (!(Number.isInteger(novo.quantidade) && novo.quantidade > 0)) return 'Informe a quantidade.';
  if (!preenchido(novo.duracao, 1)) return 'Informe a duração do tratamento.';
  if (!CLASSIFICACOES.includes(novo.classificacao)) return 'Escolha a classificação do item.';
  return null;
}

const podeEditarItemPrescricao = (atual, ctx) => prescricaoAberta(registroDoItem(atual, ctx), ctx);

// Receita com item de controle especial vira receita de controle especial.
function acertarTipoDeReceita(item, antigo, ctx) {
  const prescricao = ctx.buscar('prescricoes', item.idPrescricao);
  if (!prescricao) return;
  const itens = ctx.db.itensPrescricao.filter((i) => igual(i.idPrescricao, prescricao.id));
  prescricao.tipoReceita = itens.some((i) => i.classificacao === 'CONTROLE_ESPECIAL') ? 'CONTROLE_ESPECIAL' : 'SIMPLES';
}

// RF06: justificativa com conteúdo, que não repete a anterior nem é só
// caracteres sem sentido.
function validarAcessoExcecao(novo, antigo, ctx) {
  if (!ctx.buscar('pacientes', novo.idPaciente)) return 'Escolha o paciente.';
  const texto = typeof novo.justificativa === 'string' ? novo.justificativa.trim().replace(/\s+/g, ' ') : '';
  const palavras = texto.split(' ').filter((p) => /[a-zà-ü]{2,}/i.test(p));
  if (texto.length < 20 || palavras.length < 4) return 'Descreva a situação que exige o acesso, com ao menos quatro palavras.';
  const letras = texto.toLowerCase().replace(/[^a-zà-ü]/g, '');
  if (/(.)\1{3,}/.test(letras) || new Set(letras).size < 6) return 'A justificativa precisa ser legível para a auditoria.';
  const anterior = ctx.db.acessosExcecao.filter((a) => igual(a.idMedico, ctx.sessao.idPessoa)).at(-1);
  if (anterior && (anterior.justificativa ?? '').trim().replace(/\s+/g, ' ').toLowerCase() === texto.toLowerCase()) {
    return 'Escreva uma justificativa nova; não repita a do acesso anterior.';
  }
  return null;
}

// RF06: registro destacado no log, aviso ao Administrador no ato e, no
// segundo pedido sobre o mesmo paciente em 30 dias, a marca de padrão atípico.
function aposCriarAcessoExcecao(acesso, ctx) {
  const desde = somarDias(acesso.dataHora.slice(0, 10), -30);
  acesso.padraoAtipico = ctx.db.acessosExcecao.some(
    (a) =>
      a !== acesso && igual(a.idMedico, acesso.idMedico) && igual(a.idPaciente, acesso.idPaciente) && a.dataHora.slice(0, 10) >= desde
  );
  ctx.auditar({
    acao: 'ACESSO_EXCECAO',
    registroAlvo: `acessosExcecao/${acesso.id}`,
    resultado: 'PERMITIDO',
    motivo: acesso.padraoAtipico ? 'PADRAO_ATIPICO' : 'EXCECAO',
  });
  for (const admin of ctx.db.administradores) {
    const pessoa = ctx.buscar('pessoas', admin.id);
    ctx.inserir('notificacoes', {
      evento: acesso.padraoAtipico ? 'ACESSO_EXCECAO_ATIPICO' : 'ACESSO_EXCECAO',
      canal: 'EMAIL',
      destino: pessoa?.email ?? null,
      dataEnvio: ctx.agoraClinica(),
      situacao: 'ENVIADA',
      tentativas: 1,
      idPessoa: admin.id,
      idConsulta: null,
      idParametro: null,
    });
  }
}

// RF29 e RF30: pedido de exportação, gerado depois (RNF13) e ligado a quem pediu.
const TIPOS_DE_EXPORTACAO = ['HISTORICO', 'PRONTUARIO'];
const pedidoDeExportacao = (ctx) => ({
  situacao: 'SOLICITADA',
  dataConclusao: null,
  dataSolicitacao: ctx.agoraClinica(),
  idSolicitante: ctx.sessao.idUsuario,
});
const validarExportacao = (novo) => (TIPOS_DE_EXPORTACAO.includes(novo.tipo) ? null : 'Escolha o documento.');


// ── Cadastros (A-02b, S-01b, A-03, A-04, A-05, A-06) ───────────────────────
// Paciente, médico, secretária, administrador e responsável legal são
// especializações de uma pessoa: nascem com o id dela, informado no corpo.
const ESPECIALIZACOES = new Set(['pacientes', 'medicos', 'secretarias', 'administradores', 'responsaveisLegais']);
const COLECAO_DO_PAPEL = {
  [A]: 'administradores', [M]: 'medicos', [S]: 'secretarias', [P]: 'pacientes', [R]: 'responsaveisLegais',
};
const UFS = new Set('AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' '));
const soDigitos = (valor) => String(valor ?? '').replace(/\D/g, '');
const preenchido = (valor, minimo = 1) => typeof valor === 'string' && valor.trim().length >= minimo;
const emailValido = (valor) => typeof valor === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim());
// Outro registro da coleção com o mesmo valor, sem contar o próprio.
const repetido = (lista, novo, mesmo) => lista.some((r) => !igual(r.id, novo.id) && mesmo(r));
// Na edição, só se confere o campo que mudou: o banco sintético tem registros
// anteriores a estas regras.
const mudou = (campo, novo, antigo) => !antigo || novo[campo] !== antigo[campo];

// O CPF é conferido só no formato: o banco sintético usa dígitos verificadores
// inválidos de propósito, para que nenhum coincida com o de uma pessoa real.
function validarPessoa(novo, antigo, ctx) {
  if (mudou('nome', novo, antigo) && !preenchido(novo.nome, 3)) return 'Informe o nome completo.';
  if (novo.cpf != null && novo.cpf !== '' && mudou('cpf', novo, antigo)) {
    if (soDigitos(novo.cpf).length !== 11) return 'O CPF tem 11 dígitos.';
    if (repetido(ctx.db.pessoas, novo, (p) => p.cpf && soDigitos(p.cpf) === soDigitos(novo.cpf))) {
      return 'Já existe uma pessoa com este CPF.';
    }
  }
  if (novo.email && mudou('email', novo, antigo) && !emailValido(novo.email)) return 'E-mail inválido.';
  if (novo.dataNascimento && mudou('dataNascimento', novo, antigo)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(novo.dataNascimento) || novo.dataNascimento > ctx.agoraTexto().slice(0, 10)) {
      return 'Data de nascimento inválida.';
    }
  }
  return null;
}

function validarPaciente(novo, antigo, ctx, mudancas) {
  if ('tipoAtendimento' in mudancas && novo.tipoAtendimento != null) {
    if (!['PARTICULAR', 'CONVENIO'].includes(novo.tipoAtendimento)) return 'Tipo de atendimento inválido.';
    if (novo.tipoAtendimento === 'CONVENIO') {
      if (ctx.buscar('convenios', novo.idConvenio)?.situacao !== 'ATIVO') return 'Escolha um convênio ativo.';
      if (!preenchido(novo.numeroCarteirinha, 3)) return 'Informe o número da carteirinha.';
    }
  }
  if (novo.pendenteDeCpf === true && 'pendenteDeCpf' in mudancas && !preenchido(novo.justificativaSemCpf, 10)) {
    return 'Justifique o cadastro sem CPF.';
  }
  return null;
}

function validarMedico(novo, antigo, ctx) {
  if (mudou('crm', novo, antigo) && !/^\d{4,7}$/.test(soDigitos(novo.crm))) return 'Informe o número do CRM.';
  if (mudou('ufCrm', novo, antigo) && !UFS.has(novo.ufCrm)) return 'UF do CRM inválida.';
  if (mudou('especialidade', novo, antigo) && !preenchido(novo.especialidade, 3)) return 'Informe a especialidade.';
  if (
    (mudou('crm', novo, antigo) || mudou('ufCrm', novo, antigo)) &&
    repetido(ctx.db.medicos, novo, (m) => soDigitos(m.crm) === soDigitos(novo.crm) && m.ufCrm === novo.ufCrm)
  ) {
    return 'Já existe um médico com este CRM nesta UF.';
  }
  return null;
}

// A-03: inativar o médico encerra a conta e os vínculos; reativar devolve a
// conta, e os vínculos voltam no próximo atendimento.
function aposEditarMedico(novo, antigo, ctx) {
  if (novo.situacao === antigo.situacao) return;
  const conta = ctx.db.usuarios.find((u) => igual(u.idPessoa, novo.id) && u.papel === M);
  if (novo.situacao === 'INATIVO') {
    if (conta && conta.situacao !== 'INATIVO') conta.situacao = 'INATIVO';
    const hoje = ctx.agoraTexto().slice(0, 10);
    for (const v of ctx.db.vinculos) {
      if (igual(v.idMedico, novo.id) && v.estado === 'ATIVO') {
        Object.assign(v, { estado: 'ENCERRADO', dataFim: hoje, motivoEncerramento: 'Médico inativado' });
      }
    }
  } else if (novo.situacao === 'ATIVO' && conta?.situacao === 'INATIVO') {
    conta.situacao = conta.senhaHash ? 'ATIVO' : 'CONVITE_PENDENTE';
  }
}

// RF03 e RF09: conta nova nasce como convite; a senha quem define é a pessoa,
// no primeiro acesso. O papel acompanha o cadastro da pessoa.
function validarUsuario(novo, antigo, ctx) {
  if (!antigo) {
    if (!COLECAO_DO_PAPEL[novo.papel]) return 'Papel inválido.';
    if (!ctx.buscar(COLECAO_DO_PAPEL[novo.papel], novo.idPessoa)) {
      return 'Cadastre a pessoa neste papel antes de criar a conta.';
    }
    if (ctx.db.usuarios.some((u) => igual(u.idPessoa, novo.idPessoa))) return 'Esta pessoa já tem conta.';
    if (novo.situacao !== 'CONVITE_PENDENTE') return 'A conta nova começa com o convite pendente.';
  }
  if (mudou('login', novo, antigo)) {
    if (!/^[a-z0-9._-]{3,30}$/.test(novo.login ?? '')) {
      return 'O login tem de 3 a 30 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.';
    }
    if (repetido(ctx.db.usuarios, novo, (u) => u.login === novo.login)) return 'Este login já está em uso.';
  }
  if (mudou('email', novo, antigo)) {
    if (!emailValido(novo.email)) return 'E-mail inválido.';
    const email = novo.email.trim().toLowerCase();
    if (repetido(ctx.db.usuarios, novo, (u) => u.email?.toLowerCase() === email)) return 'Este e-mail já está em uso.';
  }
  if (antigo && novo.situacao !== antigo.situacao) {
    if (novo.situacao === 'ATIVO' && antigo.situacao === 'CONVITE_PENDENTE') {
      return 'A conta fica ativa quando a pessoa aceita o convite.';
    }
    const outrosAdmins = ctx.db.usuarios.filter(
      (u) => !igual(u.id, novo.id) && u.papel === A && u.situacao === 'ATIVO'
    );
    if (antigo.papel === A && antigo.situacao === 'ATIVO' && outrosAdmins.length === 0) {
      return 'A clínica precisa de pelo menos um Administrador ativo.';
    }
  }
  return null;
}

// A Secretária convida só para o portal (S-01b).
const validarConvitePortal = (novo, antigo, ctx) =>
  [P, R].includes(novo.papel) ? validarUsuario(novo, antigo, ctx) : 'A Secretária convida só Paciente e Responsável Legal.';

function validarConvenio(novo, antigo, ctx) {
  if (mudou('nome', novo, antigo) && !preenchido(novo.nome, 2)) return 'Informe o nome do convênio.';
  if (mudou('razaoSocial', novo, antigo) && !preenchido(novo.razaoSocial, 3)) return 'Informe a operadora.';
  if (mudou('registroAns', novo, antigo)) {
    if (!/^\d{6}$/.test(novo.registroAns ?? '')) return 'O registro ANS tem 6 dígitos.';
    if (repetido(ctx.db.convenios, novo, (c) => c.registroAns === novo.registroAns)) {
      return 'Já existe um convênio com este registro ANS.';
    }
  }
  return null;
}

const TIPOS_DE_PROCEDIMENTO = ['CONSULTA', 'EXAME', 'PROCEDIMENTO'];

function validarProcedimento(novo, antigo, ctx) {
  if (mudou('codigo', novo, antigo)) {
    if (!/^\d{8}$/.test(novo.codigo ?? '')) return 'O código TUSS tem 8 dígitos.';
    if (repetido(ctx.db.procedimentos, novo, (p) => p.codigo === novo.codigo)) {
      return 'Já existe um procedimento com este código TUSS.';
    }
  }
  if (mudou('codigoInterno', novo, antigo) && novo.codigoInterno) {
    if (repetido(ctx.db.procedimentos, novo, (p) => p.codigoInterno === novo.codigoInterno)) {
      return 'Já existe um procedimento com este código interno.';
    }
  }
  if (mudou('nome', novo, antigo) && !preenchido(novo.nome, 3)) return 'Informe a descrição.';
  if (mudou('tipo', novo, antigo) && !TIPOS_DE_PROCEDIMENTO.includes(novo.tipo)) return 'Tipo inválido.';
  if (mudou('duracaoPadrao', novo, antigo)) {
    if (!Number.isInteger(novo.duracaoPadrao) || novo.duracaoPadrao < 5 || novo.duracaoPadrao > 480) {
      return 'A duração vai de 5 a 480 minutos.';
    }
  }
  if (mudou('precoParticular', novo, antigo)) {
    if (typeof novo.precoParticular !== 'number' || !(novo.precoParticular >= 0)) return 'Informe o preço particular.';
  }
  return null;
}

const NATUREZAS_DA_REPRESENTACAO = ['PODER_FAMILIAR', 'TUTELA', 'CURATELA'];

function validarRepresentacao(novo, antigo, ctx) {
  if (!antigo) {
    if (!ctx.buscar('pacientes', novo.idPaciente)) return 'Paciente inexistente.';
    if (!ctx.buscar('responsaveisLegais', novo.idResponsavelLegal)) return 'Cadastre o responsável legal antes.';
    if (igual(novo.idPaciente, novo.idResponsavelLegal)) return 'O paciente não representa a si mesmo.';
  }
  if (mudou('grauParentesco', novo, antigo) && !preenchido(novo.grauParentesco, 2)) return 'Informe o grau de parentesco.';
  if (mudou('natureza', novo, antigo) && !NATUREZAS_DA_REPRESENTACAO.includes(novo.natureza)) {
    return 'Informe a natureza da representação.';
  }
  return null;
}

// A-14: conta nova começa em aberto; depois de paga, só o estorno muda o
// título (situação e motivo); estornada, não muda mais.
const CATEGORIAS_DE_DESPESA = ['ALUGUEL', 'FOLHA', 'INSUMOS', 'MATERIAL', 'SERVICOS', 'TRIBUTOS', 'TAXA_ADQUIRENTE', 'OUTRAS'];
const dataValida = (valor) => typeof valor === 'string' && /^\d{4}-\d{2}-\d{2}/.test(valor);

function validarTituloPagar(novo, antigo, ctx, mudancas) {
  if (!antigo && novo.situacao !== 'ABERTO') return 'A conta nova começa em aberto.';
  if (antigo && antigo.situacao !== 'ABERTO') {
    const permitidos = antigo.situacao === 'PAGO' ? ['situacao', 'motivoEstorno'] : [];
    if (Object.keys(mudancas).some((campo) => !permitidos.includes(campo))) {
      return 'Título pago não muda; para corrigir, estorne o pagamento.';
    }
  }
  if (mudou('fornecedor', novo, antigo) && !preenchido(novo.fornecedor, 3)) return 'Informe o fornecedor.';
  if (mudou('categoria', novo, antigo) && !CATEGORIAS_DE_DESPESA.includes(novo.categoria)) return 'Escolha a categoria.';
  if (mudou('vencimento', novo, antigo) && !dataValida(novo.vencimento)) return 'Informe o vencimento.';
  if (mudou('valor', novo, antigo) && !(typeof novo.valor === 'number' && novo.valor > 0)) return 'Informe o valor.';
  return null;
}

// A-11a e S-05b: motivo de lista fechada (sem motivo clínico), fim depois do
// início e médico ativo; sem médico, o bloqueio vale para a clínica inteira.
const MOTIVOS_DE_BLOQUEIO = ['FERIAS', 'FERIADO', 'CONGRESSO', 'CAPACITACAO', 'INTERVALO', 'OUTRO'];

function validarBloqueio(novo, antigo, ctx) {
  if (mudou('motivo', novo, antigo) && !MOTIVOS_DE_BLOQUEIO.includes(novo.motivo)) return 'Escolha o motivo.';
  if (mudou('dataInicio', novo, antigo) || mudou('dataFim', novo, antigo)) {
    if (!dataValida(novo.dataInicio) || !dataValida(novo.dataFim) || novo.dataFim <= novo.dataInicio) {
      return 'O fim do bloqueio vem depois do início.';
    }
  }
  if (mudou('idMedico', novo, antigo) && novo.idMedico != null && ctx.buscar('medicos', novo.idMedico)?.situacao !== 'ATIVO') {
    return 'Escolha um médico ativo.';
  }
  return null;
}

// A-26 e S-17: o produto; lote e saldo nascem das movimentações.
const TIPOS_DE_PRODUTO = ['MEDICAMENTO', 'MATERIAL', 'AMOSTRA'];
const UNIDADES = ['UN', 'CX', 'PCT', 'FR', 'DOSE'];

function validarProduto(novo, antigo) {
  if (mudou('descricao', novo, antigo) && !preenchido(novo.descricao, 3)) return 'Informe a descrição.';
  if (mudou('tipo', novo, antigo) && !TIPOS_DE_PRODUTO.includes(novo.tipo)) return 'Escolha o tipo.';
  if (mudou('unidade', novo, antigo) && !UNIDADES.includes(novo.unidade)) return 'Escolha a unidade.';
  if (mudou('estoqueMinimo', novo, antigo) && !(Number.isInteger(novo.estoqueMinimo) && novo.estoqueMinimo >= 0)) {
    return 'O estoque mínimo é um número inteiro.';
  }
  if (mudou('custoAquisicao', novo, antigo) && novo.custoAquisicao != null && !(typeof novo.custoAquisicao === 'number' && novo.custoAquisicao >= 0)) {
    return 'Custo de aquisição inválido.';
  }
  return null;
}

// Os itens seguem a etapa do orçamento a que pertencem.
const orcamentoDoItem = (r, ctx) => ctx.buscar('orcamentos', r.idOrcamento);
const podeEditarItem = (atual, ctx) => {
  const orcamento = orcamentoDoItem(atual, ctx);
  return orcamento ? podeEditarOrcamento(orcamento, ctx) : 'Orçamento inexistente.';
};

// Regra de cada papel em cada coleção:
// - ler: função (registro, ctx) => boolean; sem ela, o papel não lê;
// - criar, editar, excluir: true quando o papel pode;
// - ocultar: campos que o papel não vê nem escreve (lista ou função do registro);
// - podeGravar: campos ocultos que o papel ainda assim informa ao criar;
// - editaveis: únicos campos que o papel pode mudar ao editar;
// - fixar: valores impostos pelo servidor ao criar; depois, só mudam se
//   estiverem em editaveis;
// - alcanceDeEscrita: alcance conferido depois de criar ou editar, quando
//   difere de ler (padrão: ler);
// - podeEditar, validar, aposEditar: regras de negócio ligadas à escrita.
const politica = {
  // ── Pessoas ──────────────────────────────────────────────────────────────
  pessoas: {
    [A]: { ler: todos, criar: true, editar: true, validar: validarPessoa },
    [S]: { ler: todos, criar: true, editar: true, validar: validarPessoa },
    // RF07 e RF08: o Médico consulta pacientes e responsáveis; dos demais,
    // só o nome (RF10).
    [M]: {
      ler: todos,
      ocultar: (r, ctx) =>
        proprio(r, ctx) || ctx.buscar('pacientes', r.id) || ctx.buscar('responsaveisLegais', r.id)
          ? []
          : soMostrar('id', 'nome')(r),
    },
    [P]: {
      ler: ou(proprio, ehMedico),
      ocultar: (r, ctx) => (proprio(r, ctx) ? [] : soMostrar('id', 'nome')(r)),
    },
    [R]: {
      ler: ou(proprio, doPaciente('pessoas'), ehMedico),
      ocultar: (r, ctx) =>
        proprio(r, ctx) || doPaciente('pessoas')(r, ctx) ? [] : soMostrar('id', 'nome')(r),
    },
  },
  administradores: {
    [A]: { ler: todos, criar: true, editar: true },
  },
  secretarias: {
    [A]: { ler: todos, criar: true, editar: true },
    [S]: { ler: proprio },
  },
  medicos: {
    [A]: { ler: todos, criar: true, editar: true, validar: validarMedico, aposEditar: aposEditarMedico },
    [S]: { ler: todos },
    [M]: { ler: todos, ocultar: (r, ctx) => (proprio(r, ctx) ? [] : soMostrar('id', 'especialidade')(r)) },
    [P]: { ler: todos, ocultar: soMostrar('id', 'crm', 'ufCrm', 'especialidade', 'situacao') },
    [R]: { ler: todos, ocultar: soMostrar('id', 'crm', 'ufCrm', 'especialidade', 'situacao') },
  },
  pacientes: {
    // A3-R17: Observações Gerais nunca vão ao Administrador.
    [A]: { ler: todos, criar: true, editar: true, ocultar: ['observacoesGerais'], validar: validarPaciente },
    [S]: { ler: todos, criar: true, editar: true, validar: validarPaciente },
    [M]: { ler: todos },
    [P]: { ler: proprio, ocultar: ['observacoesGerais'] },
    [R]: { ler: doPaciente('pacientes'), ocultar: ['observacoesGerais'] },
  },
  responsaveisLegais: {
    [A]: { ler: todos, criar: true, editar: true },
    [S]: { ler: todos, criar: true, editar: true },
    [M]: { ler: todos },
    [R]: { ler: proprio },
  },

  // ── Acesso e autorização ─────────────────────────────────────────────────
  // A senha nunca sai: nenhum campo "senha*" é devolvido nem gravado por aqui.
  // O papel e a pessoa de uma conta não mudam depois de criada.
  usuarios: {
    [A]: { ler: todos, criar: true, editar: true, editaveis: ['login', 'email', 'situacao'], validar: validarUsuario },
    // S-01b: a Secretária manda o convite do portal, mas não lê as contas.
    [S]: { criar: true, alcanceDeEscrita: (r) => [P, R].includes(r.papel), validar: validarConvitePortal },
  },
  // RF40: só o Administrador lê; ninguém escreve pela API.
  logsAuditoria: {
    [A]: { ler: todos },
  },
  parametros: {
    [A]: {
      ler: todos,
      editar: true,
      editaveis: ['valor'],
      podeEditar: (atual) => (atual.editavel === false ? 'Parâmetro não editável.' : null),
    },
    [M]: { ler: todos },
    [S]: { ler: todos },
  },
  // S-01b: a Secretária registra o responsável, mas não encerra a representação.
  representacoes: {
    [A]: { ler: todos, criar: true, editar: true, validar: validarRepresentacao },
    [S]: {
      ler: todos,
      criar: true,
      editar: true,
      editaveis: ['grauParentesco', 'natureza', 'documento'],
      validar: validarRepresentacao,
    },
    [M]: { ler: todos },
    [P]: { ler: doPaciente('representacoes') },
    [R]: { ler: (r, ctx) => igual(r.idResponsavelLegal, ctx.sessao.idPessoa) },
  },
  vinculos: {
    [A]: { ler: todos },
    [M]: { ler: doMedico },
  },
  acessosExcecao: {
    // A-31: o Administrador revisa ou revoga (encurta o prazo).
    [A]: { ler: todos, editar: true, editaveis: ['revisado', 'expiraEm'] },
    // RF06: o Médico pede com justificativa; a duração é a do parâmetro X07.
    [M]: {
      ler: doMedico,
      criar: true,
      fixar: (ctx) => {
        const duracao = ctx.parametro('X07', 60);
        return {
          idMedico: ctx.sessao.idPessoa,
          dataHora: ctx.agoraClinica(),
          duracao,
          expiraEm: ctx.agoraClinica(duracao),
          revisado: false,
        };
      },
      validar: validarAcessoExcecao,
      aposCriar: aposCriarAcessoExcecao,
    },
  },
  solicitacoesTitular: {
    [A]: { ler: todos, editar: true },
    [S]: { ler: todos, criar: true },
    [P]: {
      ler: doPaciente('solicitacoesTitular'),
      criar: true,
      fixar: (ctx) => ({ ...fixarTitular(ctx), situacao: 'ABERTA', dataSolicitacao: ctx.agoraTexto(), dataResposta: null }),
    },
    [R]: {
      ler: doPaciente('solicitacoesTitular'),
      criar: true,
      fixar: (ctx) => ({ ...fixarTitular(ctx), situacao: 'ABERTA', dataSolicitacao: ctx.agoraTexto(), dataResposta: null }),
    },
  },
  notificacoes: {
    [A]: { ler: todos, criar: true, editar: true },
    [S]: { ler: todos, editar: true, editaveis: ['situacao', 'tentativas'] },
    [P]: { ler: ou(doPaciente('notificacoes'), (r, ctx) => igual(r.idPessoa, ctx.sessao.idPessoa)) },
    [R]: { ler: ou(doPaciente('notificacoes'), (r, ctx) => igual(r.idPessoa, ctx.sessao.idPessoa)) },
  },
  // RF29 (histórico) vale para todos; RF30 (prontuário completo), só para
  // Médico, Paciente e Responsável Legal.
  exportacoes: {
    [A]: { ler: comCampo('tipo', 'HISTORICO'), criar: true, fixar: pedidoDeExportacao, validar: validarExportacao },
    [S]: { ler: comCampo('tipo', 'HISTORICO'), criar: true, fixar: pedidoDeExportacao, validar: validarExportacao },
    [M]: { ler: doPaciente('exportacoes'), criar: true, fixar: pedidoDeExportacao, validar: validarExportacao },
    [P]: {
      ler: doPaciente('exportacoes'),
      criar: true,
      fixar: (ctx) => ({ ...fixarTitular(ctx), ...pedidoDeExportacao(ctx) }),
      validar: validarExportacao,
    },
    [R]: {
      ler: doPaciente('exportacoes'),
      criar: true,
      fixar: (ctx) => ({ ...fixarTitular(ctx), ...pedidoDeExportacao(ctx) }),
      validar: validarExportacao,
    },
  },

  // ── Agenda e prontuário ──────────────────────────────────────────────────
  convenios: {
    [A]: { ler: todos, criar: true, editar: true, validar: validarConvenio },
    [M]: { ler: todos },
    [S]: { ler: todos },
    [P]: { ler: todos },
    [R]: { ler: todos },
  },
  // RF12: o preço de tabela não vai ao Médico; ao titular, só dentro do
  // próprio orçamento ou cobrança.
  procedimentos: {
    [A]: { ler: todos, criar: true, editar: true, validar: validarProcedimento },
    [S]: { ler: todos },
    [M]: { ler: todos, ocultar: ['precoParticular'] },
    [P]: { ler: todos, ocultar: ['precoParticular'] },
    [R]: { ler: todos, ocultar: ['precoParticular'] },
  },
  gradesHorario: {
    [A]: { ler: todos, criar: true, editar: true },
    [S]: { ler: todos, criar: true, editar: true },
    [M]: { ler: doMedico },
    [P]: { ler: todos },
    [R]: { ler: todos },
  },
  // A contagem de consultas atingidas é sempre do servidor (RF14).
  bloqueiosAgenda: {
    [A]: { ler: todos, criar: true, editar: true, excluir: true, completar: contarAtingidas, validar: validarBloqueio, aposEditar: recontarAtingidas },
    [S]: { ler: todos, criar: true, editar: true, excluir: true, completar: contarAtingidas, validar: validarBloqueio, aposEditar: recontarAtingidas },
    // Bloqueio da clínica inteira (feriado) tem idMedico nulo e vale para todos.
    // M-03: o Médico registra a própria indisponibilidade; quem trata as
    // consultas atingidas é a recepção (RF20).
    [M]: {
      ler: ou(doMedico, comCampo('idMedico', null)),
      criar: true,
      fixar: (ctx) => ({ idMedico: ctx.sessao.idPessoa, situacao: 'ATIVO' }),
      completar: contarAtingidas,
      validar: validarBloqueio,
    },
  },
  // RF16 a RF20. O preço de referência (RN-16.2) não vai ao Médico nem ao
  // titular (RC06).
  consultas: {
    [A]: {
      ler: todos,
      criar: true,
      editar: true,
      editaveis: EDITAVEIS_DA_RECEPCAO,
      completar: completarConsulta,
      validar: validarConsulta,
      aposCriar: aposCriarConsulta,
      aposEditar: aposEditarConsulta,
    },
    [S]: {
      ler: todos,
      criar: true,
      editar: true,
      editaveis: EDITAVEIS_DA_RECEPCAO,
      completar: completarConsulta,
      validar: validarConsulta,
      aposCriar: aposCriarConsulta,
      aposEditar: aposEditarConsulta,
    },
    [M]: {
      ler: doMedico,
      editar: true,
      editaveis: ['status', 'motivoTransicao'],
      ocultar: ['valorReferencia'],
      validar: validarConsulta,
      aposEditar: aposEditarConsulta,
    },
    [P]: {
      ler: doPaciente('consultas'),
      criar: true,
      editar: true,
      editaveis: ['status', 'motivoCancelamento'],
      ocultar: ['valorReferencia'],
      fixar: (ctx) => ({ ...fixarTitular(ctx), status: 'AGENDADO', canalOrigem: 'PORTAL' }),
      completar: completarConsulta,
      validar: validarConsulta,
      aposCriar: aposCriarConsulta,
      aposEditar: aposEditarConsulta,
    },
    [R]: {
      ler: doPaciente('consultas'),
      criar: true,
      editar: true,
      editaveis: ['status', 'motivoCancelamento'],
      ocultar: ['valorReferencia'],
      fixar: (ctx) => ({ ...fixarTitular(ctx), status: 'AGENDADO', canalOrigem: 'PORTAL' }),
      completar: completarConsulta,
      validar: validarConsulta,
      aposCriar: aposCriarConsulta,
      aposEditar: aposEditarConsulta,
    },
  },
  // Conteúdo clínico: só o Médico com vínculo ou acesso de exceção (RC02, RC05).
  prontuarios: {
    [M]: { ler: doPaciente('prontuarios'), criar: true },
  },
  anexos: {
    // A5-R10: o Médico aceita ou recusa o exame enviado pelo titular.
    [M]: {
      ler: doPaciente('anexos'),
      criar: true,
      editar: true,
      editaveis: ['situacao'],
      fixar: (ctx) => ({ enviadoPor: M, situacao: 'DISPONIVEL' }),
    },
    // RF27: a Secretária vê só metadados; este registro não guarda o conteúdo.
    [S]: { ler: todos, criar: true, fixar: () => ({ enviadoPor: S, situacao: 'DISPONIVEL' }) },
    [P]: { ler: doPaciente('anexos'), criar: true, fixar: () => ({ enviadoPor: P, situacao: 'A_ACEITAR' }) },
    [R]: { ler: doPaciente('anexos'), criar: true, fixar: () => ({ enviadoPor: R, situacao: 'A_ACEITAR' }) },
  },
  registrosClinicos: {
    [M]: {
      ler: doPaciente('registrosClinicos'),
      criar: true,
      editar: true,
      editaveis: CAMPOS_CLINICOS,
      completar: completarRegistro,
      validar: validarRegistro,
      // A5-R03: registro selado só muda por retificação.
      podeEditar: podeEditarRegistro,
    },
  },
  retificacoes: {
    [M]: { ler: doPaciente('retificacoes'), criar: true, completar: completarRetificacao, validar: validarRetificacao },
  },
  prescricoes: {
    [M]: {
      ler: doPaciente('prescricoes'),
      criar: true,
      editar: true,
      editaveis: ['validade'],
      completar: completarPrescricao,
      validar: validarPrescricao,
      podeEditar: (atual, ctx) => prescricaoAberta(ctx.buscar('registrosClinicos', atual.idRegistroClinico), ctx),
    },
  },
  itensPrescricao: {
    [M]: {
      ler: doPaciente('itensPrescricao'),
      criar: true,
      editar: true,
      editaveis: ['medicamento', 'concentracao', 'posologia', 'quantidade', 'duracao', 'classificacao'],
      validar: validarItemPrescricao,
      podeEditar: podeEditarItemPrescricao,
      aposCriar: (item, ctx) => acertarTipoDeReceita(item, null, ctx),
      aposEditar: acertarTipoDeReceita,
    },
  },
  // RF28 e D2: só o autor, e só de paciente no seu alcance.
  anotacoesPrivadas: {
    [M]: {
      ler: e(doMedico, doPaciente('anotacoesPrivadas')),
      criar: true,
      editar: true,
      excluir: true,
      editaveis: ['texto'],
      fixar: fixarPessoa('idMedico'),
      completar: (novo, ctx) => {
        novo.dataHora = ctx.agoraClinica();
      },
      validar: (novo) => (preenchido(novo.texto) ? null : 'Escreva a anotação.'),
    },
  },

  // ── Cobrança e financeiro ────────────────────────────────────────────────
  orcamentos: {
    // RC09: o Administrador só vê os que estão na etapa de aprovação.
    [A]: {
      ler: comCampo('etapa', 'APROVACAO'),
      // Ao aprovar ou devolver, o orçamento sai da fila do Administrador.
      alcanceDeEscrita: todos,
      editar: true,
      editaveis: ['etapa', 'observacaoDevolucao'],
      podeEditar: podeEditarOrcamento,
      validar: validarOrcamento,
    },
    [S]: {
      ler: todos,
      editar: true,
      editaveis: ['etapa', 'valorTotal', 'validade', 'observacaoDevolucao'],
      podeEditar: podeEditarOrcamento,
      validar: validarOrcamento,
    },
    [M]: {
      ler: e(doMedico, doPaciente('orcamentos')),
      criar: true,
      editar: true,
      editaveis: ['etapa', 'validade', 'idPaciente'],
      ocultar: ['valorTotal'],
      fixar: (ctx) => ({ idMedico: ctx.sessao.idPessoa, etapa: 'ESCOPO', valorTotal: null }),
      podeEditar: podeEditarOrcamento,
      validar: validarOrcamento,
    },
    // As etapas internas não aparecem ao titular.
    [P]: {
      ler: e(doPaciente('orcamentos'), (r) => ETAPAS_DO_TITULAR.includes(r.etapa)),
      ocultar: ['observacaoDevolucao'],
      editar: true,
      editaveis: ['etapa'],
      podeEditar: podeEditarOrcamento,
      validar: validarOrcamento,
    },
    [R]: {
      ler: e(doPaciente('orcamentos'), (r) => ETAPAS_DO_TITULAR.includes(r.etapa)),
      ocultar: ['observacaoDevolucao'],
      editar: true,
      editaveis: ['etapa'],
      podeEditar: podeEditarOrcamento,
      validar: validarOrcamento,
    },
  },
  itensOrcamento: {
    [A]: { ler: (r, ctx) => orcamentoDoItem(r, ctx)?.etapa === 'APROVACAO' },
    [S]: { ler: todos, editar: true, editaveis: ['valorUnitario'], podeEditar: podeEditarItem },
    [M]: {
      ler: (r, ctx) => {
        const orcamento = orcamentoDoItem(r, ctx);
        return Boolean(orcamento) && igual(orcamento.idMedico, ctx.sessao.idPessoa) && doPaciente('itensOrcamento')(r, ctx);
      },
      criar: true,
      editar: true,
      ocultar: ['valorUnitario'],
      fixar: () => ({ valorUnitario: null }),
      podeEditar: podeEditarItem,
      validar: (novo, antigo, ctx) => (antigo ? null : podeEditarItem(novo, ctx)),
    },
    [P]: { ler: (r, ctx) => ETAPAS_DO_TITULAR.includes(orcamentoDoItem(r, ctx)?.etapa) && doPaciente('itensOrcamento')(r, ctx) },
    [R]: { ler: (r, ctx) => ETAPAS_DO_TITULAR.includes(orcamentoDoItem(r, ctx)?.etapa) && doPaciente('itensOrcamento')(r, ctx) },
  },
  // A-13b: o Administrador cria e edita a cobrança antes do pagamento; o
  // título nasce junto. Depois de paga, só por estorno (RN-32.1).
  cobrancas: {
    [A]: {
      ler: todos,
      criar: true,
      editar: true,
      editaveis: ['valorTotal', 'vencimento'],
      fixar: (ctx) => ({ situacao: 'ABERTA', dataEmissao: ctx.hojeClinica() }),
      podeEditar: podeEditarCobranca,
      validar: validarCobranca,
      aposCriar: criarTituloDaCobranca,
      aposEditar: acertarTituloDaCobranca,
    },
    [S]: { ler: todos },
    [P]: { ler: doPaciente('cobrancas') },
    [R]: { ler: doPaciente('cobrancas') },
  },
  // D5: fechamento cego; o saldo apurado e a divergência só vão ao Administrador.
  caixas: {
    [A]: { ler: todos, editar: true, editaveis: ['situacao', 'justificativa', 'motivoDevolucao'] },
    // A Secretária só fecha e reconta: a situação sai do cálculo do servidor.
    [S]: {
      ler: (r, ctx) => igual(r.idSecretaria, ctx.sessao.idPessoa),
      criar: true,
      editar: true,
      editaveis: ['dataFechamento', 'saldoContado', 'justificativa'],
      ocultar: ['saldoApurado', 'divergencia'],
      fixar: (ctx) => ({ idSecretaria: ctx.sessao.idPessoa, situacao: 'ABERTO', dataAbertura: ctx.agoraClinica() }),
      podeEditar: (atual) => (['ABERTO', 'RECONTAGEM'].includes(atual.situacao) ? null : 'Este caixa já foi fechado.'),
      validar: validarFechamento,
      aposEditar: fecharCaixa,
    },
  },
  // RF47: sangria e reforço, sempre com motivo e só no próprio caixa aberto
  // (RN-47.1). O total do caixa não sai para a Secretária (D5).
  movimentosCaixa: {
    [A]: { ler: todos },
    [S]: {
      ler: (r, ctx) => igual(ctx.buscar('caixas', r.idCaixa)?.idSecretaria, ctx.sessao.idPessoa),
      criar: true,
      fixar: (ctx) => ({ dataHora: ctx.agoraClinica(), idUsuario: ctx.sessao.idUsuario }),
      validar: validarMovimentoCaixa,
    },
  },
  // Os pagamentos nascem no checkout (/checkout), nunca por esta coleção.
  pagamentos: {
    [A]: { ler: todos },
    [S]: { ler: todos },
    [P]: { ler: doPaciente('pagamentos') },
    [R]: { ler: doPaciente('pagamentos') },
  },
  pagamentosPix: {
    [A]: { ler: todos },
    [S]: { ler: todos },
    [P]: { ler: doPaciente('pagamentosPix') },
    [R]: { ler: doPaciente('pagamentosPix') },
  },
  // S-07a: a Secretária não vê o valor líquido (taxa do adquirente).
  pagamentosCartao: {
    [A]: { ler: todos },
    [S]: { ler: todos, ocultar: ['valorLiquido'] },
  },
  pagamentosDinheiro: {
    [A]: { ler: todos },
    [S]: { ler: todos },
  },
  // P-05a: o titular vê o vencimento e a ligação com recibo e NFS-e.
  titulosReceber: {
    [A]: { ler: todos, criar: true, editar: true },
    [S]: { ler: todos },
    [P]: { ler: doPaciente('titulosReceber') },
    [R]: { ler: doPaciente('titulosReceber') },
  },
  // RF48: a Secretária pede; só o Administrador aprova e estorna.
  estornos: {
    [A]: { ler: todos, criar: true, editar: true },
    [S]: {
      ler: todos,
      criar: true,
      fixar: (ctx) => ({ idSolicitante: ctx.sessao.idUsuario, situacao: 'A_APROVAR', dataPedido: ctx.agoraTexto() }),
    },
    [P]: { ler: doPaciente('estornos') },
    [R]: { ler: doPaciente('estornos') },
  },
  // A Secretária emite e consulta recibos; NFS-e só o Administrador (S-11).
  documentosFiscais: {
    [A]: { ler: todos, criar: true, editar: true },
    [S]: { ler: comCampo('tipo', 'RECIBO'), criar: true },
    [P]: { ler: doPaciente('documentosFiscais') },
    [R]: { ler: doPaciente('documentosFiscais') },
  },
  titulosPagar: {
    [A]: { ler: todos, criar: true, editar: true, validar: validarTituloPagar },
  },

  // ── Convênio, TISS e estoque ─────────────────────────────────────────────
  contratosOperadora: {
    [A]: { ler: todos, criar: true, editar: true },
    [S]: { ler: todos },
  },
  itensTabelaPreco: {
    [A]: { ler: todos, criar: true, editar: true },
    [S]: { ler: todos },
  },
  elegibilidades: {
    [A]: { ler: todos },
    [S]: { ler: todos, criar: true },
    [M]: { ler: doPaciente('elegibilidades') },
    [P]: { ler: doPaciente('elegibilidades') },
    [R]: { ler: doPaciente('elegibilidades') },
  },
  // RC10: a justificativa clínica fica com o Médico; os outros veem o CID só
  // como código.
  autorizacoes: {
    [A]: { ler: todos, ocultar: ['justificativa'] },
    [S]: { ler: todos, criar: true, editar: true, ocultar: ['justificativa'] },
    [M]: { ler: doPaciente('autorizacoes'), editar: true, editaveis: ['justificativa', 'cid'] },
    [P]: { ler: doPaciente('autorizacoes'), ocultar: ['justificativa', 'cid'] },
    [R]: { ler: doPaciente('autorizacoes'), ocultar: ['justificativa', 'cid'] },
  },
  // D9: a Secretária não vê o total do lote.
  lotesCobranca: {
    [A]: { ler: todos, editar: true },
    [S]: { ler: todos, criar: true, editar: true, ocultar: ['valorApresentado'] },
  },
  guiasTiss: {
    [A]: { ler: todos },
    [S]: { ler: todos, criar: true, editar: true },
    [M]: { ler: doPaciente('guiasTiss'), ocultar: ['valor'] },
  },
  glosas: {
    [A]: { ler: todos, editar: true },
    [S]: { ler: todos, criar: true },
    [M]: { ler: doPaciente('glosas'), ocultar: ['valorGlosado'] },
  },
  recursosGlosa: {
    [A]: { ler: todos, editar: true },
    [S]: { ler: todos, criar: true, editar: true },
    // M-06: o Médico fundamenta o recurso que lhe foi pedido.
    [M]: {
      ler: ou(doMedico, doPaciente('recursosGlosa')),
      editar: true,
      editaveis: ['aguardaFundamentacao'],
      ocultar: ['valorRecuperado'],
    },
  },
  coparticipacoes: {
    [A]: { ler: todos },
    [S]: { ler: todos, criar: true },
    [P]: { ler: doPaciente('coparticipacoes') },
    [R]: { ler: doPaciente('coparticipacoes') },
  },
  // RC06 nível 3: o custo de aquisição é só do Administrador.
  // P-04: o titular vê o nome e o lote dos itens dispensados a ele, e nada
  // mais do estoque (RF37).
  produtos: {
    [A]: { ler: todos, criar: true, editar: true, validar: validarProduto },
    [S]: { ler: todos, criar: true, editar: true, ocultar: ['custoAquisicao'], validar: validarProduto },
    [M]: { ler: todos, ocultar: ['custoAquisicao', 'estoqueMinimo'] },
    [P]: { ler: produtoDispensadoAoTitular, ocultar: soMostrar('id', 'descricao', 'tipo', 'unidade') },
    [R]: { ler: produtoDispensadoAoTitular, ocultar: soMostrar('id', 'descricao', 'tipo', 'unidade') },
  },
  lotes: {
    [A]: { ler: todos, criar: true, editar: true },
    [S]: { ler: todos, criar: true, editar: true },
    [M]: { ler: todos },
    [P]: { ler: (r, ctx) => loteDispensadoAoTitular(r.id, ctx), ocultar: soMostrar('id', 'numero', 'validade', 'idProduto') },
    [R]: { ler: (r, ctx) => loteDispensadoAoTitular(r.id, ctx), ocultar: soMostrar('id', 'numero', 'validade', 'idProduto') },
  },
  // RC08: a saída identificada não mostra o paciente ao Administrador nem à
  // Secretária; o Médico vê só as próprias saídas.
  movimentacoes: {
    [A]: { ler: todos, criar: true, ocultar: ['idConsulta'] },
    [S]: { ler: todos, criar: true, ocultar: ['idConsulta', 'idTituloPagar'], podeGravar: ['idConsulta'] },
    [M]: {
      ler: (r, ctx) => igual(ctx.buscar('consultas', r.idConsulta)?.idMedico, ctx.sessao.idPessoa),
      criar: true,
      ocultar: ['idTituloPagar'],
    },
    [P]: { ler: doPaciente('movimentacoes'), ocultar: ['idTituloPagar'] },
    [R]: { ler: doPaciente('movimentacoes'), ocultar: ['idTituloPagar'] },
  },
  alertasEstoque: {
    [A]: { ler: todos },
    [S]: { ler: todos },
    [M]: { ler: comCampo('tipo', 'VALIDADE') },
  },

  // ── Gestão ───────────────────────────────────────────────────────────────
  relatorios: {
    [A]: {
      ler: todos,
      criar: true,
      fixar: (ctx) => ({ idUsuario: ctx.sessao.idUsuario, situacao: 'GERANDO', geradoEm: null }),
    },
  },
};

function regraPara(colecao, papel) {
  return politica[colecao]?.[papel] ?? null;
}

function camposOcultos(regra, registro, ctx) {
  const { ocultar } = regra;
  if (!ocultar) return [];
  return typeof ocultar === 'function' ? ocultar(registro, ctx) : ocultar;
}

// Remove, em qualquer nível, os campos cujo nome começa por "senha".
function semSenha(valor) {
  if (Array.isArray(valor)) return valor.map(semSenha);
  if (valor && typeof valor === 'object') {
    return Object.fromEntries(
      Object.entries(valor)
        .filter(([campo]) => !ehSenha(campo))
        .map(([campo, v]) => [campo, semSenha(v)])
    );
  }
  return valor;
}

function projetar(regra, registro, ctx) {
  const ocultos = new Set(camposOcultos(regra, registro, ctx));
  const visivel = Object.fromEntries(
    Object.entries(registro).filter(([campo]) => !ocultos.has(campo))
  );
  return semSenha(visivel);
}

// Campos do corpo que o papel pode gravar.
function camposGravaveis(regra, corpo, base, ctx, { edicao }) {
  const ocultos = new Set(camposOcultos(regra, base, ctx));
  const permitidosOcultos = new Set(regra.podeGravar ?? []);
  const fixos = new Set(Object.keys(regra.fixar ? regra.fixar(ctx) : {}));
  return Object.fromEntries(
    Object.entries(corpo).filter(
      ([campo]) =>
        campo !== 'id' &&
        !ehSenha(campo) &&
        (!fixos.has(campo) || (edicao && regra.editaveis?.includes(campo))) &&
        (!ocultos.has(campo) || permitidosOcultos.has(campo)) &&
        (!edicao || !regra.editaveis || regra.editaveis.includes(campo))
    )
  );
}

module.exports = {
  PAPEIS,
  ADMINISTRADOR: A,
  MEDICO: M,
  SECRETARIA: S,
  PACIENTE: P,
  RESPONSAVEL_LEGAL: R,
  COLECOES,
  CLINICAS,
  ESPECIALIZACOES,
  politica,
  regraPara,
  projetar,
  camposGravaveis,
  pacienteDe,
  semSenha,
  igual,
};
