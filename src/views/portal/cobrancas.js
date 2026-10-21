import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import { emBreve } from '../../components/confirmacao';
import { listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { data, moeda } from '../../utils/formatos';
import { ETAPA_ORCAMENTO, rotuloDe, SITUACAO_TITULO } from '../../utils/rotulos';
import { carregarCobrancasDoTitular, ExigeRepresentado, useTitular } from './comum';

// P-05a e R-05a · Orçamentos e cobranças. O pagamento acontece no ambiente do
// provedor; nenhuma tela tem campo de cartão.
function CobrancasPortal() {
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

export default CobrancasPortal;
