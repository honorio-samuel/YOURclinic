import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import QrCode2Icon from '@mui/icons-material/QrCode2';

import Modal from '../../components/modal';
import { mensagemDeErro } from '../../components/confirmacao';
import { mensagemSucesso } from '../../components/toastr';
import { listar } from '../../servicos/dados';
import { pagarPeloPortal, verificarPixDoPortal } from '../../servicos/checkout';
import { useCarregar } from '../../hooks/use-carregar';
import { data, hora, moeda } from '../../utils/formatos';
import { ETAPA_ORCAMENTO, rotuloDe, SITUACAO_TITULO } from '../../utils/rotulos';
import { carregarCobrancasDoTitular, ExigeRepresentado, useTitular } from './comum';

// Pagamento no ambiente do provedor (RF44): o QR Code dinâmico do PSP
// simulado; a tela consulta o pagamento sozinha até ele cair.
function JanelaPix({ cobranca, aoFechar, aoPagar }) {
  const [estado, setEstado] = React.useState({ pagamento: null, erro: null });
  const [tentativa, setTentativa] = React.useState(0);

  React.useEffect(() => {
    let ativo = true;
    setEstado({ pagamento: null, erro: null });
    pagarPeloPortal(cobranca.id)
      .then((r) => ativo && setEstado({ pagamento: r.pagamento, erro: null }))
      .catch((e) => ativo && setEstado({ pagamento: null, erro: mensagemDeErro(e) }));
    return () => {
      ativo = false;
    };
  }, [cobranca.id, tentativa]);

  const pagamento = estado.pagamento;
  React.useEffect(() => {
    if (pagamento?.situacao !== 'PENDENTE') return undefined;
    const espera = setTimeout(async () => {
      try {
        const r = await verificarPixDoPortal(pagamento.id);
        setEstado({ pagamento: r.pagamento, erro: null });
        if (r.pagamento.situacao === 'CONFIRMADO') {
          mensagemSucesso('Pagamento confirmado.');
          aoPagar();
        }
      } catch {
        // Sem resposta agora: a próxima consulta tenta de novo.
        setEstado((atual) => ({ ...atual }));
      }
    }, 3000);
    return () => clearTimeout(espera);
  }, [pagamento, aoPagar]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(pagamento.brcode);
      mensagemSucesso('Código copiado.');
    } catch {
      // Sem acesso à área de transferência: o código continua selecionável.
    }
  };

  return (
    <Modal
      titulo={`Pagar ${cobranca.descricao}`}
      aoFechar={aoFechar}
      rodape={
        <button type='button' className='btn btn-outline-secondary' onClick={aoFechar}>
          {pagamento?.situacao === 'CONFIRMADO' ? 'Concluir' : 'Fechar'}
        </button>
      }
    >
      {estado.erro && <div className='alert alert-warning mb-0' role='alert'>{estado.erro}</div>}
      {!estado.erro && !pagamento && <p className='text-body-secondary mb-0'>Gerando o QR Code…</p>}
      {pagamento?.situacao === 'PENDENTE' && (
        <div className='d-flex flex-column gap-3'>
          <div className='d-flex flex-wrap gap-3 align-items-start'>
            <div className='qr-simulado' role='img' aria-label='QR Code do Pix, simulado'>
              <QrCode2Icon aria-hidden='true' />
            </div>
            <div className='flex-grow-1'>
              <p className='mb-1' aria-live='polite'>
                <strong>Pague {moeda(pagamento.valor)} com o Pix</strong> no aplicativo do seu banco. Esta janela atualiza sozinha.
              </p>
              <p className='small text-body-secondary mb-0'>O QR Code vale até as {hora(pagamento.expiracao)}.</p>
            </div>
          </div>
          <div>
            <label htmlFor='portalPixCopiaECola' className='form-label'>
              Pix copia e cola
            </label>
            <textarea id='portalPixCopiaECola' readOnly className='form-control font-monospace small' rows='3' value={pagamento.brcode ?? ''} />
            <button type='button' className='btn btn-outline-primary btn-sm mt-2' onClick={copiar}>
              Copiar código
            </button>
          </div>
          <p className='small text-body-secondary mb-0'>Ambiente de demonstração: o provedor do Pix é simulado e confirma o pagamento sozinho em alguns segundos.</p>
        </div>
      )}
      {pagamento?.situacao === 'CONFIRMADO' && (
        <div className='alert alert-success mb-0' role='status'>
          Pagamento de {moeda(pagamento.valor)} confirmado. O recibo fica disponível nesta página depois que a recepção o emitir.
        </div>
      )}
      {['EXPIRADO', 'CANCELADO'].includes(pagamento?.situacao) && (
        <div className='d-flex flex-column gap-2'>
          <div className='alert alert-info mb-0' role='status'>
            O QR Code {pagamento.situacao === 'EXPIRADO' ? 'expirou' : 'foi cancelado'} sem pagamento.
          </div>
          <div>
            <button type='button' className='btn btn-primary' onClick={() => setTentativa((n) => n + 1)}>
              Gerar outro QR Code
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

// P-05a e R-05a · Orçamentos e cobranças. O pagamento acontece no ambiente do
// provedor; nenhuma tela tem campo de cartão.
function CobrancasPortal() {
  const { id } = useTitular();
  const navigate = useNavigate();
  const [aba, setAba] = React.useState('cobrancas');
  const [pagando, setPagando] = React.useState(null);
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
                    <button type='button' className='btn btn-link btn-sm p-0' onClick={() => setPagando(c)}>
                      Pagar
                    </button>
                  ) : (
                    <span className='d-flex gap-3'>
                      {c.idRecibo && (
                        <button type='button' className='btn btn-link btn-sm p-0' onClick={() => navigate(`/portal/documentos-fiscais/${c.idRecibo}`)}>
                          Recibo
                        </button>
                      )}
                      {c.idNfse && (
                        <button type='button' className='btn btn-link btn-sm p-0' onClick={() => navigate(`/portal/documentos-fiscais/${c.idNfse}`)}>
                          NFS-e
                        </button>
                      )}
                      {!c.idRecibo && !c.idNfse && (c.situacao === 'PAGA' ? 'Recibo a emitir na recepção' : '—')}
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
        {pagando && <JanelaPix cobranca={pagando} aoFechar={() => setPagando(null)} aoPagar={cob.recarregar} />}
      </Pagina>
    </ExigeRepresentado>
  );
}

export default CobrancasPortal;
