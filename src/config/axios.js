import axios from 'axios';

// Endereço da API. Em desenvolvimento vem de .env.development (API local do fake-api/);
// para usar outra, defina REACT_APP_API_URL em .env.development.local.
export const BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:3001';

// O banco falso representa o dia 28/09/2026, então essa data faz o papel de
// "hoje". Com o backend real, trocar pela data atual.
export const DATA_DE_HOJE = '2026-09-28';

export const api = axios.create({
  baseURL: BASE_URL,
  // Filtros repetidos saem como ?id=1&id=2, que é o formato da API.
  paramsSerializer: { indexes: null },
});

let token = null;
let aoExpirarSessao = () => {};

export function definirToken(novoToken) {
  token = novoToken;
}

export function definirAoExpirarSessao(funcao) {
  aoExpirarSessao = funcao;
}

api.interceptors.request.use((config) => {
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (resposta) => resposta,
  (erro) => {
    const status = erro.response?.status;
    const ehLogin = erro.config?.url === '/login';
    // Sem sessão ou sessão expirada: volta ao login (G-07).
    if (status === 401 && !ehLogin && token) {
      aoExpirarSessao();
    }
    return Promise.reject(erro);
  }
);
