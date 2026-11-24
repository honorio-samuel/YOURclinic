import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoBusca, CampoSelect, Filtros } from '../../components/campos';
import Modal from '../../components/modal';
import { buscar, listar, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { corresponde, data, moeda } from '../../utils/formatos';
import { ORIGEM_TITULO, rotuloDe, SITUACAO_GLOSA, SITUACAO_GUIA, SITUACAO_LOTE_TISS, SITUACAO_TITULO } from '../../utils/rotulos';
import { carregarCobrancasComPaciente, situacaoDoTitulo } from './comum';

// Título de operadora (RF32): a guia de origem, o lote TISS e as glosas.
// Nada clínico: a guia aparece sem CID. Glosado não vira perda sozinho; fica
// assim até o desfecho do recurso (RN-32.2).
async function carregarTituloDeOperadora(titulo) {
  const lote = titulo.idLoteCobranca ? await buscar('lotesCobranca', titulo.idLoteCobranca) : null;
  const [convenio, guiasDoLote] = await Promise.all([
    lote ? buscar('convenios', lote.idConvenio) : Promise.resolve(null),
    lote ? listar('guiasTiss', { idLoteCobranca: lote.id, _sort: 'dataEmissao' }) : Promise.resolve([]),
  ]);
  // Cada título nasce de uma guia; sem ela, mostra o lote inteiro.
  const daGuia = guiasDoLote.filter((g) => g.id === titulo.idGuiaTiss);
  const guias = daGuia.length ? daGuia : guiasDoLote;
  const glosas = guias.length ? await listar('glosas', { idGuiaTiss: guias.map((g) => g.id) }) : [];
  const guia = porId(guias);
  return {
    lote,
    convenio,
    guias,
    outrasDoLote: guiasDoLote.length - guias.length,
    glosas: glosas.map((g) => ({ ...g, numeroGuia: guia[g.idGuiaTiss]?.numero ?? '—' })),
  };
}

function DetalheTituloOperadora({ titulo, aoFechar }) {
  const { dados, carregando, erro } = useCarregar(() => carregarTituloDeOperadora(titulo), [titulo.id]);
  const glosado = (dados?.glosas ?? []).reduce((s, g) => s + (g.valorGlosado ?? 0), 0);
  return (
    <Modal
      titulo={`Título de ${dados?.convenio?.nome ?? 'operadora'}`}
      aoFechar={aoFechar}
      largo
      rodape={
        <button type='button' className='btn btn-outline-secondary' onClick={aoFechar}>
          Fechar
        </button>
      }
    >
      {carregando && <p className='text-body-secondary mb-0'>Carregando…</p>}
      {erro && <p className='text-danger mb-0'>Não foi possível abrir o título agora.</p>}
      {dados && (
        <div className='d-flex flex-column gap-3'>
          <dl className='row mb-0'>
            <dt className='col-sm-4'>Valor do título</dt>
            <dd className='col-sm-8'>{moeda(titulo.valor)}</dd>
            <dt className='col-sm-4'>Vencimento</dt>
            <dd className='col-sm-8'>{data(titulo.vencimento)}</dd>
            <dt className='col-sm-4'>Situação</dt>
            <dd className='col-sm-8'>{rotuloDe(SITUACAO_TITULO, titulo.situacaoEfetiva).rotulo}</dd>
            <dt className='col-sm-4'>Lote</dt>
            <dd className='col-sm-8'>
              {dados.lote
                ? `${dados.lote.numero} · ${rotuloDe(SITUACAO_LOTE_TISS, dados.lote.situacao).rotulo}${dados.lote.protocolo ? ` · protocolo ${dados.lote.protocolo}` : ''}${dados.lote.dataEnvio ? ` · enviado em ${data(dados.lote.dataEnvio)}` : ''}`
                : '—'}
            </dd>
            <dt className='col-sm-4'>Glosado</dt>
            <dd className='col-sm-8'>{glosado > 0 ? `${moeda(glosado)} em ${dados.glosas.length} ${dados.glosas.length === 1 ? 'glosa' : 'glosas'}` : 'Nada glosado'}</dd>
          </dl>
          <Listagem
            titulo={dados.guias.length === 1 ? 'Guia de origem' : 'Guias do lote'}
            linhas={dados.guias}
            vazio='Nenhuma guia neste lote.'
            colunas={[
              { titulo: 'Guia', render: (g) => g.numero },
              { titulo: 'Emissão', render: (g) => data(g.dataEmissao) },
              { titulo: 'Valor', classe: 'text-end', render: (g) => moeda(g.valor) },
              { titulo: 'Situação', render: (g) => <PilulaStatus {...rotuloDe(SITUACAO_GUIA, g.situacao)} /> },
            ]}
          />
          {dados.outrasDoLote > 0 && (
            <p className='mb-0 small text-body-secondary'>
              O lote tem mais {dados.outrasDoLote} {dados.outrasDoLote === 1 ? 'guia' : 'guias'}, cada uma com o próprio título.
            </p>
          )}
          {dados.glosas.length > 0 && (
            <Listagem
              titulo='Glosas'
              linhas={dados.glosas}
              colunas={[
                { titulo: 'Guia', render: (g) => g.numeroGuia },
                { titulo: 'Motivo', render: (g) => g.motivo },
                { titulo: 'Valor', classe: 'text-end', render: (g) => moeda(g.valorGlosado) },
                { titulo: 'Situação', render: (g) => <PilulaStatus {...rotuloDe(SITUACAO_GLOSA, g.situacao)} /> },
              ]}
            />
          )}
        </div>
      )}
    </Modal>
  );
}

// A-13a · Contas a receber. Sem "dar baixa": a baixa vem do checkout (D27).
// Nova cobrança, Ver e Editar abrem a cobrança (A-13b).
function ContasReceber() {
  const navigate = useNavigate();
  const carregar = async () => {
    const [titulos, cobrancas, lotes, convenios] = await Promise.all([
      listar('titulosReceber', { _sort: 'vencimento', _order: 'desc' }),
      carregarCobrancasComPaciente(),
      listar('lotesCobranca'),
      listar('convenios'),
    ]);
    const cobranca = porId(cobrancas);
    const lote = porId(lotes);
    const convenio = porId(convenios);
    // O devedor do título de convênio é a operadora do lote.
    const devedor = (t) => cobranca[t.idCobranca]?.paciente ?? convenio[lote[t.idLoteCobranca]?.idConvenio]?.nome ?? 'Operadora';
    return titulos.map((t) => ({ ...t, devedor: devedor(t), situacaoEfetiva: situacaoDoTitulo(t) }));
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [busca, setBusca] = React.useState('');
  const [situacao, setSituacao] = React.useState('');
  const [origem, setOrigem] = React.useState('');
  const [deOperadora, setDeOperadora] = React.useState(null);
  const linhas = (dados ?? []).filter(
    (t) => corresponde(busca, t.devedor) && (!situacao || t.situacaoEfetiva === situacao) && (!origem || t.origem === origem)
  );

  return (
    <Pagina
      titulo='Contas a receber'
      acoes={
        <button type='button' className='btn btn-primary' onClick={() => navigate('/admin/cadastro-cobrancas')}>
          + Nova cobrança
        </button>
      }
    >
      <Filtros>
        <CampoBusca id='receberBusca' rotulo='Buscar por devedor' valor={busca} aoMudar={setBusca} />
        <CampoSelect
          id='receberSituacao'
          rotulo='Situação'
          valor={situacao}
          aoMudar={setSituacao}
          opcoes={[['', 'Todas'], ['ABERTO', 'Aberto'], ['VENCIDO', 'Vencido'], ['PAGO', 'Pago']]}
        />
        <CampoSelect
          id='receberOrigem'
          rotulo='Origem'
          valor={origem}
          aoMudar={setOrigem}
          opcoes={[['', 'Todas'], ...Object.entries(ORIGEM_TITULO)]}
        />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhum título nesta seleção.'
        colunas={[
          { titulo: 'Devedor', render: (t) => t.devedor },
          { titulo: 'Origem', render: (t) => ORIGEM_TITULO[t.origem] ?? t.origem },
          { titulo: 'Vencimento', render: (t) => data(t.vencimento) },
          { titulo: 'Valor', classe: 'text-end', render: (t) => moeda(t.valor) },
          { titulo: 'Situação', render: (t) => <PilulaStatus {...rotuloDe(SITUACAO_TITULO, t.situacaoEfetiva)} /> },
          {
            titulo: 'Ações',
            render: (t) => {
              const alvo = `título de ${t.devedor}`;
              // Título de operadora (lote TISS) não tem cobrança de paciente.
              const ver = {
                tipo: 'ver',
                alvo,
                aoClicar: () =>
                  t.idCobranca ? navigate(`/admin/cadastro-cobrancas/${t.idCobranca}?consulta`) : setDeOperadora(t),
              };
              if (t.situacao === 'PAGO') return <AcoesLinha acoes={[ver, { tipo: 'estornar', alvo, aoClicar: () => navigate('/admin/listagem-estornos') }]} />;
              if (t.situacao === 'ESTORNADO' || !t.idCobranca) return <AcoesLinha acoes={[ver]} />;
              return <AcoesLinha acoes={[ver, { tipo: 'editar', alvo, aoClicar: () => navigate(`/admin/cadastro-cobrancas/${t.idCobranca}`) }]} />;
            },
          },
        ]}
      />
      {deOperadora && <DetalheTituloOperadora titulo={deOperadora} aoFechar={() => setDeOperadora(null)} />}
    </Pagina>
  );
}

export default ContasReceber;
