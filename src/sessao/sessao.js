import React from 'react';

import { api, definirToken, definirAoExpirarSessao } from '../config/axios';

// Sessão do usuário. O papel vem sempre do servidor, na resposta de POST /login;
// o front só o usa para montar menus e rotas, e o servidor recusa o resto.
const SessaoContexto = React.createContext(null);
const CHAVE = 'yourclinic.sessao';

// A API devolve o representado como { idPaciente, nome } ou null.
const normalizar = (dados) => ({
  ...dados,
  idRepresentado: dados.representado?.idPaciente ?? dados.idRepresentado ?? null,
});

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
    return salva;
  });
  const [motivoSaida, setMotivoSaida] = React.useState(null);

  const guardar = React.useCallback((nova) => {
    definirToken(nova?.token ?? null);
    setSessao(nova);
    try {
      if (nova) sessionStorage.setItem(CHAVE, JSON.stringify(nova));
      else sessionStorage.removeItem(CHAVE);
    } catch (e) {
      // Sem sessionStorage a sessão vale só até recarregar a página.
    }
  }, []);

  React.useEffect(() => {
    definirAoExpirarSessao(() => {
      guardar(null);
      setMotivoSaida('expirada');
    });
  }, [guardar]);

  const entrar = React.useCallback(
    async (login, senha) => {
      const { data } = await api.post('/login', { login, senha });
      const nova = normalizar(data);
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
    () => ({ sessao, motivoSaida, entrar, sair, escolherRepresentado }),
    [sessao, motivoSaida, entrar, sair, escolherRepresentado]
  );

  return <SessaoContexto.Provider value={valor}>{children}</SessaoContexto.Provider>;
}

export function useSessao() {
  return React.useContext(SessaoContexto);
}
