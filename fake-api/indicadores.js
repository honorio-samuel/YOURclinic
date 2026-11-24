'use strict';

// Painel financeiro (RF35) e dashboard gerencial (RF41), calculados no
// servidor para o Administrador. Nenhum indicador usa diagnóstico, CID ou
// prescrição (RN-41.2), e todo número traz a data-base do cálculo.

const igual = (a, b) => a != null && b != null && String(a) === String(b);
const { EXECUTADAS } = require('./estorno');

const centavos = (v) => Math.round(Number(v ?? 0) * 100);
const reais = (c) => c / 100;
const somar = (lista, valor) => reais(lista.reduce((s, x) => s + centavos(valor(x)), 0));
const grupo = (lista, valor) => ({ quantidade: lista.length, valor: somar(lista, valor) });
const minutos = (hora) => {
  const [h, m] = hora.slice(0, 5).split(':').map(Number);
  return h * 60 + m;
};
const diaDaSemana = (dia) => new Date(`${dia}T12:00:00Z`).getUTCDay();
function somarDias(dia, n) {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
// Dias úteis: sábado e domingo ficam de fora (X36).
function somarDiasUteis(dia, n) {
  let d = dia;
  let faltam = n;
  while (faltam > 0) {
    d = somarDias(d, 1);
    if (![0, 6].includes(diaDaSemana(d))) faltam -= 1;
  }
  return d;
}

// ── RF35 ─────────────────────────────────────────────────────────────────
function painelFinanceiro(db, { hoje, parametro }) {
  const doPaciente = db.titulosReceber.filter((t) => t.origem !== 'CONVENIO' && t.origem !== 'OPERADORA');
  const abertos = doPaciente.filter((t) => t.situacao === 'ABERTO');

  // Operadora: a situação vem da guia (RF54 a RF57).
  const glosada = new Set(db.glosas.map((g) => String(g.idGuiaTiss)));
  const emRecurso = new Set(
    db.recursosGlosa.map((r) => String(db.glosas.find((g) => igual(g.id, r.idGlosa))?.idGuiaTiss)).filter(Boolean)
  );
  const guias = db.guiasTiss.filter((g) => !['CANCELADA', 'EM_DIGITACAO', 'RASCUNHO'].includes(g.situacao));
  const situacaoDaGuia = (g) => {
    if (g.situacao === 'PAGA') return 'pago';
    if (emRecurso.has(String(g.id))) return 'emRecurso';
    if (glosada.has(String(g.id))) return 'glosado';
    if (g.situacao === 'ENVIADA') return 'apresentado';
    return 'aApresentar';
  };
  const operadora = Object.fromEntries(
    ['aApresentar', 'apresentado', 'glosado', 'emRecurso', 'pago'].map((s) => [
      s,
      grupo(guias.filter((g) => situacaoDaGuia(g) === s), (g) => g.valor),
    ])
  );

  // RF49: o que o adquirente ainda vai pagar, com a data prevista por X35 e X36.
  const credito = parametro('X35', 30);
  const debito = parametro('X36', 1);
  const emTransito = db.pagamentosCartao
    .filter((c) => c.situacaoConciliacao === 'PENDENTE' && db.pagamentos.find((p) => igual(p.id, c.id))?.situacao === 'CONFIRMADO')
    .map((c) => {
      const dia = String(c.dataHora ?? '').slice(0, 10);
      return {
        bruto: c.valorBruto,
        liquido: c.valorLiquido ?? c.valorBruto,
        previsto: c.modalidade === 'DEBITO' ? somarDiasUteis(dia, debito) : somarDias(dia, credito),
      };
    });
  const porData = {};
  for (const r of emTransito) {
    porData[r.previsto] ??= { data: r.previsto, bruto: 0, liquido: 0 };
    porData[r.previsto].bruto = reais(centavos(porData[r.previsto].bruto) + centavos(r.bruto));
    porData[r.previsto].liquido = reais(centavos(porData[r.previsto].liquido) + centavos(r.liquido));
  }

  const pagar = db.titulosPagar;
  const pagarAberto = pagar.filter((t) => t.situacao === 'ABERTO');
  // RF48: o que voltou ao pagador por cancelamento ou estorno sai do recebido.
  const devolvido = somar(db.estornos.filter((e) => e.tipo !== 'CHARGEBACK' && EXECUTADAS.includes(e.situacao)), (e) => e.valor);
  const recebido = reais(centavos(somar(db.pagamentos.filter((p) => p.situacao === 'CONFIRMADO'), (p) => p.valor)) - centavos(devolvido));
  const pago = somar(pagar.filter((t) => t.situacao === 'PAGO'), (t) => t.valor);
  const realizado = reais(centavos(recebido) - centavos(pago));
  const aReceber =
    centavos(somar(abertos, (t) => t.valor)) +
    ['aApresentar', 'apresentado', 'emRecurso'].reduce((s, k) => s + centavos(operadora[k].valor), 0) +
    centavos(somar(emTransito, (r) => r.liquido));
  const aPagar = centavos(somar(pagarAberto, (t) => t.valor));

  return {
    dataBase: hoje,
    receberPaciente: {
      aVencer: grupo(abertos.filter((t) => t.vencimento >= hoje), (t) => t.valor),
      vencido: grupo(abertos.filter((t) => t.vencimento < hoje), (t) => t.valor),
      pago: grupo(doPaciente.filter((t) => t.situacao === 'PAGO'), (t) => t.valor),
    },
    receberOperadora: operadora,
    cartaoEmTransito: {
      quantidade: emTransito.length,
      bruto: somar(emTransito, (r) => r.bruto),
      liquido: somar(emTransito, (r) => r.liquido),
      taxa: reais(centavos(somar(emTransito, (r) => r.bruto)) - centavos(somar(emTransito, (r) => r.liquido))),
      porData: Object.values(porData).sort((a, b) => a.data.localeCompare(b.data)),
    },
    pagar: {
      aVencer: grupo(pagarAberto.filter((t) => t.vencimento >= hoje), (t) => t.valor),
      vencido: grupo(pagarAberto.filter((t) => t.vencimento < hoje), (t) => t.valor),
      pago: grupo(pagar.filter((t) => t.situacao === 'PAGO'), (t) => t.valor),
    },
    // RN-35.3: o realizado é caixa (o que entrou e saiu); o projetado soma o
    // que está para receber e para pagar.
    saldo: { realizado, projetado: reais(centavos(realizado) + aReceber - aPagar) },
  };
}

// ── RF41 ─────────────────────────────────────────────────────────────────
// Blocos da grade no período: ocupados, livres e bloqueados por motivo.
function ociosidade(db, { de, ate }) {
  const medicos = db.medicos.filter((m) => m.situacao === 'ATIVO');
  const contas = { blocos: 0, ocupados: 0, livres: 0, bloqueados: {} };
  const consultasDe = new Map();
  for (const c of db.consultas) {
    if (['CANCELADO'].includes(c.status)) continue;
    const chave = `${c.idMedico}|${c.dataHora.slice(0, 10)}`;
    if (!consultasDe.has(chave)) consultasDe.set(chave, []);
    consultasDe.get(chave).push([minutos(c.dataHora.slice(11, 16)), minutos(c.dataHora.slice(11, 16)) + (c.duracao ?? 30)]);
  }
  const bloqueios = db.bloqueiosAgenda.filter((b) => b.situacao !== 'INATIVO');
  for (let dia = de; dia <= ate; dia = somarDias(dia, 1)) {
    for (const m of medicos) {
      for (const g of db.gradesHorario.filter((x) => igual(x.idMedico, m.id) && x.diaSemana === diaDaSemana(dia))) {
        const passo = g.granularidade || 30;
        for (let t = minutos(g.horaInicio); t + passo <= minutos(g.horaFim); t += passo) {
          contas.blocos += 1;
          const inicio = `${dia}T${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}:00`;
          const fimMin = t + passo;
          const fim = `${dia}T${String(Math.floor(fimMin / 60)).padStart(2, '0')}:${String(fimMin % 60).padStart(2, '0')}:00`;
          const bloqueio = bloqueios.find((b) => (b.idMedico == null || igual(b.idMedico, m.id)) && b.dataInicio < fim && inicio < b.dataFim);
          if (bloqueio) {
            contas.bloqueados[bloqueio.motivo] = (contas.bloqueados[bloqueio.motivo] ?? 0) + 1;
          } else if ((consultasDe.get(`${m.id}|${dia}`) ?? []).some(([a, b]) => a < fimMin && t < b)) {
            contas.ocupados += 1;
          } else {
            contas.livres += 1;
          }
        }
      }
    }
  }
  return {
    blocos: contas.blocos,
    ocupados: contas.ocupados,
    livres: contas.livres,
    bloqueados: Object.entries(contas.bloqueados).map(([motivo, blocos]) => ({ motivo, blocos })),
  };
}

function dashboardGerencial(db, { de, ate, hoje }) {
  const fimDoPeriodo = ate < hoje ? ate : hoje;
  const doPeriodo = db.consultas.filter((c) => c.dataHora.slice(0, 10) >= de && c.dataHora.slice(0, 10) <= fimDoPeriodo);
  const desfecho = Object.fromEntries(
    ['FINALIZADO', 'CANCELADO', 'NAO_COMPARECEU'].map((s) => [s, doPeriodo.filter((c) => c.status === s).length])
  );

  const atendidas = doPeriodo.filter((c) => c.status !== 'CANCELADO');
  const porOperadora = {};
  for (const c of atendidas.filter((x) => x.idConvenio != null)) {
    const nome = db.convenios.find((v) => igual(v.id, c.idConvenio))?.nome ?? 'Convênio';
    porOperadora[nome] = (porOperadora[nome] ?? 0) + 1;
  }

  // Espera: de Na Recepção a Em Atendimento, pelos carimbos (RF22).
  const esperas = doPeriodo
    .map((c) => c.carimbos)
    .filter((k) => k?.NA_RECEPCAO && k?.EM_ATENDIMENTO)
    .map((k) => (Date.parse(`${k.EM_ATENDIMENTO}Z`) - Date.parse(`${k.NA_RECEPCAO}Z`)) / 60000)
    .filter((m) => m >= 0);

  // Orçamento emitido é o que chegou ao titular (RF31).
  const emitidos = db.orcamentos.filter((o) => ['ACEITE', 'ACEITO', 'RECUSADO', 'EXPIRADO'].includes(o.etapa));
  const aceitos = emitidos.filter((o) => o.etapa === 'ACEITO');

  const porOperador = {};
  for (const c of db.caixas.filter((x) => x.divergencia != null && x.divergencia !== 0)) {
    const nome = db.pessoas.find((p) => igual(p.id, c.idSecretaria))?.nome ?? 'Operador';
    porOperador[nome] ??= { operador: nome, ocorrencias: 0, valor: 0 };
    porOperador[nome].ocorrencias += 1;
    porOperador[nome].valor = reais(centavos(porOperador[nome].valor) + centavos(c.divergencia));
  }

  // Índice de glosa: glosado sobre apresentado, por operadora e por motivo (RF56).
  const apresentadas = db.guiasTiss.filter((g) => g.idLoteCobranca != null && !['CANCELADA', 'EM_DIGITACAO', 'RASCUNHO'].includes(g.situacao));
  const operadoraDaGuia = (g) => {
    const contrato = db.contratosOperadora.find((x) => igual(x.id, g.idContratoOperadora));
    return db.convenios.find((v) => igual(v.id, contrato?.idConvenio))?.nome ?? 'Operadora';
  };
  const glosaPorOperadora = {};
  for (const g of apresentadas) {
    const nome = operadoraDaGuia(g);
    glosaPorOperadora[nome] ??= { operadora: nome, apresentado: 0, glosado: 0 };
    glosaPorOperadora[nome].apresentado = reais(centavos(glosaPorOperadora[nome].apresentado) + centavos(g.valor));
  }
  const glosaPorMotivo = {};
  for (const gl of db.glosas) {
    const guia = db.guiasTiss.find((g) => igual(g.id, gl.idGuiaTiss));
    if (!guia) continue;
    const nome = operadoraDaGuia(guia);
    glosaPorOperadora[nome] ??= { operadora: nome, apresentado: 0, glosado: 0 };
    glosaPorOperadora[nome].glosado = reais(centavos(glosaPorOperadora[nome].glosado) + centavos(gl.valorGlosado));
    glosaPorMotivo[gl.motivo] = reais(centavos(glosaPorMotivo[gl.motivo] ?? 0) + centavos(gl.valorGlosado));
  }
  const totalApresentado = somar(apresentadas, (g) => g.valor);
  const totalGlosado = somar(db.glosas, (g) => g.valorGlosado);
  const indice = (glosado, apresentado) => (apresentado > 0 ? Math.round((glosado / apresentado) * 1000) / 10 : null);

  return {
    dataBase: hoje,
    periodo: { de, ate: fimDoPeriodo },
    desfecho,
    tipoAtendimento: {
      particular: atendidas.filter((c) => c.idConvenio == null).length,
      convenio: Object.entries(porOperadora).map(([operadora, quantidade]) => ({ operadora, quantidade })),
    },
    tempoMedioEspera: {
      minutos: esperas.length ? Math.round(esperas.reduce((s, m) => s + m, 0) / esperas.length) : null,
      amostra: esperas.length,
    },
    ociosidade: ociosidade(db, { de, ate: fimDoPeriodo }),
    conversaoOrcamento: {
      emitidos: emitidos.length,
      aceitos: aceitos.length,
      taxa: emitidos.length ? Math.round((aceitos.length / emitidos.length) * 1000) / 10 : null,
    },
    divergenciaCaixa: Object.values(porOperador),
    indiceGlosa: {
      apresentado: totalApresentado,
      glosado: totalGlosado,
      indice: indice(totalGlosado, totalApresentado),
      porOperadora: Object.values(glosaPorOperadora).map((o) => ({ ...o, indice: indice(o.glosado, o.apresentado) })),
      porMotivo: Object.entries(glosaPorMotivo).map(([motivo, valor]) => ({ motivo, valor })),
    },
  };
}

module.exports = { painelFinanceiro, dashboardGerencial, ociosidade, somarDiasUteis };
