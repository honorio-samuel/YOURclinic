import React from 'react';
import { Link } from 'react-router-dom';

import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import MeetingRoomOutlinedIcon from '@mui/icons-material/MeetingRoomOutlined';
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import { DATA_DE_HOJE } from '../../config/axios';
import { listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { data, diasEntre } from '../../utils/formatos';
import { STATUS_CONSULTA } from '../../utils/rotulos';
import { PRAZO_TITULAR } from './comum';

// Status que viram indicador, com o ícone do chip.
const INDICADORES = [
  ['AGENDADO', EventOutlinedIcon],
  ['NA_RECEPCAO', MeetingRoomOutlinedIcon],
  ['EM_ATENDIMENTO', MedicalServicesOutlinedIcon],
  ['FINALIZADO', TaskAltOutlinedIcon],
];

// A-01 · Início › Painel do dia. Contagens sem nome de paciente e as pendências
// que esperam o Administrador; cada uma leva à tela onde é tratada.
function PainelDoDia() {
  const carregar = async () => {
    const [consultas, estornos, caixas, orcamentos, recursos, solicitacoes, excecoes, contratos] = await Promise.all([
      listar('consultas', { dataHora_gte: `${DATA_DE_HOJE}T00:00:00`, dataHora_lte: `${DATA_DE_HOJE}T23:59:59` }),
      listar('estornos', { situacao: 'A_APROVAR' }),
      listar('caixas', { situacao: 'A_APROVAR' }),
      listar('orcamentos', { etapa: 'APROVACAO' }),
      listar('recursosGlosa', { situacao: 'MANTIDO' }),
      listar('solicitacoesTitular', { situacao: ['ABERTA', 'EM_ANALISE'] }),
      listar('acessosExcecao').then((lista) => lista.filter((e) => !e.revisado)),
      listar('contratosOperadora', { situacao: ['ATIVO', 'VIGENTE'] }),
    ]);
    const porStatus = {};
    for (const c of consultas) porStatus[c.status] = (porStatus[c.status] ?? 0) + 1;
    const menorPrazo = solicitacoes.length
      ? Math.min(...solicitacoes.map((s) => PRAZO_TITULAR - diasEntre(s.dataSolicitacao, DATA_DE_HOJE)))
      : null;
    const vencendo = contratos.filter((c) => diasEntre(DATA_DE_HOJE, c.vigenciaFim) <= 90);
    const pendencias = [
      { id: 1, pendencia: 'Estornos a aprovar', itens: estornos.length, prazo: '—', rota: '/admin/listagem-estornos' },
      { id: 2, pendencia: 'Divergências de caixa', itens: caixas.length, prazo: '—', rota: '/admin/listagem-caixas' },
      { id: 3, pendencia: 'Orçamentos a aprovar', itens: orcamentos.length, prazo: '—', rota: '/admin/listagem-orcamentos' },
      { id: 4, pendencia: 'Recursos de glosa mantidos', itens: recursos.length, prazo: '—', rota: '/admin/listagem-recursos-glosa' },
      { id: 5, pendencia: 'Solicitações de titulares', itens: solicitacoes.length, prazo: menorPrazo === null ? '—' : `${menorPrazo} dias`, rota: '/admin/listagem-solicitacoes' },
      { id: 6, pendencia: 'Acessos de exceção a revisar', itens: excecoes.length, prazo: '—', rota: '/admin/listagem-log-auditoria' },
      { id: 7, pendencia: 'Contratos perto do fim da vigência', itens: vencendo.length, prazo: vencendo.length ? data(vencendo[0].vigenciaFim) : '—', rota: '/admin/listagem-contratos' },
    ];
    return { total: consultas.length, porStatus, pendencias };
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);

  // Enquanto carrega, uma barra ocupa o lugar do número; se a carga falhar,
  // fica um traço, e não um zero que pareceria dado.
  const valorDe = (status) => {
    if (carregando) {
      return (
        <span className='placeholder rounded-pill fs-4' aria-hidden='true'>
          00 de 00
        </span>
      );
    }
    if (!dados) return '—';
    return (
      <>
        <span className='numero fs-4 fw-semibold'>{dados.porStatus[status] ?? 0}</span>{' '}
        <span className='small text-body-secondary'>de {dados.total}</span>
      </>
    );
  };

  return (
    <Pagina titulo='Painel do dia'>
      <div className='card card-body'>
        <dl className={`row row-cols-2 row-cols-md-4 gy-3 mb-0 indicadores${carregando ? ' placeholder-glow' : ''}`}>
          {INDICADORES.map(([status, Icone]) => (
            <div key={status} className='col d-flex align-items-center gap-3'>
              <span className='chip-icone text-bg-dark' aria-hidden='true'>
                <Icone fontSize='small' />
              </span>
              <div>
                <dt className='small fw-normal text-body-secondary'>{STATUS_CONSULTA[status].rotulo} hoje</dt>
                <dd className='mb-0 lh-sm'>{valorDe(status)}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
      <Listagem
        titulo='Pendências'
        icone={PendingActionsOutlinedIcon}
        contador={dados?.pendencias.reduce((soma, p) => soma + p.itens, 0)}
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados?.pendencias ?? []}
        colunas={[
          { titulo: 'Pendência', render: (p) => <span className='fw-semibold'>{p.pendencia}</span> },
          { titulo: 'Itens', classe: 'text-end', render: (p) => p.itens },
          { titulo: 'Prazo', render: (p) => p.prazo },
          {
            titulo: '',
            render: (p) => (
              <Link to={p.rota} className='btn btn-sm btn-outline-secondary' aria-label={`Abrir: ${p.pendencia}`}>
                Abrir
              </Link>
            ),
          },
        ]}
      />
      <p className='small text-body-secondary mb-0'>
        {dados ? `${dados.total} consultas marcadas para hoje.` : ''} A fila completa está em{' '}
        <Link to='/admin/listagem-fila-do-dia'>Fila do dia</Link>.
      </p>
    </Pagina>
  );
}

export default PainelDoDia;
