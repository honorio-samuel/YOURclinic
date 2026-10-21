import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AreaLogada, Permitido } from './components/layout';
import Login from './views/geral/login';
import SelecionarRepresentado from './views/geral/selecionar-representado';
import { EmBreve, RegistroIndisponivel } from './views/geral/avisos';
import Pacientes from './views/cadastro/listagem-pacientes';
import Medicos from './views/cadastro/listagem-medicos';
import Equipe from './views/cadastro/listagem-equipe';
import Convenios from './views/cadastro/listagem-convenios';
import Procedimentos from './views/cadastro/listagem-procedimentos';
import AnexosRecepcao from './views/cadastro/anexos-paciente';
import FilaDoDia from './views/agenda/fila-do-dia';
import AtendimentosDoDia from './views/agenda/atendimentos-do-dia';
import Bloqueios from './views/agenda/bloqueios';
import ReagendarOuCancelar from './views/agenda/reagendar-ou-cancelar';
import ContasReceber from './views/financeiro/contas-receber';
import ContasPagar from './views/financeiro/contas-pagar';
import Conciliacao from './views/financeiro/conciliacao';
import Caixas from './views/financeiro/caixas';
import Estornos from './views/financeiro/estornos';
import DocumentosFiscais from './views/financeiro/documentos-fiscais';
import CobrancasDoDia from './views/financeiro/cobrancas-do-dia';
import OrcamentosAprovacao from './views/financeiro/orcamentos-aprovacao';
import OrcamentosValores from './views/financeiro/orcamentos-valores';
import OrcamentosMedico from './views/financeiro/orcamentos-medico';
import Contratos from './views/tiss/contratos';
import Elegibilidade from './views/tiss/elegibilidade';
import Guias from './views/tiss/guias';
import Lotes from './views/tiss/lotes';
import Glosas from './views/tiss/glosas';
import RecursosGlosa from './views/tiss/recursos-glosa';
import Produtos from './views/estoque/produtos';
import Movimentacoes from './views/estoque/movimentacoes';
import Alertas from './views/estoque/alertas';
import PainelDoDia from './views/gestao/painel-do-dia';
import Relatorios from './views/gestao/relatorios';
import LogAuditoria from './views/gestao/log-auditoria';
import Notificacoes from './views/gestao/notificacoes';
import SolicitacoesTitulares from './views/gestao/solicitacoes-titulares';
import Parametros from './views/gestao/parametros';
import MeusPacientes from './views/clinico/meus-pacientes';
import Prontuario from './views/clinico/prontuario';
import PendenciasClinicas from './views/clinico/pendencias-clinicas';
import InicioPortal from './views/portal/inicio';
import AgendamentosPortal from './views/portal/agendamentos';
import DocumentosPortal from './views/portal/documentos';
import CobrancasPortal from './views/portal/cobrancas';
import OrcamentoPortal from './views/portal/orcamento';
import DadosPortal from './views/portal/dados';
import { INICIO } from './navegacao/menus';
import { useSessao } from './sessao/sessao';

const A = ['ADMINISTRADOR'];
const M = ['MEDICO'];
const S = ['SECRETARIA'];
const PORTAL = ['PACIENTE', 'RESPONSAVEL_LEGAL'];
const TODOS = ['ADMINISTRADOR', 'MEDICO', 'SECRETARIA', 'PACIENTE', 'RESPONSAVEL_LEGAL'];

// [caminho, papéis, elemento]. Telas que não são listagem aparecem como "Em
// construção" com o código do Figma, para a navegação funcionar inteira.
const TELAS = [
  // Administrador
  ['/admin/inicio', A, <PainelDoDia />],
  ['/admin/pacientes', A, <Pacientes />],
  ['/admin/medicos', A, <Medicos />],
  ['/admin/equipe', A, <Equipe />],
  ['/admin/convenios', A, <Convenios />],
  ['/admin/procedimentos', A, <Procedimentos />],
  ['/admin/agenda', A, <EmBreve codigo='A-07' titulo='Agenda da clínica' />],
  ['/admin/agendamento', A, <EmBreve codigo='A-08a' titulo='Novo agendamento' />],
  ['/admin/fila', A, <FilaDoDia />],
  ['/admin/grade', A, <EmBreve codigo='A-10' titulo='Grade de horários' />],
  ['/admin/bloqueios', A, <Bloqueios />],
  ['/admin/painel-financeiro', A, <EmBreve codigo='A-12' titulo='Painel financeiro' />],
  ['/admin/contas-receber', A, <ContasReceber />],
  ['/admin/contas-pagar', A, <ContasPagar />],
  ['/admin/conciliacao', A, <Conciliacao />],
  ['/admin/caixas', A, <Caixas />],
  ['/admin/estornos', A, <Estornos />],
  ['/admin/orcamentos', A, <OrcamentosAprovacao />],
  ['/admin/recibos-nfse', A, <DocumentosFiscais />],
  ['/admin/contratos', A, <Contratos />],
  ['/admin/elegibilidade', A, <Elegibilidade />],
  ['/admin/guias', A, <Guias />],
  ['/admin/lotes', A, <Lotes />],
  ['/admin/glosas', A, <Glosas />],
  ['/admin/recursos', A, <RecursosGlosa />],
  ['/admin/produtos', A, <Produtos />],
  ['/admin/movimentacoes', A, <Movimentacoes />],
  ['/admin/alertas', A, <Alertas />],
  ['/admin/dashboard', A, <EmBreve codigo='A-29' titulo='Dashboard gerencial' />],
  ['/admin/relatorios', A, <Relatorios />],
  ['/admin/log', A, <LogAuditoria />],
  ['/admin/notificacoes', A, <Notificacoes />],
  ['/admin/solicitacoes', A, <SolicitacoesTitulares />],
  ['/admin/parametros', A, <Parametros />],
  // Médico
  ['/medico/atendimentos', M, <AtendimentosDoDia />],
  ['/medico/pacientes', M, <MeusPacientes />],
  ['/medico/pacientes/:id', M, <Prontuario />],
  ['/medico/pacientes/:id/:aba', M, <Prontuario />],
  ['/medico/agenda', M, <EmBreve codigo='M-03' titulo='Minha agenda' />],
  ['/medico/orcamentos', M, <OrcamentosMedico />],
  ['/medico/estoque', M, <Produtos />],
  ['/medico/pendencias', M, <PendenciasClinicas />],
  // Secretária
  ['/secretaria/pacientes', S, <Pacientes />],
  ['/secretaria/pacientes/:id/anexos', S, <AnexosRecepcao />],
  ['/secretaria/agenda', S, <EmBreve codigo='S-02' titulo='Agenda da clínica' />],
  ['/secretaria/agendamento', S, <EmBreve codigo='S-03a' titulo='Novo agendamento' />],
  ['/secretaria/reagendar', S, <ReagendarOuCancelar />],
  ['/secretaria/bloqueios', S, <Bloqueios />],
  ['/secretaria/fila', S, <FilaDoDia />],
  ['/secretaria/checkout', S, <EmBreve codigo='S-07a' titulo='Checkout' />],
  ['/secretaria/cobrancas', S, <CobrancasDoDia />],
  ['/secretaria/caixa', S, <EmBreve codigo='S-09' titulo='Meu caixa' />],
  ['/secretaria/orcamentos', S, <OrcamentosValores />],
  ['/secretaria/recibos', S, <DocumentosFiscais />],
  ['/secretaria/estornos', S, <Estornos />],
  ['/secretaria/elegibilidade', S, <Elegibilidade />],
  ['/secretaria/guias', S, <Guias />],
  ['/secretaria/lotes', S, <Lotes />],
  ['/secretaria/glosas', S, <Glosas />],
  ['/secretaria/produtos', S, <Produtos />],
  ['/secretaria/movimentacoes', S, <Movimentacoes />],
  ['/secretaria/alertas', S, <Alertas />],
  // Paciente e Responsável Legal
  ['/portal/inicio', PORTAL, <InicioPortal />],
  ['/portal/agendar', PORTAL, <EmBreve codigo='P-02 e R-02' titulo='Agendar consulta' />],
  ['/portal/agendamentos', PORTAL, <AgendamentosPortal />],
  ['/portal/documentos', PORTAL, <DocumentosPortal />],
  ['/portal/cobrancas', PORTAL, <CobrancasPortal />],
  ['/portal/orcamentos/:id', PORTAL, <OrcamentoPortal />],
  ['/portal/dados', PORTAL, <DadosPortal />],
  ['/portal/representado', ['RESPONSAVEL_LEGAL'], <SelecionarRepresentado />],
  // Todos
  ['/perfil', TODOS, <EmBreve codigo='G-10' titulo='Meu perfil' />],
];

// Rotas antigas, de antes do redesenho.
const ANTIGAS = {
  '/listagem-cadastro': '/secretaria/pacientes',
  '/listagem-filadia': '/secretaria/fila',
  '/listagem-agenda': '/secretaria/agenda',
  '/listagem-financeiro': '/secretaria/cobrancas',
  '/listagem-estoque': '/secretaria/produtos',
};

function Inicio() {
  const { sessao } = useSessao();
  return <Navigate to={sessao ? INICIO[sessao.usuario.papel] : '/entrar'} replace />;
}

function Rotas() {
  return (
    <Routes>
      <Route path='/entrar' element={<Login />} />
      <Route element={<AreaLogada />}>
        <Route index element={<Inicio />} />
        {TELAS.map(([caminho, papeis, elemento]) => (
          <Route key={caminho} path={caminho} element={<Permitido papeis={papeis}>{elemento}</Permitido>} />
        ))}
        {Object.entries(ANTIGAS).map(([de, para]) => (
          <Route key={de} path={de} element={<Navigate to={para} replace />} />
        ))}
        <Route path='*' element={<RegistroIndisponivel />} />
      </Route>
    </Routes>
  );
}

export default Rotas;
