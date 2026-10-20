'use strict';

// Filtros, ordenação e paginação no estilo do json-server 0.17.
// Eles rodam sobre os registros já recortados pelo papel e sem os campos
// ocultos: filtrar ou ordenar por um campo oculto dá o mesmo resultado que
// por um campo que não existe, e não revela nada.

const LIMITE_MAXIMO = 1000;
const OPERADORES = /^(.+)_(gte|lte|gt|lt|ne|like)$/;

const semAcento = (texto) =>
  String(texto).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

const ehNumero = (valor) => valor !== '' && valor !== null && !Number.isNaN(Number(valor));

function comparar(a, b) {
  if (ehNumero(a) && ehNumero(b)) return Number(a) - Number(b);
  const x = String(a);
  const y = String(b);
  return x < y ? -1 : x > y ? 1 : 0;
}

function igualAoParametro(valor, parametro) {
  if (valor === undefined) return false;
  if (valor === null) return parametro === 'null';
  return String(valor) === parametro;
}

function filtrar(registros, parametros) {
  const porChave = new Map();
  for (const [chave, valor] of parametros) {
    if (chave.startsWith('_')) continue;
    porChave.set(chave, [...(porChave.get(chave) ?? []), valor]);
  }

  let resultado = registros;
  for (const [chave, valores] of porChave) {
    const operador = OPERADORES.exec(chave);
    const campo = operador ? operador[1] : chave;
    const tipo = operador ? operador[2] : 'eq';
    resultado = resultado.filter((registro) => {
      const valor = registro[campo];
      switch (tipo) {
        case 'eq':
          return valores.some((v) => igualAoParametro(valor, v));
        case 'ne':
          return valores.every((v) => !igualAoParametro(valor, v));
        case 'like':
          return valor != null && valores.every((v) => semAcento(valor).includes(semAcento(v)));
        default: {
          if (valor == null) return false;
          return valores.every((v) => {
            const c = comparar(valor, v);
            return { gte: c >= 0, lte: c <= 0, gt: c > 0, lt: c < 0 }[tipo];
          });
        }
      }
    });
  }
  return resultado;
}

function ordenar(registros, parametros) {
  const campos = (parametros.get('_sort') ?? '').split(',').filter(Boolean);
  if (campos.length === 0) return registros;
  const ordens = (parametros.get('_order') ?? '').split(',');
  return [...registros].sort((a, b) => {
    for (const [i, campo] of campos.entries()) {
      const sentido = ordens[i] === 'desc' ? -1 : 1;
      const x = a[campo];
      const y = b[campo];
      if (x == null && y == null) continue;
      if (x == null) return 1;
      if (y == null) return -1;
      const c = comparar(x, y);
      if (c !== 0) return c * sentido;
    }
    return 0;
  });
}

const inteiroPositivo = (texto) => {
  const n = Number.parseInt(texto, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
};

function paginar(registros, parametros) {
  const limite = Math.min(inteiroPositivo(parametros.get('_limit')) ?? Infinity, LIMITE_MAXIMO);
  const pagina = inteiroPositivo(parametros.get('_page'));
  if (pagina === null) return Number.isFinite(limite) ? registros.slice(0, limite) : registros;
  const tamanho = Number.isFinite(limite) ? limite : 10;
  return registros.slice((pagina - 1) * tamanho, pagina * tamanho);
}

// _campos=id,nome devolve só esses campos (o id sempre vem).
function escolherCampos(registros, parametros) {
  const campos = (parametros.get('_campos') ?? '').split(',').filter(Boolean);
  if (campos.length === 0) return registros;
  const lista = new Set(['id', ...campos]);
  return registros.map((registro) =>
    Object.fromEntries(Object.entries(registro).filter(([campo]) => lista.has(campo)))
  );
}

module.exports = { filtrar, ordenar, paginar, escolherCampos, semAcento };
