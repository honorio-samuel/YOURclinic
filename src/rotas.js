import React from 'react';
import { Navigate, Route, Routes, useParams } from 'react-router-dom';

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
import CadastroPaciente from './views/cadastro/cadastro-paciente';
import ObservacoesGerais from './views/cadastro/observacoes-gerais';
import CadastroMedico from './views/cadastro/cadastro-medico';
import CadastroEquipe from './views/cadastro/cadastro-equipe';
import CadastroConvenio from './views/cadastro/cadastro-convenio';
import CadastroProcedimento from './views/cadastro/cadastro-procedimento';
import FilaDoDia from './views/agenda/listagem-fila-do-dia';
import AtendimentosDoDia from './views/agenda/listagem-atendimentos';
import Bloqueios from './views/agenda/listagem-bloqueios';
import ReagendarOuCancelar from './views/agenda/listagem-consultas';
import ContasReceber from './views/financeiro/listagem-contas-receber';
import ContasPagar from './views/financeiro/listagem-contas-pagar';
import Conciliacao from './views/financeiro/listagem-conciliacao';
import Caixas from './views/financeiro/listagem-caixas';
import Estornos from './views/financeiro/listagem-estornos';
import DocumentosFiscais from './views/financeiro/listagem-documentos-fiscais';
import CobrancasDoDia from './views/financeiro/listagem-cobrancas';
import OrcamentosAprovacao from './views/financeiro/listagem-orcamentos-aprovacao';
import OrcamentosValores from './views/financeiro/listagem-orcamentos-valores';
import OrcamentosMedico from './views/financeiro/listagem-orcamentos-medico';
import Contratos from './views/tiss/listagem-contratos';
import Elegibilidade from './views/tiss/listagem-elegibilidades';
import Guias from './views/tiss/listagem-guias';
import Lotes from './views/tiss/listagem-lotes';
import Glosas from './views/tiss/listagem-glosas';
import RecursosGlosa from './views/tiss/listagem-recursos-glosa';
import Produtos from './views/estoque/listagem-produtos';
import Movimentacoes from './views/estoque/listagem-movimentacoes';
import Alertas from './views/estoque/listagem-alertas';
import PainelDoDia from './views/gestao/painel-do-dia';
import Relatorios from './views/gestao/listagem-relatorios';
import LogAuditoria from './views/gestao/listagem-log-auditoria';
import Notificacoes from './views/gestao/listagem-notificacoes';
import SolicitacoesTitulares from './views/gestao/listagem-solicitacoes';
import Parametros from './views/gestao/listagem-parametros';
import MeusPacientes from './views/clinico/listagem-meus-pacientes';
import Prontuario from './views/clinico/prontuario';
import PendenciasClinicas from './views/clinico/listagem-pendencias';
import InicioPortal from './views/portal/inicio';
import AgendamentosPortal from './views/portal/listagem-agendamentos';
import DocumentosPortal from './views/portal/listagem-documentos';
import CobrancasPortal from './views/portal/listagem-cobrancas';
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
  ['/admin/listagem-pacientes', A, <Pacientes />],
  ['/admin/pacientes/novo', A, <CadastroPaciente modo='novo' />],
  ['/admin/pacientes/:id', A, <CadastroPaciente modo='ver' />],
  ['/admin/pacientes/:id/editar', A, <CadastroPaciente modo='editar' />],
  ['/admin/listagem-medicos', A, <Medicos />],
  ['/admin/medicos/novo', A, <CadastroMedico modo='novo' />],
  ['/admin/medicos/:id', A, <CadastroMedico modo='ver' />],
  ['/admin/medicos/:id/editar', A, <CadastroMedico modo='editar' />],
  ['/admin/listagem-equipe', A, <Equipe />],
  ['/admin/equipe/novo', A, <CadastroEquipe modo='novo' />],
  ['/admin/equipe/:id', A, <CadastroEquipe modo='ver' />],
  ['/admin/equipe/:id/editar', A, <CadastroEquipe modo='editar' />],
  ['/admin/listagem-convenios', A, <Convenios />],
  ['/admin/convenios/novo', A, <CadastroConvenio modo='novo' />],
  ['/admin/convenios/:id', A, <CadastroConvenio modo='ver' />],
  ['/admin/convenios/:id/editar', A, <CadastroConvenio modo='editar' />],
  ['/admin/listagem-procedimentos', A, <Procedimentos />],
  ['/admin/procedimentos/novo', A, <CadastroProcedimento modo='novo' />],
  ['/admin/procedimentos/:id', A, <CadastroProcedimento modo='ver' />],
  ['/admin/procedimentos/:id/editar', A, <CadastroProcedimento modo='editar' />],
  ['/admin/agenda', A, <EmBreve codigo='A-07' titulo='Agenda da clínica' />],
  ['/admin/cadastro-agendamentos', A, <EmBreve codigo='A-08a' titulo='Novo agendamento' />],
  ['/admin/listagem-fila-do-dia', A, <FilaDoDia />],
  ['/admin/grade', A, <EmBreve codigo='A-10' titulo='Grade de horários' />],
  ['/admin/listagem-bloqueios', A, <Bloqueios />],
  ['/admin/painel-financeiro', A, <EmBreve codigo='A-12' titulo='Painel financeiro' />],
  ['/admin/listagem-contas-receber', A, <ContasReceber />],
  ['/admin/listagem-contas-pagar', A, <ContasPagar />],
  ['/admin/listagem-conciliacao', A, <Conciliacao />],
  ['/admin/listagem-caixas', A, <Caixas />],
  ['/admin/listagem-estornos', A, <Estornos />],
  ['/admin/listagem-orcamentos', A, <OrcamentosAprovacao />],
  ['/admin/listagem-recibos-nfse', A, <DocumentosFiscais />],
  ['/admin/listagem-contratos', A, <Contratos />],
  ['/admin/listagem-elegibilidades', A, <Elegibilidade />],
  ['/admin/listagem-guias', A, <Guias />],
  ['/admin/listagem-lotes', A, <Lotes />],
  ['/admin/listagem-glosas', A, <Glosas />],
  ['/admin/listagem-recursos-glosa', A, <RecursosGlosa />],
  ['/admin/listagem-produtos', A, <Produtos />],
  ['/admin/listagem-movimentacoes', A, <Movimentacoes />],
  ['/admin/listagem-alertas', A, <Alertas />],
  ['/admin/dashboard', A, <EmBreve codigo='A-29' titulo='Dashboard gerencial' />],
  ['/admin/listagem-relatorios', A, <Relatorios />],
  ['/admin/listagem-log-auditoria', A, <LogAuditoria />],
  ['/admin/listagem-notificacoes', A, <Notificacoes />],
  ['/admin/listagem-solicitacoes', A, <SolicitacoesTitulares />],
  ['/admin/listagem-parametros', A, <Parametros />],
  // Médico
  ['/medico/listagem-atendimentos', M, <AtendimentosDoDia />],
  ['/medico/listagem-pacientes', M, <MeusPacientes />],
  ['/medico/prontuario/:id', M, <Prontuario />],
  ['/medico/prontuario/:id/:aba', M, <Prontuario />],
  ['/medico/agenda', M, <EmBreve codigo='M-03' titulo='Minha agenda' />],
  ['/medico/listagem-orcamentos', M, <OrcamentosMedico />],
  ['/medico/listagem-produtos', M, <Produtos />],
  ['/medico/listagem-pendencias', M, <PendenciasClinicas />],
  // Secretária
  ['/secretaria/listagem-pacientes', S, <Pacientes />],
  ['/secretaria/pacientes/novo', S, <CadastroPaciente modo='novo' />],
  ['/secretaria/pacientes/:id', S, <CadastroPaciente modo='ver' />],
  ['/secretaria/pacientes/:id/editar', S, <CadastroPaciente modo='editar' />],
  ['/secretaria/pacientes/:id/observacoes', S, <ObservacoesGerais />],
  ['/secretaria/pacientes/:id/anexos', S, <AnexosRecepcao />],
  ['/secretaria/agenda', S, <EmBreve codigo='S-02' titulo='Agenda da clínica' />],
  ['/secretaria/cadastro-agendamentos', S, <EmBreve codigo='S-03a' titulo='Novo agendamento' />],
  ['/secretaria/listagem-consultas', S, <ReagendarOuCancelar />],
  ['/secretaria/listagem-bloqueios', S, <Bloqueios />],
  ['/secretaria/listagem-fila-do-dia', S, <FilaDoDia />],
  ['/secretaria/checkout', S, <EmBreve codigo='S-07a' titulo='Checkout' />],
  ['/secretaria/listagem-cobrancas', S, <CobrancasDoDia />],
  ['/secretaria/caixa', S, <EmBreve codigo='S-09' titulo='Meu caixa' />],
  ['/secretaria/listagem-orcamentos', S, <OrcamentosValores />],
  ['/secretaria/listagem-recibos', S, <DocumentosFiscais />],
  ['/secretaria/listagem-estornos', S, <Estornos />],
  ['/secretaria/listagem-elegibilidades', S, <Elegibilidade />],
  ['/secretaria/listagem-guias', S, <Guias />],
  ['/secretaria/listagem-lotes', S, <Lotes />],
  ['/secretaria/listagem-glosas', S, <Glosas />],
  ['/secretaria/listagem-produtos', S, <Produtos />],
  ['/secretaria/listagem-movimentacoes', S, <Movimentacoes />],
  ['/secretaria/listagem-alertas', S, <Alertas />],
  // Paciente e Responsável Legal
  ['/portal/inicio', PORTAL, <InicioPortal />],
  ['/portal/cadastro-agendamentos', PORTAL, <EmBreve codigo='P-02 e R-02' titulo='Agendar consulta' />],
  ['/portal/listagem-agendamentos', PORTAL, <AgendamentosPortal />],
  ['/portal/listagem-documentos', PORTAL, <DocumentosPortal />],
  ['/portal/listagem-cobrancas', PORTAL, <CobrancasPortal />],
  ['/portal/orcamentos/:id', PORTAL, <OrcamentoPortal />],
  ['/portal/dados', PORTAL, <DadosPortal />],
  ['/portal/representado', ['RESPONSAVEL_LEGAL'], <SelecionarRepresentado />],
  // Todos
  ['/perfil', TODOS, <EmBreve codigo='G-10' titulo='Meu perfil' />],
];

// Rotas antigas: as de antes do redesenho e as anteriores ao padrão
// listagem-<entidade> e cadastro-<entidade>.
const ANTIGAS = {
  '/listagem-cadastro': '/secretaria/listagem-pacientes',
  '/listagem-filadia': '/secretaria/listagem-fila-do-dia',
  '/listagem-agenda': '/secretaria/agenda',
  '/listagem-financeiro': '/secretaria/listagem-cobrancas',
  '/listagem-estoque': '/secretaria/listagem-produtos',
  '/admin/pacientes': '/admin/listagem-pacientes',
  '/admin/medicos': '/admin/listagem-medicos',
  '/admin/equipe': '/admin/listagem-equipe',
  '/admin/convenios': '/admin/listagem-convenios',
  '/admin/procedimentos': '/admin/listagem-procedimentos',
  '/admin/agendamento': '/admin/cadastro-agendamentos',
  '/admin/fila': '/admin/listagem-fila-do-dia',
  '/admin/bloqueios': '/admin/listagem-bloqueios',
  '/admin/contas-receber': '/admin/listagem-contas-receber',
  '/admin/contas-pagar': '/admin/listagem-contas-pagar',
  '/admin/conciliacao': '/admin/listagem-conciliacao',
  '/admin/caixas': '/admin/listagem-caixas',
  '/admin/estornos': '/admin/listagem-estornos',
  '/admin/orcamentos': '/admin/listagem-orcamentos',
  '/admin/recibos-nfse': '/admin/listagem-recibos-nfse',
  '/admin/contratos': '/admin/listagem-contratos',
  '/admin/elegibilidade': '/admin/listagem-elegibilidades',
  '/admin/guias': '/admin/listagem-guias',
  '/admin/lotes': '/admin/listagem-lotes',
  '/admin/glosas': '/admin/listagem-glosas',
  '/admin/recursos': '/admin/listagem-recursos-glosa',
  '/admin/produtos': '/admin/listagem-produtos',
  '/admin/movimentacoes': '/admin/listagem-movimentacoes',
  '/admin/alertas': '/admin/listagem-alertas',
  '/admin/relatorios': '/admin/listagem-relatorios',
  '/admin/log': '/admin/listagem-log-auditoria',
  '/admin/notificacoes': '/admin/listagem-notificacoes',
  '/admin/solicitacoes': '/admin/listagem-solicitacoes',
  '/admin/parametros': '/admin/listagem-parametros',
  '/medico/atendimentos': '/medico/listagem-atendimentos',
  '/medico/pacientes': '/medico/listagem-pacientes',
  '/medico/orcamentos': '/medico/listagem-orcamentos',
  '/medico/estoque': '/medico/listagem-produtos',
  '/medico/pendencias': '/medico/listagem-pendencias',
  '/secretaria/pacientes': '/secretaria/listagem-pacientes',
  '/secretaria/agendamento': '/secretaria/cadastro-agendamentos',
  '/secretaria/reagendar': '/secretaria/listagem-consultas',
  '/secretaria/bloqueios': '/secretaria/listagem-bloqueios',
  '/secretaria/fila': '/secretaria/listagem-fila-do-dia',
  '/secretaria/cobrancas': '/secretaria/listagem-cobrancas',
  '/secretaria/orcamentos': '/secretaria/listagem-orcamentos',
  '/secretaria/recibos': '/secretaria/listagem-recibos',
  '/secretaria/estornos': '/secretaria/listagem-estornos',
  '/secretaria/elegibilidade': '/secretaria/listagem-elegibilidades',
  '/secretaria/guias': '/secretaria/listagem-guias',
  '/secretaria/lotes': '/secretaria/listagem-lotes',
  '/secretaria/glosas': '/secretaria/listagem-glosas',
  '/secretaria/produtos': '/secretaria/listagem-produtos',
  '/secretaria/movimentacoes': '/secretaria/listagem-movimentacoes',
  '/secretaria/alertas': '/secretaria/listagem-alertas',
  '/portal/agendar': '/portal/cadastro-agendamentos',
  '/portal/agendamentos': '/portal/listagem-agendamentos',
  '/portal/documentos': '/portal/listagem-documentos',
  '/portal/cobrancas': '/portal/listagem-cobrancas',
};

// Rotas antigas com parâmetro.
const ANTIGAS_COM_PARAMETRO = [
  ['/medico/pacientes/:id', (p) => `/medico/prontuario/${p.id}`],
  ['/medico/pacientes/:id/:aba', (p) => `/medico/prontuario/${p.id}/${p.aba}`],
];

function Redirecionar({ para }) {
  return <Navigate to={para(useParams())} replace />;
}

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
        {/* A chave por caminho remonta a tela ao trocar de rota (de /novo para
            /:id, de /:id/editar para /:id), com estado e dados novos. */}
        {TELAS.map(([caminho, papeis, elemento]) => (
          <Route
            key={caminho}
            path={caminho}
            element={
              <Permitido key={caminho} papeis={papeis}>
                {elemento}
              </Permitido>
            }
          />
        ))}
        {Object.entries(ANTIGAS).map(([de, para]) => (
          <Route key={de} path={de} element={<Navigate to={para} replace />} />
        ))}
        {ANTIGAS_COM_PARAMETRO.map(([de, para]) => (
          <Route key={de} path={de} element={<Redirecionar para={para} />} />
        ))}
        <Route path='*' element={<RegistroIndisponivel />} />
      </Route>
    </Routes>
  );
}

export default Rotas;
