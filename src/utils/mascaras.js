import { DATA_DE_HOJE } from '../config/axios';
import { semAcento, soDigitos } from './formatos';

// Máscaras aplicadas enquanto a pessoa digita. Guardam o valor já formatado,
// que é o formato do banco ("000.000.000-00", "(11) 90000-0000").

export function mascararCpf(valor) {
  const d = soDigitos(valor).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d{1,2})$/, '.$1-$2');
}

export function mascararTelefone(valor) {
  const d = soDigitos(valor).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export const mascararDigitos = (limite) => (valor) => soDigitos(valor).slice(0, limite);

// Valor em reais digitado da direita para a esquerda: "25000" vira "250,00".
export function mascararMoeda(valor) {
  const d = soDigitos(valor).replace(/^0+(?=\d)/, '').slice(0, 9);
  if (!d) return '';
  return (Number(d) / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function moedaParaNumero(texto) {
  const d = soDigitos(texto);
  return d ? Number(d) / 100 : null;
}

export function numeroParaMoeda(numero) {
  if (numero === null || numero === undefined) return '';
  return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function erroLogin(valor, emUso = []) {
  if (!/^[a-z0-9._-]{3,30}$/.test(valor ?? '')) {
    return 'Use de 3 a 30 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado.';
  }
  return emUso.includes(valor) ? 'Este login já está em uso.' : null;
}

// Validações dos formulários. Devolvem a mensagem de erro, ou null.
// O CPF é conferido só no formato: o banco de demonstração usa CPFs com
// dígito verificador inválido de propósito.
export function erroCpf(valor) {
  return soDigitos(valor).length === 11 ? null : 'Informe os 11 dígitos do CPF.';
}

export function erroNomeCompleto(valor) {
  return (valor ?? '').trim().split(/\s+/).filter(Boolean).length >= 2 ? null : 'Informe nome e sobrenome.';
}

export function erroTelefone(valor) {
  const n = soDigitos(valor).length;
  return n === 10 || n === 11 ? null : 'Informe o telefone com DDD.';
}

export function erroEmail(valor, { obrigatorio = false } = {}) {
  if (!valor?.trim()) return obrigatorio ? 'Informe o e-mail.' : null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valor.trim()) ? null : 'E-mail inválido.';
}

export function erroData(valor, { obrigatorio = true } = {}) {
  if (!valor) return obrigatorio ? 'Informe a data.' : null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor) || valor > DATA_DE_HOJE) return 'Data inválida.';
  return null;
}

export function erroPreenchido(valor, mensagem) {
  return String(valor ?? '').trim() ? null : mensagem;
}

// Idade completa em anos na data de referência do app.
export function idade(nascimento, hoje = DATA_DE_HOJE) {
  if (!nascimento) return null;
  const [a, m, d] = nascimento.split('-').map(Number);
  const [ah, mh, dh] = hoje.split('-').map(Number);
  return ah - a - (mh < m || (mh === m && dh < d) ? 1 : 0);
}

// Login sugerido para o convite: primeiro e último nome, sem acento, e o id.
export function sugerirLogin(nome, id) {
  const partes = semAcento(nome).replace(/[^a-z\s]/g, '').split(/\s+/).filter(Boolean);
  const base = [partes[0], partes.length > 1 ? partes.at(-1) : null].filter(Boolean).join('.');
  return `${base || 'usuario'}${id ?? ''}`.slice(0, 30);
}
