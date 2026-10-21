import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import { emBreve } from '../../components/confirmacao';
import { listar, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { data } from '../../utils/formatos';
import { rotuloDe } from '../../utils/rotulos';
import { ExigeRepresentado, useTitular } from './comum';

const SITUACAO_EXAME = {
  A_ACEITAR: { rotulo: 'Aguardando o médico', tom: 'aviso' },
  ACEITO: { rotulo: 'Aceito', tom: 'sucesso' },
  RECUSADO: { rotulo: 'Recusado', tom: 'neutro' },
  DISPONIVEL: { rotulo: 'Disponível', tom: 'sucesso' },
};

// P-04 e R-04 · Documentos: exportações do próprio histórico e prontuário,
// exames enviados e itens recebidos na clínica.
function DocumentosPortal() {
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

export default DocumentosPortal;
