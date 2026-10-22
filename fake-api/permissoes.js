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
  'orcamentos', 'itensOrcamento', 'cobrancas', 'caixas', 'pagamentos',
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

function validarConsulta(novo, antigo, ctx, mudancas) {
  if (!antigo && novo.status !== 'AGENDADO') return 'Uma consulta nova começa como Agendada.';
  // RF18: um médico não tem duas consultas ativas no mesmo horário.
  if (!antigo || novo.dataHora !== antigo.dataHora || !igual(novo.idMedico, antigo.idMedico)) {
    const ocupado = ctx.db.consultas.some(
      (c) =>
        c !== antigo &&
        igual(c.idMedico, novo.idMedico) &&
        c.dataHora === novo.dataHora &&
        c.status !== 'CANCELADO'
    );
    if (ocupado) return 'Horário indisponível.';
  }
  if (!antigo) return null;
  if (novo.status !== antigo.status) {
    const permitidas = TRANSICOES[ctx.sessao.papel][antigo.status] ?? [];
    if (!permitidas.includes(novo.status)) {
      return 'Mudança de status não permitida.';
    }
    if (novo.status === 'CANCELADO' && [A, S].includes(ctx.sessao.papel) && !novo.motivoCancelamento) {
      return 'Informe o motivo do cancelamento.';
    }
    if (ehRetroativa(novo, antigo) && !textoInformado(mudancas.motivoTransicao)) {
      return 'Informe o motivo da volta de status.';
    }
  }
  return null;
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
// o servidor calcula o esperado e a divergência, que ela não vê.
function saldoEsperado(caixa, ctx) {
  return ctx.db.pagamentosDinheiro
    .filter((p) => igual(p.idCaixa, caixa.id))
    .reduce((soma, p) => soma + (p.valorRecebido ?? 0) - (p.troco ?? 0), caixa.saldoInicial ?? 0);
}

function validarFechamento(novo, antigo, ctx) {
  if (!antigo || novo.dataFechamento == null) return null;
  if (typeof novo.saldoContado !== 'number') return 'Informe o valor contado.';
  const divergente = Math.abs(novo.saldoContado - saldoEsperado(novo, ctx)) >= 0.005;
  return divergente && !novo.justificativa ? 'Justifique a diferença no fechamento.' : null;
}

function fecharCaixa(caixa, antigo, ctx) {
  if (antigo.dataFechamento != null || caixa.dataFechamento == null) return;
  const esperado = saldoEsperado(caixa, ctx);
  caixa.saldoApurado = esperado;
  caixa.divergencia = Math.round((caixa.saldoContado - esperado) * 100) / 100;
  caixa.situacao = caixa.divergencia === 0 ? 'FECHADO' : 'A_APROVAR';
}

// Itens dispensados ao paciente no alcance da sessão.
function loteDispensadoAoTitular(idLote, ctx) {
  return ctx.db.movimentacoes.some(
    (m) => igual(m.idLote, idLote) && m.origem === 'DISPENSACAO' && doPaciente('movimentacoes')(m, ctx)
  );
}
const produtoDispensadoAoTitular = (r, ctx) =>
  ctx.db.lotes.some((l) => igual(l.idProduto, r.id) && loteDispensadoAoTitular(l.id, ctx));

const pedidoDeExportacao = { situacao: 'SOLICITADA', dataConclusao: null };

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
    [P]: { ler: todos, ocultar: soMostrar('id', 'crm', 'ufCrm', 'especialidade') },
    [R]: { ler: todos, ocultar: soMostrar('id', 'crm', 'ufCrm', 'especialidade') },
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
          dataHora: ctx.agoraTexto(),
          duracao,
          expiraEm: ctx.agoraTexto(duracao),
          revisado: false,
        };
      },
      validar: (novo) =>
        typeof novo.justificativa === 'string' && novo.justificativa.trim().length >= 10
          ? null
          : 'Descreva a justificativa do acesso.',
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
    [A]: { ler: comCampo('tipo', 'HISTORICO'), criar: true, fixar: () => pedidoDeExportacao },
    [S]: { ler: comCampo('tipo', 'HISTORICO'), criar: true, fixar: () => pedidoDeExportacao },
    [M]: { ler: doPaciente('exportacoes'), criar: true, fixar: () => pedidoDeExportacao },
    [P]: { ler: doPaciente('exportacoes'), criar: true, fixar: (ctx) => ({ ...fixarTitular(ctx), ...pedidoDeExportacao }) },
    [R]: { ler: doPaciente('exportacoes'), criar: true, fixar: (ctx) => ({ ...fixarTitular(ctx), ...pedidoDeExportacao }) },
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
  bloqueiosAgenda: {
    [A]: { ler: todos, criar: true, editar: true, excluir: true, validar: validarBloqueio },
    [S]: { ler: todos, criar: true, editar: true, excluir: true, validar: validarBloqueio },
    // Bloqueio da clínica inteira (feriado) tem idMedico nulo e vale para todos.
    [M]: { ler: ou(doMedico, comCampo('idMedico', null)), criar: true, fixar: fixarPessoa('idMedico') },
  },
  consultas: {
    [A]: {
      ler: todos,
      criar: true,
      editar: true,
      editaveis: ['status', 'motivoCancelamento', 'dataHora'],
      validar: validarConsulta,
    },
    [S]: { ler: todos, criar: true, editar: true, validar: validarConsulta },
    [M]: {
      ler: doMedico,
      editar: true,
      editaveis: ['status', 'motivoTransicao'],
      validar: validarConsulta,
      aposEditar: aposMudarStatus,
    },
    [P]: {
      ler: doPaciente('consultas'),
      criar: true,
      editar: true,
      editaveis: ['status', 'motivoCancelamento'],
      fixar: (ctx) => ({ ...fixarTitular(ctx), status: 'AGENDADO', canalOrigem: 'PORTAL' }),
      validar: validarConsulta,
    },
    [R]: {
      ler: doPaciente('consultas'),
      criar: true,
      editar: true,
      editaveis: ['status', 'motivoCancelamento'],
      fixar: (ctx) => ({ ...fixarTitular(ctx), status: 'AGENDADO', canalOrigem: 'PORTAL' }),
      validar: validarConsulta,
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
      // A5-R03: registro selado só muda por retificação.
      podeEditar: (atual) => (atual.selado ? 'Registro selado: use a retificação.' : null),
    },
  },
  retificacoes: {
    [M]: { ler: doPaciente('retificacoes'), criar: true },
  },
  prescricoes: {
    [M]: { ler: doPaciente('prescricoes'), criar: true, editar: true },
  },
  itensPrescricao: {
    [M]: { ler: doPaciente('itensPrescricao'), criar: true, editar: true },
  },
  // RF28 e D2: só o autor, e só de paciente no seu alcance.
  anotacoesPrivadas: {
    [M]: {
      ler: e(doMedico, doPaciente('anotacoesPrivadas')),
      criar: true,
      editar: true,
      excluir: true,
      fixar: fixarPessoa('idMedico'),
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
  cobrancas: {
    [A]: { ler: todos, criar: true, editar: true },
    [S]: { ler: todos, criar: true },
    [P]: { ler: doPaciente('cobrancas') },
    [R]: { ler: doPaciente('cobrancas') },
  },
  // D5: fechamento cego; o saldo apurado e a divergência só vão ao Administrador.
  caixas: {
    [A]: { ler: todos, editar: true, editaveis: ['situacao', 'justificativa'] },
    [S]: {
      ler: (r, ctx) => igual(r.idSecretaria, ctx.sessao.idPessoa),
      criar: true,
      editar: true,
      ocultar: ['saldoApurado', 'divergencia'],
      fixar: (ctx) => ({ idSecretaria: ctx.sessao.idPessoa, situacao: 'ABERTO', dataAbertura: ctx.agoraTexto() }),
      podeEditar: (atual) => (atual.situacao === 'ABERTO' ? null : 'Este caixa já foi fechado.'),
      validar: validarFechamento,
      aposEditar: fecharCaixa,
    },
  },
  pagamentos: {
    [A]: { ler: todos },
    [S]: { ler: todos, criar: true },
    [P]: { ler: doPaciente('pagamentos') },
    [R]: { ler: doPaciente('pagamentos') },
  },
  pagamentosPix: {
    [A]: { ler: todos },
    [S]: { ler: todos, criar: true },
    [P]: { ler: doPaciente('pagamentosPix') },
    [R]: { ler: doPaciente('pagamentosPix') },
  },
  // S-07a: a Secretária não vê o valor líquido (taxa do adquirente).
  pagamentosCartao: {
    [A]: { ler: todos },
    [S]: { ler: todos, criar: true, ocultar: ['valorLiquido'] },
  },
  pagamentosDinheiro: {
    [A]: { ler: todos },
    [S]: { ler: todos, criar: true },
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
