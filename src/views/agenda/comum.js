import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { atualizar, listar, pessoasPorId, porId } from '../../servicos/dados';
import { nomeMedico } from '../../utils/formatos';
import { STATUS_CONSULTA } from '../../utils/rotulos';

// Partes usadas por mais de uma tela desta pasta.

export const doDia = (dia) => ({ dataHora_gte: `${dia}T00:00:00`, dataHora_lte: `${dia}T23:59:59`, _sort: 'dataHora' });

// Consultas com nomes de paciente e médico, tipo de atendimento e convênio.
export async function carregarConsultas(params) {
  const [consultas, procedimentos, convenios] = await Promise.all([
    listar('consultas', params),
    listar('procedimentos'),
    listar('convenios'),
  ]);
  const pessoas = await pessoasPorId(consultas.flatMap((c) => [c.idPaciente, c.idMedico]));
  const proc = porId(procedimentos);
  const conv = porId(convenios);
  return consultas.map((c) => ({
    ...c,
    paciente: pessoas[c.idPaciente]?.nome ?? '—',
    medico: nomeMedico(pessoas[c.idMedico]),
    tipo: proc[c.idProcedimento]?.nome ?? '—',
    atendimento: `${proc[c.idProcedimento]?.tipo === 'CONSULTA' || !proc[c.idProcedimento] ? 'Consulta' : 'Procedimento'} · ${
      c.idConvenio ? conv[c.idConvenio]?.nome ?? 'convênio' : 'particular'
    }`,
  }));
}

export function opcoesDeMedico(consultas) {
  const mapa = new Map((consultas ?? []).map((c) => [String(c.idMedico), c.medico]));
  return [['', 'Todos os médicos'], ...[...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))];
}

// Muda o status da consulta. O servidor confere se a transição é permitida ao papel.
export function useMudarStatus(recarregar) {
  const [modal, confirmar] = useConfirmacao();
  const mudar = async (consulta, status, pedirConfirmacao) => {
    let motivo = null;
    if (pedirConfirmacao) {
      const resposta = await confirmar(pedirConfirmacao);
      if (!resposta) return;
      if (typeof resposta === 'string') motivo = resposta;
    }
    try {
      const campos = { status };
      if (status === 'CANCELADO') campos.motivoCancelamento = motivo ?? 'Cancelado pela clínica';
      // Volta de status (retroativa) leva motivo e fica destacada no log (RF22).
      else if (motivo) campos.motivoTransicao = motivo;
      await atualizar('consultas', consulta.id, campos);
      mensagemSucesso(`${consulta.paciente}: ${STATUS_CONSULTA[status].rotulo.toLowerCase()}.`);
      recarregar();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
    }
  };
  return [modal, mudar];
}
