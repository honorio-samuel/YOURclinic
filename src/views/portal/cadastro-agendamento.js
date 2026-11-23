import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import CampoHorarios from '../../components/campo-horarios';
import { CampoSelecao, CampoTexto, Formulario, Rodape, Secao, useFormulario, useSairSemSalvar } from '../../components/formulario';
import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { DATA_DE_HOJE } from '../../config/axios';
import { criar, listar, pessoasPorId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { diaMes } from '../../utils/formatos';
import { TIPO_ATENDIMENTO } from '../../utils/rotulos';
import { carregarHorarios, DIAS_CURTOS, DIAS_DA_SEMANA, diaDaSemana, ERROS_DE_HORARIO, somarDias } from '../agenda/comum';
import { ExigeRepresentado, useTitular } from './comum';

// Quantos dias à frente o portal mostra.
const DIAS_A_FRENTE = 21;

const VAZIO = { especialidade: '', medico: '', dia: '', horario: '', procedimento: '', atendimento: 'PARTICULAR', convenio: '', carteirinha: '' };

async function carregarEscolhas(idTitular) {
  const [medicos, procedimentos, convenios, pacientes] = await Promise.all([
    listar('medicos', { situacao: 'ATIVO' }),
    listar('procedimentos', { situacao: 'ATIVO', _sort: 'nome' }),
    listar('convenios', { situacao: 'ATIVO', _sort: 'nome' }),
    listar('pacientes', { id: idTitular }),
  ]);
  const pessoas = await pessoasPorId(medicos.map((m) => m.id));
  return {
    medicos: medicos
      .map((m) => ({ ...m, nome: pessoas[m.id]?.nome ?? 'Médico' }))
      .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    procedimentos,
    convenios,
    titular: pacientes[0] ?? null,
  };
}

// Dias com horário livre, como botões de opção.
function CampoDias({ id, dias, valor, aoMudar, erro }) {
  return (
    <fieldset id={id} tabIndex={-1} className='col-12' aria-describedby={erro ? `${id}-erro` : undefined}>
      <legend className='form-label fs-6 mb-2'>
        Dia
        <span className='text-danger' aria-hidden='true'>
          {' '}
          *
        </span>
      </legend>
      <div className='d-flex flex-wrap gap-2'>
        {dias.map((d) => (
          <React.Fragment key={d}>
            <input type='radio' className='btn-check' name={id} id={`${id}-${d}`} checked={valor === d} onChange={() => aoMudar(d)} />
            <label className='btn btn-outline-primary btn-sm botao-horario' htmlFor={`${id}-${d}`}>
              {DIAS_CURTOS[diaDaSemana(d)]}, {diaMes(d)}
            </label>
          </React.Fragment>
        ))}
      </div>
      {erro && (
        <div id={`${id}-erro`} className='invalid-feedback d-block'>
          {erro}
        </div>
      )}
    </fieldset>
  );
}

// P-02 e R-02 · Agendar consulta (RF16, RF17, RF18). Na ordem do RF16:
// especialidade, médico, horário livre (sem motivo de bloqueio), tipo de
// atendimento e convênio. Só aparecem os tipos que cabem no horário escolhido
// (E2). O convênio informado aqui fica a conferir pela recepção (E3).
function AgendarPortal() {
  const { id, ehResponsavel } = useTitular();
  const navigate = useNavigate();
  const form = useFormulario(VAZIO, 'agendar-');
  const { definir, carregar } = form;
  const v = form.valores;
  const [modal, confirmar] = useConfirmacao();
  const [salvando, setSalvando] = React.useState(false);
  const [conflito, setConflito] = React.useState(null);
  const [versao, setVersao] = React.useState(0);
  const [disp, setDisp] = React.useState({ porTipo: null, carregando: false, falhou: false });
  const { dados, carregando, erro, recarregar } = useCarregar(() => (id ? carregarEscolhas(id) : Promise.resolve(null)), [id]);
  const sair = useSairSemSalvar(form.sujo, confirmar, () => navigate('/portal/listagem-agendamentos'));

  // O convênio do cadastro vem sugerido, se ainda estiver ativo na clínica.
  const titular = dados?.titular;
  React.useEffect(() => {
    if (!titular?.idConvenio || !dados.convenios.some((c) => c.id === titular.idConvenio)) return;
    carregar({ ...VAZIO, atendimento: 'CONVENIO', convenio: String(titular.idConvenio), carteirinha: titular.numeroCarteirinha ?? '' });
  }, [titular, dados, carregar]);

  // Horários livres do médico para cada tipo de atendimento: o dia e o
  // horário aparecem se ao menos um tipo couber neles.
  React.useEffect(() => {
    if (!v.medico || !dados) {
      setDisp({ porTipo: null, carregando: false, falhou: false });
      return undefined;
    }
    let ativo = true;
    setDisp((atual) => ({ ...atual, carregando: true }));
    const ate = somarDias(DATA_DE_HOJE, DIAS_A_FRENTE - 1);
    Promise.all(
      dados.procedimentos.map((p) =>
        carregarHorarios({ idMedico: v.medico, idProcedimento: p.id, de: DATA_DE_HOJE, ate }).then((r) => [p.id, r.dias])
      )
    )
      .then((pares) => ativo && setDisp({ porTipo: Object.fromEntries(pares), carregando: false, falhou: false }))
      .catch(() => ativo && setDisp({ porTipo: {}, carregando: false, falhou: true }));
    return () => {
      ativo = false;
    };
  }, [v.medico, dados, versao]);

  const especialidades = [...new Set((dados?.medicos ?? []).map((m) => m.especialidade))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const medicosDaEspecialidade = (dados?.medicos ?? []).filter((m) => m.especialidade === v.especialidade);
  const medico = dados?.medicos.find((m) => String(m.id) === v.medico);
  const horariosDoTipo = (idTipo, dia) => disp.porTipo?.[idTipo]?.find((d) => d.data === dia)?.horarios ?? [];
  const horariosDoDia = (dia) =>
    [...new Set((dados?.procedimentos ?? []).flatMap((p) => horariosDoTipo(p.id, dia)))].sort();
  const dias = disp.porTipo
    ? Array.from({ length: DIAS_A_FRENTE }, (_, i) => somarDias(DATA_DE_HOJE, i)).filter((d) => horariosDoDia(d).length > 0)
    : [];
  const tipos = (dados?.procedimentos ?? []).filter((p) => v.horario && horariosDoTipo(p.id, v.dia).includes(v.horario));
  const tipo = tipos.find((p) => String(p.id) === v.procedimento);
  const convenio = v.atendimento === 'CONVENIO';

  // Cada escolha limpa as que dependem dela.
  const escolher = (nome, depois) => ({
    ...form.campo(nome),
    aoMudar: (valor) => {
      definir(nome, valor);
      depois.forEach((campo) => definir(campo, ''));
      setConflito(null);
    },
  });

  // O tipo escolhido sai se deixar de caber no horário.
  React.useEffect(() => {
    if (v.procedimento && v.horario && !tipos.some((p) => String(p.id) === v.procedimento)) definir('procedimento', '');
  }, [v.horario, v.dia, disp.porTipo]); // eslint-disable-line react-hooks/exhaustive-deps

  const salvar = async (e) => {
    e.preventDefault();
    const ok = form.validar({
      especialidade: v.especialidade ? null : 'Escolha a especialidade.',
      medico: v.medico ? null : 'Escolha o médico.',
      dia: v.dia ? null : 'Escolha o dia.',
      horario: v.horario ? null : 'Escolha o horário.',
      procedimento: v.procedimento ? null : 'Escolha o tipo de atendimento.',
      convenio: convenio && !v.convenio ? 'Escolha o convênio.' : null,
      carteirinha: convenio && v.carteirinha.trim().length < 3 ? 'Informe o número da carteirinha.' : null,
    });
    if (!ok) return;
    setSalvando(true);
    try {
      await criar('consultas', {
        idPaciente: id,
        idMedico: Number(v.medico),
        idProcedimento: Number(v.procedimento),
        dataHora: `${v.dia}T${v.horario}:00`,
        status: 'AGENDADO',
        idConvenio: convenio ? Number(v.convenio) : null,
        numeroCarteirinha: convenio ? v.carteirinha.trim() : null,
      });
      mensagemSucesso(
        `Consulta agendada para ${diaMes(v.dia)} às ${v.horario.replace(':', 'h')} com ${medico.nome}. A confirmação chega por mensagem.`
      );
      navigate('/portal/listagem-agendamentos');
    } catch (falha) {
      const mensagem = mensagemDeErro(falha);
      setSalvando(false);
      if (ERROS_DE_HORARIO.includes(mensagem)) {
        setConflito(mensagem);
        definir('horario', '');
        definir('procedimento', '');
        setVersao((n) => n + 1);
        requestAnimationFrame(() => document.getElementById('agendar-horario')?.focus());
      } else {
        mensagemErro(mensagem);
      }
    }
  };

  return (
    <ExigeRepresentado>
      <Pagina titulo='Agendar consulta'>
        {erro ? (
          <div className='alert alert-danger d-flex flex-wrap align-items-center gap-2' role='alert'>
            Não foi possível carregar os médicos agora.
            <button type='button' className='btn btn-sm btn-outline-danger' onClick={recarregar}>
              Tentar de novo
            </button>
          </div>
        ) : carregando && !dados ? (
          <p className='text-body-secondary'>Carregando…</p>
        ) : (
          <Formulario
            aoEnviar={salvar}
            rotulo='Agendar consulta'
            rodape={<Rodape aoCancelar={sair} salvando={salvando} rotuloSalvar='Confirmar agendamento' />}
          >
            <Secao titulo='1. Médico'>
              <CampoSelecao
                {...escolher('especialidade', ['medico', 'dia', 'horario', 'procedimento'])}
                rotulo='Especialidade'
                opcoes={especialidades.map((e) => [e, e])}
              />
              <CampoSelecao
                {...escolher('medico', ['dia', 'horario', 'procedimento'])}
                rotulo='Médico'
                disabled={!v.especialidade}
                opcoes={medicosDaEspecialidade.map((m) => [String(m.id), `${m.nome} · CRM ${m.crm}/${m.ufCrm}`])}
              />
            </Secao>
            {v.medico && (
              <Secao titulo='2. Dia e horário'>
                {conflito && (
                  <div className='col-12'>
                    <div className='alert alert-warning mb-0' role='alert'>
                      {conflito} Os horários foram atualizados.
                    </div>
                  </div>
                )}
                {disp.carregando ? (
                  <p className='col-12 text-body-secondary mb-0'>Carregando horários…</p>
                ) : disp.falhou ? (
                  <p className='col-12 mb-0'>Não foi possível carregar os horários agora. Tente de novo em instantes.</p>
                ) : dias.length === 0 ? (
                  <p className='col-12 mb-0'>
                    {medico?.nome} não tem horário livre nas próximas três semanas. Escolha outro médico da especialidade ou fale
                    com a recepção.
                  </p>
                ) : (
                  <>
                    <CampoDias {...escolher('dia', ['horario', 'procedimento'])} dias={dias} />
                    {v.dia && (
                      <CampoHorarios
                        {...escolher('horario', ['procedimento'])}
                        rotulo={`Horário · ${DIAS_DA_SEMANA[diaDaSemana(v.dia)].toLowerCase()}, ${diaMes(v.dia)}`}
                        horarios={horariosDoDia(v.dia)}
                      />
                    )}
                  </>
                )}
              </Secao>
            )}
            {v.horario && (
              <Secao titulo='3. Tipo de atendimento'>
                <CampoSelecao
                  {...form.campo('procedimento')}
                  rotulo='Tipo de atendimento'
                  opcoes={tipos.map((p) => [String(p.id), `${p.nome} · ${p.duracaoPadrao} min`])}
                  ajuda={tipos.length < (dados?.procedimentos.length ?? 0) ? 'Só aparecem os tipos que cabem neste horário.' : null}
                />
              </Secao>
            )}
            {v.procedimento && (
              <Secao titulo='4. Convênio'>
                <CampoSelecao {...form.campo('atendimento')} rotulo='Atendimento' opcoes={Object.entries(TIPO_ATENDIMENTO)} />
                {convenio && (
                  <>
                    <CampoSelecao
                      {...form.campo('convenio')}
                      rotulo='Convênio'
                      opcoes={(dados?.convenios ?? []).map((c) => [String(c.id), c.nome])}
                    />
                    <CampoTexto {...form.campo('carteirinha')} rotulo='Número da carteirinha' autoComplete='off' />
                    <p className='col-12 small text-body-secondary mb-0'>
                      A recepção confere o convênio antes da consulta. Se houver pendência, você é avisado.
                    </p>
                  </>
                )}
              </Secao>
            )}
            {tipo && (
              <div className='card card-body' aria-live='polite'>
                <h2 className='h5'>Resumo</h2>
                <p className='mb-0'>
                  {tipo.nome} com {medico?.nome} ({medico?.especialidade}) em {DIAS_DA_SEMANA[diaDaSemana(v.dia)].toLowerCase()},{' '}
                  {diaMes(v.dia)}, às {v.horario.replace(':', 'h')}
                  {ehResponsavel ? ', em nome do representado' : ''}. {convenio ? 'Pelo convênio.' : 'Particular.'}
                </p>
              </div>
            )}
          </Formulario>
        )}
        {modal}
      </Pagina>
    </ExigeRepresentado>
  );
}

export default AgendarPortal;
