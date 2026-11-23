import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import Pagina from '../../components/pagina';
import EstadoErro from '../../components/estado-erro';
import { CampoSelecao, CampoTextoLongo } from '../../components/formulario';
import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { RegistroIndisponivel } from '../geral/avisos';
import { api, DATA_DE_HOJE } from '../../config/axios';
import { buscar, pessoasPorId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { caminhoListagem } from '../../navegacao/caminhos';
import { useSessao } from '../../sessao/sessao';
import { data as dataBR, diaMesHora, nomeMedico } from '../../utils/formatos';
import { MOTIVO_BLOQUEIO, STATUS_CONSULTA } from '../../utils/rotulos';
import { carregarConsultas, carregarMedicosAtivos, MOTIVOS_DA_CLINICA, somarDias } from './comum';
import EscolhaDeHorario from './escolha-de-horario';

const OUTRO = 'Outro';
const ACOES = [
  ['', 'Deixar para depois'],
  ['REAGENDAR', 'Reagendar'],
  ['CANCELAR', 'Cancelar'],
];

async function carregar(id) {
  const bloqueio = await buscar('bloqueiosAgenda', id);
  const [consultas, medicos, pessoas] = await Promise.all([
    carregarConsultas({
      dataHora_gte: bloqueio.dataInicio,
      dataHora_lte: bloqueio.dataFim,
      ...(bloqueio.idMedico ? { idMedico: bloqueio.idMedico } : {}),
      _sort: 'dataHora',
    }),
    carregarMedicosAtivos(),
    pessoasPorId([bloqueio.idMedico]),
  ]);
  return {
    bloqueio: { ...bloqueio, medico: bloqueio.idMedico ? nomeMedico(pessoas[bloqueio.idMedico]) : 'toda a clínica' },
    // As que o bloqueio atinge são as que ainda vão acontecer (RF14).
    consultas: consultas.filter((c) => ['AGENDADO', 'NA_RECEPCAO'].includes(c.status)),
    medicos,
  };
}

// A-11b e S-05b · Consultas afetadas por um bloqueio: reagendar ou cancelar em
// lote, com um motivo só (RF20). O lote é tudo ou nada (A4-R09): se uma
// consulta falhar, nenhuma muda, e a tela diz qual falhou. Cada paciente
// recebe o aviso (RF21).
function ConsultasAfetadas() {
  const { idParam } = useParams();
  const id = Number(idParam);
  const { sessao } = useSessao();
  const navigate = useNavigate();
  const listagem = caminhoListagem(sessao.usuario.papel, 'bloqueios');
  const { dados, carregando, erro, recarregar } = useCarregar(() => carregar(id), [id]);
  const [modal, confirmar] = useConfirmacao();
  const [escolhas, setEscolhas] = React.useState({});
  const [motivo, setMotivo] = React.useState('Bloqueio de agenda');
  const [detalhe, setDetalhe] = React.useState('');
  const [erros, setErros] = React.useState({});
  const [falha, setFalha] = React.useState(null);
  const [versao, setVersao] = React.useState(0);
  const [salvando, setSalvando] = React.useState(false);

  // Sugestão de data: o dia seguinte ao fim do bloqueio.
  const depoisDoBloqueio = dados ? somarDias(dados.bloqueio.dataFim.slice(0, 10), 1) : DATA_DE_HOJE;
  const sugestao = depoisDoBloqueio < DATA_DE_HOJE ? DATA_DE_HOJE : depoisDoBloqueio;
  const padrao = (c) => ({ acao: '', medico: String(c.idMedico), data: sugestao, horario: '' });
  const escolhaDe = (c) => escolhas[c.id] ?? padrao(c);
  // Atualização sobre o estado mais recente: data e horário mudam juntos.
  const mudar = (c, campos) => {
    setEscolhas((atual) => ({ ...atual, [c.id]: { ...(atual[c.id] ?? padrao(c)), ...campos } }));
    setErros((atual) => ({ ...atual, [c.id]: null }));
    setFalha(null);
  };

  if (erro?.status === 404) return <RegistroIndisponivel />;

  const consultas = dados?.consultas ?? [];
  const marcadas = consultas.filter((c) => escolhaDe(c).acao);
  const reagendar = marcadas.filter((c) => escolhaDe(c).acao === 'REAGENDAR').length;
  const cancelar = marcadas.length - reagendar;
  // Horários já escolhidos em outra linha, para o mesmo médico.
  const ocupadosPor = (c) =>
    marcadas
      .filter((o) => o.id !== c.id && escolhaDe(o).acao === 'REAGENDAR' && escolhaDe(o).horario && escolhaDe(o).medico === escolhaDe(c).medico)
      .map((o) => `${escolhaDe(o).data}T${escolhaDe(o).horario}`);

  const aplicar = async () => {
    const encontrados = {};
    for (const c of marcadas) {
      const e = escolhaDe(c);
      if (e.acao === 'REAGENDAR' && !e.horario) encontrados[c.id] = 'Escolha o novo horário.';
    }
    const semMotivo = !motivo || (motivo === OUTRO && detalhe.trim().length < 5);
    setErros(encontrados);
    if (marcadas.length === 0) {
      mensagemErro('Escolha reagendar ou cancelar ao menos uma consulta.');
      return;
    }
    const primeiro = Object.keys(encontrados)[0];
    if (primeiro) {
      document.getElementById(`afetada-${primeiro}-horario`)?.focus();
      return;
    }
    if (semMotivo) {
      document.getElementById(motivo === OUTRO ? 'loteDetalhe' : 'loteMotivo')?.focus();
      setErros((atual) => ({ ...atual, motivo: motivo ? 'Descreva o motivo.' : 'Escolha o motivo.' }));
      return;
    }
    const partes = [reagendar && `${reagendar} a reagendar`, cancelar && `${cancelar} a cancelar`].filter(Boolean).join(' e ');
    const ok = await confirmar({
      titulo: `Aplicar o lote: ${partes}?`,
      texto: 'Cada paciente recebe o aviso. Se uma das consultas não puder ser tratada, nenhuma muda e a tela mostra qual foi.',
      rotuloConfirmar: 'Aplicar',
    });
    if (!ok) return;
    setSalvando(true);
    try {
      const { data } = await api.post('/agenda/lote', {
        motivo: motivo === OUTRO ? `${OUTRO}: ${detalhe.trim()}` : motivo,
        idBloqueio: id,
        acoes: marcadas.map((c) => {
          const e = escolhaDe(c);
          if (e.acao === 'CANCELAR') return { idConsulta: c.id, acao: 'CANCELAR' };
          return {
            idConsulta: c.id,
            acao: 'REAGENDAR',
            dataHora: `${e.data}T${e.horario}:00`,
            ...(e.medico !== String(c.idMedico) ? { idMedico: Number(e.medico) } : {}),
          };
        }),
      });
      mensagemSucesso(`${data.tratadas} ${data.tratadas === 1 ? 'consulta tratada' : 'consultas tratadas'}. Os pacientes recebem o aviso.`);
      if (marcadas.length === consultas.length) navigate(listagem);
      else {
        setEscolhas({});
        recarregar();
      }
    } catch (e) {
      setFalha(mensagemDeErro(e));
      setVersao((n) => n + 1);
    } finally {
      setSalvando(false);
    }
  };

  const b = dados?.bloqueio;
  return (
    <Pagina titulo='Consultas afetadas pelo bloqueio'>
      {erro ? (
        <EstadoErro erro={erro} aoTentarDeNovo={recarregar} />
      ) : carregando && !dados ? (
        <p className='text-body-secondary'>Carregando…</p>
      ) : (
        <>
          <div className='card card-body'>
            <p className='mb-0'>
              Bloqueio de {b.medico} · {MOTIVO_BLOQUEIO[b.motivo] ?? b.motivo} · de {dataBR(b.dataInicio)} {b.dataInicio.slice(11, 16)} a{' '}
              {dataBR(b.dataFim)} {b.dataFim.slice(11, 16)}
              {b.situacao !== 'ATIVO' ? ' · inativo' : ''}.
            </p>
          </div>
          {consultas.length === 0 ? (
            <div className='d-flex flex-column align-items-start gap-2'>
              <p className='mb-0'>Nenhuma consulta agendada é atingida por este bloqueio.</p>
              <button type='button' className='btn btn-outline-secondary' onClick={() => navigate(listagem)}>
                Voltar aos bloqueios
              </button>
            </div>
          ) : (
            <>
              <p className='mb-0'>
                {consultas.length} {consultas.length === 1 ? 'consulta agendada cai' : 'consultas agendadas caem'} no período. Para cada uma,
                escolha reagendar ou cancelar; o que ficar para depois continua na lista.
              </p>
              {falha && (
                <div className='alert alert-danger mb-0' role='alert'>
                  Nada foi alterado. {falha} Os horários foram atualizados.
                </div>
              )}
              {consultas.map((c) => {
                const e = escolhaDe(c);
                const doMedico = dados.medicos.find((m) => m.id === c.idMedico);
                const opcoesMedico = dados.medicos.filter(
                  (m) => m.id === c.idMedico || (doMedico && m.especialidade === doMedico.especialidade)
                );
                const podeReagendar = c.status === 'AGENDADO';
                return (
                  <fieldset key={c.id} className='card card-body'>
                    <legend className='h6 mb-1'>{c.paciente}</legend>
                    <p className='small text-body-secondary mb-2'>
                      {diaMesHora(c.dataHora)} · {c.medico} · {c.atendimento} · {STATUS_CONSULTA[c.status]?.rotulo}
                    </p>
                    <div className='d-flex flex-wrap gap-3' role='radiogroup' aria-label={`O que fazer com a consulta de ${c.paciente}`}>
                      {ACOES.filter(([valor]) => valor !== 'REAGENDAR' || podeReagendar).map(([valor, rotulo]) => (
                        <div key={valor || 'depois'} className='form-check'>
                          <input
                            className='form-check-input'
                            type='radio'
                            name={`afetada-${c.id}-acao`}
                            id={`afetada-${c.id}-acao-${valor || 'depois'}`}
                            checked={e.acao === valor}
                            onChange={() => mudar(c, { acao: valor })}
                          />
                          <label className='form-check-label' htmlFor={`afetada-${c.id}-acao-${valor || 'depois'}`}>
                            {rotulo}
                          </label>
                        </div>
                      ))}
                    </div>
                    {!podeReagendar && (
                      <p className='small text-body-secondary mb-0 mt-1'>O paciente já está na recepção: só é possível cancelar.</p>
                    )}
                    {e.acao === 'REAGENDAR' && (
                      <div className='row g-3 mt-1'>
                        <CampoSelecao
                          id={`afetada-${c.id}-medico`}
                          rotulo='Médico'
                          valor={e.medico}
                          aoMudar={(valor) => mudar(c, { medico: valor, horario: '' })}
                          opcoes={opcoesMedico.map((m) => [String(m.id), m.id === c.idMedico ? `${m.nome} (o mesmo médico)` : `${m.nome} · ${m.especialidade}`])}
                          largura='col-md-8'
                        />
                        <EscolhaDeHorario
                          idData={`afetada-${c.id}-data`}
                          idHorario={`afetada-${c.id}-horario`}
                          idMedico={e.medico}
                          idProcedimento={c.idProcedimento}
                          idConsulta={c.id}
                          data={e.data}
                          aoMudarData={(valor) => mudar(c, { data: valor })}
                          horario={e.horario}
                          aoMudarHorario={(valor) => mudar(c, { horario: valor })}
                          erroHorario={erros[c.id]}
                          versao={versao}
                          ocupados={ocupadosPor(c)}
                          rotuloData='Nova data'
                        />
                      </div>
                    )}
                  </fieldset>
                );
              })}
              <div className='card card-body'>
                <div className='row g-3'>
                  <CampoSelecao
                    id='loteMotivo'
                    rotulo='Motivo do lote'
                    valor={motivo}
                    aoMudar={(valor) => {
                      setMotivo(valor);
                      setErros((atual) => ({ ...atual, motivo: null }));
                    }}
                    opcoes={MOTIVOS_DA_CLINICA.map((m) => [m, m])}
                    erro={motivo === OUTRO ? null : erros.motivo}
                    ajuda='Vai para todas as consultas do lote e para o aviso ao paciente, sem detalhe clínico.'
                  />
                  {motivo === OUTRO && (
                    <CampoTextoLongo
                      id='loteDetalhe'
                      rotulo='Descreva o motivo'
                      valor={detalhe}
                      aoMudar={(valor) => {
                        setDetalhe(valor);
                        setErros((atual) => ({ ...atual, motivo: null }));
                      }}
                      erro={erros.motivo}
                      linhas={2}
                    />
                  )}
                </div>
              </div>
              <div className='d-flex flex-wrap justify-content-between align-items-center gap-2'>
                <span className='text-body-secondary' aria-live='polite'>
                  {marcadas.length === 0
                    ? 'Nenhuma consulta escolhida ainda.'
                    : `No lote: ${reagendar} para reagendar e ${cancelar} para cancelar.`}
                </span>
                <div className='d-flex flex-wrap gap-2 ms-auto'>
                  <button type='button' className='btn btn-outline-secondary' onClick={() => navigate(listagem)} disabled={salvando}>
                    Voltar
                  </button>
                  <button type='button' className='btn btn-primary' onClick={aplicar} disabled={salvando}>
                    {salvando ? 'Aplicando…' : 'Aplicar ao lote'}
                  </button>
                </div>
              </div>
            </>
          )}
        </>
      )}
      {modal}
    </Pagina>
  );
}

export default ConsultasAfetadas;
