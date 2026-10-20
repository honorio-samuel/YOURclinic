import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { AreaLogada, Permitido } from './components/layout';
import Login from './views/geral/login';
import SelecionarRepresentado from './views/geral/selecionar-representado';
import { EmBreve, RegistroIndisponivel } from './views/geral/avisos';
import Pacientes from './views/cadastro/pacientes';
import { Convenios, Equipe, Medicos, Procedimentos } from './views/cadastro/cadastros-admin';
import { AtendimentosDoDia, Bloqueios, FilaDoDia, ReagendarOuCancelar } from './views/agenda/agenda';
import {
  Caixas,
  CobrancasDoDia,
  Conciliacao,
  ContasPagar,
  ContasReceber,
  DocumentosFiscais,
  Estornos,
} from './views/financeiro/financeiro';
import { OrcamentosAprovacao, OrcamentosMedico, OrcamentosValores } from './views/financeiro/orcamentos';
import { Contratos, Elegibilidade, Glosas, Guias, Lotes, RecursosGlosa } from './views/tiss/tiss';
import { Alertas, Movimentacoes, Produtos } from './views/estoque/estoque';
import {
  LogAuditoria,
  Notificacoes,
  PainelDoDia,
  Parametros,
  Relatorios,
  SolicitacoesTitulares,
} from './views/gestao/gestao';
import { AnexosRecepcao, MeusPacientes, PendenciasClinicas, Prontuario } from './views/clinico/clinico';
import {
  AgendamentosPortal,
  CobrancasPortal,
  DadosPortal,
  DocumentosPortal,
  InicioPortal,
  OrcamentoPortal,
} from './views/portal/portal';
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
