import HomeIcon from '@mui/icons-material/Home';
import HowToRegIcon from '@mui/icons-material/HowToReg';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import PaymentsIcon from '@mui/icons-material/Payments';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import InsightsIcon from '@mui/icons-material/Insights';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import GroupsIcon from '@mui/icons-material/Groups';
import RequestQuoteIcon from '@mui/icons-material/RequestQuote';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import EventAvailableIcon from '@mui/icons-material/EventAvailable';
import EventNoteIcon from '@mui/icons-material/EventNote';
import FolderSharedIcon from '@mui/icons-material/FolderShared';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PrivacyTipIcon from '@mui/icons-material/PrivacyTip';

// Árvore de menus por papel (docs/redesenho/03-mapa-de-navegacao.md).
// Item com "itens" é um grupo em acordeão; item com "rota" é um link direto.
export const MENUS = {
  ADMINISTRADOR: [
    { rotulo: 'Início', icone: HomeIcon, itens: [{ rotulo: 'Painel do dia', rota: '/admin/inicio' }] },
    {
      rotulo: 'Cadastro',
      icone: HowToRegIcon,
      itens: [
        { rotulo: 'Pacientes', rota: '/admin/listagem-pacientes' },
        { rotulo: 'Médicos', rota: '/admin/listagem-medicos' },
        { rotulo: 'Equipe · usuários e papéis', rota: '/admin/listagem-equipe' },
        { rotulo: 'Convênios', rota: '/admin/listagem-convenios' },
        { rotulo: 'Procedimentos e preços', rota: '/admin/listagem-procedimentos' },
      ],
    },
    {
      rotulo: 'Agenda',
      icone: CalendarMonthIcon,
      itens: [
        { rotulo: 'Agenda da clínica', rota: '/admin/agenda' },
        { rotulo: 'Novo agendamento', rota: '/admin/cadastro-agendamentos' },
        { rotulo: 'Fila do dia', rota: '/admin/listagem-fila-do-dia' },
        { rotulo: 'Grade de horários', rota: '/admin/grade' },
        { rotulo: 'Bloqueios e consultas afetadas', rota: '/admin/listagem-bloqueios' },
      ],
    },
    {
      rotulo: 'Financeiro',
      icone: PaymentsIcon,
      itens: [
        { rotulo: 'Painel financeiro', rota: '/admin/painel-financeiro' },
        { rotulo: 'Contas a receber', rota: '/admin/listagem-contas-receber' },
        { rotulo: 'Contas a pagar', rota: '/admin/listagem-contas-pagar' },
        { rotulo: 'Conciliação', rota: '/admin/listagem-conciliacao' },
        { rotulo: 'Caixas · supervisão', rota: '/admin/listagem-caixas' },
        { rotulo: 'Cancelamentos e estornos', rota: '/admin/listagem-estornos' },
        { rotulo: 'Orçamentos · aprovação', rota: '/admin/listagem-orcamentos' },
        { rotulo: 'Recibos e NFS-e', rota: '/admin/listagem-recibos-nfse' },
      ],
    },
    {
      rotulo: 'Faturamento TISS',
      icone: FactCheckIcon,
      itens: [
        { rotulo: 'Contratos e tabelas', rota: '/admin/listagem-contratos' },
        { rotulo: 'Elegibilidade e autorizações', rota: '/admin/listagem-elegibilidades' },
        { rotulo: 'Guias TISS', rota: '/admin/listagem-guias' },
        { rotulo: 'Lotes e protocolos', rota: '/admin/listagem-lotes' },
        { rotulo: 'Demonstrativos e glosas', rota: '/admin/listagem-glosas' },
        { rotulo: 'Recursos de glosa', rota: '/admin/listagem-recursos-glosa' },
      ],
    },
    {
      rotulo: 'Estoque',
      icone: Inventory2Icon,
      itens: [
        { rotulo: 'Produtos e lotes', rota: '/admin/listagem-produtos' },
        { rotulo: 'Movimentações', rota: '/admin/listagem-movimentacoes' },
        { rotulo: 'Alertas', rota: '/admin/listagem-alertas' },
      ],
    },
    {
      rotulo: 'Gestão',
      icone: InsightsIcon,
      itens: [
        { rotulo: 'Dashboard gerencial', rota: '/admin/dashboard' },
        { rotulo: 'Relatórios', rota: '/admin/listagem-relatorios' },
        { rotulo: 'Log de auditoria', rota: '/admin/listagem-log-auditoria' },
        { rotulo: 'Notificações', rota: '/admin/listagem-notificacoes' },
        { rotulo: 'Solicitações dos titulares (LGPD)', rota: '/admin/listagem-solicitacoes' },
        { rotulo: 'Parâmetros do sistema', rota: '/admin/listagem-parametros' },
      ],
    },
  ],
  MEDICO: [
    { rotulo: 'Atendimentos do dia', icone: FormatListNumberedIcon, rota: '/medico/listagem-atendimentos' },
    { rotulo: 'Meus pacientes', icone: GroupsIcon, rota: '/medico/listagem-pacientes' },
    { rotulo: 'Minha agenda', icone: CalendarMonthIcon, rota: '/medico/agenda' },
    { rotulo: 'Orçamentos', icone: RequestQuoteIcon, rota: '/medico/listagem-orcamentos' },
    { rotulo: 'Estoque', icone: Inventory2Icon, rota: '/medico/listagem-produtos' },
    { rotulo: 'Pendências clínicas', icone: PendingActionsIcon, rota: '/medico/listagem-pendencias' },
  ],
  SECRETARIA: [
    { rotulo: 'Cadastro', icone: HowToRegIcon, itens: [{ rotulo: 'Pacientes', rota: '/secretaria/listagem-pacientes' }] },
    {
      rotulo: 'Agenda',
      icone: CalendarMonthIcon,
      itens: [
        { rotulo: 'Agenda da clínica', rota: '/secretaria/agenda' },
        { rotulo: 'Novo agendamento', rota: '/secretaria/cadastro-agendamentos' },
        { rotulo: 'Reagendar ou cancelar', rota: '/secretaria/listagem-consultas' },
        { rotulo: 'Grade e bloqueios', rota: '/secretaria/listagem-bloqueios' },
      ],
    },
    { rotulo: 'Fila do dia', icone: FormatListNumberedIcon, rota: '/secretaria/listagem-fila-do-dia' },
    {
      rotulo: 'Caixa e cobranças',
      icone: PaymentsIcon,
      itens: [
        { rotulo: 'Checkout', rota: '/secretaria/checkout' },
        { rotulo: 'Cobranças do dia', rota: '/secretaria/listagem-cobrancas' },
        { rotulo: 'Meu caixa', rota: '/secretaria/caixa' },
        { rotulo: 'Orçamentos · valores', rota: '/secretaria/listagem-orcamentos' },
        { rotulo: 'Recibos', rota: '/secretaria/listagem-recibos' },
        { rotulo: 'Estornos · solicitar', rota: '/secretaria/listagem-estornos' },
      ],
    },
    {
      rotulo: 'Faturamento TISS',
      icone: FactCheckIcon,
      itens: [
        { rotulo: 'Elegibilidade e autorização', rota: '/secretaria/listagem-elegibilidades' },
        { rotulo: 'Guias TISS', rota: '/secretaria/listagem-guias' },
        { rotulo: 'Lotes e protocolos', rota: '/secretaria/listagem-lotes' },
        { rotulo: 'Glosas e recursos', rota: '/secretaria/listagem-glosas' },
      ],
    },
    {
      rotulo: 'Estoque',
      icone: Inventory2Icon,
      itens: [
        { rotulo: 'Produtos e lotes', rota: '/secretaria/listagem-produtos' },
        { rotulo: 'Movimentações', rota: '/secretaria/listagem-movimentacoes' },
        { rotulo: 'Alertas', rota: '/secretaria/listagem-alertas' },
      ],
    },
  ],
  PACIENTE: [
    { rotulo: 'Início', icone: HomeIcon, rota: '/portal/inicio' },
    { rotulo: 'Agendar consulta', icone: EventAvailableIcon, rota: '/portal/cadastro-agendamentos' },
    { rotulo: 'Meus agendamentos', icone: EventNoteIcon, rota: '/portal/listagem-agendamentos' },
    { rotulo: 'Meus documentos', icone: FolderSharedIcon, rota: '/portal/listagem-documentos' },
    { rotulo: 'Orçamentos e cobranças', icone: ReceiptLongIcon, rota: '/portal/listagem-cobrancas' },
    { rotulo: 'Meus dados e privacidade', icone: PrivacyTipIcon, rota: '/portal/dados' },
  ],
  // O Responsável vê os mesmos itens, em terceira pessoa.
  RESPONSAVEL_LEGAL: [
    { rotulo: 'Início', icone: HomeIcon, rota: '/portal/inicio' },
    { rotulo: 'Agendar consulta', icone: EventAvailableIcon, rota: '/portal/cadastro-agendamentos' },
    { rotulo: 'Agendamentos', icone: EventNoteIcon, rota: '/portal/listagem-agendamentos' },
    { rotulo: 'Documentos', icone: FolderSharedIcon, rota: '/portal/listagem-documentos' },
    { rotulo: 'Orçamentos e cobranças', icone: ReceiptLongIcon, rota: '/portal/listagem-cobrancas' },
    { rotulo: 'Dados do representado', icone: PrivacyTipIcon, rota: '/portal/dados' },
  ],
};

// Tela de entrada de cada papel.
export const INICIO = {
  ADMINISTRADOR: '/admin/inicio',
  MEDICO: '/medico/listagem-atendimentos',
  SECRETARIA: '/secretaria/listagem-fila-do-dia',
  PACIENTE: '/portal/inicio',
  RESPONSAVEL_LEGAL: '/portal/inicio',
};
