import React from 'react';

// Executa um carregamento assíncrono e devolve dados, estado e uma função para
// recarregar. "erro" traz o status HTTP quando houver (403, 404 ou outro).
export function useCarregar(carregar, dependencias = []) {
  const [estado, setEstado] = React.useState({ dados: null, carregando: true, erro: null });
  const [versao, setVersao] = React.useState(0);

  React.useEffect(() => {
    let ativo = true;
    setEstado((atual) => ({ ...atual, carregando: true, erro: null }));
    carregar()
      .then((dados) => {
        if (ativo) setEstado({ dados, carregando: false, erro: null });
      })
      .catch((erro) => {
        if (ativo) {
          setEstado({
            dados: null,
            carregando: false,
            erro: { status: erro.response?.status ?? null },
          });
        }
      });
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...dependencias, versao]);

  const recarregar = React.useCallback(() => setVersao((v) => v + 1), []);
  return { ...estado, recarregar };
}
