'use strict';

// Senhas guardadas só como hash (RNF01) e sessões com prazo de inatividade
// (RNF03). As sessões ficam em memória: reiniciar o servidor encerra todas.

const crypto = require('node:crypto');

const PARAMETROS_SCRYPT = { N: 16384, r: 8, p: 1 };
const TAMANHO_CHAVE = 64;

function gerarHash(senha) {
  const sal = crypto.randomBytes(16);
  const chave = crypto.scryptSync(String(senha), sal, TAMANHO_CHAVE, PARAMETROS_SCRYPT);
  return `scrypt$${sal.toString('hex')}$${chave.toString('hex')}`;
}

function conferirSenha(senha, hash) {
  const [algoritmo, salHex, chaveHex] = String(hash ?? '').split('$');
  if (algoritmo !== 'scrypt' || !salHex || !chaveHex) return false;
  const esperada = Buffer.from(chaveHex, 'hex');
  const obtida = crypto.scryptSync(String(senha), Buffer.from(salHex, 'hex'), esperada.length, PARAMETROS_SCRYPT);
  return crypto.timingSafeEqual(esperada, obtida);
}

// Hash de uma senha descartável: conferido quando o login não existe, para
// que a resposta leve o mesmo tempo e não revele se a conta existe (RNF19).
const HASH_DE_ENGANO = gerarHash(crypto.randomBytes(12).toString('hex'));

class Sessoes {
  constructor({ minutos, relogio }) {
    this.minutos = minutos;
    this.relogio = relogio;
    this.porToken = new Map();
  }

  criar(dados) {
    const token = crypto.randomBytes(32).toString('hex');
    const sessao = { ...dados, expiraEm: this.prazo() };
    this.porToken.set(token, sessao);
    return { token, sessao };
  }

  // Devolve a sessão e renova o prazo; sessão vencida é apagada.
  validar(token) {
    if (!token) return null;
    const sessao = this.porToken.get(token);
    if (!sessao) return null;
    if (sessao.expiraEm <= this.relogio().getTime()) {
      this.porToken.delete(token);
      return null;
    }
    sessao.expiraEm = this.prazo();
    return sessao;
  }

  encerrar(token) {
    this.porToken.delete(token);
  }

  encerrarDoUsuario(idUsuario, excetoToken) {
    for (const [token, sessao] of this.porToken) {
      if (sessao.idUsuario === idUsuario && token !== excetoToken) this.porToken.delete(token);
    }
  }

  prazo() {
    return this.relogio().getTime() + this.minutos * 60 * 1000;
  }
}

module.exports = { gerarHash, conferirSenha, HASH_DE_ENGANO, Sessoes };
