'use strict';

// Recibo (RF33) e NFS-e (RF34) montados no servidor, sem diagnóstico nem CID
// (RN-33.3). As alíquotas vêm de tabela versionada (RN-34.2, aliquotas.json)
// e o emitente é o da clínica fictícia da demonstração.

const ALIQUOTAS = require('./aliquotas.json');

const EMITENTE = {
  razaoSocial: 'YOURClinic Serviços Médicos Ltda. (fictícia)',
  cnpj: '00.000.000/0001-00',
  endereco: 'Rua das Acácias, nº 120, Bairro Centro, 01000-000',
  responsavelTecnico: 'Diretor técnico da clínica (fictício)',
};

const igual = (a, b) => a != null && b != null && String(a) === String(b);
const centavos = (valor) => Math.round(Number(valor) * 100);
const reais = (c) => c / 100;
const dataBr = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}`;

function aliquotasEm(dia) {
  return ALIQUOTAS.find((a) => a.vigenciaInicio <= dia && dia <= a.vigenciaFim) ?? null;
}

const imposto = (valor, aliquota) => reais(Math.round(centavos(valor) * aliquota));

// RN-33.1: cada tipo tem a própria numeração, sequencial e sem lacunas.
function proximoNumero(db, tipo) {
  const maior = db.documentosFiscais.filter((d) => d.tipo === tipo && d.numero).reduce((m, d) => Math.max(m, Number(d.numero)), 0);
  return String(maior + 1).padStart(8, '0');
}

// O título de paciente nasce da cobrança de uma consulta ou de um orçamento.
function origemDoTitulo(db, titulo) {
  const cobranca = db.cobrancas.find((c) => igual(c.id, titulo?.idCobranca));
  const consulta = cobranca ? db.consultas.find((c) => igual(c.id, cobranca.idConsulta)) : undefined;
  const orcamento = cobranca ? db.orcamentos.find((o) => igual(o.id, cobranca.idOrcamento)) : undefined;
  return { cobranca, consulta, orcamento, idPaciente: consulta?.idPaciente ?? orcamento?.idPaciente ?? null };
}

// Só a descrição do serviço: nada do registro clínico entra (RN-33.3).
function descricaoDoServico(db, { consulta, orcamento }) {
  if (consulta) {
    const procedimento = db.procedimentos.find((p) => igual(p.id, consulta.idProcedimento));
    return `${procedimento?.nome ?? 'Atendimento'} em ${dataBr(consulta.dataHora)}`;
  }
  if (orcamento) {
    const itens = db.itensOrcamento.filter((i) => igual(i.idOrcamento, orcamento.id));
    return itens.map((i) => (i.quantidade > 1 ? `${i.descricao} (${i.quantidade} vezes)` : i.descricao)).join('; ') || `Orçamento nº ${orcamento.id}`;
  }
  return 'Serviço de saúde';
}

const MEIO = { DINHEIRO: 'Dinheiro', PIX: 'Pix' };
const MODALIDADE = {
  DEBITO: 'Cartão de débito',
  CREDITO: 'Cartão de crédito',
  CREDITO_PARCELADO_LOJISTA: 'Cartão de crédito parcelado',
  CREDITO_PARCELADO_EMISSOR: 'Cartão de crédito parcelado',
};

function formasDePagamento(db, cobranca) {
  if (!cobranca) return [];
  const confirmados = db.pagamentos.filter((p) => igual(p.idCobranca, cobranca.id) && p.situacao === 'CONFIRMADO');
  const forma = (p) => (p.meio === 'CARTAO' ? MODALIDADE[db.pagamentosCartao.find((c) => igual(c.id, p.id))?.modalidade] ?? 'Cartão' : MEIO[p.meio] ?? p.meio);
  return [...new Set(confirmados.map(forma))];
}

// RN-33.2: o pagador pode ser outra pessoa, como o responsável que paga pelo menor.
function pagadoresPossiveis(db, idPaciente) {
  const responsaveis = db.representacoes.filter((r) => igual(r.idPaciente, idPaciente)).map((r) => r.idResponsavelLegal);
  return [idPaciente, ...responsaveis].filter((id) => id != null).map(String);
}

// Conteúdo do documento, para ver, imprimir e salvar em PDF.
function montarDocumentoFiscal(db, doc) {
  const titulo = db.titulosReceber.find((t) => igual(t.id, doc.idTituloReceber));
  const origem = origemDoTitulo(db, titulo);
  const pessoa = (id) => db.pessoas.find((p) => igual(p.id, id));
  const paciente = pessoa(doc.idPaciente ?? origem.idPaciente);
  const pagador = pessoa(doc.idPagador ?? doc.idPaciente ?? origem.idPaciente);
  const aliquotas = doc.tipo === 'NFSE' ? aliquotasEm(doc.dataEmissao) : null;
  return {
    id: doc.id,
    tipo: doc.tipo,
    numero: doc.numero,
    situacao: doc.situacao,
    dataEmissao: doc.dataEmissao,
    valor: doc.valor,
    ibs: doc.ibs,
    cbs: doc.cbs,
    aliquotas: aliquotas ? { ibs: aliquotas.ibs, cbs: aliquotas.cbs } : null,
    chaveAcesso: doc.chaveAcesso ?? null,
    erro: doc.erro ?? null,
    emitente: EMITENTE,
    pagador: pagador ? { nome: pagador.nome, cpf: pagador.cpf ?? null } : null,
    paciente: paciente ? { nome: paciente.nome, cpf: paciente.cpf ?? null } : null,
    descricao: descricaoDoServico(db, origem),
    formasDePagamento: formasDePagamento(db, origem.cobranca),
  };
}

module.exports = { EMITENTE, aliquotasEm, imposto, proximoNumero, origemDoTitulo, pagadoresPossiveis, montarDocumentoFiscal };
