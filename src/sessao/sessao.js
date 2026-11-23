import React from 'react';

import { api, definirToken, definirAoExpirarSessao, definirAoResponderComSessao } from '../config/axios';

// Sessão do usuário. O papel vem sempre do servidor, na resposta de POST /login;
// o front só o usa para montar menus e rotas, e o servidor recusa o resto.
const SessaoContexto = React.createContext(null);
const CHAVE = 'yourclinic.sessao';

// A API devolve o representado como { idPaciente, nome } ou null.
const normalizar = (dados) => ({
  ...dados,
  idRepresentado: dados.representado?.idPaciente ?? dados.idRepresentado ?? null,
});

// Prazo da sessão no servidor (RF01, X15): renovado a cada resposta. Fica
// fora do estado do React para não redesenhar a tela a cada pedido.
const PADRAO_MS = 30 * 60 * 1000;
let prazoMs = null;
let duracaoMs = PADRAO_MS;
export const prazoDaSessao = () => prazoMs;

function renovarPrazo() {
  if (!prazoMs) return;
  prazoMs = Date.now() + duracaoMs;
  try {
    const salva = JSON.parse(sessionStorage.getItem(CHAVE));
    if (salva) sessionStorage.setItem(CHAVE, JSON.stringify({ ...salva, expiraEm: new Date(prazoMs).toISOString() }));
  } catch (e) {
    // Sem sessionStorage, o prazo fica só em memória.
  }
}

function lerSalva() {
  try {
    const salva = JSON.parse(sessionStorage.getItem(CHAVE));
    if (salva && new Date(salva.expiraEm) > new Date()) return salva;
  } catch (e) {
    // Sessão salva ilegível: começa sem sessão.
  }
  return null;
}

export function SessaoProvider({ children }) {
  const [sessao, setSessao] = React.useState(() => {
    const salva = lerSalva();
    definirToken(salva?.token ?? null);
    duracaoMs = salva?.duracaoMs ?? PADRAO_MS;
    prazoMs = salva ? new Date(salva.expiraEm).getTime() : null;
    return salva;
  });
  const [motivoSaida, setMotivoSaida] = React.useState(null);

  const guardar = React.useCallback((nova) => {
    definirToken(nova?.token ?? null);
    duracaoMs = nova?.duracaoMs ?? PADRAO_MS;
    prazoMs = nova ? new Date(nova.expiraEm).getTime() : null;
    setSessao(nova);
    try {
      if (nova) sessionStorage.setItem(CHAVE, JSON.stringify(nova));
      else sessionStorage.removeItem(CHAVE);
    } catch (e) {
      // Sem sessionStorage a sessão vale só até recarregar a página.
    }
  }, []);

  const expirar = React.useCallback(() => {
    guardar(null);
    setMotivoSaida('expirada');
  }, [guardar]);

  React.useEffect(() => {
    definirAoExpirarSessao(expirar);
    definirAoResponderComSessao(renovarPrazo);
  }, [expirar]);

  const entrar = React.useCallback(
    async (login, senha) => {
      const { data } = await api.post('/login', { login, senha });
      // A duração da sessão é a que o servidor deu no login (X15).
      const nova = { ...normalizar(data), duracaoMs: Math.max(60 * 1000, new Date(data.expiraEm).getTime() - Date.now()) };
      setMotivoSaida(null);
      guardar(nova);
      return nova;
    },
    [guardar]
  );

  const sair = React.useCallback(async () => {
    try {
      await api.post('/logout');
    } catch (e) {
      // Mesmo sem resposta do servidor, a sessão local termina.
    }
    guardar(null);
    setMotivoSaida('saiu');
  }, [guardar]);

  const escolherRepresentado = React.useCallback(
    async (idPaciente) => {
      const { data } = await api.post('/sessao/representado', { idPaciente });
      guardar(normalizar({ ...sessao, ...data, idRepresentado: idPaciente }));
    },
    [guardar, sessao]
  );

  const valor = React.useMemo(
    () => ({ sessao, motivoSaida, entrar, sair, expirar, escolherRepresentado }),
    [sessao, motivoSaida, entrar, sair, expirar, escolherRepresentado]
  );

  return <SessaoContexto.Provider value={valor}>{children}</SessaoContexto.Provider>;
}

export function useSessao() {
  return React.useContext(SessaoContexto);
}
