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
        { rotulo: 'Pacientes', rota: '/admin/pacientes' },
        { rotulo: 'Médicos', rota: '/admin/medicos' },
        { rotulo: 'Equipe · usuários e papéis', rota: '/admin/equipe' },
        { rotulo: 'Convênios', rota: '/admin/convenios' },
        { rotulo: 'Procedimentos e preços', rota: '/admin/procedimentos' },
      ],
    },
    {
      rotulo: 'Agenda',
      icone: CalendarMonthIcon,
      itens: [
        { rotulo: 'Agenda da clínica', rota: '/admin/agenda' },
        { rotulo: 'Novo agendamento', rota: '/admin/agendamento' },
        { rotulo: 'Fila do dia', rota: '/admin/fila' },
        { rotulo: 'Grade de horários', rota: '/admin/grade' },
        { rotulo: 'Bloqueios e consultas afetadas', rota: '/admin/bloqueios' },
      ],
    },
    {
      rotulo: 'Financeiro',
      icone: PaymentsIcon,
      itens: [
        { rotulo: 'Painel financeiro', rota: '/admin/painel-financeiro' },
        { rotulo: 'Contas a receber', rota: '/admin/contas-receber' },
        { rotulo: 'Contas a pagar', rota: '/admin/contas-pagar' },
        { rotulo: 'Conciliação', rota: '/admin/conciliacao' },
        { rotulo: 'Caixas · supervisão', rota: '/admin/caixas' },
        { rotulo: 'Cancelamentos e estornos', rota: '/admin/estornos' },
        { rotulo: 'Orçamentos · aprovação', rota: '/admin/orcamentos' },
        { rotulo: 'Recibos e NFS-e', rota: '/admin/recibos-nfse' },
      ],
    },
    {
      rotulo: 'Faturamento TISS',
      icone: FactCheckIcon,
      itens: [
        { rotulo: 'Contratos e tabelas', rota: '/admin/contratos' },
        { rotulo: 'Elegibilidade e autorizações', rota: '/admin/elegibilidade' },
        { rotulo: 'Guias TISS', rota: '/admin/guias' },
        { rotulo: 'Lotes e protocolos', rota: '/admin/lotes' },
        { rotulo: 'Demonstrativos e glosas', rota: '/admin/glosas' },
        { rotulo: 'Recursos de glosa', rota: '/admin/recursos' },
      ],
    },
    {
      rotulo: 'Estoque',
      icone: Inventory2Icon,
      itens: [
        { rotulo: 'Produtos e lotes', rota: '/admin/produtos' },
        { rotulo: 'Movimentações', rota: '/admin/movimentacoes' },
        { rotulo: 'Alertas', rota: '/admin/alertas' },
      ],
    },
    {
      rotulo: 'Gestão',
      icone: InsightsIcon,
      itens: [
        { rotulo: 'Dashboard gerencial', rota: '/admin/dashboard' },
        { rotulo: 'Relatórios', rota: '/admin/relatorios' },
        { rotulo: 'Log de auditoria', rota: '/admin/log' },
        { rotulo: 'Notificações', rota: '/admin/notificacoes' },
        { rotulo: 'Solicitações dos titulares (LGPD)', rota: '/admin/solicitacoes' },
        { rotulo: 'Parâmetros do sistema', rota: '/admin/parametros' },
      ],
    },
  ],
  MEDICO: [
    { rotulo: 'Atendimentos do dia', icone: FormatListNumberedIcon, rota: '/medico/atendimentos' },
    { rotulo: 'Meus pacientes', icone: GroupsIcon, rota: '/medico/pacientes' },
    { rotulo: 'Minha agenda', icone: CalendarMonthIcon, rota: '/medico/agenda' },
    { rotulo: 'Orçamentos', icone: RequestQuoteIcon, rota: '/medico/orcamentos' },
    { rotulo: 'Estoque', icone: Inventory2Icon, rota: '/medico/estoque' },
    { rotulo: 'Pendências clínicas', icone: PendingActionsIcon, rota: '/medico/pendencias' },
  ],
  SECRETARIA: [
    { rotulo: 'Cadastro', icone: HowToRegIcon, itens: [{ rotulo: 'Pacientes', rota: '/secretaria/pacientes' }] },
    {
      rotulo: 'Agenda',
      icone: CalendarMonthIcon,
      itens: [
        { rotulo: 'Agenda da clínica', rota: '/secretaria/agenda' },
        { rotulo: 'Novo agendamento', rota: '/secretaria/agendamento' },
        { rotulo: 'Reagendar ou cancelar', rota: '/secretaria/reagendar' },
        { rotulo: 'Grade e bloqueios', rota: '/secretaria/bloqueios' },
      ],
    },
    { rotulo: 'Fila do dia', icone: FormatListNumberedIcon, rota: '/secretaria/fila' },
    {
      rotulo: 'Caixa e cobranças',
      icone: PaymentsIcon,
      itens: [
        { rotulo: 'Checkout', rota: '/secretaria/checkout' },
        { rotulo: 'Cobranças do dia', rota: '/secretaria/cobrancas' },
        { rotulo: 'Meu caixa', rota: '/secretaria/caixa' },
        { rotulo: 'Orçamentos · valores', rota: '/secretaria/orcamentos' },
        { rotulo: 'Recibos', rota: '/secretaria/recibos' },
        { rotulo: 'Estornos · solicitar', rota: '/secretaria/estornos' },
      ],
    },
    {
      rotulo: 'Faturamento TISS',
      icone: FactCheckIcon,
      itens: [
        { rotulo: 'Elegibilidade e autorização', rota: '/secretaria/elegibilidade' },
        { rotulo: 'Guias TISS', rota: '/secretaria/guias' },
        { rotulo: 'Lotes e protocolos', rota: '/secretaria/lotes' },
        { rotulo: 'Glosas e recursos', rota: '/secretaria/glosas' },
      ],
    },
    {
      rotulo: 'Estoque',
      icone: Inventory2Icon,
      itens: [
        { rotulo: 'Produtos e lotes', rota: '/secretaria/produtos' },
        { rotulo: 'Movimentações', rota: '/secretaria/movimentacoes' },
        { rotulo: 'Alertas', rota: '/secretaria/alertas' },
      ],
    },
  ],
  PACIENTE: [
    { rotulo: 'Início', icone: HomeIcon, rota: '/portal/inicio' },
    { rotulo: 'Agendar consulta', icone: EventAvailableIcon, rota: '/portal/agendar' },
    { rotulo: 'Meus agendamentos', icone: EventNoteIcon, rota: '/portal/agendamentos' },
    { rotulo: 'Meus documentos', icone: FolderSharedIcon, rota: '/portal/documentos' },
    { rotulo: 'Orçamentos e cobranças', icone: ReceiptLongIcon, rota: '/portal/cobrancas' },
    { rotulo: 'Meus dados e privacidade', icone: PrivacyTipIcon, rota: '/portal/dados' },
  ],
  // O Responsável vê os mesmos itens, em terceira pessoa.
  RESPONSAVEL_LEGAL: [
    { rotulo: 'Início', icone: HomeIcon, rota: '/portal/inicio' },
    { rotulo: 'Agendar consulta', icone: EventAvailableIcon, rota: '/portal/agendar' },
    { rotulo: 'Agendamentos', icone: EventNoteIcon, rota: '/portal/agendamentos' },
    { rotulo: 'Documentos', icone: FolderSharedIcon, rota: '/portal/documentos' },
    { rotulo: 'Orçamentos e cobranças', icone: ReceiptLongIcon, rota: '/portal/cobrancas' },
    { rotulo: 'Dados do representado', icone: PrivacyTipIcon, rota: '/portal/dados' },
  ],
};

// Tela de entrada de cada papel.
export const INICIO = {
  ADMINISTRADOR: '/admin/inicio',
  MEDICO: '/medico/atendimentos',
  SECRETARIA: '/secretaria/fila',
  PACIENTE: '/portal/inicio',
  RESPONSAVEL_LEGAL: '/portal/inicio',
};
