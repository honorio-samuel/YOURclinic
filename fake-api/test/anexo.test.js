'use strict';

// Anexos de exame (RF26, RF27): tipo real, tamanho, varredura, quem envia,
// quem abre o conteúdo e o aceite médico do exame enviado pelo titular.

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');

const { gerarBanco } = require('../seed');
const { criarApi } = require('../servidor');
const contas = require('../usuarios-de-teste.json');

const BANCO = gerarBanco();
const SENHA = contas.senhaDemonstracao;
const DEZ_HORAS = () => new Date(2026, 8, 28, 10, 0, 0);
const PDF = Buffer.from('%PDF-1.4\n% exame de teste\n%%EOF\n', 'latin1');
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);

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
    const tipo = res.headers.get('content-type') ?? '';
    const bruto = Buffer.from(await res.arrayBuffer());
    const corpoResposta = tipo.includes('json') ? JSON.parse(bruto.toString('utf8') || 'null') : bruto;
    return { status: res.status, corpo: corpoResposta, tipo, disposicao: res.headers.get('content-disposition') };
  }

  async function entrar(login) {
    const r = await pedir('POST', '/login', { corpo: { login, senha: SENHA } });
    assert.equal(r.status, 200, `login de ${login} falhou`);
    return r.corpo.token;
  }

  return { db, pedir, entrar, fechar: () => new Promise((fim) => servidor.close(fim)) };
}

const envio = (idPaciente, nomeArquivo, conteudo) => ({ idPaciente, nomeArquivo, conteudo: conteudo.toString('base64') });

describe('envio de anexo (RF26)', () => {
  let api;
  let secretaria;
  let medico;
  let eu;
  before(async () => {
    api = await subir();
    secretaria = await api.entrar('secretaria');
    medico = await api.entrar('medico');
    eu = api.db.usuarios.find((u) => u.login === 'medico').idPessoa;
  });
  after(() => api.fechar());

  const meuPaciente = () => api.db.vinculos.find((v) => v.idMedico === eu && v.estado === 'ATIVO').idPaciente;

  test('a coleção genérica não recebe anexo', async () => {
    const r = await api.pedir('POST', '/anexos', { token: secretaria, corpo: { idPaciente: meuPaciente(), nomeArquivo: 'x.pdf' } });
    assert.equal(r.status, 403);
  });

  test('a Secretária envia e vê só os metadados; o conteúdo, nunca', async () => {
    const r = await api.pedir('POST', '/anexos/envio', { token: secretaria, corpo: envio(meuPaciente(), 'laudo.pdf', PDF) });
    assert.equal(r.status, 201, JSON.stringify(r.corpo));
    assert.equal(r.corpo.situacao, 'DISPONIVEL');
    assert.equal(r.corpo.tipoMime, 'application/pdf');
    assert.equal(r.corpo.tamanho, PDF.length);
    assert.equal('conteudo' in r.corpo, false);
    const conteudo = await api.pedir('GET', `/anexos/${r.corpo.id}/arquivo`, { token: secretaria });
    assert.equal(conteudo.status, 403);
    // O médico do vínculo abre o mesmo arquivo, e cada leitura vai ao log.
    const aberto = await api.pedir('GET', `/anexos/${r.corpo.id}/arquivo`, { token: medico });
    assert.equal(aberto.status, 200);
    assert.match(aberto.tipo, /application\/pdf/);
    assert.ok(aberto.corpo.equals(PDF));
    const baixado = await api.pedir('GET', `/anexos/${r.corpo.id}/arquivo?baixar`, { token: medico });
    assert.match(baixado.disposicao, /^attachment/);
    assert.ok(api.db.logsAuditoria.some((l) => l.registroAlvo === `anexos/${r.corpo.id}` && l.acao === 'BAIXAR'));
  });

  test('o tipo vale pelo conteúdo, e a tentativa com tipo trocado vai ao log (E1)', async () => {
    const trocado = await api.pedir('POST', '/anexos/envio', { token: secretaria, corpo: envio(meuPaciente(), 'exame.pdf', PNG) });
    assert.equal(trocado.status, 422);
    assert.ok(api.db.logsAuditoria.some((l) => l.motivo === 'TIPO_DO_ARQUIVO'));
    const texto = await api.pedir('POST', '/anexos/envio', { token: secretaria, corpo: envio(meuPaciente(), 'nota.txt', Buffer.from('texto simples')) });
    assert.equal(texto.status, 422);
    const imagem = await api.pedir('POST', '/anexos/envio', { token: secretaria, corpo: envio(meuPaciente(), 'foto.png', PNG) });
    assert.equal(imagem.status, 201);
    assert.equal(imagem.corpo.tipoMime, 'image/png');
  });

  test('a varredura reprova o arquivo de teste antivírus (E3)', async () => {
    const eicar = Buffer.concat([PDF, Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*', 'latin1')]);
    const r = await api.pedir('POST', '/anexos/envio', { token: secretaria, corpo: envio(meuPaciente(), 'suspeito.pdf', eicar) });
    assert.equal(r.status, 422);
    assert.match(r.corpo.erro, /varredura/);
    assert.ok(api.db.logsAuditoria.some((l) => l.motivo === 'VARREDURA_REPROVOU'));
  });

  test('o arquivo acima do X13 é recusado (E2)', async () => {
    api.db.parametros.find((p) => p.chave === 'X13').valor = 1;
    const grande = Buffer.concat([PDF, Buffer.alloc(1024 * 1024 + 10)]);
    const r = await api.pedir('POST', '/anexos/envio', { token: secretaria, corpo: envio(meuPaciente(), 'grande.pdf', grande) });
    assert.equal(r.status, 413);
    api.db.parametros.find((p) => p.chave === 'X13').valor = 5;
  });

  test('o Médico só envia e só abre exame de paciente no alcance dele', async () => {
    const comVinculo = new Set(api.db.vinculos.filter((v) => v.idMedico === eu).map((v) => v.idPaciente));
    const outro = api.db.pacientes.find((p) => !comVinculo.has(p.id));
    assert.equal((await api.pedir('POST', '/anexos/envio', { token: medico, corpo: envio(outro.id, 'x.pdf', PDF) })).status, 403);
    const deOutro = api.db.anexos.find((a) => !comVinculo.has(a.idPaciente));
    assert.equal((await api.pedir('GET', `/anexos/${deOutro.id}/arquivo`, { token: medico })).status, 404);
    const meu = await api.pedir('POST', '/anexos/envio', { token: medico, corpo: envio(meuPaciente(), 'ecg.pdf', PDF) });
    assert.equal(meu.status, 201);
    assert.equal(meu.corpo.enviadoPor, 'MEDICO');
  });
});

describe('exame do titular e aceite médico (RN-26.6)', () => {
  let api;
  before(async () => {
    api = await subir();
  });
  after(() => api.fechar());

  test('o exame do portal espera o médico; a recusa pede motivo e o titular a vê', async () => {
    const paciente = await api.entrar('paciente');
    const titular = api.db.usuarios.find((u) => u.login === 'paciente').idPessoa;
    const outro = api.db.pacientes.find((p) => p.id !== titular);
    const r = await api.pedir('POST', '/anexos/envio', { token: paciente, corpo: envio(outro.id, 'meu-exame.pdf', PDF) });
    assert.equal(r.status, 201);
    assert.equal(r.corpo.idPaciente, titular);
    assert.equal(r.corpo.situacao, 'A_ACEITAR');
    assert.equal((await api.pedir('GET', `/anexos/${r.corpo.id}/arquivo`, { token: paciente })).status, 200);

    const medicoDoTitular = api.db.vinculos.find((v) => v.idPaciente === titular && v.estado === 'ATIVO').idMedico;
    const login = api.db.usuarios.find((u) => u.idPessoa === medicoDoTitular).login;
    const medico = await api.entrar(login);
    assert.equal((await api.pedir('PATCH', `/anexos/${r.corpo.id}`, { token: medico, corpo: { situacao: 'RECUSADO' } })).status, 422);
    const recusado = await api.pedir('PATCH', `/anexos/${r.corpo.id}`, {
      token: medico,
      corpo: { situacao: 'RECUSADO', motivoRecusa: 'Exame de outra pessoa; envie o seu.' },
    });
    assert.equal(recusado.status, 200);
    assert.equal((await api.pedir('PATCH', `/anexos/${r.corpo.id}`, { token: medico, corpo: { situacao: 'ACEITO' } })).status, 422);
    const visto = await api.pedir('GET', `/anexos/${r.corpo.id}`, { token: paciente });
    assert.equal(visto.corpo.motivoRecusa, 'Exame de outra pessoa; envie o seu.');
    const secretaria = await api.entrar('secretaria');
    assert.equal('motivoRecusa' in (await api.pedir('GET', `/anexos/${r.corpo.id}`, { token: secretaria })).corpo, false);
  });

  test('exame do banco sintético abre com um arquivo de demonstração', async () => {
    const paciente = await api.entrar('paciente');
    const titular = api.db.usuarios.find((u) => u.login === 'paciente').idPessoa;
    for (const anexo of api.db.anexos.filter((a) => a.idPaciente === titular && a.id <= BANCO.anexos.length)) {
      const r = await api.pedir('GET', `/anexos/${anexo.id}/arquivo`, { token: paciente });
      assert.equal(r.status, 200, anexo.nomeArquivo);
      assert.match(r.tipo, anexo.tipoMime === 'application/pdf' ? /pdf/ : /png/);
      assert.ok(r.corpo.length > 100);
    }
  });
});
