import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { CampoBusca, CampoSelect, Filtros } from '../../components/campos';
import { emBreve, salvarComAviso, useConfirmacao } from '../../components/confirmacao';
import { DATA_DE_HOJE } from '../../config/axios';
import { listar, pessoasPorId, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { corresponde, data, diaMes, moeda } from '../../utils/formatos';
import {
  CATEGORIA_DESPESA,
  MEIO_PAGAMENTO,
  ORIGEM_TITULO,
  SITUACAO_TITULO,
  rotuloDe,
} from '../../utils/rotulos';

// Situação efetiva do título: aberto com vencimento passado é Vencido.
const situacaoDoTitulo = (t) => (t.situacao === 'ABERTO' && t.vencimento < DATA_DE_HOJE ? 'VENCIDO' : t.situacao);

// Devedor de cada cobrança: o paciente da consulta ou do orçamento.
async function carregarCobrancasComPaciente() {
  const [cobrancas, consultas, orcamentos] = await Promise.all([
    listar('cobrancas'),
    listar('consultas'),
    listar('orcamentos'),
  ]);
  const consulta = porId(consultas);
  const orcamento = porId(orcamentos);
  const idPaciente = (c) => consulta[c.idConsulta]?.idPaciente ?? orcamento[c.idOrcamento]?.idPaciente;
  const pessoas = await pessoasPorId(cobrancas.map(idPaciente));
  return cobrancas.map((c) => ({ ...c, idPaciente: idPaciente(c), paciente: pessoas[idPaciente(c)]?.nome ?? '—', consulta: consulta[c.idConsulta] }));
}

// A-13a · Contas a receber. Sem "dar baixa": a baixa vem do checkout (D27).
export function ContasReceber() {
  const navigate = useNavigate();
  const carregar = async () => {
    const [titulos, cobrancas] = await Promise.all([listar('titulosReceber', { _sort: 'vencimento', _order: 'desc' }), carregarCobrancasComPaciente()]);
    const cobranca = porId(cobrancas);
    return titulos.map((t) => ({ ...t, devedor: cobranca[t.idCobranca]?.paciente ?? 'Operadora', situacaoEfetiva: situacaoDoTitulo(t) }));
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [busca, setBusca] = React.useState('');
  const [situacao, setSituacao] = React.useState('');
  const [origem, setOrigem] = React.useState('');
  const linhas = (dados ?? []).filter(
    (t) => corresponde(busca, t.devedor) && (!situacao || t.situacaoEfetiva === situacao) && (!origem || t.origem === origem)
  );

  return (
    <Pagina
      titulo='Contas a receber'
      acoes={
        <button type='button' className='btn btn-primary' onClick={() => emBreve('A criação de cobrança')}>
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
              const ver = { tipo: 'ver', alvo, aoClicar: () => emBreve('O detalhe do título') };
              if (t.situacao === 'PAGO') return <AcoesLinha acoes={[ver, { tipo: 'estornar', alvo, aoClicar: () => navigate('/admin/estornos') }]} />;
              if (t.situacao === 'ESTORNADO') return <AcoesLinha acoes={[ver]} />;
              return <AcoesLinha acoes={[ver, { tipo: 'editar', alvo, aoClicar: () => emBreve('A edição da cobrança') }]} />;
            },
          },
        ]}
      />
    </Pagina>
  );
}

// A-14 · Contas a pagar. Título pago não é editado, só estornado (RN-50.1).
export function ContasPagar() {
  const { dados, carregando, erro, recarregar } = useCarregar(async () =>
    (await listar('titulosPagar', { _sort: 'vencimento' })).map((t) => ({ ...t, situacaoEfetiva: situacaoDoTitulo(t) }))
  );
  const [modal, confirmar] = useConfirmacao();
  const [busca, setBusca] = React.useState('');
  const [categoria, setCategoria] = React.useState('');
  const [situacao, setSituacao] = React.useState('');

  const pagar = async (t) => {
    const ok = await confirmar({
      titulo: `Registrar o pagamento de ${t.fornecedor}?`,
      texto: `${moeda(t.valor)} com vencimento em ${data(t.vencimento)}. Depois de pago, o título só pode ser estornado.`,
      rotuloConfirmar: 'Registrar pagamento',
    });
    if (ok && (await salvarComAviso('titulosPagar', t.id, { situacao: 'PAGO' }, 'Pagamento registrado.'))) recarregar();
  };
  const estornar = async (t) => {
    const motivo = await confirmar({
      titulo: `Estornar o pagamento de ${t.fornecedor}?`,
      texto: 'O lançamento original continua no histórico.',
      campo: 'Motivo do estorno',
      rotuloConfirmar: 'Estornar',
      perigo: true,
    });
    if (motivo && (await salvarComAviso('titulosPagar', t.id, { situacao: 'ESTORNADO', motivoEstorno: motivo }, 'Pagamento estornado.'))) recarregar();
  };

  const linhas = (dados ?? []).filter(
    (t) => corresponde(busca, t.fornecedor) && (!categoria || t.categoria === categoria) && (!situacao || t.situacaoEfetiva === situacao)
  );

  return (
    <Pagina
      titulo='Contas a pagar'
      acoes={
        <button type='button' className='btn btn-primary' onClick={() => emBreve('O cadastro de conta a pagar')}>
          + Nova conta
        </button>
      }
    >
      <Filtros>
        <CampoBusca id='pagarBusca' rotulo='Buscar por fornecedor' valor={busca} aoMudar={setBusca} />
        <CampoSelect id='pagarCategoria' rotulo='Categoria' valor={categoria} aoMudar={setCategoria} opcoes={[['', 'Todas'], ...Object.entries(CATEGORIA_DESPESA)]} />
        <CampoSelect
          id='pagarSituacao'
          rotulo='Situação'
          valor={situacao}
          aoMudar={setSituacao}
          opcoes={[['', 'Todas'], ['ABERTO', 'Aberto'], ['VENCIDO', 'Vencido'], ['PAGO', 'Pago'], ['ESTORNADO', 'Estornado']]}
        />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhuma conta nesta seleção.'
        colunas={[
          { titulo: 'Fornecedor', render: (t) => t.fornecedor },
          { titulo: 'Categoria', render: (t) => CATEGORIA_DESPESA[t.categoria] ?? t.categoria },
          { titulo: 'Vencimento', render: (t) => data(t.vencimento) },
          { titulo: 'Valor', classe: 'text-end', render: (t) => moeda(t.valor) },
          {
            titulo: 'Situação',
            render: (t) => (
              <PilulaStatus
                {...rotuloDe(SITUACAO_TITULO, t.situacaoEfetiva)}
                transicoes={['ABERTO', 'VENCIDO'].includes(t.situacaoEfetiva) ? [{ rotulo: 'Registrar pagamento', aoEscolher: () => pagar(t) }] : null}
              />
            ),
          },
          {
            titulo: 'Ações',
            render: (t) => {
              const alvo = `conta de ${t.fornecedor}`;
              const ver = { tipo: 'ver', alvo, aoClicar: () => emBreve('O detalhe da conta') };
              if (t.situacao === 'PAGO') return <AcoesLinha acoes={[ver, { tipo: 'estornar', alvo, aoClicar: () => estornar(t) }]} />;
              if (t.situacao === 'ESTORNADO') return <AcoesLinha acoes={[ver]} />;
              return <AcoesLinha acoes={[ver, { tipo: 'editar', alvo, aoClicar: () => emBreve('A edição da conta') }]} />;
            },
          },
        ]}
      />
      {modal}
    </Pagina>
  );
}

const CONCILIACAO = {
  CONCILIADO: { rotulo: 'Conciliado', tom: 'sucesso' },
  DIVERGENTE: { rotulo: 'Divergente', tom: 'perigo' },
  PENDENTE: { rotulo: 'Pendente', tom: 'aviso' },
};

// A-15 · Conciliação de recebíveis (RF49).
export function Conciliacao() {
  const { dados, carregando, erro, recarregar } = useCarregar(() => listar('pagamentosCartao'));
  const [adquirente, setAdquirente] = React.useState('');
  const [situacao, setSituacao] = React.useState('');
  const adquirentes = [...new Set((dados ?? []).map((p) => p.adquirente).filter(Boolean))];
  const linhas = (dados ?? [])
    .filter((p) => (!adquirente || p.adquirente === adquirente) && (!situacao || p.situacaoConciliacao === situacao))
    .sort((a, b) => (b.dataHora ?? '').localeCompare(a.dataHora ?? ''));

  return (
    <Pagina
      titulo='Conciliação de recebíveis'
      acoes={
        <button type='button' className='btn btn-outline-primary' onClick={() => emBreve('A importação do extrato')}>
          Importar extrato
        </button>
      }
    >
      <Filtros>
        <CampoSelect id='concAdquirente' rotulo='Adquirente' valor={adquirente} aoMudar={setAdquirente} opcoes={[['', 'Todos'], ...adquirentes.map((a) => [a, a])]} />
        <CampoSelect
          id='concSituacao'
          rotulo='Situação'
          valor={situacao}
          aoMudar={setSituacao}
          opcoes={[['', 'Todas'], ...Object.entries(CONCILIACAO).map(([k, v]) => [k, v.rotulo])]}
        />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhuma transação nesta seleção.'
        colunas={[
          { titulo: 'Data', render: (p) => diaMes(p.dataHora) },
          { titulo: 'NSU', render: (p) => p.nsu },
          { titulo: 'Bandeira', render: (p) => p.bandeira },
          { titulo: 'Bruto', classe: 'text-end', render: (p) => moeda(p.valorBruto) },
          { titulo: 'Líquido', classe: 'text-end', render: (p) => moeda(p.valorLiquido) },
          {
            titulo: 'Situação',
            render: (p) => (
              <PilulaStatus
                {...rotuloDe(CONCILIACAO, p.situacaoConciliacao)}
                transicoes={p.situacaoConciliacao === 'DIVERGENTE' ? [{ rotulo: 'Tratar divergência', aoEscolher: () => emBreve('O tratamento da divergência') }] : null}
              />
            ),
          },
          { titulo: 'Ações', render: (p) => <AcoesLinha acoes={[{ tipo: 'ver', alvo: `NSU ${p.nsu}`, aoClicar: () => emBreve('O detalhe da transação') }]} /> },
        ]}
      />
    </Pagina>
  );
}

const SITUACAO_CAIXA = {
  ABERTO: { rotulo: 'Aberto', tom: 'info' },
  FECHADO: { rotulo: 'Fechado', tom: 'sucesso' },
  A_APROVAR: { rotulo: 'A aprovar', tom: 'aviso' },
  RECONTAGEM: { rotulo: 'Em recontagem', tom: 'neutro' },
};
const TURNO = { MANHA: 'manhã', TARDE: 'tarde', NOITE: 'noite' };

// A-16 · Caixas · supervisão. Só aqui aparece o saldo esperado (fechamento cego, D5).
export function Caixas() {
  const carregar = async () => {
    const caixas = await listar('caixas', { _sort: 'dataAbertura', _order: 'desc' });
    const pessoas = await pessoasPorId(caixas.map((c) => c.idSecretaria));
    return caixas.map((c) => ({ ...c, operador: pessoas[c.idSecretaria]?.nome ?? '—' }));
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [modal, confirmar] = useConfirmacao();
  const [situacao, setSituacao] = React.useState('');

  const aprovar = async (c) => {
    const ok = await confirmar({
      titulo: `Aprovar o fechamento de ${c.operador}?`,
      texto: `Diferença de ${moeda(c.divergencia)}. Justificativa: ${c.justificativa ?? 'não informada'}.`,
      rotuloConfirmar: 'Aprovar fechamento',
    });
    if (ok && (await salvarComAviso('caixas', c.id, { situacao: 'FECHADO' }, 'Fechamento aprovado.'))) recarregar();
  };
  const devolver = async (c) => {
    const motivo = await confirmar({
      titulo: 'Devolver para recontagem?',
      texto: 'O turno continua aberto até a nova contagem.',
      campo: 'Motivo da devolução',
      rotuloConfirmar: 'Devolver',
    });
    if (motivo && (await salvarComAviso('caixas', c.id, { situacao: 'RECONTAGEM', motivoDevolucao: motivo }, 'Fechamento devolvido para recontagem.'))) recarregar();
  };

  const linhas = (dados ?? []).filter((c) => !situacao || c.situacao === situacao);
  return (
    <Pagina titulo='Caixas'>
      <Filtros>
        <CampoSelect
          id='caixaSituacao'
          rotulo='Situação'
          valor={situacao}
          aoMudar={setSituacao}
          opcoes={[['', 'Todas'], ...Object.entries(SITUACAO_CAIXA).map(([k, v]) => [k, v.rotulo])]}
        />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhum caixa nesta seleção.'
        colunas={[
          { titulo: 'Operador', render: (c) => c.operador },
          { titulo: 'Turno', render: (c) => `${diaMes(c.dataAbertura)} · ${TURNO[c.turno] ?? '—'}` },
          { titulo: 'Esperado', classe: 'text-end', render: (c) => moeda(c.saldoApurado) },
          { titulo: 'Contado', classe: 'text-end', render: (c) => moeda(c.saldoContado) },
          { titulo: 'Diferença', classe: 'text-end', render: (c) => (c.divergencia ? moeda(c.divergencia) : '—') },
          {
            titulo: 'Situação',
            render: (c) => (
              <PilulaStatus
                {...rotuloDe(SITUACAO_CAIXA, c.situacao)}
                transicoes={
                  c.situacao === 'A_APROVAR'
                    ? [
                        { rotulo: 'Aprovar fechamento', aoEscolher: () => aprovar(c) },
                        { rotulo: 'Devolver para recontagem', aoEscolher: () => devolver(c) },
                      ]
                    : null
                }
              />
            ),
          },
        ]}
      />
      {modal}
    </Pagina>
  );
}

const SITUACAO_ESTORNO = {
  A_APROVAR: { rotulo: 'A aprovar', tom: 'aviso' },
  ESTORNADO: { rotulo: 'Estornado', tom: 'neutro' },
  CANCELADO: { rotulo: 'Cancelado', tom: 'neutro' },
  RECUSADO: { rotulo: 'Recusado', tom: 'perigo' },
};

// A-17 Cancelamentos e estornos (Administrador aprova) e S-12 Estornos
// (Secretária pede e acompanha). Nenhum estorno acontece com um só par de olhos.
export function Estornos() {
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

const SITUACAO_DOCUMENTO = {
  EMITIDO: { rotulo: 'Emitido', tom: 'sucesso' },
  PENDENTE: { rotulo: 'Pendente', tom: 'aviso' },
  CANCELADO: { rotulo: 'Cancelado', tom: 'neutro' },
};

// A-19 Recibos e NFS-e (Administrador emite NFS-e) e S-11 Recibos (Secretária
// emite recibo). Nenhum documento traz CID ou diagnóstico.
export function DocumentosFiscais() {
  const { sessao } = useSessao();
  const ehAdmin = sessao.usuario.papel === 'ADMINISTRADOR';
  const carregar = async () => {
    const [documentos, titulos, cobrancas] = await Promise.all([
      listar('documentosFiscais', ehAdmin ? { _sort: 'id', _order: 'desc' } : { tipo: 'RECIBO', _sort: 'id', _order: 'desc' }),
      listar('titulosReceber'),
      carregarCobrancasComPaciente(),
    ]);
    const titulo = porId(titulos);
    const cobranca = porId(cobrancas);
    return documentos.map((d) => {
      const cob = cobranca[titulo[d.idTituloReceber]?.idCobranca];
      return { ...d, pagador: cob?.paciente ?? '—', paciente: cob?.paciente ?? '—' };
    });
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [busca, setBusca] = React.useState('');
  const [tipo, setTipo] = React.useState('');
  const [situacao, setSituacao] = React.useState('');
  const linhas = (dados ?? []).filter(
    (d) => corresponde(busca, d.numero, d.pagador) && (!tipo || d.tipo === tipo) && (!situacao || d.situacao === situacao)
  );

  const acoes = (d) => {
    const alvo = d.numero ? `documento ${d.numero}` : 'documento pendente';
    const ver = { tipo: 'ver', alvo, aoClicar: () => emBreve('A visualização do documento') };
    if (d.situacao !== 'EMITIDO') return <AcoesLinha acoes={[ver]} />;
    return <AcoesLinha acoes={[ver, { tipo: 'baixar', alvo, aoClicar: () => emBreve('O download do documento') }]} />;
  };

  return (
    <Pagina
      titulo={ehAdmin ? 'Recibos e NFS-e' : 'Recibos'}
      acoes={
        <button type='button' className='btn btn-primary' onClick={() => emBreve(ehAdmin ? 'A emissão de NFS-e' : 'A emissão de recibo')}>
          {ehAdmin ? 'Emitir NFS-e' : 'Emitir recibo'}
        </button>
      }
    >
      <Filtros>
        <CampoBusca id='docBusca' rotulo='Buscar por número ou pagador' valor={busca} aoMudar={setBusca} />
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
                { titulo: 'Tipo', render: (d) => (d.tipo === 'NFSE' ? 'NFS-e' : 'Recibo') },
                { titulo: 'Pagador', render: (d) => d.pagador },
                { titulo: 'Valor', classe: 'text-end', render: (d) => moeda(d.valor) },
                { titulo: 'Emissão', render: (d) => data(d.dataEmissao) },
                { titulo: 'Situação', render: (d) => <PilulaStatus {...rotuloDe(SITUACAO_DOCUMENTO, d.situacao)} /> },
                { titulo: 'Ações', render: acoes },
              ]
            : [
                { titulo: 'Número', render: (d) => d.numero },
                { titulo: 'Pagador', render: (d) => d.pagador },
                { titulo: 'Paciente', render: (d) => d.paciente },
                { titulo: 'Valor', classe: 'text-end', render: (d) => moeda(d.valor) },
                { titulo: 'Situação', render: (d) => <PilulaStatus {...rotuloDe(SITUACAO_DOCUMENTO, d.situacao)} /> },
                { titulo: 'Ações', render: acoes },
              ]
        }
      />
    </Pagina>
  );
}

// S-08 · Cobranças do dia, item a item. Sem soma do dia, sem subtotal por meio
// ou por médico e sem gráfico (RC06, regra de derivação).
export function CobrancasDoDia() {
  const navigate = useNavigate();
  const carregar = async () => {
    const [cobrancas, procedimentos] = await Promise.all([carregarCobrancasComPaciente(), listar('procedimentos')]);
    const proc = porId(procedimentos);
    const medicos = await pessoasPorId(cobrancas.map((c) => c.consulta?.idMedico));
    return cobrancas
      .filter((c) => c.dataEmissao === DATA_DE_HOJE)
      .map((c) => ({
        ...c,
        idMedico: c.consulta?.idMedico,
        medico: medicos[c.consulta?.idMedico]?.nome,
        procedimento: c.consulta?.idConvenio ? 'Coparticipação' : proc[c.consulta?.idProcedimento]?.nome ?? '—',
      }));
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  const [medico, setMedico] = React.useState('');
  const [situacao, setSituacao] = React.useState('');
  const opcoesMedico = [['', 'Todos os médicos'], ...[...new Map((dados ?? []).filter((c) => c.idMedico).map((c) => [String(c.idMedico), c.medico])).entries()]];
  const linhas = (dados ?? []).filter((c) => (!medico || String(c.idMedico) === medico) && (!situacao || c.situacao === situacao));

  return (
    <Pagina titulo='Cobranças do dia'>
      <Filtros>
        <CampoSelect id='cobMedico' rotulo='Médico' valor={medico} aoMudar={setMedico} opcoes={opcoesMedico} />
        <CampoSelect id='cobSituacao' rotulo='Situação' valor={situacao} aoMudar={setSituacao} opcoes={[['', 'Todas'], ['ABERTA', 'Em aberto'], ['PAGA', 'Paga']]} />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhuma cobrança emitida hoje nesta seleção.'
        colunas={[
          { titulo: 'Paciente', render: (c) => c.paciente },
          { titulo: 'Procedimento', render: (c) => c.procedimento },
          { titulo: 'Valor de tabela', classe: 'text-end', render: (c) => moeda(c.valorTotal) },
          { titulo: 'Situação', render: (c) => <PilulaStatus {...rotuloDe(SITUACAO_TITULO, c.situacao)} /> },
          {
            titulo: '',
            render: (c) =>
              c.situacao === 'PAGA' ? (
                <button type='button' className='btn btn-link btn-sm p-0' onClick={() => navigate('/secretaria/recibos')}>
                  Recibo
                </button>
              ) : (
                <button type='button' className='btn btn-sm btn-outline-primary' onClick={() => navigate('/secretaria/checkout')}>
                  Receber
                </button>
              ),
          },
        ]}
      />
    </Pagina>
  );
}
