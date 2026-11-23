import React from 'react';
import { Link } from 'react-router-dom';

import AcoesLinha from '../../components/acoes-linha';
import { DATA_DE_HOJE } from '../../config/axios';
import { data as dataBR, diaMes, hora } from '../../utils/formatos';
import { MOTIVO_BLOQUEIO, STATUS_CONSULTA } from '../../utils/rotulos';
import { DIAS_CURTOS, DIAS_DA_SEMANA, diaDaSemana, horaDe, inicioDaSemana, minutosDe, nomeDoMes, somarDias, ultimoDiaDoMes } from './comum';

// Visões da agenda (A-07, A-07b, A-07c, A-07d, S-02, M-03). Nenhuma cor ou
// texto deriva de conteúdo clínico: a consulta aparece com horário, paciente,
// "Consulta" ou "Procedimento", particular ou convênio, e o status (RC02).
// dados: { medicos, grades, bloqueios, consultas, livres }.

const inicioDe = (c) => minutosDe(c.dataHora.slice(11, 16));
const fimDe = (c) => inicioDe(c) + (c.duracao ?? 30);
const doMedicoNoDia = (consultas, idMedico, dia) => consultas.filter((c) => c.idMedico === idMedico && c.dataHora.startsWith(dia));
const periodosDe = (grades, idMedico, dia) => grades.filter((g) => g.idMedico === idMedico && g.diaSemana === diaDaSemana(dia));
const atende = (grades, idMedico, dia) => periodosDe(grades, idMedico, dia).length > 0;
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// Bloqueio do médico ou da clínica inteira que toca o intervalo [ini, fim) do dia.
function bloqueioEm(bloqueios, idMedico, dia, ini = 0, fim = 24 * 60) {
  const de = `${dia}T${horaDe(ini)}:00`;
  const ate = fim >= 24 * 60 ? `${dia}T23:59:59` : `${dia}T${horaDe(fim)}:00`;
  return bloqueios.find((b) => (b.idMedico === null || b.idMedico === idMedico) && b.dataInicio < ate && de < b.dataFim);
}

const nomeDoBloqueio = (b) => MOTIVO_BLOQUEIO[b.motivo] ?? 'Bloqueio';

// Linhas de horário que cobrem a grade e as consultas das colunas, no passo da
// menor granularidade entre elas.
function faixaDeHorarios(colunas, { grades, consultas }) {
  let passo = null;
  let ini = null;
  let fim = null;
  for (const { medico, dia } of colunas) {
    const idMedico = medico.id;
    for (const g of periodosDe(grades, idMedico, dia)) {
      passo = Math.min(passo ?? g.granularidade, g.granularidade);
      ini = Math.min(ini ?? Infinity, minutosDe(g.horaInicio));
      fim = Math.max(fim ?? 0, minutosDe(g.horaFim));
    }
    for (const c of doMedicoNoDia(consultas, idMedico, dia)) {
      ini = Math.min(ini ?? Infinity, inicioDe(c));
      fim = Math.max(fim ?? 0, fimDe(c));
    }
  }
  if (ini === null) return { linhas: [], passo: 30 };
  passo = passo ?? 30;
  const linhas = [];
  for (let t = Math.floor(ini / passo) * passo; t < fim; t += passo) linhas.push(t);
  return { linhas, passo };
}

function estadoDaCelula({ idMedico, dia, t, passo, dados, agora }) {
  const fim = t + passo;
  const doDia = doMedicoNoDia(dados.consultas, idMedico, dia);
  const comecam = doDia.filter((c) => inicioDe(c) >= t && inicioDe(c) < fim);
  if (comecam.length) return { tipo: 'consultas', consultas: comecam };
  if (doDia.some((c) => inicioDe(c) < t && fimDe(c) > t)) return { tipo: 'continuacao' };
  const bloqueio = bloqueioEm(dados.bloqueios, idMedico, dia, t, fim);
  if (bloqueio) return { tipo: 'bloqueio', bloqueio };
  const naGrade = periodosDe(dados.grades, idMedico, dia).some((g) => minutosDe(g.horaInicio) <= t && fim <= minutosDe(g.horaFim));
  if (!naGrade) return { tipo: 'fora' };
  return { tipo: `${dia}T${horaDe(t)}` < agora ? 'passado' : 'livre' };
}

function ItemConsulta({ consulta: c, acoes }) {
  const daConsulta = acoes?.daConsulta && c.status === 'AGENDADO' ? acoes.daConsulta(c) : null;
  return (
    <div className='agenda-item'>
      <div className='d-flex justify-content-between align-items-start gap-1'>
        <span>
          <span className='fw-semibold'>{hora(c.dataHora)}</span> {c.paciente}
        </span>
        {daConsulta && <AcoesLinha acoes={daConsulta} />}
      </div>
      <div className='small text-body-secondary'>
        {c.atendimento} · {STATUS_CONSULTA[c.status]?.rotulo ?? c.status}
      </div>
    </div>
  );
}

function Celula({ estado, dia, t, medico, acoes }) {
  switch (estado.tipo) {
    case 'consultas':
      return (
        <td className='agenda-ocupado'>
          {estado.consultas.map((c) => (
            <ItemConsulta key={c.id} consulta={c} acoes={acoes} />
          ))}
        </td>
      );
    case 'continuacao':
      return (
        <td className='agenda-ocupado'>
          <span className='small text-body-secondary'>Em consulta</span>
        </td>
      );
    case 'bloqueio':
      return (
        <td className='agenda-bloqueio'>
          <span className='small'>Bloqueado · {nomeDoBloqueio(estado.bloqueio)}</span>
        </td>
      );
    case 'fora':
      return (
        <td className='agenda-fora'>
          <span className='visually-hidden'>Fora da grade</span>
        </td>
      );
    case 'passado':
      return (
        <td>
          <span className='small text-body-secondary' aria-hidden='true'>
            —
          </span>
          <span className='visually-hidden'>Horário que já passou</span>
        </td>
      );
    default:
      return (
        <td>
          {acoes?.agendar ? (
            <Link to={acoes.agendar(medico.id, dia, horaDe(t))} className='small'>
              Livre
              <span className='visually-hidden'>
                : agendar {DIAS_DA_SEMANA[diaDaSemana(dia)].toLowerCase()}, {diaMes(dia)}, às {horaDe(t)} com {medico.nome}
              </span>
            </Link>
          ) : (
            <span className='small text-success-emphasis'>Livre</span>
          )}
        </td>
      );
  }
}

function Legenda() {
  return (
    <p className='small text-body-secondary mb-0'>
      <span className='amostra agenda-ocupado' aria-hidden='true' /> Consulta ·{' '}
      <span className='amostra agenda-bloqueio' aria-hidden='true' /> Bloqueado ·{' '}
      <span className='amostra agenda-fora' aria-hidden='true' /> Fora da grade. "Livre" é horário da grade ainda sem consulta.
    </p>
  );
}

// Grade de horários: linhas de horário e uma coluna por médico (Dia) ou por
// dia (Semana de um médico).
function TabelaDeHorarios({ legenda, colunas, dados, acoes, agora }) {
  const { linhas, passo } = faixaDeHorarios(colunas, dados);
  return (
    <div className='card'>
      <div className='table-responsive'>
        <table className='table table-bordered mb-0 agenda-tabela'>
          <caption className='visually-hidden'>{legenda}</caption>
          <thead>
            <tr>
              <th scope='col' className='agenda-hora'>
                Horário
              </th>
              {colunas.map((c) => (
                <th key={c.chave} scope='col'>
                  {c.titulo}
                  {c.subtitulo && <span className='d-block small fw-normal text-body-secondary'>{c.subtitulo}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {linhas.map((t) => (
              <tr key={t}>
                <th scope='row' className='agenda-hora'>
                  {horaDe(t).replace(':', 'h')}
                </th>
                {colunas.map((c) => (
                  <Celula
                    key={c.chave}
                    estado={estadoDaCelula({ idMedico: c.medico.id, dia: c.dia, t, passo, dados, agora })}
                    dia={c.dia}
                    t={t}
                    medico={c.medico}
                    acoes={acoes}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// A-07 e S-02 · Dia: uma coluna por médico.
export function VisaoDia({ dia, dados, acoes, agora }) {
  const daClinica = dados.bloqueios.filter((b) => b.idMedico === null && bloqueioEm([b], null, dia));
  const colunas = dados.medicos.map((m) => ({ chave: m.id, titulo: m.nome, subtitulo: m.especialidade, medico: m, dia }));
  const vazia = faixaDeHorarios(colunas, dados).linhas.length === 0;
  return (
    <>
      {daClinica.map((b) => (
        <div key={b.id} className='alert alert-warning mb-0' role='status'>
          Bloqueio da clínica inteira neste dia: {nomeDoBloqueio(b)}.
        </div>
      ))}
      {vazia ? (
        <p className='mb-0'>{dados.medicos.length === 1 ? `${dados.medicos[0].nome} não atende` : 'Nenhum médico atende'} neste dia.</p>
      ) : (
        <>
          <TabelaDeHorarios
            legenda={`Agenda de ${DIAS_DA_SEMANA[diaDaSemana(dia)].toLowerCase()}, ${dataBR(dia)}`}
            colunas={colunas}
            dados={dados}
            acoes={acoes}
            agora={agora}
          />
          <Legenda />
        </>
      )}
    </>
  );
}

// Semana de um médico: as colunas são os dias. Sábado e domingo só aparecem
// se houver grade ou consulta neles.
function SemanaDeUmMedico({ de, medico, dados, acoes, agora }) {
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(de, i)).filter(
    (d) => ![0, 6].includes(diaDaSemana(d)) || atende(dados.grades, medico.id, d) || doMedicoNoDia(dados.consultas, medico.id, d).length
  );
  const colunas = dias.map((d) => ({
    chave: d,
    titulo: `${DIAS_CURTOS[diaDaSemana(d)]}, ${diaMes(d)}`,
    subtitulo: d === DATA_DE_HOJE ? 'Hoje' : null,
    medico,
    dia: d,
  }));
  if (faixaDeHorarios(colunas, dados).linhas.length === 0) {
    return <p className='mb-0'>{medico.nome} não tem grade nem consultas nesta semana.</p>;
  }
  return (
    <>
      <TabelaDeHorarios legenda={`Semana de ${medico.nome}`} colunas={colunas} dados={dados} acoes={acoes} agora={agora} />
      <Legenda />
    </>
  );
}

// Semana de todos os médicos: quantas consultas cada um tem por dia. Sábado
// e domingo só aparecem se algum médico tiver grade ou consulta neles.
function SemanaDeTodos({ de, dados, aoAbrirDia }) {
  const dias = Array.from({ length: 7 }, (_, i) => somarDias(de, i)).filter(
    (d) =>
      ![0, 6].includes(diaDaSemana(d)) ||
      dados.medicos.some((m) => atende(dados.grades, m.id, d) || doMedicoNoDia(dados.consultas, m.id, d).length)
  );
  return (
    <div className='card'>
      <div className='table-responsive'>
        <table className='table table-bordered mb-0 agenda-tabela'>
          <caption className='visually-hidden'>Consultas por médico e por dia</caption>
          <thead>
            <tr>
              <th scope='col'>Médico</th>
              {dias.map((d) => (
                <th key={d} scope='col' className={d === DATA_DE_HOJE ? 'calendario-hoje' : undefined}>
                  {DIAS_CURTOS[diaDaSemana(d)]}, {diaMes(d)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dados.medicos.map((m) => (
              <tr key={m.id}>
                <th scope='row'>
                  {m.nome}
                  <span className='d-block small fw-normal text-body-secondary'>{m.especialidade}</span>
                </th>
                {dias.map((d) => {
                  const n = doMedicoNoDia(dados.consultas, m.id, d).length;
                  const bloqueio = bloqueioEm(dados.bloqueios, m.id, d);
                  const grade = atende(dados.grades, m.id, d);
                  if (!grade && !n) {
                    return (
                      <td key={d} className='agenda-fora'>
                        <span className='visually-hidden'>Fora da grade</span>
                      </td>
                    );
                  }
                  return (
                    <td key={d} className={bloqueio ? 'agenda-bloqueio' : n ? 'agenda-ocupado' : undefined}>
                      <button type='button' className='btn btn-link btn-sm p-0 text-start' onClick={() => aoAbrirDia(d, m.id)}>
                        {n ? plural(n, 'consulta', 'consultas') : 'Sem consultas'}
                        <span className='visually-hidden'>
                          {' '}
                          de {m.nome} em {diaMes(d)}: abrir o dia
                        </span>
                      </button>
                      {bloqueio && <span className='d-block small'>{nomeDoBloqueio(bloqueio)}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// A-07c, S-02 e M-03 · Semana: com um médico, a grade de horários; com todos,
// a contagem por médico e por dia.
export function VisaoSemana({ dia, dados, acoes, agora, aoAbrirDia }) {
  const de = inicioDaSemana(dia);
  if (dados.medicos.length === 1) {
    return <SemanaDeUmMedico de={de} medico={dados.medicos[0]} dados={dados} acoes={acoes} agora={agora} />;
  }
  return <SemanaDeTodos de={de} dados={dados} aoAbrirDia={aoAbrirDia} />;
}

// Semanas (de domingo a sábado) que cobrem o mês do dia.
function semanasDoMes(dia) {
  const primeiro = `${dia.slice(0, 7)}-01`;
  const ultimo = ultimoDiaDoMes(dia);
  const semanas = [];
  for (let d = inicioDaSemana(primeiro); d <= ultimo; d = somarDias(d, 7)) {
    semanas.push(Array.from({ length: 7 }, (_, i) => somarDias(d, i)));
  }
  return semanas;
}

// A-07d, S-02 e M-03 · Mês: contagem por dia, sem nome de paciente. Com um
// médico escolhido, a recepção vê também quantos horários ainda estão livres.
export function VisaoMes({ dia, dados, aoAbrirDia }) {
  const mes = dia.slice(0, 7);
  const umMedico = dados.medicos.length === 1 ? dados.medicos[0] : null;
  const ids = new Set(dados.medicos.map((m) => m.id));
  return (
    <div className='card'>
      <div className='table-responsive'>
        <table className='table table-bordered mb-0 calendario-mes'>
          <caption className='visually-hidden'>
            {nomeDoMes(dia)} de {dia.slice(0, 4)}
          </caption>
          <thead>
            <tr>
              {DIAS_CURTOS.map((d, i) => (
                <th key={d} scope='col'>
                  <abbr title={DIAS_DA_SEMANA[i]} className='text-decoration-none'>{d}</abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {semanasDoMes(dia).map((semana) => (
              <tr key={semana[0]}>
                {semana.map((d) => {
                  if (!d.startsWith(mes)) return <td key={d} className='fora-do-mes' />;
                  const n = dados.consultas.filter((c) => ids.has(c.idMedico) && c.dataHora.startsWith(d)).length;
                  const bloqueio = umMedico
                    ? bloqueioEm(dados.bloqueios, umMedico.id, d)
                    : dados.bloqueios.find((b) => b.idMedico === null && bloqueioEm([b], null, d));
                  const livres = dados.livres ? dados.livres[d] : undefined;
                  return (
                    <td key={d} className={d === DATA_DE_HOJE ? 'calendario-hoje' : undefined}>
                      <button type='button' className='calendario-dia' onClick={() => aoAbrirDia(d, umMedico?.id)}>
                        <span className='calendario-numero'>
                          {Number(d.slice(8))}
                          <span className='visually-hidden'>
                            {' '}
                            de {nomeDoMes(d).toLowerCase()}, {DIAS_DA_SEMANA[diaDaSemana(d)].toLowerCase()}
                            {d === DATA_DE_HOJE ? ', hoje' : ''}:
                          </span>
                        </span>
                        {n > 0 && <span className='d-block'>{plural(n, 'consulta', 'consultas')}</span>}
                        {livres > 0 && <span className='d-block text-success-emphasis'>{plural(livres, 'livre', 'livres')}</span>}
                        {bloqueio && <span className='d-block text-warning-emphasis'>{nomeDoBloqueio(bloqueio)}</span>}
                        {!n && !livres && !bloqueio && <span className='visually-hidden'>sem consultas</span>}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// A-07b · Ano: só o Administrador, só contagens, sem nome de paciente. O tom
// do dia acompanha a ocupação, e o número vai em texto para quem não vê cor.
export function VisaoAno({ dia, dados, aoAbrirDia }) {
  const ano = dia.slice(0, 4);
  const porDia = {};
  for (const c of dados.consultas) {
    const d = c.dataHora.slice(0, 10);
    porDia[d] = (porDia[d] ?? 0) + 1;
  }
  const maximo = Math.max(1, ...Object.values(porDia));
  const nivel = (n) => (n ? Math.min(3, Math.ceil((n / maximo) * 3)) : 0);
  const meses = Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, '0')}-01`);
  return (
    <>
      <div className='row row-cols-1 row-cols-sm-2 row-cols-lg-3 row-cols-xxl-4 g-3'>
        {meses.map((m) => {
          const total = Object.entries(porDia)
            .filter(([d]) => d.startsWith(m.slice(0, 7)))
            .reduce((soma, [, n]) => soma + n, 0);
          return (
            <div key={m} className='col'>
              <div className='card card-body ano-mes h-100'>
                <h3 className='h6 d-flex justify-content-between gap-2'>
                  <span>{nomeDoMes(m)}</span>
                  <span className='fw-normal text-body-secondary'>{plural(total, 'consulta', 'consultas')}</span>
                </h3>
                <table className='mb-0 w-100'>
                  <caption className='visually-hidden'>
                    Consultas por dia em {nomeDoMes(m).toLowerCase()} de {ano}
                  </caption>
                  <thead>
                    <tr>
                      {DIAS_CURTOS.map((d, i) => (
                        <th key={d} scope='col'>
                          <abbr title={DIAS_DA_SEMANA[i]} className='text-decoration-none'>{d[0]}</abbr>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {semanasDoMes(m).map((semana) => (
                      <tr key={semana[0]}>
                        {semana.map((d) => {
                          if (!d.startsWith(m.slice(0, 7))) return <td key={d} />;
                          const n = porDia[d] ?? 0;
                          return (
                            <td key={d}>
                              <button
                                type='button'
                                className={`ano-dia nivel-${nivel(n)}${d === DATA_DE_HOJE ? ' calendario-hoje' : ''}`}
                                title={`${diaMes(d)}: ${plural(n, 'consulta', 'consultas')}`}
                                onClick={() => aoAbrirDia(d)}
                              >
                                {Number(d.slice(8))}
                                <span className='visually-hidden'>
                                  {' '}
                                  de {nomeDoMes(d).toLowerCase()}: {plural(n, 'consulta', 'consultas')}
                                </span>
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
      <p className='small text-body-secondary mb-0 d-flex flex-wrap align-items-center gap-2'>
        Ocupação do dia, do menor ao maior número de consultas:
        <span className='amostra-ano nivel-0'>sem</span>
        <span className='amostra-ano nivel-1'>pouca</span>
        <span className='amostra-ano nivel-2'>média</span>
        <span className='amostra-ano nivel-3'>alta</span>
      </p>
    </>
  );
}
