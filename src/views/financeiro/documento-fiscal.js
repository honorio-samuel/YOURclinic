import React from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';

import Pagina from '../../components/pagina';
import { RegistroIndisponivel } from '../geral/avisos';
import { carregarDocumentoFiscal } from '../../servicos/fiscal';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { data, moeda } from '../../utils/formatos';

const VOLTAR = {
  ADMINISTRADOR: ['/admin/listagem-recibos-nfse', 'Voltar a Recibos e NFS-e'],
  SECRETARIA: ['/secretaria/listagem-recibos', 'Voltar a Recibos'],
  PACIENTE: ['/portal/listagem-cobrancas', 'Voltar às cobranças'],
  RESPONSAVEL_LEGAL: ['/portal/listagem-cobrancas', 'Voltar às cobranças'],
};

const porcento = (aliquota) => `${String(Math.round(aliquota * 10000) / 100).replace('.', ',')}%`;
const comCpf = (pessoa) => (pessoa ? `${pessoa.nome}${pessoa.cpf ? `, CPF ${pessoa.cpf}` : ''}` : '—');

// A-19, S-11, P-05a e R-05a · Recibo (RF33) e documento auxiliar da NFS-e
// (RF34), montados pela API, sem diagnóstico nem CID. "Baixar" abre esta
// página já com a janela de impressão, para salvar em PDF.
function DocumentoFiscal() {
  const { id } = useParams();
  const [busca] = useSearchParams();
  const { sessao } = useSessao();
  const { dados: d, carregando, erro } = useCarregar(() => carregarDocumentoFiscal(id), [id]);
  const [voltar, rotuloVoltar] = VOLTAR[sessao.usuario.papel] ?? ['/', 'Voltar'];
  const imprimir = busca.has('imprimir');

  React.useEffect(() => {
    if (!d || !imprimir) return undefined;
    const pronto = setTimeout(() => window.print(), 300);
    return () => clearTimeout(pronto);
  }, [d, imprimir]);

  if (erro?.status === 404) return <RegistroIndisponivel />;
  if (erro) {
    return (
      <Pagina titulo='Documento'>
        <div className='alert alert-warning mb-0' role='alert'>
          Não foi possível abrir o documento agora.
        </div>
      </Pagina>
    );
  }
  if (carregando && !d) return <p className='text-body-secondary'>Carregando…</p>;

  const recibo = d.tipo === 'RECIBO';
  const nome = recibo ? 'Recibo' : 'NFS-e';
  const titulo = d.numero ? `${nome} nº ${d.numero}` : `${nome} pendente`;
  const mesmaPessoa = d.pagador && d.paciente && d.pagador.nome === d.paciente.nome;
  return (
    <Pagina titulo={titulo} tituloAba={nome}>
      <div className='d-flex flex-wrap gap-2 no-print'>
        {d.situacao === 'EMITIDO' && (
          <button type='button' className='btn btn-primary' onClick={() => window.print()}>
            Imprimir ou salvar em PDF
          </button>
        )}
        <Link to={voltar} className='btn btn-outline-secondary'>
          {rotuloVoltar}
        </Link>
      </div>
      {d.situacao === 'PENDENTE' && d.erro && (
        <div className='alert alert-warning mb-0' role='status'>
          Rejeitada pelo ambiente nacional ({d.erro.codigo}): {d.erro.descricao}
        </div>
      )}
      <article className='card card-body documento-impresso'>
        <header className='mb-3'>
          <p className='mb-0 fw-semibold'>{d.emitente.razaoSocial}</p>
          <p className='small mb-0'>
            CNPJ {d.emitente.cnpj} · {d.emitente.endereco}
          </p>
          <p className='small text-body-secondary mb-0'>Responsável técnico: {d.emitente.responsavelTecnico}</p>
        </header>
        <h2 className='h4'>
          {recibo ? titulo : `${titulo} · documento auxiliar`}
          {d.situacao === 'CANCELADO' && <span className='badge text-bg-danger ms-2'>CANCELADO</span>}
        </h2>
        <p>
          Recebemos de <strong>{comCpf(d.pagador)}</strong> a importância de <strong>{moeda(d.valor)}</strong>, referente a {d.descricao}
          {mesmaPessoa ? '.' : <>, prestado a {comCpf(d.paciente)}.</>}
        </p>
        <dl className='row mb-0'>
          <dt className='col-sm-4'>Forma de pagamento</dt>
          <dd className='col-sm-8'>{d.formasDePagamento.length ? d.formasDePagamento.join(', ') : '—'}</dd>
          <dt className='col-sm-4'>Emissão</dt>
          <dd className='col-sm-8'>{data(d.dataEmissao)}</dd>
          {!recibo && (
            <>
              <dt className='col-sm-4'>IBS</dt>
              <dd className='col-sm-8'>
                {moeda(d.ibs)}
                {d.aliquotas ? ` (${porcento(d.aliquotas.ibs)})` : ''}
              </dd>
              <dt className='col-sm-4'>CBS</dt>
              <dd className='col-sm-8'>
                {moeda(d.cbs)}
                {d.aliquotas ? ` (${porcento(d.aliquotas.cbs)})` : ''}
              </dd>
              <dt className='col-sm-4'>Chave de acesso</dt>
              <dd className='col-sm-8'>{d.chaveAcesso ?? '—'}</dd>
            </>
          )}
        </dl>
        {!recibo && <p className='small text-body-secondary mt-3 mb-0'>Emitida num ambiente nacional simulado, só para demonstração.</p>}
      </article>
    </Pagina>
  );
}

export default DocumentoFiscal;
