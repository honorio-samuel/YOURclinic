import { listar, pessoasPorId, porId } from '../../servicos/dados';
import { useSessao } from '../../sessao/sessao';

// Partes usadas por mais de uma tela desta pasta.

export const useEhAdmin = () => useSessao().sessao.usuario.papel === 'ADMINISTRADOR';
export const nomeOperadora = (c) => c?.nome ?? c?.razaoSocial ?? '—';
export const opcoesOperadora = (linhas) => [['', 'Todas'], ...[...new Map((linhas ?? []).map((l) => [l.operadora, l.operadora])).entries()]];

// Guias com consulta, paciente, operadora e procedimento.
export async function carregarGuias() {
  const [guias, consultas, contratos, convenios, procedimentos] = await Promise.all([
    listar('guiasTiss', { _sort: 'numero', _order: 'desc' }),
    listar('consultas'),
    listar('contratosOperadora'),
    listar('convenios'),
    listar('procedimentos'),
  ]);
  const consulta = porId(consultas);
  const contrato = porId(contratos);
  const convenio = porId(convenios);
  const proc = porId(procedimentos);
  const pessoas = await pessoasPorId(guias.map((g) => consulta[g.idConsulta]?.idPaciente));
  return guias.map((g) => {
    const c = consulta[g.idConsulta];
    const p = proc[c?.idProcedimento];
    return {
      ...g,
      paciente: pessoas[c?.idPaciente]?.nome ?? '—',
      operadora: nomeOperadora(convenio[contrato[g.idContratoOperadora]?.idConvenio]),
      item: p ? `${p.codigo} · ${p.nome}` : '—',
    };
  });
}
