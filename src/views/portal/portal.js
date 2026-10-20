import React from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import { emBreve, salvarComAviso, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { RegistroIndisponivel } from '../geral/avisos';
import { api, DATA_DE_HOJE } from '../../config/axios';
import { buscar, idTitular, listar, pessoasPorId, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { data, diaMes, diaMesHora, diasEntre, moeda, nomeMedico, primeiroNome } from '../../utils/formatos';
import { CANAL, ETAPA_ORCAMENTO, EVENTO_NOTIFICACAO, SITUACAO_TITULO, rotuloDe } from '../../utils/rotulos';

const ANTECEDENCIA_CANCELAMENTO = 24; // horas (X08)

// Titular das telas do portal e se quem vê é o próprio titular.
function useTitular() {
  const { sessao } = useSessao();
  return { id: idTitular(sessao), ehResponsavel: sessao.usuario.papel === 'RESPONSAVEL_LEGAL', sessao };
}

// Consultas do titular, com médico e tipo de atendimento.
async function carregarConsultasDoTitular(idPaciente) {
  const [consultas, procedimentos] = await Promise.all([listar('consultas', { idPaciente, _sort: 'dataHora' }), listar('procedimentos')]);
  const medicos = await pessoasPorId(consultas.map((c) => c.idMedico));
  const proc = porId(procedimentos);
  const tipo = (p) => {
    if (!p) return 'Consulta';
    if (/retorno/i.test(p.nome)) return 'Retorno';
    return p.tipo === 'CONSULTA' ? 'Consulta' : p.tipo === 'EXAME' ? 'Exame' : 'Procedimento';
  };
  return consultas.map((c) => ({ ...c, medico: nomeMedico(medicos[c.idMedico]), tipo: tipo(proc[c.idProcedimento]) }));
}

// Cobranças do titular: as das consultas e as dos orçamentos dele.
async function carregarCobrancasDoTitular(idPaciente) {
  const [consultas, orcamentos] = await Promise.all([listar('consultas', { idPaciente }), listar('orcamentos', { idPaciente })]);
  const ids = consultas.map((c) => c.id);
  const idsOrc = orcamentos.map((o) => o.id);
  const [porConsulta, porOrcamento] = await Promise.all([
    ids.length ? listar('cobrancas', { idConsulta: ids }) : [],
    idsOrc.length ? listar('cobrancas', { idOrcamento: idsOrc }) : [],
  ]);
  const cobrancas = [...new Map([...porConsulta, ...porOrcamento].map((c) => [c.id, c])).values()];
  // Títulos e documentos completam a linha; se a API não os entregar ao titular,
  // a cobrança aparece mesmo assim.
  const titulos = cobrancas.length ? await listar('titulosReceber', { idCobranca: cobrancas.map((c) => c.id) }).catch(() => []) : [];
  const documentos = await listar('documentosFiscais').catch(() => []);
  const consulta = porId(consultas);
  return cobrancas
    .map((c) => {
      const titulo = titulos.find((t) => t.idCobranca === c.id);
      const docs = documentos.filter((d) => titulo && d.idTituloReceber === titulo.id && d.situacao === 'EMITIDO');
      const quando = consulta[c.idConsulta]?.dataHora ?? c.dataEmissao;
      return {
        ...c,
        descricao: `${titulo?.origem === 'COPARTICIPACAO' ? 'Coparticipação' : 'Consulta'} · ${diaMes(quando)}`,
        vencimento: titulo?.vencimento ?? c.dataEmissao,
        // Sem o título, o recibo da cobrança paga ainda pode ser pedido.
        recibo: docs.some((d) => d.tipo === 'RECIBO') || (!titulo && c.situacao === 'PAGA'),
        nfse: docs.some((d) => d.tipo === 'NFSE'),
      };
    })
    .sort((a, b) => b.vencimento.localeCompare(a.vencimento));
}

function ExigeRepresentado({ children }) {
  const { id, ehResponsavel } = useTitular();
  if (ehResponsavel && !id) return <Navigate to='/portal/representado' replace />;
  return children;
}

// P-01 e R-01 · Início: consulta de hoje, próximas consultas e pendências.
export function InicioPortal() {
  const { id, ehResponsavel, sessao } = useTitular();
  const navigate = useNavigate();
  const { dados, carregando, erro, recarregar } = useCarregar(async () => {
    if (!id) return null;
    const [consultas, orcamentos, cobrancas] = await Promise.all([carregarConsultasDoTitular(id), listar('orcamentos', { idPaciente: id, etapa: 'ACEITE' }), carregarCobrancasDoTitular(id)]);
    const hoje = consultas.find((c) => c.dataHora.startsWith(DATA_DE_HOJE) && !['CANCELADO'].includes(c.status));
    const proximas = consultas.filter((c) => c.status === 'AGENDADO' && c.dataHora.slice(0, 10) > DATA_DE_HOJE).slice(0, 3);
    const pendencias = [
      ...orcamentos.map((o) => ({ id: `o${o.id}`, pendencia: 'Orçamento aguardando aceite', detalhe: `válido até ${diaMes(o.validade)}`, acao: 'Abrir', rota: `/portal/orcamentos/${o.id}` })),
      ...cobrancas.filter((c) => c.situacao === 'ABERTA').map((c) => ({ id: `c${c.id}`, pendencia: 'Cobrança em aberto', detalhe: moeda(c.valorTotal), acao: 'Pagar', rota: '/portal/cobrancas' })),
    ];
    return { hoje, proximas, pendencias };
  }, [id]);

  return (
    <ExigeRepresentado>
      <Pagina titulo={ehResponsavel ? 'Início' : `Olá, ${primeiroNome(sessao.usuario.nome)}`}>
        {dados?.hoje && (
          <div className='card'>
            <div className='card-body d-flex flex-wrap align-items-center gap-3'>
              <h2 className='h5 mb-0 w-100'>{ehResponsavel ? 'Consulta de hoje' : 'Minha consulta de hoje'}</h2>
              <span>
                {diaMesHora(dados.hoje.dataHora).split(' · ')[1]} · {dados.hoje.medico}
              </span>
              <PilulaStatus estado={dados.hoje.status} />
            </div>
          </div>
        )}
        <Listagem
          titulo='Próximas consultas'
          carregando={carregando}
          erro={erro}
          aoTentarDeNovo={recarregar}
          linhas={dados?.proximas ?? []}
          vazio='Nenhuma consulta marcada.'
          colunas={[
            { titulo: 'Data e hora', render: (c) => diaMesHora(c.dataHora) },
            { titulo: 'Médico', render: (c) => c.medico },
            { titulo: 'Tipo', render: (c) => c.tipo },
            { titulo: '', render: () => <Link to='/portal/agendamentos'>Ver</Link> },
          ]}
        />
        <Listagem
          titulo='Pendências'
          carregando={carregando}
          linhas={dados?.pendencias ?? []}
          vazio='Nada pendente.'
          colunas={[
            { titulo: 'Pendência', render: (p) => p.pendencia },
            { titulo: 'Detalhe', render: (p) => p.detalhe },
            {
              titulo: '',
              render: (p) => (
                <button type='button' className='btn btn-link btn-sm p-0' onClick={() => navigate(p.rota)}>
                  {p.acao}
                </button>
              ),
            },
          ]}
        />
      </Pagina>
    </ExigeRepresentado>
  );
}

// P-03 e R-03 · Agendamentos. O titular cancela até X08 horas antes; depois
// disso, só pela recepção. Remarcar é cancelar e agendar de novo.
export function AgendamentosPortal() {
  const { id, ehResponsavel } = useTitular();
  const navigate = useNavigate();
  const { dados, carregando, erro, recarregar } = useCarregar(async () => (id ? (await carregarConsultasDoTitular(id)).reverse() : []), [id]);
  const [modal, confirmar] = useConfirmacao();

  const podeCancelar = (c) => c.status === 'AGENDADO' && diasEntre(DATA_DE_HOJE, c.dataHora) * 24 >= ANTECEDENCIA_CANCELAMENTO;
  const cancelar = async (c) => {
    const ok = await confirmar({ titulo: 'Cancelar esta consulta?', texto: `${diaMesHora(c.dataHora)} com ${c.medico}. O horário fica livre para outra pessoa.`, rotuloConfirmar: 'Cancelar consulta', perigo: true });
    if (ok && (await salvarComAviso('consultas', c.id, { status: 'CANCELADO', motivoCancelamento: 'Cancelado pelo titular pelo portal' }, 'Consulta cancelada.'))) recarregar();
  };

  return (
    <ExigeRepresentado>
      <Pagina
        titulo={ehResponsavel ? 'Agendamentos' : 'Meus agendamentos'}
        acoes={
          <button type='button' className='btn btn-primary' onClick={() => navigate('/portal/agendar')}>
            Agendar consulta
          </button>
        }
      >
        <Listagem
          carregando={carregando}
          erro={erro}
          aoTentarDeNovo={recarregar}
          linhas={dados ?? []}
          vazio='Nenhum agendamento.'
          legenda={`O cancelamento pelo portal vale até ${ANTECEDENCIA_CANCELAMENTO} horas antes da consulta. Para remarcar, cancele e agende de novo.`}
          colunas={[
            { titulo: 'Data e hora', render: (c) => diaMesHora(c.dataHora) },
            { titulo: 'Médico', render: (c) => c.medico },
            { titulo: 'Tipo', render: (c) => c.tipo },
            { titulo: 'Situação', render: (c) => <PilulaStatus estado={c.status} /> },
            {
              titulo: '',
              render: (c) =>
                podeCancelar(c) ? (
                  <button type='button' className='btn btn-link btn-sm p-0' onClick={() => cancelar(c)}>
                    Cancelar
                  </button>
                ) : c.status === 'AGENDADO' ? (
                  'Ligue para a recepção'
                ) : (
                  '—'
                ),
            },
          ]}
        />
        {modal}
      </Pagina>
    </ExigeRepresentado>
  );
}

const SITUACAO_EXAME = {
  A_ACEITAR: { rotulo: 'Aguardando o médico', tom: 'aviso' },
  ACEITO: { rotulo: 'Aceito', tom: 'sucesso' },
  RECUSADO: { rotulo: 'Recusado', tom: 'neutro' },
  DISPONIVEL: { rotulo: 'Disponível', tom: 'sucesso' },
};

// P-04 e R-04 · Documentos: exportações do próprio histórico e prontuário,
// exames enviados e itens recebidos na clínica.
export function DocumentosPortal() {
  const { id, ehResponsavel } = useTitular();
  const { dados, carregando, erro, recarregar } = useCarregar(async () => {
    if (!id) return null;
    const [anexos, consultas] = await Promise.all([listar('anexos', { idPaciente: id, enviadoPor: ['PACIENTE', 'RESPONSAVEL_LEGAL'] }), listar('consultas', { idPaciente: id })]);
    const movimentos = consultas.length ? await listar('movimentacoes', { idConsulta: consultas.map((c) => c.id), origem: 'DISPENSACAO' }) : [];
    // O nome do item depende de a API liberar lotes e produtos ao titular.
    const [lotes, produtos] = movimentos.length
      ? await Promise.all([listar('lotes', { id: movimentos.map((m) => m.idLote) }).catch(() => []), listar('produtos').catch(() => [])])
      : [[], []];
    const lote = porId(lotes);
    const produto = porId(produtos);
    return { anexos, itens: movimentos.map((m) => ({ id: m.id, dataHora: m.dataHora, item: produto[lote[m.idLote]?.idProduto]?.descricao ?? 'Item dispensado', quantidade: m.quantidade })) };
  }, [id]);

  return (
    <ExigeRepresentado>
      <Pagina titulo={ehResponsavel ? 'Documentos' : 'Meus documentos'}>
        <div className='row g-3'>
          {[
            ['Histórico de atendimentos', 'Datas, tipo de atendimento e médico responsável.'],
            ['Prontuário completo', 'Anamnese, exame físico, diagnóstico e prescrições.'],
          ].map(([titulo, texto]) => (
            <div key={titulo} className='col-md-6'>
              <div className='card h-100'>
                <div className='card-body d-flex flex-column gap-2'>
                  <h2 className='h5 mb-0'>{titulo}</h2>
                  <p className='mb-0 text-body-secondary'>{texto}</p>
                  <div>
                    <button type='button' className='btn btn-primary' onClick={() => emBreve('A geração do PDF')}>
                      Gerar PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className='d-flex justify-content-between align-items-center'>
          <h2 className='h5 mb-0'>Exames enviados</h2>
          <button type='button' className='btn btn-outline-primary' onClick={() => emBreve('O envio de exame')}>
            Enviar exame
          </button>
        </div>
        <Listagem
          carregando={carregando}
          erro={erro}
          aoTentarDeNovo={recarregar}
          linhas={dados?.anexos ?? []}
          vazio='Nenhum exame enviado.'
          colunas={[
            { titulo: 'Arquivo', render: (a) => a.nomeArquivo },
            { titulo: 'Enviado em', render: (a) => data(a.dataEnvio) },
            { titulo: 'Situação', render: (a) => <PilulaStatus {...rotuloDe(SITUACAO_EXAME, a.situacao)} /> },
          ]}
        />
        <Listagem
          titulo='Itens recebidos na clínica'
          carregando={carregando}
          linhas={dados?.itens ?? []}
          vazio='Nenhum item recebido.'
          colunas={[
            { titulo: 'Data', render: (i) => data(i.dataHora) },
            { titulo: 'Item', render: (i) => i.item },
            { titulo: 'Quantidade', classe: 'text-end', render: (i) => i.quantidade },
          ]}
        />
      </Pagina>
    </ExigeRepresentado>
  );
}

// P-05a e R-05a · Orçamentos e cobranças. O pagamento acontece no ambiente do
// provedor; nenhuma tela tem campo de cartão.
export function CobrancasPortal() {
  const { id } = useTitular();
  const navigate = useNavigate();
  const [aba, setAba] = React.useState('cobrancas');
  const cob = useCarregar(() => (id ? carregarCobrancasDoTitular(id) : Promise.resolve([])), [id]);
  const orc = useCarregar(() => (id ? listar('orcamentos', { idPaciente: id, etapa: ['ACEITE', 'ACEITO', 'RECUSADO', 'EXPIRADO'], _sort: 'dataEmissao', _order: 'desc' }) : Promise.resolve([])), [id]);

  return (
    <ExigeRepresentado>
      <Pagina titulo='Orçamentos e cobranças'>
        <ul className='nav nav-tabs'>
          {[
            ['cobrancas', 'Cobranças'],
            ['orcamentos', 'Orçamentos'],
          ].map(([chave, rotulo]) => (
            <li key={chave} className='nav-item'>
              <button type='button' className={`nav-link ${aba === chave ? 'active' : ''}`} aria-current={aba === chave ? 'page' : undefined} onClick={() => setAba(chave)}>
                {rotulo}
              </button>
            </li>
          ))}
        </ul>
        {aba === 'cobrancas' ? (
          <Listagem
            carregando={cob.carregando}
            erro={cob.erro}
            aoTentarDeNovo={cob.recarregar}
            linhas={cob.dados ?? []}
            vazio='Nenhuma cobrança.'
            colunas={[
              { titulo: 'Descrição', render: (c) => c.descricao },
              { titulo: 'Vencimento', render: (c) => data(c.vencimento) },
              { titulo: 'Valor', classe: 'text-end', render: (c) => moeda(c.valorTotal) },
              { titulo: 'Situação', render: (c) => <PilulaStatus {...rotuloDe(SITUACAO_TITULO, c.situacao)} /> },
              {
                titulo: '',
                render: (c) =>
                  c.situacao === 'ABERTA' ? (
                    <button type='button' className='btn btn-link btn-sm p-0' onClick={() => emBreve('O pagamento no ambiente do provedor')}>
                      Pagar
                    </button>
                  ) : (
                    <span className='d-flex gap-3'>
                      {c.recibo && (
                        <button type='button' className='btn btn-link btn-sm p-0' onClick={() => emBreve('O download do recibo')}>
                          Recibo
                        </button>
                      )}
                      {c.nfse && (
                        <button type='button' className='btn btn-link btn-sm p-0' onClick={() => emBreve('O download da NFS-e')}>
                          NFS-e
                        </button>
                      )}
                      {!c.recibo && !c.nfse && '—'}
                    </span>
                  ),
              },
            ]}
          />
        ) : (
          <Listagem
            carregando={orc.carregando}
            erro={orc.erro}
            aoTentarDeNovo={orc.recarregar}
            linhas={orc.dados ?? []}
            vazio='Nenhum orçamento.'
            colunas={[
              { titulo: 'Emitido em', render: (o) => data(o.dataEmissao) },
              { titulo: 'Válido até', render: (o) => data(o.validade) },
              { titulo: 'Situação', render: (o) => <PilulaStatus {...rotuloDe(ETAPA_ORCAMENTO, o.etapa)} /> },
              {
                titulo: '',
                render: (o) => (
                  <button type='button' className='btn btn-link btn-sm p-0' onClick={() => navigate(`/portal/orcamentos/${o.id}`)}>
                    Abrir
                  </button>
                ),
              },
            ]}
          />
        )}
      </Pagina>
    </ExigeRepresentado>
  );
}

// P-05b e R-05b · Orçamento · aceite. O titular aceita ou recusa; não altera nada.
export function OrcamentoPortal() {
  const { id: idParam } = useParams();
  const { id } = useTitular();
  const { dados, carregando, erro, recarregar } = useCarregar(async () => {
    const orcamento = await buscar('orcamentos', idParam);
    if (orcamento.idPaciente !== id) throw Object.assign(new Error('fora do alcance'), { response: { status: 404 } });
    const itens = await listar('itensOrcamento', { idOrcamento: orcamento.id });
    return { ...orcamento, itens };
  }, [idParam, id]);
  const [modal, confirmar] = useConfirmacao();

  if (erro?.status === 404) return <RegistroIndisponivel />;
  const total = (dados?.itens ?? []).reduce((s, i) => s + (i.valorUnitario ?? 0) * i.quantidade, 0);
  const responder = async (aceitar) => {
    const ok = await confirmar({
      titulo: aceitar ? 'Aceitar o orçamento?' : 'Recusar o orçamento?',
      texto: aceitar ? `Total de ${moeda(total)}. A cobrança é gerada depois do aceite.` : 'O orçamento fica no histórico como recusado.',
      rotuloConfirmar: aceitar ? 'Aceitar' : 'Recusar',
      perigo: !aceitar,
    });
    if (ok && (await salvarComAviso('orcamentos', dados.id, { etapa: aceitar ? 'ACEITO' : 'RECUSADO', dataResposta: DATA_DE_HOJE }, aceitar ? 'Orçamento aceito.' : 'Orçamento recusado.'))) recarregar();
  };

  return (
    <ExigeRepresentado>
      <Pagina titulo='Orçamentos e cobranças'>
        {dados && (
          <div className='d-flex flex-wrap align-items-center gap-3'>
            <h2 className='h5 mb-0'>Orçamento de {data(dados.dataEmissao)}</h2>
            <PilulaStatus {...rotuloDe(ETAPA_ORCAMENTO, dados.etapa)} />
            <span className='text-body-secondary'>Válido até {data(dados.validade)}</span>
          </div>
        )}
        <Listagem
          carregando={carregando}
          erro={erro}
          aoTentarDeNovo={recarregar}
          linhas={dados?.itens ?? []}
          vazio='Orçamento sem itens.'
          colunas={[
            { titulo: 'Procedimento', render: (i) => i.descricao },
            { titulo: 'Qtd.', classe: 'text-end', render: (i) => i.quantidade },
            { titulo: 'Valor', classe: 'text-end', render: (i) => moeda(i.valorUnitario) },
            { titulo: 'Subtotal', classe: 'text-end', render: (i) => moeda((i.valorUnitario ?? 0) * i.quantidade) },
          ]}
        />
        {dados && <p className='mb-0 text-end'>Total: <strong>{moeda(total)}</strong></p>}
        {dados?.etapa === 'ACEITE' && (
          <div className='d-flex justify-content-end gap-2'>
            <button type='button' className='btn btn-outline-danger' onClick={() => responder(false)}>
              Recusar
            </button>
            <button type='button' className='btn btn-primary' onClick={() => responder(true)}>
              Aceitar
            </button>
          </div>
        )}
        {modal}
      </Pagina>
    </ExigeRepresentado>
  );
}

const DIREITOS = [
  ['ACESSO', 'Acesso aos dados', 'Declaração e exportações'],
  ['PORTABILIDADE', 'Portabilidade', 'Arquivo estruturado e PDF'],
  ['REVOGACAO', 'Revogação de consentimento', 'Usos que dependem de consentimento'],
];

// P-06 e R-06 · Dados e privacidade: dados cadastrais só para leitura, direitos
// do titular (RF39) e notificações recebidas.
export function DadosPortal() {
  const { id, ehResponsavel } = useTitular();
  const { dados, carregando, erro, recarregar } = useCarregar(async () => {
    if (!id) return null;
    const [pessoa, solicitacoes, notificacoes] = await Promise.all([
      buscar('pessoas', id),
      listar('solicitacoesTitular', { idPaciente: id }),
      listar('notificacoes', { idPessoa: id, _sort: 'dataEnvio', _order: 'desc' }),
    ]);
    return { pessoa, solicitacoes, notificacoes };
  }, [id]);
  const [modal, confirmar] = useConfirmacao();
  const [avisos, setAvisos] = React.useState({ lembretes: true, cobrancas: true });

  const solicitar = async (tipo, rotulo) => {
    const ok = await confirmar({ titulo: `Pedir: ${rotulo.toLowerCase()}?`, texto: 'A clínica responde em até 15 dias. O andamento aparece em Pedidos em andamento.', rotuloConfirmar: 'Enviar pedido' });
    if (!ok) return;
    try {
      await api.post('/solicitacoesTitular', { tipo, dataSolicitacao: DATA_DE_HOJE, dataResposta: null, situacao: 'ABERTA', idPaciente: id });
      mensagemSucesso('Pedido enviado.');
      recarregar();
    } catch (e) {
      mensagemErro('Não foi possível enviar o pedido agora. Tente de novo.');
    }
  };

  const andamento = (dados?.solicitacoes ?? []).filter((s) => ['ABERTA', 'EM_ANALISE'].includes(s.situacao));
  const linhasDireitos = [
    ...DIREITOS.map(([tipo, direito, entrega]) => ({ id: tipo, direito, entrega, acao: 'Solicitar', aoClicar: () => solicitar(tipo, direito) })),
    { id: 'andamento', direito: 'Pedidos em andamento', entrega: andamento.length ? `${andamento.length} em análise · resposta em até 15 dias` : 'Nenhum', acao: andamento.length ? 'Ver' : null, aoClicar: () => emBreve('O acompanhamento dos pedidos') },
  ];
  const campo = (rotulo, valor, chave) => (
    <div className='col-md-6' key={chave}>
      <label htmlFor={`dado-${chave}`} className='form-label'>
        {rotulo}
      </label>
      <input id={`dado-${chave}`} className='form-control campo-leitura' value={valor ?? ''} readOnly />
    </div>
  );

  return (
    <ExigeRepresentado>
      <Pagina titulo={ehResponsavel ? 'Dados do representado' : 'Meus dados e privacidade'}>
        <div className='card'>
          <div className='card-body'>
            <h2 className='h5'>{ehResponsavel ? 'Dados cadastrais' : 'Meus dados'}</h2>
            {carregando && <p className='text-body-secondary mb-0'>Carregando…</p>}
            {dados && (
              <div className='row g-3'>
                {campo('Nome', dados.pessoa.nome, 'nome')}
                {campo('CPF', dados.pessoa.cpf, 'cpf')}
                {campo('Telefone', dados.pessoa.telefone, 'telefone')}
                {campo('E-mail', dados.pessoa.email, 'email')}
                <div className='col-12'>
                  <button type='button' className='btn btn-link p-0' onClick={() => solicitar('CORRECAO', 'Correção de dados')}>
                    Pedir correção de dados
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <Listagem
          titulo={ehResponsavel ? 'Direitos do titular' : 'Meus direitos'}
          carregando={carregando}
          erro={erro}
          aoTentarDeNovo={recarregar}
          linhas={linhasDireitos}
          colunas={[
            { titulo: 'Direito', render: (d) => d.direito },
            { titulo: 'O que a clínica entrega', render: (d) => d.entrega },
            {
              titulo: '',
              render: (d) =>
                d.acao ? (
                  <button type='button' className='btn btn-link btn-sm p-0' onClick={d.aoClicar}>
                    {d.acao}
                  </button>
                ) : (
                  '—'
                ),
            },
          ]}
        />
        <div className='card'>
          <div className='card-body'>
            <h2 className='h5'>Avisos por mensagem</h2>
            {[
              ['lembretes', 'Lembretes de consulta'],
              ['cobrancas', 'Avisos de cobrança'],
            ].map(([chave, rotulo]) => (
              <div key={chave} className='form-check'>
                <input
                  id={`aviso-${chave}`}
                  type='checkbox'
                  className='form-check-input'
                  checked={avisos[chave]}
                  onChange={(e) => {
                    setAvisos((a) => ({ ...a, [chave]: e.target.checked }));
                    emBreve('Salvar a preferência de aviso');
                  }}
                />
                <label htmlFor={`aviso-${chave}`} className='form-check-label'>
                  {rotulo}
                </label>
              </div>
            ))}
            <p className='small text-body-secondary mb-0 mt-2'>Avisos de cancelamento pela clínica continuam sendo enviados.</p>
          </div>
        </div>
        <Listagem
          titulo='Notificações recebidas'
          carregando={carregando}
          linhas={dados?.notificacoes ?? []}
          vazio='Nenhuma notificação.'
          colunas={[
            { titulo: 'Data', render: (n) => diaMesHora(n.dataEnvio) },
            { titulo: 'Aviso', render: (n) => EVENTO_NOTIFICACAO[n.evento] ?? n.evento },
            { titulo: 'Canal', render: (n) => CANAL[n.canal] ?? n.canal },
          ]}
        />
        {modal}
      </Pagina>
    </ExigeRepresentado>
  );
}
