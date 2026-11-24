'use strict';

// RF54: guia TISS do atendimento de convênio. Nasce em rascunho quando o
// atendimento é finalizado, com os dados que o sistema já tem, e só vai para
// o lote depois da crítica prévia. Depois de liberada não se edita: a correção
// é cancelar e gerar outra.

const igual = (a, b) => a != null && b != null && String(a) === String(b);
const somarDias = (data, dias) => new Date(Date.parse(`${data}T00:00:00Z`) + dias * 86400000).toISOString().slice(0, 10);
const centavos = (v) => Math.round(Number(v) * 100);
const dataBr = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '—');
const moeda = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

// Situações em que a Secretária ainda revisa a guia.
const EM_REVISAO = ['RASCUNHO', 'EM_DIGITACAO', 'BLOQUEADA'];

const dataDoAtendimento = (consulta) => consulta?.dataHora?.slice(0, 10) ?? null;

function contratoVigente(db, idConvenio, data) {
  const vigentes = db.contratosOperadora.filter((c) => igual(c.idConvenio, idConvenio) && c.situacao === 'VIGENTE');
  return vigentes.find((c) => c.vigenciaInicio <= data && data <= c.vigenciaFim) ?? null;
}

// RN-51.2: o valor é o da tabela vigente na data do atendimento.
function precoDaTabela(db, idContrato, idProcedimento, data) {
  const item = db.itensTabelaPreco.find(
    (i) =>
      igual(i.idContratoOperadora, idContrato) &&
      igual(i.idProcedimento, idProcedimento) &&
      (!i.vigenciaInicio || i.vigenciaInicio <= data) &&
      (!i.vigenciaFim || data <= i.vigenciaFim)
  );
  return item?.valorNegociado ?? null;
}

const maisRecente = (lista) => [...lista].sort((a, b) => Number(b.id) - Number(a.id))[0] ?? null;

// O que o sistema preenche sozinho: contrato, elegibilidade, autorização (com
// a senha, que nunca sai na resposta), valor da tabela e o CID registrado pelo
// médico, só como código (RN-54.3).
function dadosDaGuia(db, consulta) {
  const data = dataDoAtendimento(consulta);
  const procedimento = db.procedimentos.find((p) => igual(p.id, consulta.idProcedimento));
  const contrato = contratoVigente(db, consulta.idConvenio, data);
  const elegibilidade = maisRecente(db.elegibilidades.filter((e) => igual(e.idPaciente, consulta.idPaciente) && igual(e.idConvenio, consulta.idConvenio)));
  const autorizacao = maisRecente(db.autorizacoes.filter((a) => igual(a.idConsulta, consulta.id)));
  const registro = db.registrosClinicos.find((r) => igual(r.idConsulta, consulta.id));
  return {
    tipo: procedimento?.tipo === 'CONSULTA' ? 'CONSULTA' : 'SP_SADT',
    versaoTiss: contrato?.versaoTiss ?? '4.01.00',
    idContratoOperadora: contrato?.id ?? null,
    idElegibilidade: elegibilidade?.id ?? null,
    idAutorizacao: autorizacao?.id ?? null,
    valor: contrato ? precoDaTabela(db, contrato.id, consulta.idProcedimento, data) : null,
    cid: registro?.cid ?? autorizacao?.cid ?? null,
  };
}

const guiaAtiva = (db, idConsulta) => db.guiasTiss.find((g) => igual(g.idConsulta, idConsulta) && g.situacao !== 'CANCELADA');

function gerarGuia(db, consulta, { inserir, hoje }) {
  if (!consulta?.idConvenio || consulta.status !== 'FINALIZADO' || guiaAtiva(db, consulta.id)) return null;
  const base = `G${String(consulta.id).padStart(9, '0')}`;
  const anteriores = db.guiasTiss.filter((g) => String(g.numero).startsWith(base)).length;
  return inserir('guiasTiss', {
    numero: anteriores ? `${base}-${anteriores + 1}` : base,
    dataEmissao: hoje,
    situacao: 'EM_DIGITACAO',
    idConsulta: consulta.id,
    idLoteCobranca: null,
    ...dadosDaGuia(db, consulta),
  });
}

// Crítica prévia: os oito bloqueios do RF54. Cada um diz o item irregular e
// como corrigir (RN-54.1).
function criticaPrevia(db, guia, hoje) {
  const consulta = db.consultas.find((c) => igual(c.id, guia.idConsulta));
  const data = dataDoAtendimento(consulta) ?? guia.dataEmissao;
  const procedimento = db.procedimentos.find((p) => igual(p.id, consulta?.idProcedimento));
  const nome = procedimento?.nome ?? 'O procedimento';
  const contrato = db.contratosOperadora.find((c) => igual(c.id, guia.idContratoOperadora));
  const elegibilidade = db.elegibilidades.find((e) => igual(e.id, guia.idElegibilidade));
  const autorizacao = db.autorizacoes.find((a) => igual(a.id, guia.idAutorizacao));
  const bloqueios = [];
  const bloquear = (numero, item, correcao) => bloqueios.push({ numero, item, correcao });

  if (!elegibilidade) {
    bloquear(1, 'A elegibilidade do beneficiário não foi verificada.', 'Verifique na operadora, em Elegibilidade e autorização, e atualize a guia.');
  } else if (elegibilidade.situacao !== 'ELEGIVEL') {
    bloquear(1, 'A operadora respondeu que o beneficiário não é elegível.', 'Confira a carteirinha com o paciente, verifique de novo e atualize a guia.');
  }
  const autorizada = autorizacao?.situacao === 'AUTORIZADA' && Boolean(autorizacao.senha);
  if (procedimento?.exigeAutorizacao && !autorizada) {
    bloquear(2, `${nome} exige autorização prévia e não há senha válida.`, 'Acompanhe o pedido de autorização; com a senha, atualize a guia.');
  }
  if (autorizada && autorizacao.validade && data > autorizacao.validade) {
    bloquear(3, `O atendimento de ${dataBr(data)} está fora da validade da autorização, que ia até ${dataBr(autorizacao.validade)}.`, 'Peça uma nova autorização à operadora.');
  }
  const quantidade = guia.quantidade ?? 1;
  if (autorizada && autorizacao.quantidadeAutorizada != null && quantidade > autorizacao.quantidadeAutorizada) {
    bloquear(4, `Foram executadas ${quantidade} unidades e a operadora autorizou ${autorizacao.quantidadeAutorizada}.`, 'Peça a complementação da autorização.');
  }
  if (!procedimento?.codigo) {
    bloquear(5, `${nome} está sem código TUSS.`, 'O Administrador completa o código no cadastro de procedimentos.');
  }
  if (guia.tipo === 'SP_SADT' && !guia.cid) {
    bloquear(6, 'Falta o CID, exigido na guia SP/SADT.', 'O médico registra o CID no prontuário do atendimento; depois atualize a guia.');
  }
  const tabela = contrato ? precoDaTabela(db, contrato.id, consulta?.idProcedimento, data) : null;
  if (!contrato) {
    bloquear(7, `Não há contrato vigente com a operadora em ${dataBr(data)}.`, 'O Administrador cadastra ou renova o contrato em Contratos e tabelas.');
  } else if (tabela == null) {
    bloquear(7, `${nome} não está na tabela do contrato ${contrato.numero} vigente em ${dataBr(data)}.`, 'O Administrador inclui o procedimento na tabela do contrato.');
  } else if (guia.valor == null || centavos(guia.valor) !== centavos(tabela)) {
    bloquear(7, `O valor da guia (${guia.valor == null ? 'em branco' : moeda(guia.valor)}) diverge da tabela vigente (${moeda(tabela)}).`, 'Atualize a guia para trazer o valor da tabela.');
  }
  if (contrato?.prazoApresentacao) {
    const limite = somarDias(data, contrato.prazoApresentacao);
    if (limite < hoje) {
      bloquear(8, `O prazo de apresentação de ${contrato.prazoApresentacao} dias venceu em ${dataBr(limite)}.`, 'Fale com a operadora antes de apresentar; se ela recusar, cancele a guia.');
    }
  }
  return bloqueios;
}

module.exports = { EM_REVISAO, dadosDaGuia, gerarGuia, criticaPrevia, guiaAtiva };
