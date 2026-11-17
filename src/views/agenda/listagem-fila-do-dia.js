import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import ViewKanbanOutlinedIcon from '@mui/icons-material/ViewKanbanOutlined';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import Esqueleto from '../../components/esqueleto';
import EstadoErro from '../../components/estado-erro';
import { NomeComAvatar } from '../../components/avatar';
import PilulaStatus from '../../components/pilula-status';
import { CampoSelect, Filtros } from '../../components/campos';
import { emBreve } from '../../components/confirmacao';
import { DATA_DE_HOJE } from '../../config/axios';
import { listar, pessoasPorId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { data, hora } from '../../utils/formatos';
import { carregarConsultas, doDia, opcoesDeMedico, useMudarStatus } from './comum';

// Colunas do quadro: o caminho da consulta e, no fim, as duas saídas.
const COLUNAS_DO_QUADRO = ['AGENDADO', 'NA_RECEPCAO', 'EM_ATENDIMENTO', 'FINALIZADO', 'NAO_COMPARECEU', 'CANCELADO'];

const VISOES = [
  ['lista', 'Lista', ViewListOutlinedIcon],
  ['quadro', 'Quadro', ViewKanbanOutlinedIcon],
];

// A fila em quadro: uma coluna por status do RF22, cada uma na ordem do
// horário. Mostra o mesmo que a lista, com as mesmas ações; o status muda pela
// pílula, sem arrastar. A rolagem lateral recebe foco para andar pelo teclado.
function QuadroDaFila({ linhas, transicoes, acaoDa }) {
  return (
    <div className='quadro' role='region' aria-label='Quadro da fila' tabIndex={0}>
      {COLUNAS_DO_QUADRO.map((status) => {
        const doStatus = linhas.filter((c) => c.status === status);
        return (
          <section key={status} className='quadro-coluna' aria-labelledby={`coluna-${status}`}>
            <h2 id={`coluna-${status}`} className='h6 d-flex align-items-center gap-2 mb-0'>
              <PilulaStatus estado={status} />{' '}
              <span className='badge rounded-pill bg-body text-body'>{doStatus.length}</span>
            </h2>
            {doStatus.length === 0 && <p className='small text-body-secondary mb-0'>Nenhuma consulta.</p>}
            {doStatus.map((c) => {
              const opcoes = transicoes(c);
              const acao = acaoDa(c);
              return (
                <article key={c.id} className='card card-body quadro-cartao'>
                  <NomeComAvatar nome={c.paciente} />
                  <p className='small text-body-secondary mb-0'>
                    {hora(c.dataHora)} · {c.medico}
                    <br />
                    {c.atendimento}
                  </p>
                  {(opcoes || acao) && (
                    <div className='d-flex flex-wrap align-items-center gap-2'>
                      {opcoes && <PilulaStatus estado={c.status} transicoes={opcoes} />}
                      {acao}
                    </div>
                  )}
                </article>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}

async function carregarPendenciasRecepcao(consultasDoDia) {
  const [notificacoes, alertas, representacoes] = await Promise.all([
    listar('notificacoes', { situacao: 'FALHOU' }),
    listar('alertasEstoque', { situacao: 'ABERTO' }),
    listar('representacoes'),
  ]);
  const pessoas = await pessoasPorId(representacoes.map((r) => r.idPaciente));
  const maiores = representacoes.filter((r) => {
    const nasc = pessoas[r.idPaciente]?.dataNascimento;
    return !r.fimVigencia && nasc && Number(DATA_DE_HOJE.slice(0, 4)) - Number(nasc.slice(0, 4)) >= 18 && nasc.slice(5) <= DATA_DE_HOJE.slice(5);
  });
  const convenioAConferir = (consultasDoDia ?? []).filter(
    (c) => c.idConvenio && ['AGENDADO', 'NA_RECEPCAO'].includes(c.status)
  );
  return [
    { id: 1, pendencia: 'Convênios a conferir', itens: convenioAConferir.length, rota: '/secretaria/listagem-elegibilidades', acao: 'Abrir' },
    { id: 2, pendencia: 'Notificações sem entrega', itens: notificacoes.length, rota: null, acao: 'Reenviar ou ligar' },
    { id: 3, pendencia: 'Titulares a habilitar por maioridade', itens: maiores.length, rota: '/secretaria/listagem-pacientes', acao: 'Abrir' },
    { id: 4, pendencia: 'Alertas de estoque', itens: alertas.length, rota: '/secretaria/listagem-alertas', acao: 'Abrir' },
  ];
}

// S-06 Fila do dia e A-09 Fila do dia · leitura. Nenhuma coluna, cor ou ordem
// deriva de conteúdo clínico (RN-22.2). A Secretária faz check-in, marca Não
// compareceu e cancela; nunca move para Em atendimento (D1).
function FilaDoDia() {
  const { sessao } = useSessao();
  const navigate = useNavigate();
  const ehSecretaria = sessao.usuario.papel === 'SECRETARIA';
  const { dados, carregando, erro, recarregar } = useCarregar(() => carregarConsultas(doDia(DATA_DE_HOJE)));
  const pend = useCarregar(() => (ehSecretaria && dados ? carregarPendenciasRecepcao(dados) : Promise.resolve(null)), [dados]);
  const [modal, mudar] = useMudarStatus(recarregar);
  const [medico, setMedico] = React.useState('');
  const [visao, setVisao] = React.useState('lista');
  const linhas = (dados ?? []).filter((c) => !medico || String(c.idMedico) === medico);

  const transicoes = (c) => {
    if (!ehSecretaria) return null;
    const cancelar = {
      rotulo: 'Cancelar consulta',
      aoEscolher: () =>
        mudar(c, 'CANCELADO', {
          titulo: `Cancelar a consulta de ${c.paciente}?`,
          texto: 'O paciente recebe o aviso de cancelamento. A consulta fica no histórico como cancelada pela clínica.',
          rotuloConfirmar: 'Cancelar consulta',
          perigo: true,
        }),
    };
    const faltou = { rotulo: 'Não compareceu', aoEscolher: () => mudar(c, 'NAO_COMPARECEU') };
    if (c.status === 'AGENDADO') return [{ rotulo: 'Fazer check-in', aoEscolher: () => mudar(c, 'NA_RECEPCAO') }, faltou, cancelar];
    if (c.status === 'NA_RECEPCAO') return [faltou, cancelar];
    return null;
  };

  // Depois de finalizada, a consulta vai para a cobrança (só a Secretária cobra).
  const acaoDa = (c) =>
    ehSecretaria && c.status === 'FINALIZADO' ? (
      <button type='button' className='btn btn-sm btn-outline-secondary' onClick={() => navigate('/secretaria/listagem-cobrancas')}>
        Cobrar
      </button>
    ) : null;

  const colunas = [
    { titulo: 'Paciente', render: (c) => <NomeComAvatar nome={c.paciente} /> },
    { titulo: 'Horário', render: (c) => hora(c.dataHora) },
    { titulo: 'Médico', render: (c) => c.medico },
    { titulo: 'Atendimento', render: (c) => c.atendimento },
    { titulo: 'Status', render: (c) => <PilulaStatus estado={c.status} transicoes={transicoes(c)} /> },
  ];
  if (ehSecretaria) colunas.push({ titulo: '', render: (c) => acaoDa(c) ?? '—' });

  let conteudo;
  if (visao === 'lista') {
    conteudo = (
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        itensPorPagina={50}
        vazio='Nenhuma consulta marcada para hoje.'
        colunas={colunas}
      />
    );
  } else if (erro) {
    conteudo = <EstadoErro erro={erro} aoTentarDeNovo={recarregar} />;
  } else if (carregando) {
    conteudo = (
      <div className='card card-body'>
        <Esqueleto />
      </div>
    );
  } else {
    conteudo = <QuadroDaFila linhas={linhas} transicoes={transicoes} acaoDa={acaoDa} />;
  }

  return (
    <Pagina titulo={ehSecretaria ? 'Fila do dia' : 'Fila do dia · leitura'}>
      <div className='d-flex flex-wrap align-items-end justify-content-between gap-3'>
        <Filtros>
          <CampoSelect id='filaMedico' rotulo='Médico' valor={medico} aoMudar={setMedico} opcoes={opcoesDeMedico(dados)} />
          <div className='filtro'>
            <span className='form-label d-block'>Data</span>
            <span className='form-control-plaintext'>Hoje, {data(DATA_DE_HOJE)}</span>
          </div>
        </Filtros>
        {/* Lista ou quadro: os mesmos dados, em duas arrumações. */}
        <ul className='nav nav-tabs align-self-end' aria-label='Visão da fila'>
          {VISOES.map(([chave, rotulo, Icone]) => (
            <li key={chave} className='nav-item'>
              <button
                type='button'
                className={`nav-link d-flex align-items-center gap-1${visao === chave ? ' active' : ''}`}
                aria-pressed={visao === chave}
                onClick={() => setVisao(chave)}
              >
                <Icone fontSize='small' aria-hidden='true' />
                {rotulo}
              </button>
            </li>
          ))}
        </ul>
      </div>
      {conteudo}
      {ehSecretaria && (
        <Listagem
          titulo='Pendências da recepção'
          icone={PendingActionsOutlinedIcon}
          carregando={pend.carregando}
          erro={pend.erro}
          linhas={pend.dados ?? []}
          colunas={[
            { titulo: 'Pendência', render: (p) => p.pendencia },
            { titulo: 'Itens', classe: 'text-end', render: (p) => p.itens },
            {
              titulo: '',
              render: (p) =>
                p.rota ? (
                  <Link to={p.rota} className='btn btn-sm btn-outline-secondary'>
                    {p.acao}
                  </Link>
                ) : (
                  <button type='button' className='btn btn-sm btn-outline-secondary' onClick={() => emBreve('O reenvio de notificações')}>
                    {p.acao}
                  </button>
                ),
            },
          ]}
        />
      )}
      {modal}
    </Pagina>
  );
}

export default FilaDoDia;
