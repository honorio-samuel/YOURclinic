import { listar } from '../../servicos/dados';

// Partes usadas por mais de uma tela desta pasta.

export async function carregarProdutos() {
  const [produtos, lotes] = await Promise.all([listar('produtos', { _sort: 'descricao' }), listar('lotes', { _sort: 'validade' })]);
  return produtos.map((p) => {
    const dele = lotes.filter((l) => l.idProduto === p.id);
    return { ...p, lotes: dele, saldo: dele.reduce((s, l) => s + l.quantidade, 0), proximoLote: dele.find((l) => l.quantidade > 0) };
  });
}
