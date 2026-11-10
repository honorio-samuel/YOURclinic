import { buscar, criar, listar } from './dados';
import { atualizarSeMudou, convidar, ErroDeCadastro, pessoaParaNovoCadastro } from './pessoas';
import { mascararCpf } from '../utils/mascaras';

// Cadastro de quem trabalha na clínica (A-03 e A-04): a pessoa, o cadastro do
// papel (médico, secretária ou administrador) e a conta, que nasce como
// convite. "Cadastro profissional e conta de usuário no mesmo fluxo."

export function dadosDaPessoa(v) {
  return {
    nome: v.nome.trim(),
    cpf: mascararCpf(v.cpf),
    dataNascimento: v.dataNascimento || null,
    sexo: v.sexo || null,
    telefone: v.telefone || null,
    email: v.email.trim().toLowerCase(),
  };
}

// Pessoa, cadastro do papel e conta de acesso de um profissional.
export async function carregarProfissional(colecao, papel, id) {
  const [pessoa, cadastro, contas] = await Promise.all([
    buscar('pessoas', id),
    buscar(colecao, id),
    listar('usuarios', { idPessoa: id, papel }),
  ]);
  return { pessoa, cadastro, conta: contas[0] ?? null };
}

// Logins em uso, para avisar no campo antes de gravar.
export async function loginsEmUso() {
  const contas = await listar('usuarios', { _campos: 'login,idPessoa' });
  return contas;
}

// Grava e devolve o id da pessoa. No cadastro novo, se o convite falhar, o
// erro leva o id para a tela abrir a edição e completar a conta.
export async function salvarProfissional({ id, colecao, rotulo, papel, pessoa, cadastro, login, original }) {
  if (!id) {
    const idPessoa = await pessoaParaNovoCadastro(colecao, pessoa, rotulo);
    await criar(colecao, { id: idPessoa, situacao: 'ATIVO', ...cadastro });
    try {
      await convidar({ idPessoa, nome: pessoa.nome, email: pessoa.email, papel, login });
    } catch (e) {
      const motivo = e.response?.data?.erro ?? 'tente de novo';
      const erro = new ErroDeCadastro(`O cadastro foi salvo, mas o convite não: ${motivo}`);
      erro.idCriado = idPessoa;
      throw erro;
    }
    return idPessoa;
  }
  await atualizarSeMudou('pessoas', id, pessoa, original.pessoa);
  await atualizarSeMudou(colecao, id, cadastro, original.cadastro);
  if (original.conta) {
    await atualizarSeMudou('usuarios', original.conta.id, { login, email: pessoa.email }, original.conta);
  } else if (login) {
    await convidar({ idPessoa: id, nome: pessoa.nome, email: pessoa.email, papel, login });
  }
  return id;
}
