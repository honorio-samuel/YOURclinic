import { atualizar, criar, listar } from './dados';
import { semAcento } from '../utils/formatos';
import { mascararCpf, sugerirLogin } from '../utils/mascaras';

// Erro de cadastro com texto para a pessoa que usa o sistema.
export class ErroDeCadastro extends Error {
  constructor(mensagem) {
    super(mensagem);
    this.mensagemParaUsuario = mensagem;
  }
}

// Pessoa com este CPF, se já existir. O CPF fica formatado no banco.
export async function pessoaPorCpf(cpf) {
  if (!cpf) return null;
  const [pessoa] = await listar('pessoas', { cpf: mascararCpf(cpf) });
  return pessoa ?? null;
}

// Consulta filtrada em vez de GET por id: a ausência volta como lista vazia,
// sem um 404 no console a cada cadastro novo.
export async function existe(colecao, id) {
  const encontrados = await listar(colecao, { id, _campos: 'id' });
  return encontrados.length > 0;
}

// Só os campos que mudaram, para o PATCH.
export function diferencas(novo, antigo = {}) {
  return Object.fromEntries(Object.entries(novo).filter(([campo, valor]) => (antigo[campo] ?? null) !== (valor ?? null)));
}

export async function atualizarSeMudou(colecao, id, novo, antigo) {
  const mudancas = diferencas(novo, antigo);
  if (Object.keys(mudancas).length) await atualizar(colecao, id, mudancas);
}

// Cria a pessoa de um cadastro novo. Se o CPF já existe, reaproveita a pessoa
// quando o nome confere e ela ainda não tem este papel (a mãe que vira
// paciente, a paciente que entra na equipe). Devolve o id.
export async function pessoaParaNovoCadastro(colecaoDoPapel, dadosPessoa, rotuloDoPapel) {
  const existente = dadosPessoa.cpf ? await pessoaPorCpf(dadosPessoa.cpf) : null;
  if (!existente) return (await criar('pessoas', dadosPessoa)).id;
  if (await existe(colecaoDoPapel, existente.id)) {
    throw new ErroDeCadastro(`Já existe ${rotuloDoPapel} com este CPF.`);
  }
  if (semAcento(existente.nome).trim() !== semAcento(dadosPessoa.nome).trim()) {
    throw new ErroDeCadastro('Este CPF já está cadastrado para outra pessoa. Confira o número.');
  }
  await atualizarSeMudou('pessoas', existente.id, dadosPessoa, existente);
  return existente.id;
}

// Cria o cadastro do papel (paciente, responsável...) se ainda não existir.
export async function garantirPapel(colecao, id, campos) {
  if (await existe(colecao, id)) return;
  await criar(colecao, { id, ...campos });
}

// Convite de acesso: a conta nasce pendente e a pessoa define a senha pelo
// link (RF09, G-04). O e-mail é o mesmo do cadastro.
export function convidar({ idPessoa, nome, email, papel, login }) {
  return criar('usuarios', {
    login: login ?? sugerirLogin(nome, idPessoa),
    email: email.trim().toLowerCase(),
    papel,
    situacao: 'CONVITE_PENDENTE',
    idPessoa,
  });
}
