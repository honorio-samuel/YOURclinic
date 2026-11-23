import React from 'react';

import Modal from '../../components/modal';
import { CampoSelecao, CampoTextoLongo, useFormulario } from '../../components/formulario';
import { mensagemDeErro } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { DATA_DE_HOJE } from '../../config/axios';
import { atualizar } from '../../servicos/dados';
import { diaMes, diaMesHora } from '../../utils/formatos';
import { carregarMedicosAtivos, ERROS_DE_HORARIO, MOTIVOS_DA_CLINICA } from './comum';
import EscolhaDeHorario from './escolha-de-horario';

const OUTRO = 'Outro';

// RF20 · Reagendamento pela clínica, sempre com motivo de lista fechada. O
// mesmo médico vem primeiro; na falta de horário, outro da mesma especialidade.
// O paciente recebe o aviso da remarcação (RF21).
// Uso: const [modal, reagendar] = useReagendar(recarregar); ... reagendar(consulta)
export function useReagendar(recarregar) {
  const [consulta, setConsulta] = React.useState(null);
  const abrir = React.useCallback((c) => setConsulta(c), []);
  const fechar = () => setConsulta(null);
  const modal = consulta && (
    <JanelaReagendar
      consulta={consulta}
      aoFechar={fechar}
      aoConcluir={() => {
        fechar();
        recarregar();
      }}
    />
  );
  return [modal, abrir];
}

function JanelaReagendar({ consulta, aoFechar, aoConcluir }) {
  const dia = consulta.dataHora.slice(0, 10);
  const form = useFormulario(
    { medico: String(consulta.idMedico), data: dia >= DATA_DE_HOJE ? dia : DATA_DE_HOJE, horario: '', motivo: '', detalhe: '' },
    'reagendar-'
  );
  const { definir } = form;
  const v = form.valores;
  const [medicos, setMedicos] = React.useState(null);
  const [conflito, setConflito] = React.useState(null);
  const [versao, setVersao] = React.useState(0);
  const [salvando, setSalvando] = React.useState(false);

  React.useEffect(() => {
    let ativo = true;
    carregarMedicosAtivos()
      .then((lista) => ativo && setMedicos(lista))
      .catch(() => ativo && setMedicos([]));
    return () => {
      ativo = false;
    };
  }, []);

  const doConsulta = medicos?.find((m) => m.id === consulta.idMedico);
  const opcoes = (medicos ?? []).filter(
    (m) => m.id === consulta.idMedico || (doConsulta && m.especialidade === doConsulta.especialidade)
  );

  const salvar = async () => {
    const ok = form.validar({
      medico: v.medico ? null : 'Escolha o médico.',
      data: v.data ? null : 'Escolha a nova data.',
      horario: v.horario ? null : 'Escolha o novo horário.',
      motivo: v.motivo ? null : 'Escolha o motivo.',
      detalhe: v.motivo === OUTRO && v.detalhe.trim().length < 5 ? 'Descreva o motivo.' : null,
    });
    if (!ok) return;
    setSalvando(true);
    const campos = {
      dataHora: `${v.data}T${v.horario}:00`,
      motivoRemarcacao: v.motivo === OUTRO ? `${OUTRO}: ${v.detalhe.trim()}` : v.motivo,
    };
    if (Number(v.medico) !== consulta.idMedico) campos.idMedico = Number(v.medico);
    try {
      await atualizar('consultas', consulta.id, campos);
      mensagemSucesso(
        `Consulta de ${consulta.paciente} remarcada para ${diaMes(v.data)} às ${v.horario.replace(':', 'h')}. O paciente recebe o aviso.`
      );
      aoConcluir();
    } catch (falha) {
      const mensagem = mensagemDeErro(falha);
      setSalvando(false);
      if (ERROS_DE_HORARIO.includes(mensagem)) {
        setConflito(mensagem);
        definir('horario', '');
        setVersao((n) => n + 1);
      } else {
        mensagemErro(mensagem);
      }
    }
  };

  return (
    <Modal
      titulo={`Reagendar a consulta de ${consulta.paciente}`}
      aoFechar={aoFechar}
      largo
      rodape={
        <>
          <button type='button' className='btn btn-outline-secondary' onClick={aoFechar} disabled={salvando}>
            Voltar
          </button>
          <button type='button' className='btn btn-primary' onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Reagendar'}
          </button>
        </>
      }
    >
      <form
        noValidate
        aria-label='Reagendamento'
        className='row g-3'
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <p className='col-12 mb-0'>
          Marcada para {diaMesHora(consulta.dataHora)} com {consulta.medico}.
        </p>
        <CampoSelecao
          {...form.campo('medico')}
          aoMudar={(valor) => {
            definir('medico', valor);
            definir('horario', '');
            setConflito(null);
          }}
          rotulo='Médico'
          largura='col-12'
          opcoes={opcoes.map((m) => [String(m.id), m.id === consulta.idMedico ? `${m.nome} (o mesmo médico)` : `${m.nome} · ${m.especialidade}`])}
          ajuda={opcoes.length > 1 ? 'Na falta de horário com o mesmo médico, outro da mesma especialidade.' : null}
        />
        {conflito && (
          <div className='col-12'>
            <div className='alert alert-warning mb-0' role='alert'>
              {conflito} A lista de horários foi atualizada.
            </div>
          </div>
        )}
        <EscolhaDeHorario
          idData='reagendar-data'
          idHorario='reagendar-horario'
          idMedico={v.medico}
          idProcedimento={consulta.idProcedimento}
          idConsulta={consulta.id}
          data={v.data}
          aoMudarData={(valor) => {
            definir('data', valor);
            setConflito(null);
          }}
          horario={v.horario}
          aoMudarHorario={(valor) => definir('horario', valor)}
          erroData={form.erros.data}
          erroHorario={form.erros.horario}
          versao={versao}
          rotuloData='Nova data'
          larguraData='col-sm-6'
        />
        <CampoSelecao {...form.campo('motivo')} rotulo='Motivo' largura='col-12' opcoes={MOTIVOS_DA_CLINICA.map((m) => [m, m])} />
        {v.motivo === OUTRO && <CampoTextoLongo {...form.campo('detalhe')} rotulo='Descreva o motivo' linhas={2} />}
      </form>
    </Modal>
  );
}
