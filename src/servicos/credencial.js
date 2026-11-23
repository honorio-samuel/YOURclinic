import { api } from '../config/axios';

// Ciclo de vida da credencial (RF02, RF09). As rotas de convite e de
// recuperação funcionam sem sessão.

export async function consultarConvite(token) {
  const { data } = await api.get(`/convites/${encodeURIComponent(token)}`);
  return data;
}

export async function aceitarConvite(token, corpo) {
  await api.post(`/convites/${encodeURIComponent(token)}`, corpo);
}

export async function pedirRecuperacao(email) {
  const { data } = await api.post('/senha/recuperar', { email });
  return data;
}

export async function consultarRedefinicao(token) {
  await api.get(`/senha/redefinir/${encodeURIComponent(token)}`);
}

export async function redefinirSenha(token, senha) {
  await api.post(`/senha/redefinir/${encodeURIComponent(token)}`, { senha });
}

export async function alterarSenha(senhaAtual, novaSenha) {
  await api.post('/sessao/senha', { senhaAtual, novaSenha });
}

export async function reenviarConvite(idUsuario) {
  const { data } = await api.post(`/usuarios/${idUsuario}/convite`);
  return data;
}

export async function representacoesEncerradas() {
  const { data } = await api.get('/sessao/representacoes-encerradas');
  return data;
}

// Mesma regra da API: ao menos 8 caracteres, com letras e números.
export function erroDeSenha(senha, confirmacao) {
  if (!senha || senha.length < 8 || !/[A-Za-z]/.test(senha) || !/\d/.test(senha)) {
    return 'Use ao menos 8 caracteres, com letras e números.';
  }
  if (confirmacao !== undefined && senha !== confirmacao) return 'As duas senhas não são iguais.';
  return null;
}
