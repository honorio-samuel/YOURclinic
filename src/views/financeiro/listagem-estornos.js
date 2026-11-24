import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import Modal from '../../components/modal';
import PilulaStatus from '../../components/pilula-status';
import { CampoSelect, Filtros } from '../../components/campos';
import { CampoMoeda, CampoSelecao, CampoTexto, CampoTextoLongo, useFormulario } from '../../components/formulario';
import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { DATA_DE_HOJE } from '../../config/axios';
import { listar, pessoasPorId, porId } from '../../servicos/dados';
import { avaliarEstorno, decidirEstorno, pedirEstorno } from '../../servicos/estornos';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { corresponde, data, diaMesHora, moeda } from '../../utils/formatos';
import { mascararMoeda, moedaParaNumero, numeroParaMoeda } from '../../utils/mascaras';
import { MEIO_PAGAMENTO, rotuloDe } from '../../utils/rotulos';
import { carregarCobrancasComPaciente } from './comum';
import { somarDias } from '../agenda/comum';

const SITUACAO_ESTORNO = {
  A_APROVAR: { rotulo: 'A aprovar', tom: 'aviso' },
  ESTORNADO: { rotulo: 'Estornado', tom: 'neutro' },
  CANCELADO: { rotulo: 'Cancelado', tom: 'neutro' },
  RECUSADO: { rotulo: 'Recusado', tom: 'perigo' },
  REGISTRADO: { rotulo: 'Registrado', tom: 'info' },
};

// RN-48.3: cancelamento (mesmo dia), estorno (depois) e chargeback (do portador).
const TIPO_ESTORNO = { CANCELAMENTO: 'Cancelamento', ESTORNO: 'Estorno', CHARGEBACK: 'Chargeback' };

const FORMA = {
  SAIDA_DE_CAIXA: 'Dinheiro devolvido no balcão',
  DEVOLUCAO_CAIXA_SEGUINTE: 'Dinheiro devolvido pelo caixa do dia',
  DEVOLUCAO_PSP: 'Devolução do Pix pelo PSP',
  TRANSFERENCIA_MANUAL: 'Transferência avulsa, com comprovante',
  CANCELAMENTO_TERMINAL: 'Cancelamento no terminal, com o cartão',
  CANCELAMENTO_ADQUIRENTE: 'Cancelamento no adquirente',
  DEVOLUCAO_OUTRO_MEIO: 'Devolução por outro meio',
};

function comoDevolver(e) {
  if (e.tipo === 'CHARGEBACK') return 'Contestação do portador';
  if (e.forma === 'DEVOLUCAO_OUTRO_MEIO' && e.meioDevolucao) return `Devolução por ${MEIO_PAGAMENTO[e.meioDevolucao]?.toLowerCase() ?? e.meioDevolucao}`;
  return FORMA[e.forma] ?? '—';
}

// S-12 · Pedido de cancelamento ou estorno, ou registro de chargeback. A API
// diz o que o meio permite hoje; a tela só repete a orientação (RF48, passo 2).
function JanelaPedido({ aoFechar, aoConcluir }) {
  const { dados: pagamentos } = useCarregar(async () => {
    const [lista, cobrancas] = await Promise.all([
      listar('pagamentos', { situacao: 'CONFIRMADO', dataHora_gte: `${somarDias(DATA_DE_HOJE, -120)}T00:00:00`, _sort: 'dataHora', _order: 'desc' }),
      carregarCobrancasComPaciente(),
    ]);
    const cobranca = porId(cobrancas);
    return lista.filter((p) => p.valor > 0).map((p) => ({ ...p, paciente: cobranca[p.idCobranca]?.paciente ?? '—' }));
  });
  const form = useFormulario({ busca: '', idPagamento: '', acao: 'DEVOLUCAO', valor: '', meioDevolucao: '', motivo: '' }, 'estorno-');
  const { definir } = form;
  const v = form.valores;
  const [avaliacao, setAvaliacao] = React.useState(null);
  const [salvando, setSalvando] = React.useState(false);

  const opcoes = (pagamentos ?? [])
    .filter((p) => corresponde(v.busca, p.paciente) || String(p.id) === v.idPagamento)
    .slice(0, 40)
    .map((p) => [String(p.id), `${diaMesHora(p.dataHora)} · ${MEIO_PAGAMENTO[p.meio] ?? p.meio} · ${moeda(p.valor)} · ${p.paciente}`]);
  const pagamento = (pagamentos ?? []).find((p) => String(p.id) === v.idPagamento);
  const chargeback = v.acao === 'CHARGEBACK';
  const valorTravado = !chargeback && avaliacao && !avaliacao.parcial;

  const escolher = async (id) => {
    definir('idPagamento', id);
    definir('acao', 'DEVOLUCAO');
    definir('meioDevolucao', '');
    setAvaliacao(null);
    if (!id) return;
    try {
      const a = await avaliarEstorno(id);
      setAvaliacao(a);
      definir('valor', numeroParaMoeda(a.disponivel));
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    }
  };

  const salvar = async () => {
    const valor = moedaParaNumero(v.valor);
    const limite = chargeback ? pagamento?.valor : avaliacao?.disponivel;
    let erroValor = null;
    if (!(valor > 0)) erroValor = 'Informe o valor.';
    else if (limite != null && valor > limite) erroValor = `O valor passa de ${moeda(limite)}.`;
    const ok = form.validar({
      idPagamento: pagamento ? null : 'Escolha o pagamento.',
      valor: erroValor,
      meioDevolucao: !chargeback && avaliacao?.exigeMeio && !v.meioDevolucao ? 'Escolha como devolver.' : null,
      motivo: v.motivo.trim().length >= 5 ? null : 'Informe o motivo.',
    });
    if (!ok) return;
    if (!chargeback && !avaliacao?.possivel) {
      mensagemErro(avaliacao?.orientacao ?? 'Este pagamento não pode ser devolvido.');
      return;
    }
    setSalvando(true);
    try {
      await pedirEstorno({
        idPagamento: pagamento.id,
        valor,
        motivo: v.motivo.trim(),
        ...(chargeback ? { chargeback: true } : avaliacao.exigeMeio ? { meioDevolucao: v.meioDevolucao } : {}),
      });
      mensagemSucesso(chargeback ? 'Chargeback registrado.' : 'Pedido enviado. O Administrador aprova antes de devolver.');
      aoConcluir();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
      setSalvando(false);
    }
  };

  return (
    <Modal
      titulo='Pedir cancelamento ou estorno'
      aoFechar={aoFechar}
      largo
      rodape={
        <>
          <button type='button' className='btn btn-outline-secondary' onClick={aoFechar} disabled={salvando}>
            Voltar
          </button>
          <button type='button' className='btn btn-primary' onClick={salvar} disabled={salvando || (!chargeback && avaliacao && !avaliacao.possivel)}>
            {salvando ? 'Enviando…' : chargeback ? 'Registrar chargeback' : 'Enviar pedido'}
          </button>
        </>
      }
    >
      <form
        noValidate
        aria-label='Pedido de cancelamento ou estorno'
        className='row g-3'
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <CampoTexto {...form.campo('busca')} rotulo='Buscar pelo paciente' opcional tipo='search' largura='col-sm-5' />
        <CampoSelecao
          {...form.campo('idPagamento')}
          aoMudar={escolher}
          rotulo='Pagamento'
          opcoes={opcoes}
          largura='col-sm-7'
          ajuda={pagamentos ? 'Pagamentos confirmados nos últimos 120 dias.' : 'Carregando os pagamentos…'}
        />
        {avaliacao && (
          <div className='col-12'>
            <div className={`alert mb-0 ${avaliacao.possivel ? 'alert-info' : 'alert-warning'}`} role='status'>
              {avaliacao.possivel && <strong>{TIPO_ESTORNO[avaliacao.tipo]}: </strong>}
              {avaliacao.orientacao}
              {avaliacao.possivel && avaliacao.disponivel < avaliacao.valor && ` Ainda pode ser devolvido: ${moeda(avaliacao.disponivel)}.`}
            </div>
          </div>
        )}
        {avaliacao?.chargeback && (
          <CampoSelecao
            {...form.campo('acao')}
            aoMudar={(acao) => {
              definir('acao', acao);
              definir('valor', numeroParaMoeda(acao === 'CHARGEBACK' ? pagamento.valor : avaliacao.disponivel));
            }}
            rotulo='O que registrar'
            opcoes={[
              ['DEVOLUCAO', 'Devolução pedida pela clínica'],
              ['CHARGEBACK', 'Chargeback avisado pelo adquirente'],
            ]}
            largura='col-12'
            ajuda={chargeback ? 'Contestação do portador do cartão: a clínica só registra, sem aprovação.' : null}
          />
        )}
        {pagamento && (
          <>
            <CampoMoeda
              {...form.campo('valor', mascararMoeda)}
              rotulo={chargeback ? 'Valor contestado' : 'Valor a devolver'}
              largura='col-sm-6'
              disabled={Boolean(valorTravado)}
              ajuda={valorTravado ? 'Neste meio a devolução é pelo valor total.' : null}
            />
            {!chargeback && avaliacao?.exigeMeio && (
              <CampoSelecao
                {...form.campo('meioDevolucao')}
                rotulo='Devolver por'
                opcoes={[
                  ['PIX', 'Pix'],
                  ['DINHEIRO', 'Dinheiro'],
                ]}
                largura='col-sm-6'
              />
            )}
            <CampoTextoLongo {...form.campo('motivo')} rotulo='Motivo' linhas={2} />
          </>
        )}
      </form>
    </Modal>
  );
}

// A-17 Cancelamentos e estornos (Administrador aprova) e S-12 Estornos
// (Secretária pede e acompanha). Nenhum estorno acontece com um só par de olhos.
function Estornos() {
  const { sessao } = useSessao();
  const ehAdmin = sessao.usuario.papel === 'ADMINISTRADOR';
  const carregar = async () => {
    const [estornos, pagamentos, cobrancas, usuarios] = await Promise.all([
      listar('estornos', { _sort: 'dataPedido', _order: 'desc' }),
      listar('pagamentos'),
      carregarCobrancasComPaciente(),
      ehAdmin ? listar('usuarios') : Promise.resolve([]),
    ]);
    const pagamento = porId(pagamentos);
    const cobranca = porId(cobrancas);
    const usuario = porId(usuarios);
    const solicitantes = await pessoasPorId(usuarios.map((u) => u.idPessoa));
    return estornos.map((e) => {
      const pg = pagamento[e.idPagamento];
      return {
        ...e,
        paciente: cobranca[pg?.idCobranca]?.paciente ?? '—',
        meio: MEIO_PAGAMENTO[pg?.meio] ?? '—',
        pedidoPor: solicitantes[usuario[e.idSolicitante]?.idPessoa]?.nome ?? '—',
        como: comoDevolver(e),
      };
    });
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [modal, confirmar] = useConfirmacao();
  const [pedindo, setPedindo] = React.useState(false);
  const [situacao, setSituacao] = React.useState(ehAdmin ? 'A_APROVAR' : '');
  const [meio, setMeio] = React.useState('');

  const decidir = async (e, decisao, motivo) => {
    try {
      const feito = await decidirEstorno(e.id, decisao, motivo);
      mensagemSucesso(decisao === 'recusar' ? 'Pedido recusado.' : `${TIPO_ESTORNO[feito.tipo]} aprovado. Protocolo ${feito.protocolo}. O título foi reaberto.`);
      recarregar();
    } catch (falha) {
      mensagemErro(mensagemDeErro(falha));
    }
  };
  const aprovar = async (e) => {
    const ok = await confirmar({
      titulo: `Aprovar o ${TIPO_ESTORNO[e.tipo].toLowerCase()} de ${moeda(e.valor)}?`,
      texto: `Paciente: ${e.paciente}. Como: ${e.como}. Motivo: ${e.motivo.replace(/[.!?]+$/, '')}. O lançamento original continua no histórico; o título volta a ficar em aberto e o recibo e a NFS-e são cancelados.`,
      rotuloConfirmar: 'Aprovar',
    });
    if (ok) decidir(e, 'aprovar');
  };
  const recusar = async (e) => {
    const motivo = await confirmar({ titulo: 'Recusar o pedido?', texto: 'A Secretária vê o motivo da recusa.', campo: 'Motivo da recusa', rotuloConfirmar: 'Recusar', perigo: true });
    if (motivo) decidir(e, 'recusar', motivo);
  };

  const linhas = (dados ?? []).filter((e) => (!situacao || e.situacao === situacao) && (!meio || e.meio === meio));
  const colunas = [
    { titulo: 'Paciente', render: (e) => e.paciente },
    { titulo: 'Meio', render: (e) => e.meio },
    { titulo: 'Valor', classe: 'text-end', render: (e) => moeda(e.valor) },
    ehAdmin ? { titulo: 'Pedido por', render: (e) => e.pedidoPor } : { titulo: 'Pedido em', render: (e) => data(e.dataPedido) },
    { titulo: 'Tipo', render: (e) => TIPO_ESTORNO[e.tipo] ?? e.tipo },
    { titulo: 'Como', render: (e) => e.como },
    {
      titulo: 'Situação',
      render: (e) => {
        const r = rotuloDe(SITUACAO_ESTORNO, e.situacao);
        if (!ehAdmin && e.situacao === 'A_APROVAR') return <PilulaStatus rotulo='Em aprovação' tom='aviso' />;
        return (
          <PilulaStatus
            {...r}
            transicoes={ehAdmin && e.situacao === 'A_APROVAR' ? [{ rotulo: 'Aprovar', aoEscolher: () => aprovar(e) }, { rotulo: 'Recusar', aoEscolher: () => recusar(e) }] : null}
          />
        );
      },
    },
    { titulo: 'Detalhe', render: (e) => (e.situacao === 'RECUSADO' ? e.motivoRecusa ?? '—' : e.protocolo ?? e.motivo) },
  ];

  return (
    <Pagina
      titulo={ehAdmin ? 'Cancelamentos e estornos' : 'Estornos'}
      acoes={
        !ehAdmin && (
          <button type='button' className='btn btn-primary' onClick={() => setPedindo(true)}>
            Pedir cancelamento ou estorno
          </button>
        )
      }
    >
      <Filtros>
        <CampoSelect
          id='estornoSituacao'
          rotulo='Situação'
          valor={situacao}
          aoMudar={setSituacao}
          opcoes={[['', 'Todas'], ...Object.entries(SITUACAO_ESTORNO).map(([k, v]) => [k, v.rotulo])]}
        />
        <CampoSelect id='estornoMeio' rotulo='Meio' valor={meio} aoMudar={setMeio} opcoes={[['', 'Todos'], ...Object.values(MEIO_PAGAMENTO).map((m) => [m, m])]} />
      </Filtros>
      <Listagem carregando={carregando} erro={erro} aoTentarDeNovo={recarregar} linhas={linhas} vazio='Nenhum pedido nesta seleção.' colunas={colunas} />
      {pedindo && (
        <JanelaPedido
          aoFechar={() => setPedindo(false)}
          aoConcluir={() => {
            setPedindo(false);
            recarregar();
          }}
        />
      )}
      {modal}
    </Pagina>
  );
}

export default Estornos;
