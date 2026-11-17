import React from 'react';

import CalendarMonthOutlinedIcon from '@mui/icons-material/CalendarMonthOutlined';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import Pagina from '../../components/pagina';
import CabecalhoCartao from '../../components/cabecalho-cartao';
import Esqueleto from '../../components/esqueleto';
import EstadoErro from '../../components/estado-erro';
import { DATA_DE_HOJE } from '../../config/axios';
import { listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';

const DIAS_DA_SEMANA = [
  ['Dom', 'Domingo'],
  ['Seg', 'Segunda-feira'],
  ['Ter', 'Terça-feira'],
  ['Qua', 'Quarta-feira'],
  ['Qui', 'Quinta-feira'],
  ['Sex', 'Sexta-feira'],
  ['Sáb', 'Sábado'],
];

const NOME_DO_MES = new Intl.DateTimeFormat('pt-BR', { month: 'long', timeZone: 'UTC' });
const doisDigitos = (n) => String(n).padStart(2, '0');

// O mês vem como "2026-09". As contas de data são em UTC, para não sofrer com fuso.
const partes = (anoMes) => anoMes.split('-').map(Number);
const somarMeses = (anoMes, n) => {
  const [ano, mes] = partes(anoMes);
  return new Date(Date.UTC(ano, mes - 1 + n, 1)).toISOString().slice(0, 7);
};

// Semanas de domingo a sábado; os dias de fora do mês ficam vazios (null).
function semanasDoMes(anoMes) {
  const [ano, mes] = partes(anoMes);
  const primeiroDia = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const dias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const celulas = [...Array(primeiroDia).fill(null), ...Array.from({ length: dias }, (_, i) => i + 1)];
  while (celulas.length % 7) celulas.push(null);
  const semanas = [];
  for (let i = 0; i < celulas.length; i += 7) semanas.push(celulas.slice(i, i + 7));
  return { semanas, dias };
}

// A-07, S-02 e M-03 · Agenda, visão Mês: quantas consultas cada dia tem, sem
// nomes. Conta todas as marcadas no dia, como o Painel do dia. O Médico vê só
// as dele, porque a API só entrega essas a ele.
function Agenda() {
  const { sessao } = useSessao();
  const ehMedico = sessao.usuario.papel === 'MEDICO';
  const mesDeHoje = DATA_DE_HOJE.slice(0, 7);
  const [mes, setMes] = React.useState(mesDeHoje);
  const { semanas, dias } = semanasDoMes(mes);
  const { dados, carregando, erro, recarregar } = useCarregar(async () => {
    const consultas = await listar('consultas', { dataHora_gte: `${mes}-01T00:00:00`, dataHora_lte: `${mes}-${doisDigitos(dias)}T23:59:59` });
    const porDia = {};
    for (const c of consultas) {
      const dia = Number(c.dataHora.slice(8, 10));
      porDia[dia] = (porDia[dia] ?? 0) + 1;
    }
    return { porDia, total: consultas.length };
  }, [mes]);

  const [ano, numeroDoMes] = partes(mes);
  const nomeDoMes = NOME_DO_MES.format(new Date(Date.UTC(ano, numeroDoMes - 1, 1)));
  const titulo = `${nomeDoMes[0].toUpperCase()}${nomeDoMes.slice(1)} de ${ano}`;

  const navegacao = (
    <div className='d-flex align-items-center gap-1'>
      <button type='button' className='btn btn-sm btn-outline-secondary' aria-label='Mês anterior' onClick={() => setMes(somarMeses(mes, -1))}>
        <ChevronLeftIcon fontSize='small' aria-hidden='true' />
      </button>
      <button type='button' className='btn btn-sm btn-outline-secondary' onClick={() => setMes(mesDeHoje)}>
        Hoje
      </button>
      <button type='button' className='btn btn-sm btn-outline-secondary' aria-label='Próximo mês' onClick={() => setMes(somarMeses(mes, 1))}>
        <ChevronRightIcon fontSize='small' aria-hidden='true' />
      </button>
    </div>
  );

  let calendario;
  if (erro) calendario = <EstadoErro erro={erro} aoTentarDeNovo={recarregar} />;
  else if (carregando) calendario = <Esqueleto linhas={4} />;
  else {
    calendario = (
      <table className='calendario'>
        <caption className='visually-hidden'>Consultas por dia em {titulo}</caption>
        <thead>
          <tr>
            {DIAS_DA_SEMANA.map(([curto, longo]) => (
              <th key={curto} scope='col'>
                <span aria-hidden='true'>{curto}</span>
                <span className='visually-hidden'>{longo}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {semanas.map((semana, i) => (
            <tr key={i}>
              {semana.map((dia, j) => {
                if (!dia) return <td key={j} />;
                const hoje = `${mes}-${doisDigitos(dia)}` === DATA_DE_HOJE;
                const quantas = dados?.porDia[dia] ?? 0;
                return (
                  <td key={j} className={hoje ? 'hoje' : undefined} aria-current={hoje ? 'date' : undefined}>
                    <span className='calendario-dia'>
                      {dia}
                      {hoje && <span className='visually-hidden'>, hoje</span>}
                    </span>{' '}
                    {quantas > 0 && (
                      <span className='calendario-contagem'>
                        {quantas}
                        <span className='visually-hidden'> {quantas === 1 ? 'consulta' : 'consultas'}</span>
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <Pagina titulo={ehMedico ? 'Minha agenda' : 'Agenda da clínica'}>
      <div className='card card-body d-flex flex-column gap-3'>
        <CabecalhoCartao
          icone={CalendarMonthOutlinedIcon}
          titulo={titulo}
          contador={carregando || erro ? undefined : dados?.total}
          legenda={ehMedico ? 'Suas consultas marcadas, por dia.' : 'Consultas marcadas por dia, de todos os médicos.'}
          acoes={navegacao}
        />
        {/* Ao trocar de mês, o leitor de tela ouve o mês novo. */}
        <p className='visually-hidden' aria-live='polite'>
          {titulo}
        </p>
        {calendario}
      </div>
      <p className='small text-body-secondary mb-0'>As visões de dia e de semana entram numa próxima etapa.</p>
    </Pagina>
  );
}

export default Agenda;
