'use strict';

// Credencial (RF02, RF09): convite com conferência de identidade, token de uso
// único guardado só como hash, recuperação de senha que não revela e-mails e
// reenvio de convite.

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
  const emails = [];
  const servidor = http.createServer(criarApi({ db, relogio: DEZ_HORAS, enviarEmail: (e) => emails.push(e) }));
  await new Promise((pronto) => servidor.listen(0, '127.0.0.1', pronto));
  const { port } = servidor.address();
  async function pedir(metodo, caminho, { token, corpo } = {}) {
    const res = await fetch(`http://127.0.0.1:${port}${caminho}`, {
      method: metodo,
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(corpo ? { 'Content-Type': 'application/json' } : {}) },
      body: corpo ? JSON.stringify(corpo) : undefined,
    });
    const texto = await res.text();
    return { status: res.status, corpo: texto ? JSON.parse(texto) : null };
  }
  async function entrar(login, senha = SENHA) {
    const r = await pedir('POST', '/login', { corpo: { login, senha } });
    assert.equal(r.status, 200, `login de ${login} falhou`);
    return r.corpo.token;
  }
  return { db, emails, pedir, entrar, fechar: () => new Promise((fim) => servidor.close(fim)) };
}

const ultimoToken = (api) => api.emails.at(-1).token;

describe('convite do portal (RF02, RF09)', () => {
  let api;
  let paciente;
  before(async () => {
    api = await subir();
    const comConta = new Set(api.db.usuarios.map((u) => u.idPessoa));
    paciente = api.db.pacientes.find((p) => p.situacao === 'ATIVO' && !comConta.has(p.id) && !p.pendenteDeCpf);
  });
  after(() => api.fechar());

  test('a Secretária convida; o token só vale com CPF e nascimento do paciente, uma vez', async () => {
    const secretaria = await api.entrar('secretaria');
    const pessoa = api.db.pessoas.find((p) => p.id === paciente.id);
    const criado = await api.pedir('POST', '/usuarios', {
      token: secretaria,
      corpo: { login: `teste.convite${paciente.id}`, email: `convite${paciente.id}@exemplo.test`, papel: 'PACIENTE', situacao: 'CONVITE_PENDENTE', idPessoa: paciente.id },
    });
    assert.equal(criado.status, 201);
    assert.equal(api.emails.length, 1);
    const token = ultimoToken(api);
    assert.ok(api.emails[0].link.endsWith(token));
    const usuario = api.db.usuarios.find((u) => u.id === criado.corpo.id);
    assert.notEqual(usuario.senhaToken, token, 'guardado só como hash');
    assert.equal(JSON.stringify(criado.corpo).includes('senhaToken'), false);

    assert.equal((await api.pedir('GET', `/convites/${token}`)).corpo.papel, 'PACIENTE');
    const errado = await api.pedir('POST', `/convites/${token}`, { corpo: { cpf: '000.000.000-00', dataNascimento: pessoa.dataNascimento, senha: 'Segura123' } });
    assert.equal(errado.status, 422);
    const fraca = await api.pedir('POST', `/convites/${token}`, { corpo: { cpf: pessoa.cpf, dataNascimento: pessoa.dataNascimento, senha: 'curta' } });
    assert.equal(fraca.status, 422);
    const certo = await api.pedir('POST', `/convites/${token}`, { corpo: { cpf: pessoa.cpf, dataNascimento: pessoa.dataNascimento, senha: 'Segura123' } });
    assert.equal(certo.status, 204);
    assert.equal(usuario.situacao, 'ATIVO');
    await api.entrar(`teste.convite${paciente.id}`, 'Segura123');
    assert.equal((await api.pedir('GET', `/convites/${token}`)).status, 410, 'uso único');
  });

  test('excesso de tentativas invalida o convite (RN-09.2)', async () => {
    const admin = await api.entrar('admin');
    const usuario = api.db.usuarios.find((u) => u.login === 'responsavel2');
    usuario.situacao = 'CONVITE_PENDENTE';
    assert.equal((await api.pedir('POST', `/usuarios/${usuario.id}/convite`, { token: admin })).status, 202);
    const token = ultimoToken(api);
    let ultima;
    for (let i = 0; i < 5; i++) {
      ultima = await api.pedir('POST', `/convites/${token}`, { corpo: { cpf: '111.111.111-11', dataNascimento: '2000-01-01', senha: 'Segura123' } });
    }
    assert.equal(ultima.status, 410);
    assert.equal((await api.pedir('GET', `/convites/${token}`)).status, 410);
  });

  test('o Responsável confere o próprio CPF e o nascimento do representado (B16)', async () => {
    const admin = await api.entrar('admin');
    const usuario = api.db.usuarios.find((u) => u.login === 'responsavel2');
    await api.pedir('POST', `/usuarios/${usuario.id}/convite`, { token: admin });
    const token = ultimoToken(api);
    const eu = api.db.pessoas.find((p) => p.id === usuario.idPessoa);
    const representado = api.db.representacoes.find((r) => r.idResponsavelLegal === usuario.idPessoa);
    const crianca = api.db.pessoas.find((p) => p.id === representado.idPaciente);
    const comOProprioNascimento = await api.pedir('POST', `/convites/${token}`, {
      corpo: { cpf: eu.cpf, dataNascimento: eu.dataNascimento, senha: 'Segura123' },
    });
    assert.equal(comOProprioNascimento.status, 422);
    const certo = await api.pedir('POST', `/convites/${token}`, { corpo: { cpf: eu.cpf, dataNascimento: crianca.dataNascimento, senha: 'Segura123' } });
    assert.equal(certo.status, 204);
  });

  test('a Secretária só reenvia convite do portal; conta ativa não recebe convite', async () => {
    const secretaria = await api.entrar('secretaria');
    const medico = api.db.usuarios.find((u) => u.papel === 'MEDICO' && u.situacao === 'CONVITE_PENDENTE');
    assert.equal((await api.pedir('POST', `/usuarios/${medico.id}/convite`, { token: secretaria })).status, 403);
    const admin = await api.entrar('admin');
    assert.equal((await api.pedir('POST', `/usuarios/${medico.id}/convite`, { token: admin })).status, 202);
    const ativo = api.db.usuarios.find((u) => u.login === 'paciente');
    assert.equal((await api.pedir('POST', `/usuarios/${ativo.id}/convite`, { token: admin })).status, 409);
  });
});

describe('recuperação de senha (RF02)', () => {
  let api;
  before(async () => {
    api = await subir();
  });
  after(() => api.fechar());

  test('a resposta não revela se o e-mail existe; o token novo invalida o anterior', async () => {
    const desconhecido = await api.pedir('POST', '/senha/recuperar', { corpo: { email: 'ninguem@exemplo.test' } });
    const usuario = api.db.usuarios.find((u) => u.login === 'paciente');
    const conhecido = await api.pedir('POST', '/senha/recuperar', { corpo: { email: usuario.email } });
    assert.equal(desconhecido.status, 202);
    assert.deepEqual(desconhecido.corpo, conhecido.corpo);
    assert.equal(api.emails.length, 1);
    const primeiro = ultimoToken(api);
    await api.pedir('POST', '/senha/recuperar', { corpo: { email: usuario.email } });
    const segundo = ultimoToken(api);
    assert.equal((await api.pedir('GET', `/senha/redefinir/${primeiro}`)).status, 410);
    assert.equal((await api.pedir('GET', `/senha/redefinir/${segundo}`)).status, 200);
  });

  test('redefinir troca a senha e encerra as sessões abertas', async () => {
    const usuario = api.db.usuarios.find((u) => u.login === 'paciente');
    const antiga = await api.entrar('paciente');
    await api.pedir('POST', '/senha/recuperar', { corpo: { email: usuario.email } });
    const token = ultimoToken(api);
    assert.equal((await api.pedir('POST', `/senha/redefinir/${token}`, { corpo: { senha: 'abc' } })).status, 422);
    assert.equal((await api.pedir('POST', `/senha/redefinir/${token}`, { corpo: { senha: 'NovaSenha42' } })).status, 204);
    assert.equal((await api.pedir('GET', '/sessao', { token: antiga })).status, 401);
    await api.entrar('paciente', 'NovaSenha42');
    assert.equal((await api.pedir('POST', `/senha/redefinir/${token}`, { corpo: { senha: 'OutraSenha42' } })).status, 410);
  });

  test('o Responsável sabe quantas representações acabaram pela maioridade, sem nomes', async () => {
    const token = await api.entrar('responsavel');
    const r = await api.pedir('GET', '/sessao/representacoes-encerradas', { token });
    assert.equal(r.status, 200);
    assert.equal(typeof r.corpo.maioridade, 'number');
    assert.deepEqual(Object.keys(r.corpo), ['maioridade']);
  });
});
