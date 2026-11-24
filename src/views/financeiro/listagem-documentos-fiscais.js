import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import Modal from '../../components/modal';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoBusca, CampoSelect, Filtros } from '../../components/campos';
import { CampoSelecao, CampoTexto, useFormulario } from '../../components/formulario';
import { mensagemDeErro } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso, mostrarMensagem } from '../../components/toastr';
import { listar, pessoasPorId, porId } from '../../servicos/dados';
import { emitirDocumento, reenviarNfse } from '../../servicos/fiscal';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { corresponde, data, moeda } from '../../utils/formatos';
import { rotuloDe } from '../../utils/rotulos';
import { carregarCobrancasComPaciente } from './comum';

const SITUACAO_DOCUMENTO = {
  EMITIDO: { rotulo: 'Emitido', tom: 'sucesso' },
  PENDENTE: { rotulo: 'Pendente', tom: 'aviso' },
  CANCELADO: { rotulo: 'Cancelado', tom: 'neutro' },
};
const NOME = { RECIBO: 'Recibo', NFSE: 'NFS-e' };
const NO_TEXTO = { RECIBO: 'recibo', NFSE: 'NFS-e' };

// Títulos de paciente já pagos e ainda sem o documento do tipo (RF33: só
// depois da baixa), com o paciente e quem pode constar como pagador.
async function carregarEmitiveis(documentos) {
  const [titulos, cobrancas, representacoes] = await Promise.all([
    listar('titulosReceber', { situacao: 'PAGO', _sort: 'vencimento', _order: 'desc' }),
    carregarCobrancasComPaciente(),
    listar('representacoes'),
  ]);
  const cobranca = porId(cobrancas);
  const responsaveis = await pessoasPorId(representacoes.map((r) => r.idResponsavelLegal));
  const comDocumento = (tipo) => new Set(documentos.filter((d) => d.tipo === tipo && d.situacao !== 'CANCELADO').map((d) => d.idTituloReceber));
  const jaTem = { RECIBO: comDocumento('RECIBO'), NFSE: comDocumento('NFSE') };
  return {
    jaTem,
    titulos: titulos
      .filter((t) => t.idCobranca && cobranca[t.idCobranca])
      .map((t) => {
        const c = cobranca[t.idCobranca];
        const deles = representacoes.filter((r) => r.idPaciente === c.idPaciente);
        return {
          ...t,
          paciente: c.paciente,
          idPaciente: c.idPaciente,
          emissao: c.dataEmissao,
          pagadores: [[String(c.idPaciente), `${c.paciente} (paciente)`], ...deles.map((r) => [String(r.idResponsavelLegal), `${responsaveis[r.idResponsavelLegal]?.nome ?? '—'} (responsável)`])],
        };
      }),
  };
}

function JanelaEmissao({ ehAdmin, documentos, aoFechar, aoEmitir }) {
  const { dados } = useCarregar(() => carregarEmitiveis(documentos), []);
  const form = useFormulario({ tipo: 'RECIBO', busca: '', idTituloReceber: '', idPagador: '' }, 'emissao-');
  const { definir } = form;
  const v = form.valores;
  const [salvando, setSalvando] = React.useState(false);
  const disponiveis = (dados?.titulos ?? []).filter((t) => !dados.jaTem[v.tipo].has(t.id));
  const opcoes = disponiveis
    .filter((t) => corresponde(v.busca, t.paciente) || String(t.id) === v.idTituloReceber)
    .slice(0, 40)
    .map((t) => [String(t.id), `${t.paciente} · ${moeda(t.valor)} · ${data(t.emissao)}`]);
  const titulo = disponiveis.find((t) => String(t.id) === v.idTituloReceber);

  const emitir = async () => {
    if (!form.validar({ idTituloReceber: titulo ? null : 'Escolha o título pago.' })) return;
    setSalvando(true);
    try {
      const doc = await emitirDocumento(v.tipo, { idTituloReceber: titulo.id, ...(v.idPagador ? { idPagador: Number(v.idPagador) } : {}) });
      if (doc.situacao === 'PENDENTE') mostrarMensagem('NFS-e pendente', `${doc.erro?.descricao ?? 'O ambiente nacional rejeitou a nota.'}`, 'warning');
      else mensagemSucesso(`${NOME[doc.tipo]} nº ${doc.numero} emitido.`);
      aoEmitir(doc);
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
      setSalvando(false);
    }
  };

  return (
    <Modal
      titulo={ehAdmin ? 'Emitir recibo ou NFS-e' : 'Emitir recibo'}
      aoFechar={aoFechar}
      largo
      rodape={
        <>
          <button type='button' className='btn btn-outline-secondary' onClick={aoFechar} disabled={salvando}>
            Voltar
          </button>
          <button type='button' className='btn btn-primary' onClick={emitir} disabled={salvando}>
            {salvando ? 'Emitindo…' : `Emitir ${NO_TEXTO[v.tipo]}`}
          </button>
        </>
      }
    >
      <form
        noValidate
        aria-label='Emissão de documento'
        className='row g-3'
        onSubmit={(e) => {
          e.preventDefault();
          emitir();
        }}
      >
        {ehAdmin && (
          <CampoSelecao
            {...form.campo('tipo')}
            aoMudar={(tipo) => {
              definir('tipo', tipo);
              definir('idTituloReceber', '');
            }}
            rotulo='Documento'
            opcoes={[
              ['RECIBO', 'Recibo'],
              ['NFSE', 'NFS-e'],
            ]}
            largura='col-sm-4'
          />
        )}
        <CampoTexto {...form.campo('busca')} rotulo='Buscar pelo paciente' opcional tipo='search' largura={ehAdmin ? 'col-sm-8' : 'col-12'} />
        <CampoSelecao
          {...form.campo('idTituloReceber')}
          aoMudar={(id) => {
            definir('idTituloReceber', id);
            definir('idPagador', '');
          }}
          rotulo='Título pago'
          opcoes={opcoes}
          largura='col-12'
          ajuda={dados ? `${disponiveis.length} títulos pagos sem ${NO_TEXTO[v.tipo]}.` : 'Carregando…'}
        />
        {titulo && titulo.pagadores.length > 1 && (
          <CampoSelecao
            {...form.campo('idPagador')}
            rotulo='Pagador'
            opcional
            opcoes={titulo.pagadores}
            largura='col-12'
            ajuda='Sem escolha, o pagador é o paciente. O responsável legal pode constar como pagador.'
          />
        )}
        {v.tipo === 'NFSE' && <p className='col-12 mb-0 small text-body-secondary'>IBS e CBS saem da tabela de alíquotas vigente; ninguém os digita.</p>}
      </form>
    </Modal>
  );
}

// A-19 Recibos e NFS-e (Administrador emite os dois) e S-11 Recibos
// (Secretária emite recibo). Nenhum documento traz CID ou diagnóstico.
function DocumentosFiscais() {
  const { sessao } = useSessao();
  const navigate = useNavigate();
  const ehAdmin = sessao.usuario.papel === 'ADMINISTRADOR';
  const prefixo = ehAdmin ? '/admin' : '/secretaria';
  const carregar = async () => {
    const [documentos, titulos, cobrancas] = await Promise.all([
      listar('documentosFiscais', ehAdmin ? { _sort: 'id', _order: 'desc' } : { tipo: 'RECIBO', _sort: 'id', _order: 'desc' }),
      listar('titulosReceber'),
      carregarCobrancasComPaciente(),
    ]);
    const titulo = porId(titulos);
    const cobranca = porId(cobrancas);
    const pagadores = await pessoasPorId(documentos.map((d) => d.idPagador));
    return documentos.map((d) => {
      const cob = cobranca[titulo[d.idTituloReceber]?.idCobranca];
      return { ...d, paciente: cob?.paciente ?? '—', pagador: pagadores[d.idPagador]?.nome ?? cob?.paciente ?? '—' };
    });
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [emitindo, setEmitindo] = React.useState(false);
  const [busca, setBusca] = React.useState('');
  const [tipo, setTipo] = React.useState('');
  const [situacao, setSituacao] = React.useState('');
  const linhas = (dados ?? []).filter(
    (d) => corresponde(busca, d.numero, d.pagador, d.paciente) && (!tipo || d.tipo === tipo) && (!situacao || d.situacao === situacao)
  );
  const abrir = (d, imprimir = false) => navigate(`${prefixo}/documentos-fiscais/${d.id}${imprimir ? '?imprimir' : ''}`);

  const reenviar = async (d) => {
    try {
      const novo = await reenviarNfse(d.id);
      if (novo.situacao === 'EMITIDO') mensagemSucesso(`NFS-e nº ${novo.numero} emitida.`);
      else mostrarMensagem('Ainda pendente', novo.erro?.descricao ?? 'O ambiente nacional rejeitou de novo.', 'warning');
      recarregar();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    }
  };

  const acoes = (d) => {
    const alvo = d.numero ? `${NOME[d.tipo]} ${d.numero}` : `${NOME[d.tipo]} pendente de ${d.pagador}`;
    const ver = { tipo: 'ver', alvo, aoClicar: () => abrir(d) };
    if (d.situacao !== 'EMITIDO') return <AcoesLinha acoes={[ver]} />;
    return <AcoesLinha acoes={[ver, { tipo: 'baixar', alvo, aoClicar: () => abrir(d, true) }]} />;
  };
  const situacaoDe = (d) => (
    <PilulaStatus
      {...rotuloDe(SITUACAO_DOCUMENTO, d.situacao)}
      transicoes={ehAdmin && d.tipo === 'NFSE' && d.situacao === 'PENDENTE' ? [{ rotulo: 'Reenviar ao ambiente nacional', aoEscolher: () => reenviar(d) }] : null}
    />
  );

  return (
    <Pagina
      titulo={ehAdmin ? 'Recibos e NFS-e' : 'Recibos'}
      acoes={
        <button type='button' className='btn btn-primary' disabled={!dados} onClick={() => setEmitindo(true)}>
          {ehAdmin ? 'Emitir documento' : 'Emitir recibo'}
        </button>
      }
    >
      <Filtros>
        <CampoBusca id='docBusca' rotulo='Buscar por número, pagador ou paciente' valor={busca} aoMudar={setBusca} />
        {ehAdmin && <CampoSelect id='docTipo' rotulo='Tipo' valor={tipo} aoMudar={setTipo} opcoes={[['', 'Todos'], ['RECIBO', 'Recibo'], ['NFSE', 'NFS-e']]} />}
        {ehAdmin && (
          <CampoSelect
            id='docSituacao'
            rotulo='Situação'
            valor={situacao}
            aoMudar={setSituacao}
            opcoes={[['', 'Todas'], ...Object.entries(SITUACAO_DOCUMENTO).map(([k, v]) => [k, v.rotulo])]}
          />
        )}
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhum documento nesta seleção.'
        colunas={
          ehAdmin
            ? [
                { titulo: 'Número', render: (d) => d.numero ?? '—' },
                { titulo: 'Tipo', render: (d) => NOME[d.tipo] ?? d.tipo },
                { titulo: 'Pagador', render: (d) => d.pagador },
                { titulo: 'Valor', classe: 'text-end', render: (d) => moeda(d.valor) },
                { titulo: 'Emissão', render: (d) => data(d.dataEmissao) },
                { titulo: 'Situação', render: situacaoDe },
                { titulo: 'Detalhe', render: (d) => (d.situacao === 'PENDENTE' && d.erro ? `${d.erro.codigo}: ${d.erro.descricao}` : '—') },
                { titulo: 'Ações', render: acoes },
              ]
            : [
                { titulo: 'Número', render: (d) => d.numero },
                { titulo: 'Pagador', render: (d) => d.pagador },
                { titulo: 'Paciente', render: (d) => d.paciente },
                { titulo: 'Valor', classe: 'text-end', render: (d) => moeda(d.valor) },
                { titulo: 'Situação', render: situacaoDe },
                { titulo: 'Ações', render: acoes },
              ]
        }
      />
      {emitindo && (
        <JanelaEmissao
          ehAdmin={ehAdmin}
          documentos={dados ?? []}
          aoFechar={() => setEmitindo(false)}
          aoEmitir={(doc) => {
            setEmitindo(false);
            if (doc.situacao === 'EMITIDO') abrir(doc);
            else recarregar();
          }}
        />
      )}
    </Pagina>
  );
}

export default DocumentosFiscais;
