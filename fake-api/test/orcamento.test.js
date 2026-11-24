'use strict';

// Orçamento, etapa 1 (RF31): o Médico monta o escopo clínico de um paciente
// com quem tem vínculo, sem valores, e envia para a etapa de valores.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { gerarBanco } = require('../seed');
const { criarApi } = require('../servidor');
const contas = require('../usuarios-de-teste.json');

const BANCO = gerarBanco();
const SENHA = contas.senhaDemonstracao;
const DEZ_HORAS = () => new Date(2026, 8, 28, 10, 0, 0);

async function subir() {
  const db = structuredClone(BANCO);
  const servidor = http.createServer(criarApi({ db, relogio: DEZ_HORAS }));
  await new Promise((pronto) => servidor.listen(0, '127.0.0.1', pronto));
  const { port } = servidor.address();

  async function pedir(metodo, caminho, { token, corpo } = {}) {
    const res = await fetch(`http://127.0.0.1:${port}${caminho}`, {
      method: metodo,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(corpo ? { 'Content-Type': 'application/json' } : {}),
      },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const texto = await res.text();
    return { status: res.status, corpo: texto ? JSON.parse(texto) : null };
  }

  async function entrar(login) {
    const r = await pedir('POST', '/login', { corpo: { login, senha: SENHA } });
    assert.equal(r.status, 200, `login de ${login} falhou`);
    return r.corpo.token;
  }

  return { db, pedir, entrar, fechar: () => new Promise((fim) => servidor.close(fim)) };
}

describe('escopo clínico do orçamento (RF31, etapa 1)', () => {
  let api;
  let medico;
  let eu;
  before(async () => {
    api = await subir();
    medico = await api.entrar('medico');
    eu = api.db.usuarios.find((u) => u.login === 'medico').idPessoa;
  });
  after(() => api.fechar());

  const meuPaciente = () => api.db.vinculos.find((v) => v.idMedico === eu && v.estado === 'ATIVO').idPaciente;
  const procedimentoAtivo = () => api.db.procedimentos.find((p) => p.situacao === 'ATIVO' && p.tipo !== 'CONSULTA');

  test('o orçamento nasce no escopo, do médico, com a data da clínica', async () => {
    assert.equal((await api.pedir('POST', '/orcamentos', { token: medico, corpo: {} })).status, 422);
    const r = await api.pedir('POST', '/orcamentos', { token: medico, corpo: { idPaciente: meuPaciente(), etapa: 'ACEITE', valorTotal: 10 } });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    assert.equal(r.corpo.etapa, 'ESCOPO');
    assert.equal(r.corpo.idMedico, eu);
    assert.equal(r.corpo.dataEmissao, '2026-09-28');
    assert.equal('valorTotal' in r.corpo, false);
  });

  test('paciente sem vínculo com o médico fica de fora', async () => {
    const comVinculo = new Set(api.db.vinculos.filter((v) => v.idMedico === eu).map((v) => v.idPaciente));
    const outro = api.db.pacientes.find((p) => !comVinculo.has(p.id));
    const r = await api.pedir('POST', '/orcamentos', { token: medico, corpo: { idPaciente: outro.id } });
    assert.ok([403, 404].includes(r.status), String(r.status));
  });

  test('itens do catálogo, sem preço, e envio com justificativa', async () => {
    const { corpo: orcamento } = await api.pedir('POST', '/orcamentos', { token: medico, corpo: { idPaciente: meuPaciente() } });
    const p = procedimentoAtivo();
    assert.equal((await api.pedir('PATCH', `/orcamentos/${orcamento.id}`, { token: medico, corpo: { etapa: 'VALORES' } })).status, 422);
    const semProcedimento = await api.pedir('POST', '/itensOrcamento', { token: medico, corpo: { idOrcamento: orcamento.id, idProcedimento: 9999, quantidade: 1 } });
    assert.equal(semProcedimento.status, 422);
    const zero = await api.pedir('POST', '/itensOrcamento', { token: medico, corpo: { idOrcamento: orcamento.id, idProcedimento: p.id, quantidade: 0 } });
    assert.equal(zero.status, 422);
    const item = await api.pedir('POST', '/itensOrcamento', {
      token: medico,
      corpo: { idOrcamento: orcamento.id, idProcedimento: p.id, quantidade: 2, valorUnitario: 1, descricao: 'Outro nome' },
    });
    assert.equal(item.status, 201, JSON.stringify(item.corpo));
    assert.equal(item.corpo.descricao, p.nome);
    assert.equal(api.db.itensOrcamento.find((i) => i.id === item.corpo.id).valorUnitario, null);
    assert.equal((await api.pedir('PATCH', `/orcamentos/${orcamento.id}`, { token: medico, corpo: { etapa: 'VALORES' } })).status, 422);
    const enviado = await api.pedir('PATCH', `/orcamentos/${orcamento.id}`, {
      token: medico,
      corpo: { etapa: 'VALORES', justificativaClinica: 'Indicação clínica para o procedimento.' },
    });
    assert.equal(enviado.status, 200, JSON.stringify(enviado.corpo));
    assert.equal(enviado.corpo.etapa, 'VALORES');
    // Fora do escopo, o item não muda nem sai.
    assert.equal((await api.pedir('PATCH', `/itensOrcamento/${item.corpo.id}`, { token: medico, corpo: { quantidade: 3 } })).status, 409);
    assert.equal((await api.pedir('DELETE', `/itensOrcamento/${item.corpo.id}`, { token: medico })).status, 409);
  });

  test('no escopo, o médico tira o item', async () => {
    const { corpo: orcamento } = await api.pedir('POST', '/orcamentos', { token: medico, corpo: { idPaciente: meuPaciente() } });
    const { corpo: item } = await api.pedir('POST', '/itensOrcamento', {
      token: medico,
      corpo: { idOrcamento: orcamento.id, idProcedimento: procedimentoAtivo().id, quantidade: 1 },
    });
    assert.equal((await api.pedir('DELETE', `/itensOrcamento/${item.id}`, { token: medico })).status, 204);
    assert.equal(api.db.itensOrcamento.some((i) => i.id === item.id), false);
  });

  test('a justificativa clínica fica com o médico (RC09)', async () => {
    const comJustificativa = api.db.orcamentos.find((o) => o.justificativaClinica && o.etapa === 'VALORES');
    const secretaria = await api.entrar('secretaria');
    const lido = await api.pedir('GET', `/orcamentos/${comJustificativa.id}`, { token: secretaria });
    assert.equal(lido.status, 200);
    assert.equal('justificativaClinica' in lido.corpo, false);
    const admin = await api.entrar('admin');
    const fila = (await api.pedir('GET', '/orcamentos', { token: admin })).corpo;
    assert.ok(fila.length > 0 && fila.every((o) => !('justificativaClinica' in o)));
    const doMedico = (await api.pedir('GET', '/orcamentos', { token: medico })).corpo;
    assert.ok(doMedico.some((o) => o.justificativaClinica));
  });
});
