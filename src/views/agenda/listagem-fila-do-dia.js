import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import { CampoSelect, Filtros } from '../../components/campos';
import { emBreve } from '../../components/confirmacao';
import { DATA_DE_HOJE } from '../../config/axios';
import { listar, pessoasPorId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { data, hora } from '../../utils/formatos';
import { agoraDaClinica, carregarConsultas, doDia, MOTIVOS_DA_CLINICA, opcoesDeMedico, useMudarStatus } from './comum';

// Espera: da chegada (Na Recepção) ao chamado (Em Atendimento), pelos
// carimbos da API; enquanto espera, conta até agora.
function espera(c, agora) {
  const k = c.carimbos ?? {};
  if (!k.NA_RECEPCAO) return '—';
  const fim = k.EM_ATENDIMENTO ?? (c.status === 'NA_RECEPCAO' ? agora : null);
  if (!fim) return '—';
  const minutos = Math.max(0, Math.round((Date.parse(fim) - Date.parse(k.NA_RECEPCAO)) / 60000));
  const texto = minutos >= 60 ? `${Math.floor(minutos / 60)} h ${minutos % 60} min` : `${minutos} min`;
  return c.status === 'NA_RECEPCAO' ? `${texto}, esperando` : texto;
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
  const linhas = (dados ?? []).filter((c) => !medico || String(c.idMedico) === medico);
  const agora = `${agoraDaClinica()}:00`;

  // RNF15: a fila se atualiza sozinha a cada X28 segundos.
  const [intervalo, setIntervalo] = React.useState(30);
  React.useEffect(() => {
    listar('parametros', { chave: 'X28' })
      .then((p) => setIntervalo(Number(p[0]?.valor) || 30))
      .catch(() => {});
  }, []);
  React.useEffect(() => {
    const relogio = setInterval(recarregar, intervalo * 1000);
    return () => clearInterval(relogio);
  }, [recarregar, intervalo]);

  const transicoes = (c) => {
    if (!ehSecretaria) return null;
    const cancelar = {
      rotulo: 'Cancelar consulta',
      aoEscolher: () =>
        mudar(c, 'CANCELADO', {
          titulo: `Cancelar a consulta de ${c.paciente}?`,
          texto: 'O paciente recebe o aviso de cancelamento. A consulta fica no histórico como cancelada pela clínica.',
          motivos: MOTIVOS_DA_CLINICA,
          rotuloMotivo: 'Motivo do cancelamento',
          rotuloConfirmar: 'Cancelar consulta',
          perigo: true,
        }),
    };
    const faltou = { rotulo: 'Não compareceu', aoEscolher: () => mudar(c, 'NAO_COMPARECEU') };
    if (c.status === 'AGENDADO') return [{ rotulo: 'Fazer check-in', aoEscolher: () => mudar(c, 'NA_RECEPCAO') }, faltou, cancelar];
    if (c.status === 'NA_RECEPCAO') return [faltou, cancelar];
    return null;
  };

  const colunas = [
    { titulo: 'Paciente', render: (c) => c.paciente },
    { titulo: 'Horário', render: (c) => hora(c.dataHora) },
    { titulo: 'Espera', render: (c) => espera(c, agora) },
    { titulo: 'Médico', render: (c) => c.medico },
    { titulo: 'Atendimento', render: (c) => c.atendimento },
    { titulo: 'Status', render: (c) => <PilulaStatus estado={c.status} transicoes={transicoes(c)} /> },
  ];
  if (ehSecretaria) {
    colunas.push({
      titulo: '',
      render: (c) =>
        c.status === 'FINALIZADO' ? (
          <button type='button' className='btn btn-link btn-sm p-0' onClick={() => navigate(`/secretaria/checkout?consulta=${c.id}`)}>
            Cobrar
          </button>
        ) : (
          '—'
        ),
    });
  }

  return (
    <Pagina titulo={ehSecretaria ? 'Fila do dia' : 'Fila do dia · leitura'}>
      <Filtros>
        <CampoSelect id='filaMedico' rotulo='Médico' valor={medico} aoMudar={setMedico} opcoes={opcoesDeMedico(dados)} />
        <div className='filtro'>
          <span className='form-label d-block'>Data</span>
          <span className='form-control-plaintext'>Hoje, {data(DATA_DE_HOJE)}</span>
        </div>
        <p className='small text-body-secondary mb-2'>Atualiza sozinha a cada {intervalo} s.</p>
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        itensPorPagina={50}
        vazio='Nenhuma consulta marcada para hoje.'
        colunas={colunas}
      />
      {ehSecretaria && (
        <Listagem
          titulo='Pendências da recepção'
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
                  <Link to={p.rota}>{p.acao}</Link>
                ) : (
                  <button type='button' className='btn btn-link btn-sm p-0' onClick={() => emBreve('O reenvio de notificações')}>
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
