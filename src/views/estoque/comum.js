import { DATA_DE_HOJE } from '../../config/axios';
import { listar } from '../../servicos/dados';
import { diasEntre } from '../../utils/formatos';

// Partes usadas por mais de uma tela desta pasta.

export const ORIGEM_ENTRADA = {
  COMPRA: 'Compra',
  DOACAO: 'Doação',
  AMOSTRA_FORNECEDOR: 'Amostra do laboratório',
};

export const MOTIVO_DESCARTE = {
  VENCIMENTO: 'Vencimento',
  AVARIA: 'Avaria',
  RECOLHIMENTO: 'Recolhimento',
  OUTRO: 'Outro',
};

// RF38: os três alertas. O Médico recebe só os de validade.
export const ALERTA = {
  MINIMO: { rotulo: 'Estoque mínimo', tom: 'aviso' },
  VALIDADE: { rotulo: 'A vencer', tom: 'aviso' },
  VENCIDO: { rotulo: 'Vencido', tom: 'perigo' },
};

// RN-36.1: medicamento e amostra sempre controlam lote e validade.
export const TIPOS_COM_LOTE = ['MEDICAMENTO', 'AMOSTRA'];

export const vencido = (lote) => Boolean(lote.validade) && lote.validade < DATA_DE_HOJE;

// RF37: a sugestão é o lote de validade mais próxima entre os que podem sair
// (com saldo e na validade), a mesma regra da API.
export function loteSugerido(lotes) {
  return [...lotes]
    .filter((l) => l.quantidade > 0 && !vencido(l))
    .sort((a, b) => (a.validade ?? '9999-12-31').localeCompare(b.validade ?? '9999-12-31') || a.id - b.id)[0];
}

export function situacaoDoLote(lote, antecedencia) {
  if (!lote.validade) return { rotulo: 'Sem validade', tom: 'neutro' };
  const dias = diasEntre(DATA_DE_HOJE, lote.validade);
  if (dias < 0) return { rotulo: 'Vencido · só descarte', tom: 'perigo' };
  if (dias < antecedencia) return { rotulo: dias === 0 ? 'Vence hoje' : `Vence em ${dias} dias`, tom: 'aviso' };
  return { rotulo: 'Disponível', tom: 'sucesso' };
}

// X14: antecedência do alerta de lote próximo do vencimento (60 dias sugeridos).
export async function carregarAntecedencia() {
  const [p] = await listar('parametros', { chave: 'X14' });
  return Number(p?.valor) || 60;
}

export const nomeDoLote = (lote) => (lote?.numero ? `lote ${lote.numero}` : 'sem lote');

// Produtos com os lotes, o saldo total, o que pode sair (fora os vencidos) e
// o lote sugerido para a próxima saída.
export async function carregarProdutos() {
  const [produtos, lotes] = await Promise.all([listar('produtos', { _sort: 'descricao' }), listar('lotes', { _sort: 'validade' })]);
  return produtos.map((p) => {
    const dele = lotes.filter((l) => l.idProduto === p.id);
    return {
      ...p,
      lotes: dele,
      saldo: dele.reduce((s, l) => s + l.quantidade, 0),
      utilizavel: dele.filter((l) => !vencido(l)).reduce((s, l) => s + l.quantidade, 0),
      sugerido: loteSugerido(dele),
    };
  });
}
