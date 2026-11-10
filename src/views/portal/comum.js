import React from 'react';
import { Navigate } from 'react-router-dom';

import { idTitular, listar, pessoasPorId, porId } from '../../servicos/dados';
import { useSessao } from '../../sessao/sessao';
import { diaMes, nomeMedico } from '../../utils/formatos';

// Partes usadas por mais de uma tela desta pasta.

// Titular das telas do portal e se quem vê é o próprio titular.
export function useTitular() {
  const { sessao } = useSessao();
  return { id: idTitular(sessao), ehResponsavel: sessao.usuario.papel === 'RESPONSAVEL_LEGAL', sessao };
}

// Consultas do titular, com médico e tipo de atendimento.
export async function carregarConsultasDoTitular(idPaciente) {
  const [consultas, procedimentos] = await Promise.all([listar('consultas', { idPaciente, _sort: 'dataHora' }), listar('procedimentos')]);
  const medicos = await pessoasPorId(consultas.map((c) => c.idMedico));
  const proc = porId(procedimentos);
  const tipo = (p) => {
    if (!p) return 'Consulta';
    if (/retorno/i.test(p.nome)) return 'Retorno';
    return p.tipo === 'CONSULTA' ? 'Consulta' : p.tipo === 'EXAME' ? 'Exame' : 'Procedimento';
  };
  return consultas.map((c) => ({ ...c, medico: nomeMedico(medicos[c.idMedico]), tipo: tipo(proc[c.idProcedimento]) }));
}

// Cobranças do titular: as das consultas e as dos orçamentos dele.
export async function carregarCobrancasDoTitular(idPaciente) {
  const [consultas, orcamentos] = await Promise.all([listar('consultas', { idPaciente }), listar('orcamentos', { idPaciente })]);
  const ids = consultas.map((c) => c.id);
  const idsOrc = orcamentos.map((o) => o.id);
  const [porConsulta, porOrcamento] = await Promise.all([
    ids.length ? listar('cobrancas', { idConsulta: ids }) : [],
    idsOrc.length ? listar('cobrancas', { idOrcamento: idsOrc }) : [],
  ]);
  const cobrancas = [...new Map([...porConsulta, ...porOrcamento].map((c) => [c.id, c])).values()];
  // Títulos e documentos completam a linha; se a API não os entregar ao titular,
  // a cobrança aparece mesmo assim.
  const titulos = cobrancas.length ? await listar('titulosReceber', { idCobranca: cobrancas.map((c) => c.id) }).catch(() => []) : [];
  const documentos = await listar('documentosFiscais').catch(() => []);
  const consulta = porId(consultas);
  return cobrancas
    .map((c) => {
      const titulo = titulos.find((t) => t.idCobranca === c.id);
      const docs = documentos.filter((d) => titulo && d.idTituloReceber === titulo.id && d.situacao === 'EMITIDO');
      const quando = consulta[c.idConsulta]?.dataHora ?? c.dataEmissao;
      return {
        ...c,
        descricao: `${titulo?.origem === 'COPARTICIPACAO' ? 'Coparticipação' : 'Consulta'} · ${diaMes(quando)}`,
        vencimento: titulo?.vencimento ?? c.dataEmissao,
        // Sem o título, o recibo da cobrança paga ainda pode ser pedido.
        recibo: docs.some((d) => d.tipo === 'RECIBO') || (!titulo && c.situacao === 'PAGA'),
        nfse: docs.some((d) => d.tipo === 'NFSE'),
      };
    })
    .sort((a, b) => b.vencimento.localeCompare(a.vencimento));
}

export function ExigeRepresentado({ children }) {
  const { id, ehResponsavel } = useTitular();
  if (ehResponsavel && !id) return <Navigate to='/portal/representado' replace />;
  return children;
}
