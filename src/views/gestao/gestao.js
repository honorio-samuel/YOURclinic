import React from 'react';
import { Link } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoSelect, Filtros } from '../../components/campos';
import { emBreve, salvarComAviso, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro } from '../../components/toastr';
import { DATA_DE_HOJE } from '../../config/axios';
import { listar, pessoasPorId, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { data, diaMes, diaMesHora, diasEntre, nomeMedico } from '../../utils/formatos';
import {
  CANAL,
  EVENTO_NOTIFICACAO,
  PAPEIS,
  SITUACAO_NOTIFICACAO,
  SITUACAO_SOLICITACAO,
  STATUS_CONSULTA,
  TIPO_SOLICITACAO,
  rotuloDe,
} from '../../utils/rotulos';

const PRAZO_TITULAR = 15; // dias (proposta PR-11, X53)

// A-01 · Início › Painel do dia. Contagens sem nome de paciente e as pendências
// que esperam o Administrador; cada uma leva à tela onde é tratada.
export function PainelDoDia() {
  const carregar = async () => {
    const [consultas, estornos, caixas, orcamentos, recursos, solicitacoes, excecoes, contratos] = await Promise.all([
      listar('consultas', { dataHora_gte: `${DATA_DE_HOJE}T00:00:00`, dataHora_lte: `${DATA_DE_HOJE}T23:59:59` }),
      listar('estornos', { situacao: 'A_APROVAR' }),
      listar('caixas', { situacao: 'A_APROVAR' }),
      listar('orcamentos', { etapa: 'APROVACAO' }),
      listar('recursosGlosa', { situacao: 'MANTIDO' }),
      listar('solicitacoesTitular', { situacao: ['ABERTA', 'EM_ANALISE'] }),
      listar('acessosExcecao').then((lista) => lista.filter((e) => !e.revisado)),
      listar('contratosOperadora', { situacao: ['ATIVO', 'VIGENTE'] }),
    ]);
    const porStatus = {};
    for (const c of consultas) porStatus[c.status] = (porStatus[c.status] ?? 0) + 1;
    const menorPrazo = solicitacoes.length
      ? Math.min(...solicitacoes.map((s) => PRAZO_TITULAR - diasEntre(s.dataSolicitacao, DATA_DE_HOJE)))
      : null;
    const vencendo = contratos.filter((c) => diasEntre(DATA_DE_HOJE, c.vigenciaFim) <= 90);
    const pendencias = [
      { id: 1, pendencia: 'Estornos a aprovar', itens: estornos.length, prazo: '—', rota: '/admin/estornos' },
      { id: 2, pendencia: 'Divergências de caixa', itens: caixas.length, prazo: '—', rota: '/admin/caixas' },
      { id: 3, pendencia: 'Orçamentos a aprovar', itens: orcamentos.length, prazo: '—', rota: '/admin/orcamentos' },
      { id: 4, pendencia: 'Recursos de glosa mantidos', itens: recursos.length, prazo: '—', rota: '/admin/recursos' },
      { id: 5, pendencia: 'Solicitações de titulares', itens: solicitacoes.length, prazo: menorPrazo === null ? '—' : `${menorPrazo} dias`, rota: '/admin/solicitacoes' },
      { id: 6, pendencia: 'Acessos de exceção a revisar', itens: excecoes.length, prazo: '—', rota: '/admin/log' },
      { id: 7, pendencia: 'Contratos perto do fim da vigência', itens: vencendo.length, prazo: vencendo.length ? data(vencendo[0].vigenciaFim) : '—', rota: '/admin/contratos' },
    ];
    return { total: consultas.length, porStatus, pendencias };
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);

  return (
    <Pagina titulo='Painel do dia'>
      <div className='row g-3'>
        {['AGENDADO', 'NA_RECEPCAO', 'EM_ATENDIMENTO', 'FINALIZADO'].map((s) => (
          <div key={s} className='col-6 col-md-3'>
            <div className='card h-100'>
              <div className='card-body'>
                <div className='display-6 fw-light'>{carregando ? '…' : dados?.porStatus[s] ?? 0}</div>
                <div className='small text-body-secondary'>{STATUS_CONSULTA[s].rotulo} hoje</div>
              </div>
            </div>
          </div>
        ))}
      </div>
      <Listagem
        titulo='Pendências'
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados?.pendencias ?? []}
        colunas={[
          { titulo: 'Pendência', render: (p) => p.pendencia },
          { titulo: 'Itens', classe: 'text-end', render: (p) => p.itens },
          { titulo: 'Prazo', render: (p) => p.prazo },
          { titulo: '', render: (p) => <Link to={p.rota}>Abrir</Link> },
        ]}
      />
      <p className='small text-body-secondary mb-0'>
        {dados ? `${dados.total} consultas marcadas para hoje.` : ''} A fila completa está em{' '}
        <Link to='/admin/fila'>Fila do dia</Link>.
      </p>
    </Pagina>
  );
}

// A-30 · Relatórios. Recortes com poucos registros não são exibidos (RF42).
export function Relatorios() {
  const { dados, carregando, erro, recarregar } = useCarregar(() => listar('relatorios', { _sort: 'geradoEm', _order: 'desc' }));
  const [dimensao, setDimensao] = React.useState('Atendimentos por convênio');
  return (
    <Pagina titulo='Relatórios'>
      <Filtros>
        <CampoSelect
          id='relDimensao'
          rotulo='Dimensão'
          valor={dimensao}
          aoMudar={setDimensao}
          opcoes={['Atendimentos por convênio', 'Faturamento por médico', 'Glosas por motivo', 'Estoque por item'].map((d) => [d, d])}
        />
        <div className='filtro'>
          <label htmlFor='relDe' className='form-label'>
            De
          </label>
          <input id='relDe' type='date' className='form-control' defaultValue='2026-09-01' />
        </div>
        <div className='filtro'>
          <label htmlFor='relAte' className='form-label'>
            Até
          </label>
          <input id='relAte' type='date' className='form-control' defaultValue={DATA_DE_HOJE} />
        </div>
        <button type='button' className='btn btn-primary' onClick={() => emBreve('A geração de relatório')}>
          Gerar relatório
        </button>
      </Filtros>
      <div className='alert alert-info mb-0' role='status'>
        Recortes com menos de 5 registros não aparecem no relatório, para não identificar ninguém.
      </div>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados ?? []}
        vazio='Nenhum relatório gerado.'
        colunas={[
          { titulo: 'Relatório', render: (r) => r.nome },
          { titulo: 'Período', render: (r) => `${diaMes(r.periodoInicio)} a ${diaMes(r.periodoFim)}` },
          { titulo: 'Gerado em', render: (r) => data(r.geradoEm) },
          { titulo: 'Situação', render: (r) => <PilulaStatus rotulo={r.situacao === 'PRONTO' ? 'Pronto' : 'Gerando'} tom={r.situacao === 'PRONTO' ? 'sucesso' : 'info'} /> },
          {
            titulo: 'Ações',
            render: (r) =>
              r.situacao === 'PRONTO' ? <AcoesLinha acoes={[{ tipo: 'baixar', alvo: r.nome, aoClicar: () => emBreve('O download do relatório') }]} /> : null,
          },
        ]}
      />
    </Pagina>
  );
}

const ACAO_LOG = {
  LOGIN: 'Entrada no sistema',
  LOGOUT: 'Saída do sistema',
  LER: 'Leitura',
  CRIAR: 'Criação',
  EDITAR: 'Alteração',
  EXCLUIR: 'Exclusão',
  ALTERAR_SENHA: 'Troca de senha',
  SELECIONAR_REPRESENTADO: 'Escolha de representado',
  CONSULTAR: 'Consulta',
  ACESSO_NEGADO: 'Acesso negado',
  ACESSO_EXCECAO: 'Acesso de exceção',
  ACESSO_EXCECAO_ATIPICO: 'Acesso de exceção · atípico',
  ORCAMENTO_EXCECAO: 'Orçamento · exceção',
  EXPORTAR: 'Exportação',
  RETIFICAR: 'Retificação',
};
const COLECAO = {
  prontuarios: 'Prontuário',
  pacientes: 'Paciente',
  consultas: 'Consulta',
  vinculos: 'Vínculo',
  registrosClinicos: 'Registro clínico',
  orcamentos: 'Orçamento',
  usuarios: 'Usuário',
  relatorios: 'Relatório',
  anexos: 'Anexo',
};
const alvoLegivel = (alvo) => {
  if (!alvo) return '—';
  const [colecao, id] = alvo.split(/[:/]/);
  return `${COLECAO[colecao] ?? colecao}${id ? ` ${id}` : ''}`;
};

// A-31 · Log de auditoria (somente leitura) e acessos de exceção em curso, que o
// Administrador pode revogar antes do fim da janela.
export function LogAuditoria() {
  const carregar = async () => {
    const [logs, usuarios, excecoes] = await Promise.all([listar('logsAuditoria', { _sort: 'dataHora', _order: 'desc' }), listar('usuarios'), listar('acessosExcecao')]);
    const usuario = porId(usuarios);
    const emCurso = excecoes.filter((e) => e.expiraEm && e.expiraEm > `${DATA_DE_HOJE}T00:00:00` && !e.revogado);
    const pessoas = await pessoasPorId([...usuarios.map((u) => u.idPessoa), ...emCurso.flatMap((e) => [e.idMedico, e.idPaciente])]);
    return {
      logs: logs.map((l) => ({ ...l, usuario: pessoas[usuario[l.idUsuario]?.idPessoa]?.nome ?? '—' })),
      emCurso: emCurso.map((e) => ({ ...e, medico: nomeMedico(pessoas[e.idMedico]), paciente: pessoas[e.idPaciente]?.nome ?? '—' })),
    };
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [modal, confirmar] = useConfirmacao();
  const [acao, setAcao] = React.useState('');
  const [papel, setPapel] = React.useState('');

  const revogar = async (e) => {
    const ok = await confirmar({ titulo: `Revogar o acesso de exceção de ${e.medico}?`, texto: `O acesso ao prontuário de ${e.paciente} termina agora. A revogação fica no log.`, rotuloConfirmar: 'Revogar', perigo: true });
    // Revogar é encurtar o prazo: o acesso termina agora.
    if (ok && (await salvarComAviso('acessosExcecao', e.id, { expiraEm: `${DATA_DE_HOJE}T00:00:00`, revisado: true }, 'Acesso de exceção revogado.'))) recarregar();
  };

  const logs = (dados?.logs ?? []).filter((l) => (!acao || l.acao === acao) && (!papel || l.papel === papel));
  return (
    <Pagina titulo='Log de auditoria'>
      <Filtros>
        <CampoSelect id='logPapel' rotulo='Papel' valor={papel} aoMudar={setPapel} opcoes={[['', 'Todos'], ...Object.entries(PAPEIS)]} />
        <CampoSelect id='logAcao' rotulo='Ação' valor={acao} aoMudar={setAcao} opcoes={[['', 'Todas'], ...Object.entries(ACAO_LOG)]} />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={logs}
        vazio='Nenhum registro nesta seleção.'
        colunas={[
          { titulo: 'Data e hora', render: (l) => diaMesHora(l.dataHora) },
          { titulo: 'Usuário', render: (l) => l.usuario },
          { titulo: 'Papel', render: (l) => PAPEIS[l.papel] ?? l.papel },
          { titulo: 'Ação', render: (l) => ACAO_LOG[l.acao] ?? l.acao },
          { titulo: 'Registro', render: (l) => alvoLegivel(l.registroAlvo) },
        ]}
      />
      <Listagem
        titulo='Acessos de exceção em curso'
        carregando={carregando}
        linhas={dados?.emCurso ?? []}
        vazio='Nenhum acesso de exceção em curso.'
        colunas={[
          { titulo: 'Médico', render: (e) => e.medico },
          { titulo: 'Paciente', render: (e) => e.paciente },
          { titulo: 'Expira em', render: (e) => diaMesHora(e.expiraEm) },
          {
            titulo: '',
            render: (e) => (
              <button type='button' className='btn btn-sm btn-outline-danger' onClick={() => revogar(e)}>
                Revogar
              </button>
            ),
          },
        ]}
      />
      {modal}
    </Pagina>
  );
}

// A-32 · Notificações. Reenvio manual das que falharam (RF59).
export function Notificacoes() {
  const carregar = async () => {
    const notificacoes = await listar('notificacoes', { _sort: 'dataEnvio', _order: 'desc' });
    const pessoas = await pessoasPorId(notificacoes.map((n) => n.idPessoa));
    return notificacoes.map((n) => ({ ...n, destinatario: pessoas[n.idPessoa]?.nome ?? '—' }));
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [evento, setEvento] = React.useState('');
  const [canal, setCanal] = React.useState('');
  const [situacao, setSituacao] = React.useState('');

  const reenviar = async (n) => {
    if (await salvarComAviso('notificacoes', n.id, { situacao: 'ENVIADA', tentativas: (n.tentativas ?? 0) + 1 }, `Notificação reenviada para ${n.destinatario}.`)) recarregar();
  };
  const linhas = (dados ?? []).filter((n) => (!evento || n.evento === evento) && (!canal || n.canal === canal) && (!situacao || n.situacao === situacao));

  return (
    <Pagina
      titulo='Notificações'
      acoes={
        <button type='button' className='btn btn-outline-primary' onClick={() => emBreve('A edição de modelos e canais')}>
          Modelos e canais
        </button>
      }
    >
      <Filtros>
        <CampoSelect id='notEvento' rotulo='Evento' valor={evento} aoMudar={setEvento} opcoes={[['', 'Todos'], ...Object.entries(EVENTO_NOTIFICACAO)]} />
        <CampoSelect id='notCanal' rotulo='Canal' valor={canal} aoMudar={setCanal} opcoes={[['', 'Todos'], ['SMS', 'Mensagem de texto'], ['EMAIL', 'E-mail']]} />
        <CampoSelect
          id='notSituacao'
          rotulo='Situação'
          valor={situacao}
          aoMudar={setSituacao}
          opcoes={[['', 'Todas'], ...Object.entries(SITUACAO_NOTIFICACAO).map(([k, v]) => [k, v.rotulo])]}
        />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhuma notificação nesta seleção.'
        colunas={[
          { titulo: 'Evento', render: (n) => EVENTO_NOTIFICACAO[n.evento] ?? n.evento },
          { titulo: 'Canal', render: (n) => CANAL[n.canal] ?? n.canal },
          { titulo: 'Destinatário', render: (n) => n.destinatario },
          { titulo: 'Enviado em', render: (n) => diaMesHora(n.dataEnvio) },
          {
            titulo: 'Situação',
            render: (n) => (
              <PilulaStatus
                {...rotuloDe(SITUACAO_NOTIFICACAO, n.situacao)}
                transicoes={['FALHOU', 'FALHA'].includes(n.situacao) ? [{ rotulo: 'Reenviar', aoEscolher: () => reenviar(n) }] : null}
              />
            ),
          },
          { titulo: 'Ações', render: (n) => <AcoesLinha acoes={[{ tipo: 'ver', alvo: `notificação para ${n.destinatario}`, aoClicar: () => emBreve('O detalhe da notificação') }]} /> },
        ]}
      />
    </Pagina>
  );
}

// A-33 · Solicitações dos titulares (LGPD). Prazo de 15 dias para a declaração
// completa (LGPD, art. 19, II), com alerta antes do vencimento.
export function SolicitacoesTitulares() {
  const carregar = async () => {
    const solicitacoes = await listar('solicitacoesTitular', { _sort: 'dataSolicitacao', _order: 'desc' });
    const pessoas = await pessoasPorId(solicitacoes.map((s) => s.idPaciente));
    return solicitacoes.map((s) => ({ ...s, titular: pessoas[s.idPaciente]?.nome ?? '—', restante: PRAZO_TITULAR - diasEntre(s.dataSolicitacao, DATA_DE_HOJE) }));
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [modal, confirmar] = useConfirmacao();
  const [direito, setDireito] = React.useState('');
  const [situacao, setSituacao] = React.useState('EM_ABERTO');

  const mudar = async (s, nova, extra = {}) => {
    if (await salvarComAviso('solicitacoesTitular', s.id, { situacao: nova, ...extra }, 'Solicitação atualizada.')) recarregar();
  };
  const recusar = async (s) => {
    const motivo = await confirmar({ titulo: 'Recusar a solicitação?', texto: 'O titular recebe o motivo da recusa.', campo: 'Motivo', rotuloConfirmar: 'Recusar', perigo: true });
    if (motivo) mudar(s, 'RECUSADA', { motivoRecusa: motivo, dataResposta: DATA_DE_HOJE });
  };

  const linhas = (dados ?? []).filter(
    (s) => (!direito || s.tipo === direito) && (situacao === 'EM_ABERTO' ? ['ABERTA', 'EM_ANALISE'].includes(s.situacao) : !situacao || s.situacao === situacao)
  );
  const aVencer = (dados ?? []).filter((s) => ['ABERTA', 'EM_ANALISE'].includes(s.situacao) && s.restante <= 3);

  return (
    <Pagina titulo='Solicitações dos titulares'>
      <Filtros>
        <CampoSelect id='solDireito' rotulo='Direito' valor={direito} aoMudar={setDireito} opcoes={[['', 'Todos'], ...Object.entries(TIPO_SOLICITACAO)]} />
        <CampoSelect
          id='solSituacao'
          rotulo='Situação'
          valor={situacao}
          aoMudar={setSituacao}
          opcoes={[['EM_ABERTO', 'Em aberto'], ['', 'Todas'], ...Object.entries(SITUACAO_SOLICITACAO).map(([k, v]) => [k, v.rotulo])]}
        />
      </Filtros>
      {aVencer.length > 0 && (
        <div className='alert alert-warning mb-0' role='status'>
          {aVencer.length === 1 ? '1 solicitação vence' : `${aVencer.length} solicitações vencem`} em até 3 dias.
        </div>
      )}
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhuma solicitação nesta seleção.'
        colunas={[
          { titulo: 'Titular', render: (s) => s.titular },
          { titulo: 'Direito', render: (s) => TIPO_SOLICITACAO[s.tipo] ?? s.tipo },
          { titulo: 'Aberta em', render: (s) => data(s.dataSolicitacao) },
          { titulo: 'Prazo', render: (s) => (['ABERTA', 'EM_ANALISE'].includes(s.situacao) ? `${s.restante} dias` : '—') },
          {
            titulo: 'Situação',
            render: (s) => (
              <PilulaStatus
                {...rotuloDe(SITUACAO_SOLICITACAO, s.situacao)}
                transicoes={
                  s.situacao === 'ABERTA'
                    ? [{ rotulo: 'Iniciar análise', aoEscolher: () => mudar(s, 'EM_ANALISE') }]
                    : s.situacao === 'EM_ANALISE'
                      ? [
                          { rotulo: 'Concluir', aoEscolher: () => mudar(s, 'RESPONDIDA', { dataResposta: DATA_DE_HOJE }) },
                          { rotulo: 'Recusar', aoEscolher: () => recusar(s) },
                        ]
                      : null
                }
              />
            ),
          },
          {
            titulo: 'Ações',
            render: (s) => (
              <AcoesLinha
                acoes={[
                  { tipo: 'ver', alvo: `solicitação de ${s.titular}`, aoClicar: () => emBreve('O detalhe da solicitação') },
                  { tipo: 'editar', alvo: `solicitação de ${s.titular}`, aoClicar: () => emBreve('A resposta ao titular') },
                ]}
              />
            ),
          },
        ]}
      />
      {modal}
    </Pagina>
  );
}

const GRUPO = {
  AUTENTICACAO: 'Autenticação e sessão',
  ACESSO_CLINICO: 'Acesso clínico',
  NOTIFICACOES: 'Notificações',
  CONTINUIDADE: 'Continuidade',
  PREMISSAS: 'Premissas de projeto',
};

// A-34 · Parâmetros do sistema. Premissas aparecem só para leitura; o valor
// novo precisa estar dentro da faixa.
export function Parametros() {
  const { dados, carregando, erro, recarregar } = useCarregar(() => listar('parametros', { _sort: 'chave' }));
  const [modal, confirmar] = useConfirmacao();
  const grupos = [...new Set((dados ?? []).map((p) => p.grupo).filter(Boolean))];
  const [escolhido, setGrupo] = React.useState(null);
  const grupo = escolhido ?? grupos[0] ?? '';

  const editar = async (p) => {
    const faixa = p.faixaMinima !== null && p.faixaMaxima !== null ? `Faixa aceita: ${p.faixaMinima} a ${p.faixaMaxima} ${p.unidade}.` : 'Faixa não definida no documento.';
    const texto = await confirmar({ titulo: p.descricao, texto: `Valor atual: ${p.valor} ${p.unidade}. ${faixa}`, campo: `Novo valor (${p.unidade})`, rotuloConfirmar: 'Salvar' });
    if (!texto) return;
    const valor = Number(texto.replace(',', '.'));
    if (Number.isNaN(valor) || (p.faixaMinima !== null && valor < p.faixaMinima) || (p.faixaMaxima !== null && valor > p.faixaMaxima)) {
      mensagemErro(`Valor fora da faixa. ${faixa}`);
      return;
    }
    if (await salvarComAviso('parametros', p.id, { valor }, 'Parâmetro salvo. A alteração fica no log.')) recarregar();
  };

  const linhas = (dados ?? []).filter((p) => !grupo || p.grupo === grupo);
  return (
    <Pagina titulo='Parâmetros do sistema'>
      <Filtros>
        <CampoSelect id='parGrupo' rotulo='Grupo' valor={grupo} aoMudar={setGrupo} opcoes={[...grupos.map((g) => [g, GRUPO[g] ?? g]), ['', 'Todos']]} />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhum parâmetro neste grupo.'
        colunas={[
          { titulo: 'Parâmetro', render: (p) => p.descricao },
          { titulo: 'Valor', render: (p) => `${p.valor} ${p.unidade}` },
          { titulo: 'Sugerido', render: (p) => `${p.valorSugerido ?? p.valor} ${p.unidade}` },
          {
            titulo: 'Faixa',
            render: (p) => (!p.editavel ? 'premissa' : p.faixaMinima !== null && p.faixaMaxima !== null ? `${p.faixaMinima} a ${p.faixaMaxima}` : 'não definida'),
          },
          {
            titulo: '',
            render: (p) =>
              p.editavel ? (
                <button type='button' className='btn btn-sm btn-outline-primary' onClick={() => editar(p)}>
                  Editar
                </button>
              ) : (
                '—'
              ),
          },
        ]}
      />
      {modal}
    </Pagina>
  );
}
