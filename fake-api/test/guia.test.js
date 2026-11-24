'use strict';

// RF54: guia TISS em rascunho, crítica prévia, liberação e nova guia depois
// do cancelamento.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { gerarBanco } = require('../seed');
const { criarApi } = require('../servidor');
const contas = require('../usuarios-de-teste.json');

async function subir() {
  const db = gerarBanco();
  const servidor = http.createServer(criarApi({ db, relogio: () => new Date(2026, 8, 28, 10, 0, 0) }));
  await new Promise((pronto) => servidor.listen(0, '127.0.0.1', pronto));
  const { port } = servidor.address();
  const pedir = async (metodo, caminho, { token, corpo } = {}) => {
    const res = await fetch(`http://127.0.0.1:${port}${caminho}`, {
      method: metodo,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const texto = await res.text();
    return { status: res.status, corpo: texto ? JSON.parse(texto) : null };
  };
  const entrar = async (login) => (await pedir('POST', '/login', { corpo: { login, senha: contas.senhaDemonstracao } })).corpo.token;
  return { db, pedir, entrar, fechar: () => new Promise((fim) => servidor.close(fim)) };
}

test('a crítica prévia bloqueia, a guia atualizada é liberada e a correção é cancelar e gerar outra', async () => {
  const { db, pedir, entrar, fechar } = await subir();
  try {
    const secretaria = await entrar('secretaria');
    const rascunhos = db.guiasTiss.filter((g) => g.situacao === 'EM_DIGITACAO');
    const comValorAntigo = rascunhos[rascunhos.length - 1];

    const critica = await pedir('GET', `/tiss/guias/${comValorAntigo.id}/critica`, { token: secretaria });
    assert.equal(critica.status, 200);
    assert.deepEqual(critica.corpo.bloqueios.map((b) => b.numero), [7]);
    assert.ok(critica.corpo.bloqueios[0].correcao, 'cada bloqueio diz como corrigir (RN-54.1)');

    const negada = await pedir('POST', `/tiss/guias/${comValorAntigo.id}/liberar`, { token: secretaria });
    assert.equal(negada.status, 422);
    assert.equal(negada.corpo.bloqueios.length, 1);
    assert.equal(comValorAntigo.situacao, 'BLOQUEADA');

    const atualizada = await pedir('POST', `/tiss/guias/${comValorAntigo.id}/atualizar`, { token: secretaria });
    assert.equal(atualizada.status, 200);
    assert.deepEqual(atualizada.corpo.bloqueios, []);
    assert.equal(comValorAntigo.situacao, 'EM_DIGITACAO');

    const liberada = await pedir('POST', `/tiss/guias/${comValorAntigo.id}/liberar`, { token: secretaria });
    assert.equal(liberada.status, 200, JSON.stringify(liberada.corpo));
    assert.equal(liberada.corpo.guia.situacao, 'LIBERADA');
    assert.equal((await pedir('POST', `/tiss/guias/${comValorAntigo.id}/atualizar`, { token: secretaria })).status, 409, 'liberada não muda');

    // Pela coleção, liberar sem a crítica não passa.
    assert.equal((await pedir('PATCH', `/guiasTiss/${rascunhos[0].id}`, { token: secretaria, corpo: { situacao: 'LIBERADA' } })).status, 422);
    assert.equal((await pedir('POST', '/guiasTiss', { token: secretaria, corpo: { idConsulta: rascunhos[0].idConsulta } })).status, 403);

    // Correção: cancelar e gerar a guia nova do mesmo atendimento.
    assert.equal((await pedir('PATCH', `/guiasTiss/${comValorAntigo.id}`, { token: secretaria, corpo: { situacao: 'CANCELADA' } })).status, 422);
    const cancelada = await pedir('PATCH', `/guiasTiss/${comValorAntigo.id}`, { token: secretaria, corpo: { situacao: 'CANCELADA', motivoCancelamento: 'Carteirinha trocada.' } });
    assert.equal(cancelada.status, 200, JSON.stringify(cancelada.corpo));
    const nova = await pedir('POST', '/tiss/guias', { token: secretaria, corpo: { idConsulta: comValorAntigo.idConsulta } });
    assert.equal(nova.status, 201, JSON.stringify(nova.corpo));
    assert.equal(nova.corpo.guia.situacao, 'EM_DIGITACAO');
    assert.equal(nova.corpo.guia.numero, `${comValorAntigo.numero}-2`);
    assert.equal((await pedir('POST', '/tiss/guias', { token: secretaria, corpo: { idConsulta: comValorAntigo.idConsulta } })).status, 409);

    const emLote = db.guiasTiss.find((g) => g.idLoteCobranca != null && g.situacao === 'LIBERADA');
    assert.equal((await pedir('PATCH', `/guiasTiss/${emLote.id}`, { token: secretaria, corpo: { situacao: 'CANCELADA', motivoCancelamento: 'Teste de lote.' } })).status, 422);

    const admin = await entrar('admin');
    assert.equal((await pedir('POST', `/tiss/guias/${rascunhos[0].id}/liberar`, { token: admin })).status, 403);
  } finally {
    await fechar();
  }
});

test('o atendimento de convênio finalizado pelo médico ganha a guia em rascunho', async () => {
  const { db, pedir, entrar, fechar } = await subir();
  try {
    const medico = await entrar('medico');
    const idMedico = db.usuarios.find((u) => u.login === 'medico').idPessoa;
    const consulta = db.consultas.find((c) => c.idMedico === idMedico && c.idConvenio && ['EM_ATENDIMENTO', 'NA_RECEPCAO'].includes(c.status));
    assert.ok(consulta, 'sem atendimento de convênio do médico no banco sintético');
    if (consulta.status === 'NA_RECEPCAO') {
      assert.equal((await pedir('PATCH', `/consultas/${consulta.id}`, { token: medico, corpo: { status: 'EM_ATENDIMENTO' } })).status, 200);
    }
    assert.ok(!db.guiasTiss.some((g) => g.idConsulta === consulta.id));
    assert.equal((await pedir('PATCH', `/consultas/${consulta.id}`, { token: medico, corpo: { status: 'FINALIZADO' } })).status, 200);
    const guias = db.guiasTiss.filter((g) => g.idConsulta === consulta.id);
    assert.equal(guias.length, 1);
    assert.equal(guias[0].situacao, 'EM_DIGITACAO');
    assert.ok(guias[0].idContratoOperadora && guias[0].valor > 0);
  } finally {
    await fechar();
  }
});
