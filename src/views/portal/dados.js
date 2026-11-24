import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import Modal from '../../components/modal';
import { useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { api, DATA_DE_HOJE } from '../../config/axios';
import { buscar, listar } from '../../servicos/dados';
import { carregarPreferencias, salvarPreferencias } from '../../servicos/notificacoes';
import { useCarregar } from '../../hooks/use-carregar';
import { data, diaMesHora } from '../../utils/formatos';
import { CANAL, EVENTO_NOTIFICACAO, TIPO_SOLICITACAO } from '../../utils/rotulos';
import { ExigeRepresentado, useTitular } from './comum';
import { somarDias } from '../agenda/comum';

const SITUACAO_PEDIDO = { ABERTA: 'Recebido', EM_ANALISE: 'Em análise', RESPONDIDA: 'Respondido', RECUSADA: 'Recusado' };

const DIREITOS = [
  ['ACESSO', 'Acesso aos dados', 'Declaração e exportações'],
  ['PORTABILIDADE', 'Portabilidade', 'Arquivo estruturado e PDF'],
  ['REVOGACAO', 'Revogação de consentimento', 'Usos que dependem de consentimento'],
];

// P-06 e R-06 · Dados e privacidade: dados cadastrais só para leitura, direitos
// do titular (RF39) e notificações recebidas.
function DadosPortal() {
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
  const [vendoPedidos, setVendoPedidos] = React.useState(false);
  // RF39: a preferência vem da API e vale na hora em que muda.
  React.useEffect(() => {
    if (!id) return;
    carregarPreferencias()
      .then(setAvisos)
      .catch(() => {});
  }, [id]);
  const mudarAviso = async (chave, ligado) => {
    const antes = avisos;
    const novos = { ...avisos, [chave]: ligado };
    setAvisos(novos);
    try {
      await salvarPreferencias(novos);
      mensagemSucesso(ligado ? 'Aviso ligado.' : 'Aviso desligado. Avisos de cancelamento pela clínica continuam.');
    } catch {
      setAvisos(antes);
      mensagemErro('Não foi possível salvar a preferência agora.');
    }
  };

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
    { id: 'andamento', direito: 'Pedidos em andamento', entrega: andamento.length ? `${andamento.length} em análise · resposta em até 15 dias` : 'Nenhum', acao: andamento.length ? 'Ver' : null, aoClicar: () => setVendoPedidos(true) },
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
                  onChange={(e) => mudarAviso(chave, e.target.checked)}
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
        {vendoPedidos && (
          <Modal
            titulo='Pedidos à clínica'
            aoFechar={() => setVendoPedidos(false)}
            rodape={
              <button type='button' className='btn btn-outline-secondary' onClick={() => setVendoPedidos(false)}>
                Fechar
              </button>
            }
          >
            <Listagem
              linhas={[...(dados?.solicitacoes ?? [])].sort((a, b) => b.dataSolicitacao.localeCompare(a.dataSolicitacao))}
              vazio='Nenhum pedido feito.'
              colunas={[
                { titulo: 'Pedido', render: (p) => TIPO_SOLICITACAO[p.tipo] ?? p.tipo },
                { titulo: 'Feito em', render: (p) => data(p.dataSolicitacao) },
                { titulo: 'Situação', render: (p) => SITUACAO_PEDIDO[p.situacao] ?? p.situacao },
                {
                  titulo: 'Resposta',
                  render: (p) =>
                    p.dataResposta
                      ? `Em ${data(p.dataResposta)}${p.resposta ? `: ${p.resposta}` : ''}${p.motivoRecusa ? `: ${p.motivoRecusa}` : ''}`
                      : `Prevista até ${data(somarDias(p.dataSolicitacao.slice(0, 10), 15))}`,
                },
              ]}
            />
          </Modal>
        )}
        {modal}
      </Pagina>
    </ExigeRepresentado>
  );
}

export default DadosPortal;
