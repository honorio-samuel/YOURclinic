import React from 'react';
import { useParams } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import { salvarComAviso, useConfirmacao } from '../../components/confirmacao';
import { RegistroIndisponivel } from '../geral/avisos';
import { DATA_DE_HOJE } from '../../config/axios';
import { buscar, listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { data, moeda } from '../../utils/formatos';
import { ETAPA_ORCAMENTO, rotuloDe } from '../../utils/rotulos';
import { ExigeRepresentado, useTitular } from './comum';

// P-05b e R-05b · Orçamento · aceite. O titular aceita ou recusa; não altera nada.
function OrcamentoPortal() {
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

export default OrcamentoPortal;
