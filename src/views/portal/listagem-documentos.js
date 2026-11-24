import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { BotaoEnviarArquivo, baixarAnexo, VisualizadorDeAnexo } from '../../components/anexos';
import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mostrarMensagem } from '../../components/toastr';
import { criar, listar, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { data, diaMesHora } from '../../utils/formatos';
import { rotuloDe } from '../../utils/rotulos';
import { ExigeRepresentado, useTitular } from './comum';

const SITUACAO_EXAME = {
  A_ACEITAR: { rotulo: 'Aguardando o médico', tom: 'aviso' },
  ACEITO: { rotulo: 'Aceito', tom: 'sucesso' },
  RECUSADO: { rotulo: 'Recusado', tom: 'neutro' },
  DISPONIVEL: { rotulo: 'Disponível', tom: 'sucesso' },
};
const DO_TITULAR = ['PACIENTE', 'RESPONSAVEL_LEGAL'];
const DOCUMENTO = {
  HISTORICO: ['Histórico de atendimentos', 'Datas, tipo de atendimento e médico responsável, sem conteúdo clínico.'],
  PRONTUARIO: ['Prontuário completo', 'Anamnese, exame físico, diagnóstico e prescrições dos atendimentos já encerrados.'],
};
const pronto = (e) => ['CONCLUIDA', 'PRONTO'].includes(e.situacao);

// P-04 e R-04 · Documentos: exportações do próprio histórico e prontuário
// (RF29, RF30), exames (RF26, RF27) e itens recebidos na clínica.
function DocumentosPortal() {
  const { id, ehResponsavel } = useTitular();
  const navigate = useNavigate();
  const [modal, confirmar] = useConfirmacao();
  const [aberto, setAberto] = React.useState(null);
  const { dados, carregando, erro, recarregar } = useCarregar(async () => {
    if (!id) return null;
    const [anexos, consultas, exportacoes] = await Promise.all([
      listar('anexos', { idPaciente: id, _sort: 'dataEnvio', _order: 'desc' }),
      listar('consultas', { idPaciente: id }),
      listar('exportacoes', { idPaciente: id, _sort: 'dataSolicitacao', _order: 'desc' }).catch(() => []),
    ]);
    const movimentos = consultas.length ? await listar('movimentacoes', { idConsulta: consultas.map((c) => c.id), origem: 'DISPENSACAO' }) : [];
    // O nome do item depende de a API liberar lotes e produtos ao titular.
    const [lotes, produtos] = movimentos.length
      ? await Promise.all([listar('lotes', { id: movimentos.map((m) => m.idLote) }).catch(() => []), listar('produtos').catch(() => [])])
      : [[], []];
    const lote = porId(lotes);
    const produto = porId(produtos);
    return {
      anexos,
      exportacoes,
      itens: movimentos.map((m) => ({ id: m.id, dataHora: m.dataHora, item: produto[lote[m.idLote]?.idProduto]?.descricao ?? 'Item dispensado', quantidade: m.quantidade })),
    };
  }, [id]);

  // O documento fica pronto em segundos: a lista se atualiza até lá.
  const gerando = (dados?.exportacoes ?? []).some((e) => !pronto(e));
  React.useEffect(() => {
    if (!gerando) return undefined;
    const espera = setTimeout(recarregar, 3000);
    return () => clearTimeout(espera);
  }, [gerando, dados, recarregar]);

  const gerar = async (tipo) => {
    const [titulo, texto] = DOCUMENTO[tipo];
    const ok = await confirmar({ titulo: `Gerar o ${titulo.toLowerCase()}?`, texto: `${texto} O documento fica disponível por 24 horas, só para você.`, rotuloConfirmar: 'Gerar' });
    if (!ok) return;
    try {
      await criar('exportacoes', { tipo, formato: 'PDF', idPaciente: id });
      mostrarMensagem('Documento pedido', 'Fica pronto em alguns segundos, na lista abaixo.', 'info');
      recarregar();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    }
  };

  return (
    <ExigeRepresentado>
      <Pagina titulo={ehResponsavel ? 'Documentos' : 'Meus documentos'}>
        <div className='row g-3'>
          {Object.entries(DOCUMENTO).map(([tipo, [titulo, texto]]) => (
            <div key={tipo} className='col-md-6'>
              <div className='card h-100'>
                <div className='card-body d-flex flex-column gap-2'>
                  <h2 className='h5 mb-0'>{titulo}</h2>
                  <p className='mb-0 text-body-secondary'>{texto}</p>
                  <div className='mt-auto'>
                    <button type='button' className='btn btn-primary' onClick={() => gerar(tipo)}>
                      Gerar PDF
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {(dados?.exportacoes ?? []).length > 0 && (
          <Listagem
            titulo='Documentos gerados'
            linhas={dados.exportacoes}
            colunas={[
              { titulo: 'Documento', render: (e) => (e.tipo === 'PRONTUARIO' ? 'Prontuário completo' : 'Histórico de atendimentos') },
              { titulo: 'Pedido em', render: (e) => diaMesHora(e.dataSolicitacao) },
              { titulo: 'Situação', render: (e) => (pronto(e) ? <PilulaStatus rotulo='Pronto' tom='sucesso' /> : <PilulaStatus rotulo='Gerando…' tom='aviso' />) },
              {
                titulo: '',
                render: (e) =>
                  pronto(e) ? (
                    <button type='button' className='btn btn-link btn-sm p-0' onClick={() => navigate(`/portal/exportacoes/${e.id}`)}>
                      Abrir
                    </button>
                  ) : (
                    '—'
                  ),
              },
            ]}
          />
        )}
        <div className='d-flex flex-wrap justify-content-between align-items-center gap-2'>
          <h2 className='h5 mb-0'>Exames</h2>
          {id && <BotaoEnviarArquivo idPaciente={id} aoEnviar={recarregar} rotulo='Enviar exame' classe='btn btn-outline-primary' ajuda='PDF, JPG ou PNG de até 5 MB' />}
        </div>
        <p className='mb-0 small text-body-secondary'>O exame que você envia passa pelo médico antes de entrar no prontuário.</p>
        <Listagem
          carregando={carregando}
          erro={erro}
          aoTentarDeNovo={recarregar}
          linhas={dados?.anexos ?? []}
          vazio='Nenhum exame ainda.'
          colunas={[
            { titulo: 'Arquivo', render: (a) => a.nomeArquivo },
            { titulo: 'Enviado em', render: (a) => data(a.dataEnvio) },
            { titulo: 'Enviado por', render: (a) => (DO_TITULAR.includes(a.enviadoPor) ? (ehResponsavel ? 'Responsável' : 'Você') : 'Clínica') },
            {
              titulo: 'Situação',
              render: (a) => (
                <>
                  <PilulaStatus {...rotuloDe(SITUACAO_EXAME, a.situacao)} />
                  {a.situacao === 'RECUSADO' && a.motivoRecusa && <div className='small text-body-secondary mt-1'>{a.motivoRecusa}</div>}
                </>
              ),
            },
            {
              titulo: 'Ações',
              render: (a) => (
                <AcoesLinha
                  acoes={[
                    { tipo: 'ver', alvo: a.nomeArquivo, aoClicar: () => setAberto(a) },
                    { tipo: 'baixar', alvo: a.nomeArquivo, aoClicar: () => baixarAnexo(a) },
                  ]}
                />
              ),
            },
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
        {aberto && <VisualizadorDeAnexo anexo={aberto} aoFechar={() => setAberto(null)} />}
        {modal}
      </Pagina>
    </ExigeRepresentado>
  );
}

export default DocumentosPortal;
