import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import { CampoSelect, Filtros } from '../../components/campos';
import { emBreve, salvarComAviso, useConfirmacao } from '../../components/confirmacao';
import { DATA_DE_HOJE } from '../../config/axios';
import { listar, pessoasPorId, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { data, moeda } from '../../utils/formatos';
import { MEIO_PAGAMENTO, rotuloDe } from '../../utils/rotulos';
import { carregarCobrancasComPaciente } from './comum';

const SITUACAO_ESTORNO = {
  A_APROVAR: { rotulo: 'A aprovar', tom: 'aviso' },
  ESTORNADO: { rotulo: 'Estornado', tom: 'neutro' },
  CANCELADO: { rotulo: 'Cancelado', tom: 'neutro' },
  RECUSADO: { rotulo: 'Recusado', tom: 'perigo' },
};

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
      };
    });
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [modal, confirmar] = useConfirmacao();
  const [situacao, setSituacao] = React.useState(ehAdmin ? 'A_APROVAR' : '');
  const [meio, setMeio] = React.useState('');

  const aprovar = async (e) => {
    const ok = await confirmar({
      titulo: `Aprovar o ${e.tipo === 'CANCELAMENTO' ? 'cancelamento' : 'estorno'} de ${moeda(e.valor)}?`,
      texto: `Paciente: ${e.paciente}. Motivo: ${e.motivo}. O lançamento original continua no histórico.`,
      rotuloConfirmar: 'Aprovar',
    });
    const nova = e.tipo === 'CANCELAMENTO' ? 'CANCELADO' : 'ESTORNADO';
    if (ok && (await salvarComAviso('estornos', e.id, { situacao: nova, dataHora: `${DATA_DE_HOJE}T12:00:00` }, 'Pedido aprovado.'))) recarregar();
  };
  const recusar = async (e) => {
    const motivo = await confirmar({ titulo: 'Recusar o pedido?', texto: 'A Secretária vê o motivo da recusa.', campo: 'Motivo da recusa', rotuloConfirmar: 'Recusar', perigo: true });
    if (motivo && (await salvarComAviso('estornos', e.id, { situacao: 'RECUSADO', motivoRecusa: motivo }, 'Pedido recusado.'))) recarregar();
  };

  const linhas = (dados ?? []).filter((e) => (!situacao || e.situacao === situacao) && (!meio || e.meio === meio));
  const colunas = [
    { titulo: 'Paciente', render: (e) => e.paciente },
    { titulo: 'Meio', render: (e) => e.meio },
    { titulo: 'Valor', classe: 'text-end', render: (e) => moeda(e.valor) },
    ehAdmin ? { titulo: 'Pedido por', render: (e) => e.pedidoPor } : { titulo: 'Pedido em', render: (e) => data(e.dataPedido) },
    { titulo: 'Tipo', render: (e) => (e.tipo === 'CANCELAMENTO' ? 'Cancelamento' : 'Estorno') },
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
  ];

  return (
    <Pagina
      titulo={ehAdmin ? 'Cancelamentos e estornos' : 'Estornos'}
      acoes={
        !ehAdmin && (
          <button type='button' className='btn btn-primary' onClick={() => emBreve('O pedido de cancelamento ou estorno')}>
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
      {modal}
    </Pagina>
  );
}

export default Estornos;
