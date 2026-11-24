'use strict';

// Relatórios administrativos (RF42). Tudo agregado e sem conteúdo clínico:
// nada de CID, diagnóstico, anotação ou dispensação identificada. O recorte de
// atendimento com menos de MINIMO registros é suprimido, porque agregado com
// poucos casos identifica o paciente por dedução.

const MINIMO = 5;
const igual = (a, b) => a != null && b != null && String(a) === String(b);
const centavos = (v) => Math.round(Number(v ?? 0) * 100);
const reais = (c) => c / 100;
const noPeriodo = (dataHora, de, ate) => Boolean(dataHora) && dataHora.slice(0, 10) >= de && dataHora.slice(0, 10) <= ate;

const MEIOS = { DINHEIRO: 'Dinheiro', PIX: 'Pix', CARTAO: 'Cartão' };

function nomeDe(db, idPessoa) {
  const pessoa = db.pessoas.find((p) => igual(p.id, idPessoa));
  return pessoa?.nome ?? '—';
}

// Agrupa e, se pedido, suprime grupos pequenos.
function agrupar(itens, chave, { suprimir = false, valor } = {}) {
  const grupos = new Map();
  for (const item of itens) {
    const k = chave(item);
    const g = grupos.get(k) ?? { chave: k, quantidade: 0, centavos: 0 };
    g.quantidade += 1;
    if (valor) g.centavos += centavos(valor(item));
    grupos.set(k, g);
  }
  const todos = [...grupos.values()].sort((a, b) => b.quantidade - a.quantidade || String(a.chave).localeCompare(String(b.chave)));
  if (!suprimir) return { grupos: todos, suprimidos: 0 };
  return { grupos: todos.filter((g) => g.quantidade >= MINIMO), suprimidos: todos.filter((g) => g.quantidade < MINIMO).length };
}

const DIMENSOES = {
  'Atendimentos por convênio': (db, de, ate) => {
    const finalizadas = db.consultas.filter((c) => c.status === 'FINALIZADO' && noPeriodo(c.dataHora, de, ate));
    const convenio = (c) => (c.idConvenio == null ? 'Particular' : db.convenios.find((x) => igual(x.id, c.idConvenio))?.nome ?? 'Convênio');
    const { grupos, suprimidos } = agrupar(finalizadas, convenio, { suprimir: true });
    return { colunas: ['Convênio', 'Atendimentos'], linhas: grupos.map((g) => [g.chave, g.quantidade]), suprimidos };
  },
  'Atendimentos por médico': (db, de, ate) => {
    const finalizadas = db.consultas.filter((c) => c.status === 'FINALIZADO' && noPeriodo(c.dataHora, de, ate));
    const { grupos, suprimidos } = agrupar(finalizadas, (c) => nomeDe(db, c.idMedico), { suprimir: true });
    return { colunas: ['Médico', 'Atendimentos'], linhas: grupos.map((g) => [g.chave, g.quantidade]), suprimidos };
  },
  'Faturamento por médico': (db, de, ate) => {
    const cobradas = db.cobrancas
      .map((cob) => ({ cob, consulta: db.consultas.find((c) => igual(c.id, cob.idConsulta)) }))
      .filter(({ consulta }) => consulta && noPeriodo(consulta.dataHora, de, ate));
    const { grupos, suprimidos } = agrupar(cobradas, ({ consulta }) => nomeDe(db, consulta.idMedico), { suprimir: true, valor: ({ cob }) => cob.valorTotal });
    return { colunas: ['Médico', 'Cobranças', 'Valor (R$)'], linhas: grupos.map((g) => [g.chave, g.quantidade, reais(g.centavos)]), suprimidos };
  },
  'Glosas por motivo': (db, de, ate) => {
    const glosas = db.glosas.filter((g) => noPeriodo(g.dataDemonstrativo, de, ate));
    const { grupos } = agrupar(glosas, (g) => g.motivo, { valor: (g) => g.valorGlosado });
    return { colunas: ['Motivo', 'Glosas', 'Valor glosado (R$)'], linhas: grupos.map((g) => [g.chave, g.quantidade, reais(g.centavos)]), suprimidos: 0 };
  },
  'Glosas por operadora': (db, de, ate) => {
    const glosas = db.glosas.filter((g) => noPeriodo(g.dataDemonstrativo, de, ate));
    const operadora = (g) => {
      const guia = db.guiasTiss.find((x) => igual(x.id, g.idGuiaTiss));
      const contrato = db.contratosOperadora.find((x) => igual(x.id, guia?.idContratoOperadora));
      return db.convenios.find((x) => igual(x.id, contrato?.idConvenio))?.nome ?? '—';
    };
    const { grupos } = agrupar(glosas, operadora, { valor: (g) => g.valorGlosado });
    return { colunas: ['Operadora', 'Glosas', 'Valor glosado (R$)'], linhas: grupos.map((g) => [g.chave, g.quantidade, reais(g.centavos)]), suprimidos: 0 };
  },
  // RC08: saída em atendimento só somada por item, nunca por paciente.
  'Estoque por item': (db, de, ate) => {
    const linhas = db.produtos.map((p) => {
      const lotes = db.lotes.filter((l) => igual(l.idProduto, p.id)).map((l) => l.id);
      const movimentos = db.movimentacoes.filter((m) => lotes.some((id) => igual(id, m.idLote)) && noPeriodo(m.dataHora, de, ate));
      const soma = (f) => movimentos.filter(f).reduce((s, m) => s + Math.abs(m.quantidade), 0);
      const saldo = db.lotes.filter((l) => igual(l.idProduto, p.id)).reduce((s, l) => s + l.quantidade, 0);
      return [p.descricao, soma((m) => m.tipo === 'ENTRADA'), soma((m) => m.origem === 'DISPENSACAO'), soma((m) => m.origem === 'DESCARTE'), saldo];
    });
    return { colunas: ['Item', 'Entradas', 'Saídas em atendimento', 'Descartes', 'Saldo atual'], linhas, suprimidos: 0 };
  },
  'Recebimentos por meio de pagamento': (db, de, ate) => {
    const pagos = db.pagamentos.filter((p) => p.situacao === 'CONFIRMADO' && noPeriodo(p.dataHora, de, ate));
    const { grupos } = agrupar(pagos, (p) => MEIOS[p.meio] ?? p.meio, { valor: (p) => p.valor });
    return { colunas: ['Meio', 'Pagamentos', 'Valor (R$)'], linhas: grupos.map((g) => [g.chave, g.quantidade, reais(g.centavos)]), suprimidos: 0 };
  },
};

function montarRelatorio(db, relatorio) {
  const montar = DIMENSOES[relatorio.nome];
  if (!montar) return { colunas: ['Aviso'], linhas: [['Dimensão sem modelo nesta versão.']], suprimidos: 0 };
  return montar(db, relatorio.periodoInicio, relatorio.periodoFim);
}

// CSV com separador ";" e BOM, para o Excel abrir com acentos.
function paraCsv({ colunas, linhas, suprimidos }) {
  const celula = (v) => {
    const texto = typeof v === 'number' ? String(v).replace('.', ',') : String(v ?? '');
    return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
  };
  const corpo = [colunas, ...linhas].map((linha) => linha.map(celula).join(';'));
  if (suprimidos) corpo.push(`${suprimidos} recorte(s) com menos de ${MINIMO} registros suprimido(s)`);
  return `﻿${corpo.join('\r\n')}\r\n`;
}

module.exports = { MINIMO, DIMENSOES, montarRelatorio, paraCsv };
