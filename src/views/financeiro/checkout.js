import React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import EstadoErro from '../../components/estado-erro';
import { CampoBusca, Filtros } from '../../components/campos';
import { CampoMoeda } from '../../components/formulario';
import { listar } from '../../servicos/dados';
import { carregarCheckout } from '../../servicos/checkout';
import { useCarregar } from '../../hooks/use-carregar';
import { corresponde, data, diaMes, moeda } from '../../utils/formatos';
import { mascararMoeda, moedaParaNumero, numeroParaMoeda } from '../../utils/mascaras';
import { BANDEIRA, MEIO_PAGAMENTO, rotuloDe, SITUACAO_PAGAMENTO } from '../../utils/rotulos';
import { carregarCobrancasComPaciente } from './comum';
import { PainelDinheiro, PainelPix, PainelPos, PainelTef } from './checkout-meios';
import ConferenciasPos from './conferencias';

const MEIOS = [
  { id: 'dinheiro', rotulo: 'Dinheiro' },
  { id: 'pix', rotulo: 'Pix', dica: 'QR Code na tela ou copia e cola' },
  { id: 'tef', rotulo: 'Cartão · maquininha integrada', dica: 'O valor vai direto ao terminal' },
  { id: 'pos', rotulo: 'Cartão · maquininha avulsa', dica: 'Lançamento do comprovante' },
];

function detalheDoPagamento(p) {
  if (p.meio === 'DINHEIRO') return p.troco ? `troco ${moeda(p.troco)}` : '';
  if (p.meio === 'CARTAO' && p.ultimosDigitos) return `${BANDEIRA[p.bandeira] ?? p.bandeira} final ${p.ultimosDigitos}${p.viaTef ? '' : ' · avulsa'}`;
  return p.meio === 'CARTAO' ? (p.viaTef ? 'integrada' : 'avulsa') : '';
}

// S-07a a S-07d · Checkout de uma cobrança (RF43): itens, total e o que falta,
// pagamento composto e um painel por meio. Sem taxa, valor líquido nem soma
// do dia (RC06).
function Recebimento({ id }) {
  const navigate = useNavigate();
  const [estado, setEstado] = React.useState({ dados: null, erro: null });
  const [meio, setMeio] = React.useState('');
  const [valorTexto, setValorTexto] = React.useState('');

  const aplicar = React.useCallback((novo) => {
    setEstado({ dados: novo, erro: null });
    setValorTexto(novo.disponivel > 0 ? numeroParaMoeda(novo.disponivel) : '');
  }, []);

  React.useEffect(() => {
    let ativo = true;
    carregarCheckout(id)
      .then((novo) => ativo && aplicar(novo))
      .catch((e) => ativo && setEstado({ dados: null, erro: { status: e.response?.status ?? null } }));
    return () => {
      ativo = false;
    };
  }, [id, aplicar]);

  const d = estado.dados;
  if (estado.erro) {
    return (
      <Pagina titulo='Checkout'>
        <EstadoErro erro={estado.erro} aoTentarDeNovo={() => navigate(0)} />
      </Pagina>
    );
  }
  if (!d) {
    return (
      <Pagina titulo='Checkout'>
        <p className='text-body-secondary'>Carregando…</p>
      </Pagina>
    );
  }

  const valor = moedaParaNumero(valorTexto);
  const quitada = d.cobranca.situacao === 'PAGA';
  const props = { id, valor, d, aoAtualizar: aplicar };

  return (
    <Pagina titulo='Checkout'>
      <div className='row g-3'>
        <div className='col-lg-5'>
          <section className='card card-body h-100' aria-labelledby='checkoutResumo'>
            <h2 id='checkoutResumo' className='h5'>
              {d.paciente.nome}
            </h2>
            <ul className='list-unstyled mb-3'>
              {d.itens.map((item) => (
                <li key={item.descricao} className='d-flex justify-content-between gap-2'>
                  <span>{item.descricao}</span>
                  <span>{moeda(item.valor)}</span>
                </li>
              ))}
            </ul>
            <dl className='row mb-0'>
              <dt className='col-7 fw-normal'>Total</dt>
              <dd className='col-5 text-end mb-1'>{moeda(d.valorTotal)}</dd>
              <dt className='col-7 fw-normal'>Recebido</dt>
              <dd className='col-5 text-end mb-1'>{moeda(d.pago)}</dd>
              <dt className='col-7'>Falta receber</dt>
              <dd className='col-5 text-end fw-semibold mb-0'>{moeda(d.saldo)}</dd>
            </dl>
            {d.pagamentos.length > 0 && (
              <>
                <h3 className='h6 mt-3'>Pagamentos</h3>
                <ul className='list-unstyled mb-0 d-flex flex-column gap-2'>
                  {d.pagamentos.map((p) => (
                    <li key={p.id} className='d-flex flex-wrap justify-content-between align-items-center gap-2'>
                      <span>
                        {MEIO_PAGAMENTO[p.meio] ?? p.meio} · {moeda(p.valor)}
                        <span className='d-block small text-body-secondary'>{detalheDoPagamento(p)}</span>
                      </span>
                      <PilulaStatus {...rotuloDe(SITUACAO_PAGAMENTO, p.situacao)} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
        <div className='col-lg-7'>
          <section className='card card-body h-100' aria-labelledby='checkoutReceber'>
            <h2 id='checkoutReceber' className='h5'>
              Receber
            </h2>
            {quitada ? (
              <div className='d-flex flex-column align-items-start gap-2' role='status'>
                <div className='alert alert-success mb-0 w-100'>Cobrança quitada. O paciente recebe o aviso do pagamento.</div>
                <div className='d-flex flex-wrap gap-2'>
                  <Link to='/secretaria/listagem-recibos' className='btn btn-primary'>
                    Emitir recibo
                  </Link>
                  <Link to='/secretaria/listagem-cobrancas' className='btn btn-outline-secondary'>
                    Voltar às cobranças do dia
                  </Link>
                </div>
              </div>
            ) : (
              <div className='d-flex flex-column gap-3'>
                {d.disponivel < d.saldo && (
                  <div className='alert alert-info mb-0' role='status'>
                    {moeda(Math.round((d.saldo - d.disponivel) * 100) / 100)} aguardam desfecho (Pix gerado, cartão sem resposta ou
                    lançamento em conferência).
                  </div>
                )}
                <div className='row g-3'>
                  <CampoMoeda
                    id='checkoutValor'
                    rotulo='Valor a receber neste meio'
                    valor={valorTexto}
                    aoMudar={(v) => setValorTexto(mascararMoeda(v))}
                    ajuda='Para dividir entre meios, informe só a parte deste meio.'
                    largura='col-sm-6'
                  />
                </div>
                <fieldset>
                  <legend className='form-label fs-6 mb-2'>Meio de pagamento</legend>
                  <div className='row g-2'>
                    {MEIOS.map((m) => {
                      const semCaixa = m.id === 'dinheiro' && !d.caixaAberto;
                      return (
                        <div key={m.id} className='col-sm-6'>
                          <input
                            type='radio'
                            className='btn-check'
                            name='checkoutMeio'
                            id={`checkoutMeio-${m.id}`}
                            checked={meio === m.id}
                            onChange={() => setMeio(m.id)}
                            disabled={semCaixa}
                          />
                          <label className='btn btn-outline-primary w-100 text-start meio-pagamento' htmlFor={`checkoutMeio-${m.id}`}>
                            <span className='d-block fw-semibold'>{m.rotulo}</span>
                            <span className='small'>{m.id === 'dinheiro' ? (semCaixa ? 'Abra o caixa em Meu caixa' : 'No seu caixa aberto') : m.dica}</span>
                          </label>
                        </div>
                      );
                    })}
                  </div>
                </fieldset>
                {meio === 'dinheiro' && <PainelDinheiro {...props} />}
                {meio === 'pix' && <PainelPix {...props} />}
                {meio === 'tef' && <PainelTef {...props} />}
                {meio === 'pos' && <PainelPos {...props} />}
              </div>
            )}
          </section>
        </div>
      </div>
    </Pagina>
  );
}

// S-07a sem cobrança escolhida: as cobranças em aberto e os lançamentos a conferir.
function ParaReceber({ aviso }) {
  const navigate = useNavigate();
  const { dados, carregando, erro, recarregar } = useCarregar(async () =>
    (await carregarCobrancasComPaciente())
      .filter((c) => c.situacao === 'ABERTA')
      .sort((a, b) => b.dataEmissao.localeCompare(a.dataEmissao))
  );
  const [busca, setBusca] = React.useState('');
  const linhas = (dados ?? []).filter((c) => corresponde(busca, c.paciente));

  return (
    <Pagina titulo='Checkout'>
      {aviso && (
        <div className='alert alert-info mb-0' role='status'>
          {aviso}
        </div>
      )}
      <ConferenciasPos aoConferir={recarregar} />
      <Filtros>
        <CampoBusca id='checkoutBusca' rotulo='Buscar por paciente' valor={busca} aoMudar={setBusca} />
      </Filtros>
      <Listagem
        titulo='Cobranças em aberto'
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhuma cobrança em aberto nesta seleção.'
        colunas={[
          { titulo: 'Paciente', render: (c) => c.paciente },
          { titulo: 'Origem', render: (c) => (c.idOrcamento ? `Orçamento nº ${c.idOrcamento}` : `Consulta de ${diaMes(c.consulta?.dataHora)}`) },
          { titulo: 'Emissão', render: (c) => data(c.dataEmissao) },
          { titulo: 'Valor', classe: 'text-end', render: (c) => moeda(c.valorTotal) },
          {
            titulo: '',
            render: (c) => (
              <button type='button' className='btn btn-sm btn-outline-primary' onClick={() => navigate(`/secretaria/checkout?cobranca=${c.id}`)}>
                Receber<span className='visually-hidden'> de {c.paciente}</span>
              </button>
            ),
          },
        ]}
      />
    </Pagina>
  );
}

// Rota do checkout: ?cobranca=id abre a cobrança; ?consulta=id (da fila do
// dia) acha a cobrança da consulta.
function Checkout() {
  const [params, setParams] = useSearchParams();
  const idCobranca = params.get('cobranca');
  const idConsulta = params.get('consulta');
  const [aviso, setAviso] = React.useState(null);

  React.useEffect(() => {
    if (!idConsulta || idCobranca) return undefined;
    let ativo = true;
    listar('cobrancas', { idConsulta })
      .then((lista) => {
        if (!ativo) return;
        const escolhida = lista.find((c) => c.situacao === 'ABERTA') ?? lista[0];
        if (escolhida) setParams({ cobranca: String(escolhida.id) }, { replace: true });
        else setAviso('Esta consulta ainda não tem cobrança. Escolha outra na lista.');
      })
      .catch(() => ativo && setAviso('Não foi possível achar a cobrança desta consulta.'));
    return () => {
      ativo = false;
    };
  }, [idConsulta, idCobranca, setParams]);

  if (idCobranca) return <Recebimento key={idCobranca} id={idCobranca} />;
  if (idConsulta && !aviso) {
    return (
      <Pagina titulo='Checkout'>
        <p className='text-body-secondary'>Carregando…</p>
      </Pagina>
    );
  }
  return <ParaReceber aviso={aviso} />;
}

export default Checkout;
