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
import { carregarConsultas, doDia, opcoesDeMedico, useMudarStatus } from './comum';

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
    { id: 1, pendencia: 'Convênios a conferir', itens: convenioAConferir.length, rota: '/secretaria/elegibilidade', acao: 'Abrir' },
    { id: 2, pendencia: 'Notificações sem entrega', itens: notificacoes.length, rota: null, acao: 'Reenviar ou ligar' },
    { id: 3, pendencia: 'Titulares a habilitar por maioridade', itens: maiores.length, rota: '/secretaria/pacientes', acao: 'Abrir' },
    { id: 4, pendencia: 'Alertas de estoque', itens: alertas.length, rota: '/secretaria/alertas', acao: 'Abrir' },
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

  const colunas = [
    { titulo: 'Paciente', render: (c) => c.paciente },
    { titulo: 'Horário', render: (c) => hora(c.dataHora) },
    { titulo: 'Médico', render: (c) => c.medico },
    { titulo: 'Atendimento', render: (c) => c.atendimento },
    { titulo: 'Status', render: (c) => <PilulaStatus estado={c.status} transicoes={transicoes(c)} /> },
  ];
  if (ehSecretaria) {
    colunas.push({
      titulo: '',
      render: (c) =>
        c.status === 'FINALIZADO' ? (
          <button type='button' className='btn btn-link btn-sm p-0' onClick={() => navigate('/secretaria/cobrancas')}>
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
