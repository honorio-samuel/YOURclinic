import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import CloseIcon from '@mui/icons-material/Close';

import Pagina from '../../components/pagina';
import EstadoErro from '../../components/estado-erro';
import { CampoSelect } from '../../components/campos';
import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { api } from '../../config/axios';
import { listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { prefixoDoPapel } from '../../navegacao/caminhos';
import { useSessao } from '../../sessao/sessao';
import { carregarMedicosAtivos, DIAS_DA_SEMANA, minutosDe } from './comum';

// Segunda primeiro: é a ordem da semana de trabalho.
const ORDEM_DOS_DIAS = [1, 2, 3, 4, 5, 6, 0];
const GRANULARIDADES = [10, 15, 20, 30, 40, 45, 60];
const MAXIMO_DE_PERIODOS = 2;
// X12 · janela padrão de funcionamento: segunda a sexta, das 8h às 18h.
const JANELA_PADRAO = { dias: [1, 2, 3, 4, 5], horaInicio: '08:00', horaFim: '18:00' };

const vazia = () => Object.fromEntries(ORDEM_DOS_DIAS.map((d) => [d, []]));

function paraEdicao(linhas, granularidadePadrao) {
  const dias = vazia();
  for (const g of [...linhas].sort((a, b) => a.horaInicio.localeCompare(b.horaInicio))) {
    dias[g.diaSemana].push({ horaInicio: g.horaInicio, horaFim: g.horaFim });
  }
  return { granularidade: linhas[0]?.granularidade ?? granularidadePadrao, dias };
}

// Mesmas regras do servidor: início antes do fim, ao menos um bloco e sem
// sobreposição no dia (RF13).
function errosDaGrade({ granularidade, dias }) {
  const erros = {};
  for (const d of ORDEM_DOS_DIAS) {
    const periodos = dias[d];
    periodos.forEach((p, i) => {
      if (!p.horaInicio || !p.horaFim) erros[`${d}-${i}`] = 'Informe início e fim.';
      else if (p.horaFim <= p.horaInicio) erros[`${d}-${i}`] = 'O fim vem depois do início.';
      else if (minutosDe(p.horaFim) - minutosDe(p.horaInicio) < granularidade) {
        erros[`${d}-${i}`] = `O período precisa ter ao menos ${granularidade} minutos.`;
      }
    });
    const ordenados = periodos.map((p, i) => ({ ...p, i })).filter((p) => p.horaInicio && p.horaFim).sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
    for (let k = 1; k < ordenados.length; k++) {
      if (ordenados[k].horaInicio < ordenados[k - 1].horaFim) erros[`${d}-${ordenados[k].i}`] = 'Este período se sobrepõe ao outro do dia.';
    }
  }
  return erros;
}

async function carregarGrade(idMedico) {
  const [linhas, parametros] = await Promise.all([listar('gradesHorario', { idMedico }), listar('parametros', { chave: 'X11' })]);
  return { linhas, granularidadePadrao: Number(parametros[0]?.valor) || 30 };
}

// A-10 e S-05a · Grade de horários (RF13). Um médico por vez; até dois períodos
// por dia. Reduzir a grade não pode deixar consulta agendada de fora: o
// servidor recusa e a tela leva a reagendar antes (A3-R13).
function GradeHorarios() {
  const { sessao } = useSessao();
  const papel = sessao.usuario.papel;
  const [params, setParams] = useSearchParams();
  const [modal, confirmar] = useConfirmacao();
  const medicos = useCarregar(carregarMedicosAtivos);
  const idMedico = params.get('medico') ?? (medicos.dados?.[0] ? String(medicos.dados[0].id) : '');
  const grade = useCarregar(() => (idMedico ? carregarGrade(idMedico) : Promise.resolve(null)), [idMedico]);
  const [edicao, setEdicao] = React.useState(null);
  const [sujo, setSujo] = React.useState(false);
  const [erros, setErros] = React.useState({});
  const [recusa, setRecusa] = React.useState(null);
  const [salvando, setSalvando] = React.useState(false);
  const medico = medicos.dados?.find((m) => String(m.id) === idMedico);

  const descartar = React.useCallback(() => {
    if (!grade.dados) return;
    setEdicao(paraEdicao(grade.dados.linhas, grade.dados.granularidadePadrao));
    setSujo(false);
    setErros({});
    setRecusa(null);
  }, [grade.dados]);

  React.useEffect(() => {
    descartar();
  }, [descartar]);

  const mudar = (funcao) => {
    setEdicao((atual) => funcao(JSON.parse(JSON.stringify(atual))));
    setSujo(true);
    setErros({});
    setRecusa(null);
  };

  const trocarMedico = async (novo) => {
    if (
      sujo &&
      !(await confirmar({
        titulo: 'Descartar as alterações?',
        texto: `A grade de ${medico?.nome ?? 'este médico'} tem mudanças ainda não salvas.`,
        rotuloConfirmar: 'Descartar',
        perigo: true,
      }))
    ) {
      return;
    }
    setParams({ medico: novo });
  };

  const usarJanelaPadrao = () =>
    mudar((g) => {
      for (const d of ORDEM_DOS_DIAS) {
        g.dias[d] = JANELA_PADRAO.dias.includes(d) ? [{ horaInicio: JANELA_PADRAO.horaInicio, horaFim: JANELA_PADRAO.horaFim }] : [];
      }
      return g;
    });

  const salvar = async (e) => {
    e.preventDefault();
    const encontrados = errosDaGrade(edicao);
    setErros(encontrados);
    const primeiro = Object.keys(encontrados)[0];
    if (primeiro) {
      document.getElementById(`grade-${primeiro}-inicio`)?.focus();
      return;
    }
    setSalvando(true);
    try {
      const periodos = ORDEM_DOS_DIAS.flatMap((d) => edicao.dias[d].map((p) => ({ diaSemana: d, ...p })));
      await api.put(`/agenda/grade/${idMedico}`, { granularidade: edicao.granularidade, periodos });
      mensagemSucesso(`Grade de ${medico.nome} salva.`);
      setSujo(false);
      grade.recarregar();
    } catch (falha) {
      if (falha.response?.status === 409) setRecusa(mensagemDeErro(falha));
      else mensagemErro(mensagemDeErro(falha));
    } finally {
      setSalvando(false);
    }
  };

  if (medicos.erro) {
    return (
      <Pagina titulo='Grade de horários'>
        <EstadoErro erro={medicos.erro} aoTentarDeNovo={medicos.recarregar} />
      </Pagina>
    );
  }

  const opcoesGranularidade = [...new Set([...GRANULARIDADES, edicao?.granularidade].filter(Boolean))].sort((a, b) => a - b);

  return (
    <Pagina titulo='Grade de horários'>
      <div className='d-flex flex-wrap align-items-end gap-3'>
        <CampoSelect
          id='gradeMedico'
          rotulo='Médico'
          valor={idMedico}
          aoMudar={trocarMedico}
          opcoes={(medicos.dados ?? []).map((m) => [String(m.id), `${m.nome} · ${m.especialidade}`])}
        />
        {papel === 'SECRETARIA' && <Link to='/secretaria/listagem-bloqueios'>Ver os bloqueios de agenda</Link>}
      </div>
      {grade.erro ? (
        <EstadoErro erro={grade.erro} aoTentarDeNovo={grade.recarregar} />
      ) : medicos.dados && !medico ? (
        <p className='mb-0'>Escolha um médico ativo.</p>
      ) : !edicao || !medico ? (
        <p className='text-body-secondary'>Carregando…</p>
      ) : (
        <form noValidate onSubmit={salvar} aria-label={`Grade de horários de ${medico.nome}`} className='d-flex flex-column gap-3'>
          <div className='card card-body'>
            <div className='row g-3 align-items-end'>
              <div className='col-sm-6 col-lg-4'>
                <label htmlFor='gradeGranularidade' className='form-label'>
                  Duração de cada horário
                </label>
                <select
                  id='gradeGranularidade'
                  className='form-select'
                  value={edicao.granularidade}
                  onChange={(e) => mudar((g) => ({ ...g, granularidade: Number(e.target.value) }))}
                  aria-describedby='gradeGranularidadeAjuda'
                >
                  {opcoesGranularidade.map((n) => (
                    <option key={n} value={n}>
                      {n} minutos
                    </option>
                  ))}
                </select>
                <div id='gradeGranularidadeAjuda' className='form-text'>
                  Padrão da clínica: {grade.dados.granularidadePadrao} minutos (X11).
                </div>
              </div>
              <div className='col-sm-6 col-lg-8'>
                <button type='button' className='btn btn-outline-primary' onClick={usarJanelaPadrao}>
                  Usar a janela padrão: segunda a sexta, 8h às 18h
                </button>
              </div>
            </div>
          </div>
          {recusa && (
            <div className='alert alert-warning d-flex flex-wrap align-items-center gap-2 mb-0' role='alert'>
              <span>{recusa}</span>
              <Link
                to={
                  papel === 'SECRETARIA'
                    ? '/secretaria/listagem-consultas'
                    : `${prefixoDoPapel(papel)}/agenda?visao=semana&medico=${idMedico}`
                }
              >
                {papel === 'SECRETARIA' ? 'Abrir Reagendar ou cancelar' : 'Ver a agenda do médico'}
              </Link>
            </div>
          )}
          <div className='row row-cols-1 row-cols-lg-2 g-3'>
            {ORDEM_DOS_DIAS.map((d) => (
              <div key={d} className='col'>
                <fieldset className='card card-body h-100'>
                  <legend className='h6 mb-2'>{DIAS_DA_SEMANA[d]}</legend>
                  {edicao.dias[d].length === 0 && <p className='text-body-secondary mb-2'>Sem atendimento.</p>}
                  {edicao.dias[d].map((p, i) => {
                    const chave = `${d}-${i}`;
                    const erro = erros[chave];
                    const campo = (nome, rotulo) => (
                      <div className='col-5'>
                        <label htmlFor={`grade-${chave}-${nome}`} className='form-label small mb-1'>
                          {rotulo}
                          <span className='visually-hidden'>
                            {' '}
                            do período {i + 1} de {DIAS_DA_SEMANA[d].toLowerCase()}
                          </span>
                        </label>
                        <input
                          id={`grade-${chave}-${nome}`}
                          type='time'
                          className={`form-control${erro ? ' is-invalid' : ''}`}
                          value={nome === 'inicio' ? p.horaInicio : p.horaFim}
                          step={edicao.granularidade * 60}
                          onChange={(e) =>
                            mudar((g) => {
                              g.dias[d][i][nome === 'inicio' ? 'horaInicio' : 'horaFim'] = e.target.value;
                              return g;
                            })
                          }
                          aria-invalid={erro ? true : undefined}
                          aria-describedby={erro ? `grade-${chave}-erro` : undefined}
                        />
                      </div>
                    );
                    return (
                      <div key={chave} className='mb-2'>
                        <div className='row g-2 align-items-end'>
                          {campo('inicio', 'Início')}
                          {campo('fim', 'Fim')}
                          <div className='col-2'>
                            <button
                              type='button'
                              className='btn btn-sm botao-icone botao-icone-perigo'
                              title='Remover período'
                              aria-label={`Remover o período ${i + 1} de ${DIAS_DA_SEMANA[d].toLowerCase()}`}
                              onClick={() =>
                                mudar((g) => {
                                  g.dias[d].splice(i, 1);
                                  return g;
                                })
                              }
                            >
                              <CloseIcon fontSize='small' aria-hidden='true' />
                            </button>
                          </div>
                        </div>
                        {erro && (
                          <div id={`grade-${chave}-erro`} className='invalid-feedback d-block'>
                            {erro}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {edicao.dias[d].length < MAXIMO_DE_PERIODOS && (
                    <div>
                      <button
                        type='button'
                        className='btn btn-sm btn-outline-secondary'
                        onClick={() =>
                          mudar((g) => {
                            const anterior = g.dias[d][g.dias[d].length - 1];
                            g.dias[d].push(anterior ? { horaInicio: '14:00', horaFim: '18:00' } : { horaInicio: '08:00', horaFim: '12:00' });
                            return g;
                          })
                        }
                      >
                        + Adicionar período
                        <span className='visually-hidden'> em {DIAS_DA_SEMANA[d].toLowerCase()}</span>
                      </button>
                    </div>
                  )}
                </fieldset>
              </div>
            ))}
          </div>
          <div className='d-flex flex-wrap justify-content-end gap-2'>
            <button type='button' className='btn btn-outline-secondary' onClick={descartar} disabled={!sujo || salvando}>
              Descartar alterações
            </button>
            <button type='submit' className='btn btn-primary' disabled={!sujo || salvando}>
              {salvando ? 'Salvando…' : 'Salvar grade'}
            </button>
          </div>
        </form>
      )}
      {modal}
    </Pagina>
  );
}

export default GradeHorarios;
