import React from 'react';
import { Link } from 'react-router-dom';

import EventOutlinedIcon from '@mui/icons-material/EventOutlined';
import MeetingRoomOutlinedIcon from '@mui/icons-material/MeetingRoomOutlined';
import MedicalServicesOutlinedIcon from '@mui/icons-material/MedicalServicesOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import CabecalhoCartao from '../../components/cabecalho-cartao';
import Esqueleto from '../../components/esqueleto';
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

// Faixa de horas do gráfico: a grade dos médicos vai das 8h às 17h, então a
// última consulta começa às 16h. Consulta fora dessa faixa alarga o gráfico.
const PRIMEIRA_HORA = 8;
const ULTIMA_HORA = 16;
// A barra mais alta ocupa 80% da área, e o número cabe acima dela.
const ALTURA_MAXIMA = 80;

// "8h", "8h e 9h", "8h, 9h e 10h".
const juntar = (itens) => (itens.length > 1 ? `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}` : itens[0]);

// Consultas de hoje por hora, só com CSS. O desenho fica fora da leitura de
// tela, que recebe a tabela oculta com os mesmos números; o pico vai em texto
// na legenda, e não só na cor da barra.
function GraficoPorHorario({ porHora, carregando }) {
  const horas = Object.keys(porHora ?? {}).map(Number);
  const barras = [];
  for (let h = Math.min(PRIMEIRA_HORA, ...horas); h <= Math.max(ULTIMA_HORA, ...horas); h += 1) barras.push([h, porHora?.[h] ?? 0]);
  const maior = Math.max(0, ...barras.map(([, n]) => n));
  const picos = maior ? barras.filter(([, n]) => n === maior).map(([h]) => `${h}h`) : [];
  const legenda = picos.length ? `Pico às ${juntar(picos)}, com ${maior} ${maior === 1 ? 'consulta' : 'consultas'}.` : 'Nenhuma consulta marcada para hoje.';

  return (
    <div className='card card-body h-100 d-flex flex-column gap-3'>
      <CabecalhoCartao icone={ScheduleOutlinedIcon} titulo='Consultas por horário' legenda={carregando ? undefined : legenda} />
      {carregando ? (
        <Esqueleto />
      ) : (
        <>
          <div className='grafico-horas' aria-hidden='true'>
            {barras.map(([h, n]) => {
              const altura = maior ? (n / maior) * ALTURA_MAXIMA : 0;
              return (
                <div key={h} className='grafico-coluna'>
                  <span className='grafico-area'>
                    {n > 0 && (
                      <span className='grafico-valor' style={{ bottom: `calc(${altura}% + 0.25rem)` }}>
                        {n}
                      </span>
                    )}
                    <span className={`grafico-barra${n === maior && n > 0 ? ' pico' : ''}`} style={{ height: `${altura}%` }} />
                  </span>
                  <span className='grafico-hora'>{h}h</span>
                </div>
              );
            })}
          </div>
          <table className='visually-hidden'>
            <caption>Consultas de hoje por horário</caption>
            <thead>
              <tr>
                <th scope='col'>Horário</th>
                <th scope='col'>Consultas</th>
              </tr>
            </thead>
            <tbody>
              {barras.map(([h, n]) => (
                <tr key={h}>
                  <th scope='row'>{h}h</th>
                  <td>{n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

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
    const porHora = {};
    for (const c of consultas) {
      porStatus[c.status] = (porStatus[c.status] ?? 0) + 1;
      const h = Number(c.dataHora.slice(11, 13));
      porHora[h] = (porHora[h] ?? 0) + 1;
    }
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
    return { total: consultas.length, porStatus, porHora, pendencias };
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
    const quantos = dados.porStatus[status] ?? 0;
    return (
      <>
        <span className='numero fs-4 fw-semibold'>{quantos}</span> <span className='small text-body-secondary'>de {dados.total}</span>
        {/* A barra repete o "de {total}" em forma de proporção; o texto já diz o número. */}
        <span className='progress progresso mt-2' aria-hidden='true'>
          <span className='progress-bar' style={{ width: `${dados.total ? (quantos / dados.total) * 100 : 0}%` }} />
        </span>
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
              <div className='flex-grow-1'>
                <dt className='small fw-normal text-body-secondary'>{STATUS_CONSULTA[status].rotulo} hoje</dt>
                <dd className='mb-0 lh-sm'>{valorDe(status)}</dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
      <div className='row g-3'>
        <div className={carregando || dados ? 'col-xl-7' : 'col-12'}>
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
        </div>
        {/* Com erro de carga, o aviso da listagem basta; o gráfico não aparece vazio. */}
        {(carregando || dados) && (
          <div className='col-xl-5'>
            <GraficoPorHorario porHora={dados?.porHora} carregando={carregando} />
          </div>
        )}
      </div>
      <p className='small text-body-secondary mb-0'>
        {dados ? `${dados.total} consultas marcadas para hoje.` : ''} A fila completa está em{' '}
        <Link to='/admin/listagem-fila-do-dia'>Fila do dia</Link>.
      </p>
    </Pagina>
  );
}

export default PainelDoDia;
