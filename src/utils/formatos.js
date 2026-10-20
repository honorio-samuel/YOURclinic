const moedaBR = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

// As datas da API vêm como texto ISO sem fuso ("2026-09-28T09:00:00"); são
// tratadas como texto para não sofrer conversão de fuso horário.
export function data(iso) {
  if (!iso) return '—';
  return iso.slice(0, 10).split('-').reverse().join('/');
}

export function diaMes(iso) {
  if (!iso) return '—';
  const [, mes, dia] = iso.slice(0, 10).split('-');
  return `${dia}/${mes}`;
}

export function mesAno(iso) {
  if (!iso) return '—';
  const [ano, mes] = iso.slice(0, 7).split('-');
  return `${mes}/${ano}`;
}

export function hora(iso) {
  if (!iso || iso.length < 16) return '—';
  return iso.slice(11, 16).replace(':', 'h');
}

export function diaMesHora(iso) {
  if (!iso) return '—';
  return `${diaMes(iso)} · ${hora(iso)}`;
}

export function moeda(valor) {
  if (valor === null || valor === undefined) return '—';
  return moedaBR.format(valor);
}

export function quantidadeComSinal(valor) {
  if (valor > 0) return `+${valor}`;
  if (valor < 0) return `−${Math.abs(valor)}`;
  return '0';
}

// "Dr." ou "Dra." conforme o cadastro da pessoa.
export function nomeMedico(pessoa) {
  if (!pessoa) return '—';
  // No portal a API manda só id e nome do médico; sem o sexo, vai sem título.
  if (!pessoa.sexo) return pessoa.nome;
  return `${pessoa.sexo === 'F' ? 'Dra.' : 'Dr.'} ${pessoa.nome}`;
}

export function primeiroNome(nome) {
  return (nome ?? '').split(' ')[0];
}

export function diasEntre(inicio, fim) {
  const a = new Date(inicio.slice(0, 10) + 'T00:00:00Z');
  const b = new Date(fim.slice(0, 10) + 'T00:00:00Z');
  return Math.round((b - a) / 86400000);
}

export function semAcento(texto) {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
}

export function soDigitos(texto) {
  return (texto ?? '').replace(/\D/g, '');
}

// Busca simples: todas as palavras do termo precisam aparecer em algum campo.
export function corresponde(termo, ...campos) {
  const palavras = semAcento(termo).split(/\s+/).filter(Boolean);
  if (palavras.length === 0) return true;
  const alvo = semAcento(campos.filter(Boolean).join(' '));
  return palavras.every((p) => alvo.includes(p));
}
