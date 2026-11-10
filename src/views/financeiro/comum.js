import { DATA_DE_HOJE } from '../../config/axios';
import { listar, pessoasPorId, porId } from '../../servicos/dados';

// Partes usadas por mais de uma tela desta pasta.

// Situação efetiva do título: aberto com vencimento passado é Vencido.
export const situacaoDoTitulo = (t) => (t.situacao === 'ABERTO' && t.vencimento < DATA_DE_HOJE ? 'VENCIDO' : t.situacao);

// Devedor de cada cobrança: o paciente da consulta ou do orçamento.
export async function carregarCobrancasComPaciente() {
  const [cobrancas, consultas, orcamentos] = await Promise.all([
    listar('cobrancas'),
    listar('consultas'),
    listar('orcamentos'),
  ]);
  const consulta = porId(consultas);
  const orcamento = porId(orcamentos);
  const idPaciente = (c) => consulta[c.idConsulta]?.idPaciente ?? orcamento[c.idOrcamento]?.idPaciente;
  const pessoas = await pessoasPorId(cobrancas.map(idPaciente));
  return cobrancas.map((c) => ({ ...c, idPaciente: idPaciente(c), paciente: pessoas[idPaciente(c)]?.nome ?? '—', consulta: consulta[c.idConsulta] }));
}
