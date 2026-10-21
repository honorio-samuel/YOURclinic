// Rótulo e tom de cada valor que a API devolve em maiúsculas. O tom é o da
// PilulaStatus do Figma: neutro, info, escuro, sucesso, perigo ou aviso.

export const PAPEIS = {
  ADMINISTRADOR: 'Administrador',
  MEDICO: 'Médico',
  SECRETARIA: 'Secretária',
  PACIENTE: 'Paciente',
  RESPONSAVEL_LEGAL: 'Responsável Legal',
};

// Os seis estados da consulta (RF22). Não existe um sétimo.
export const STATUS_CONSULTA = {
  AGENDADO: { rotulo: 'Agendado', tom: 'neutro' },
  NA_RECEPCAO: { rotulo: 'Na recepção', tom: 'info' },
  EM_ATENDIMENTO: { rotulo: 'Em atendimento', tom: 'escuro' },
  FINALIZADO: { rotulo: 'Finalizado', tom: 'sucesso' },
  CANCELADO: { rotulo: 'Cancelado', tom: 'perigo' },
  NAO_COMPARECEU: { rotulo: 'Não compareceu', tom: 'aviso' },
};

export const SITUACAO_CADASTRO = {
  ATIVO: { rotulo: 'Ativo', tom: 'sucesso' },
  INATIVO: { rotulo: 'Inativo', tom: 'neutro' },
  CONVITE_PENDENTE: { rotulo: 'Convite pendente', tom: 'aviso' },
  ENCERRADO: { rotulo: 'Encerrado', tom: 'neutro' },
  VIGENTE: { rotulo: 'Vigente', tom: 'sucesso' },
};

export const VINCULO = {
  ATIVO: { rotulo: 'Ativo', tom: 'sucesso' },
  HISTORICO: { rotulo: 'Histórico', tom: 'info' },
  PENDENTE: { rotulo: 'Pendente', tom: 'aviso' },
  ENCERRADO: { rotulo: 'Encerrado', tom: 'neutro' },
};

export const SITUACAO_TITULO = {
  ABERTO: { rotulo: 'Aberto', tom: 'info' },
  ABERTA: { rotulo: 'Em aberto', tom: 'info' },
  VENCIDO: { rotulo: 'Vencido', tom: 'perigo' },
  PAGO: { rotulo: 'Pago', tom: 'sucesso' },
  PAGA: { rotulo: 'Paga', tom: 'sucesso' },
  PARCIALMENTE_PAGA: { rotulo: 'Parcial', tom: 'aviso' },
  ESTORNADO: { rotulo: 'Estornado', tom: 'neutro' },
  ESTORNADA: { rotulo: 'Estornada', tom: 'neutro' },
};

export const ORIGEM_TITULO = {
  COPARTICIPACAO: 'Coparticipação',
  ATENDIMENTO_PARTICULAR: 'Atendimento',
  PARTICULAR: 'Atendimento',
  ORCAMENTO: 'Orçamento',
  OPERADORA: 'Operadora',
  CONVENIO: 'Operadora',
};

export const CATEGORIA_DESPESA = {
  ALUGUEL: 'Aluguel',
  FOLHA: 'Folha e encargos',
  INSUMOS: 'Insumos',
  MATERIAL: 'Material',
  SERVICOS: 'Serviços de terceiros',
  TRIBUTOS: 'Tributos',
  TAXA_ADQUIRENTE: 'Taxa de adquirente',
  OUTRAS: 'Outras',
};

export const MEIO_PAGAMENTO = {
  PIX: 'Pix',
  CARTAO: 'Cartão',
  DINHEIRO: 'Dinheiro',
};

export const ETAPA_ORCAMENTO = {
  ESCOPO: { rotulo: '1. Escopo', tom: 'neutro' },
  VALORES: { rotulo: '2. Valores', tom: 'info' },
  APROVACAO: { rotulo: '3. Aprovação', tom: 'aviso' },
  ACEITE: { rotulo: 'A aceitar', tom: 'info' },
  ACEITO: { rotulo: 'Aceito', tom: 'sucesso' },
  RECUSADO: { rotulo: 'Recusado', tom: 'neutro' },
  DEVOLVIDO: { rotulo: 'Devolvido', tom: 'perigo' },
  EXPIRADO: { rotulo: 'Expirado', tom: 'neutro' },
};

export const MOTIVO_BLOQUEIO = {
  FERIAS: 'Férias',
  FERIADO: 'Feriado',
  CONGRESSO: 'Congresso',
  CAPACITACAO: 'Capacitação',
  INTERVALO: 'Intervalo',
  OUTRO: 'Outro',
};

export const TIPO_PRODUTO = {
  MEDICAMENTO: 'Medicamento',
  MATERIAL: 'Material',
  AMOSTRA: 'Amostra',
};

export const SITUACAO_GUIA = {
  RASCUNHO: { rotulo: 'Rascunho', tom: 'neutro' },
  EM_DIGITACAO: { rotulo: 'Rascunho', tom: 'neutro' },
  LIBERADA: { rotulo: 'Liberada', tom: 'info' },
  BLOQUEADA: { rotulo: 'Bloqueada', tom: 'perigo' },
  ENVIADA: { rotulo: 'Enviada', tom: 'info' },
  PAGA: { rotulo: 'Paga', tom: 'sucesso' },
  GLOSADA: { rotulo: 'Glosada', tom: 'aviso' },
  CANCELADA: { rotulo: 'Cancelada', tom: 'neutro' },
};

export const SITUACAO_NOTIFICACAO = {
  ENTREGUE: { rotulo: 'Entregue', tom: 'sucesso' },
  FALHOU: { rotulo: 'Falhou', tom: 'perigo' },
  FALHA: { rotulo: 'Falhou', tom: 'perigo' },
  AGENDADA: { rotulo: 'Agendada', tom: 'neutro' },
  ENVIADA: { rotulo: 'Enviada', tom: 'info' },
};

export const EVENTO_NOTIFICACAO = {
  LEMBRETE_CONSULTA: 'Lembrete de consulta',
  CANCELAMENTO_CONSULTA: 'Consulta cancelada pela clínica',
  CONFIRMACAO_CONSULTA: 'Confirmação de consulta',
  CONFIRMACAO_AGENDAMENTO: 'Confirmação de agendamento',
  CANCELAMENTO: 'Consulta cancelada pela clínica',
  COBRANCA_DISPONIVEL: 'Cobrança disponível',
  ORCAMENTO_DISPONIVEL: 'Orçamento disponível',
};

export const CANAL = {
  SMS: 'Mensagem de texto',
  EMAIL: 'E-mail',
  WHATSAPP: 'WhatsApp',
};

export const TIPO_SOLICITACAO = {
  ACESSO: 'Acesso aos dados',
  CORRECAO: 'Correção',
  PORTABILIDADE: 'Portabilidade',
  REVOGACAO: 'Revogação de consentimento',
  ELIMINACAO: 'Eliminação',
};

export const SITUACAO_SOLICITACAO = {
  ABERTA: { rotulo: 'Aberta', tom: 'info' },
  EM_ANALISE: { rotulo: 'Em análise', tom: 'aviso' },
  CONCLUIDA: { rotulo: 'Concluída', tom: 'sucesso' },
  RESPONDIDA: { rotulo: 'Respondida', tom: 'sucesso' },
  RECUSADA: { rotulo: 'Recusada', tom: 'neutro' },
};

// Cadastros (A-02b, S-01b, A-03, A-04).
export const TIPO_ATENDIMENTO = { PARTICULAR: 'Particular', CONVENIO: 'Convênio' };

export const GRAU_PARENTESCO = {
  MAE: 'Mãe',
  PAI: 'Pai',
  AVO: 'Avó ou avô',
  TIO: 'Tia ou tio',
  IRMAO: 'Irmã ou irmão',
  TUTOR: 'Tutor ou tutora',
  CURADOR: 'Curador ou curadora',
  OUTRO: 'Outro',
};

export const NATUREZA_REPRESENTACAO = {
  PODER_FAMILIAR: 'Poder familiar',
  TUTELA: 'Tutela',
  CURATELA: 'Curatela',
};

export const CONTA = {
  ATIVO: { rotulo: 'Ativa', tom: 'sucesso' },
  INATIVO: { rotulo: 'Inativa', tom: 'neutro' },
  CONVITE_PENDENTE: { rotulo: 'Convite pendente', tom: 'aviso' },
};

export const TURNO = { MANHA: 'Manhã', TARDE: 'Tarde', INTEGRAL: 'Integral' };

export const SEXO = { F: 'Feminino', M: 'Masculino' };

// Unidades de estoque do banco (A-26).
export const UNIDADE_PRODUTO = { UN: 'Unidade', CX: 'Caixa', PCT: 'Pacote', FR: 'Frasco', DOSE: 'Dose' };

export const UFS = 'AC AL AM AP BA CE DF ES GO MA MG MS MT PA PB PE PI PR RJ RN RO RR RS SC SE SP TO'.split(' ');

export function rotuloDe(mapa, valor) {
  const item = mapa[valor];
  if (!item) return { rotulo: valor ?? '—', tom: 'neutro' };
  return typeof item === 'string' ? { rotulo: item, tom: 'neutro' } : item;
}
