import React from 'react';

import { api } from '../config/axios';
import { prazoDaSessao, useSessao } from '../sessao/sessao';

// Quanto antes do fim a pessoa é avisada (WCAG 2.2.1: tempo ajustável).
const AVISO_MS = 2 * 60 * 1000;

const relogio = (ms) => {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

// G-07b · Aviso de expiração. Antes da sessão terminar por inatividade, a
// pessoa escolhe continuar conectada ou sair; sem resposta, a sessão termina
// e o login mostra o aviso de sessão expirada (G-07).
function AvisoDeExpiracao() {
  const { sessao, sair, expirar } = useSessao();
  const [restante, setRestante] = React.useState(null);
  const botao = React.useRef(null);

  React.useEffect(() => {
    if (!sessao) return undefined;
    const conferir = () => {
      const prazo = prazoDaSessao();
      if (!prazo) return;
      const falta = prazo - Date.now();
      if (falta <= 0) expirar();
      else setRestante(falta <= AVISO_MS ? falta : null);
    };
    conferir();
    const intervalo = setInterval(conferir, 1000);
    return () => clearInterval(intervalo);
  }, [sessao, expirar]);

  const aberto = restante !== null;
  React.useEffect(() => {
    if (aberto) botao.current?.focus();
  }, [aberto]);

  if (!aberto) return null;
  return (
    <>
      <div className='modal d-block' role='alertdialog' aria-modal='true' aria-labelledby='expiracaoTitulo' aria-describedby='expiracaoTexto'>
        <div className='modal-dialog modal-dialog-centered'>
          <div className='modal-content'>
            <div className='modal-header'>
              <h2 id='expiracaoTitulo' className='modal-title h5'>
                Sua sessão vai terminar
              </h2>
            </div>
            <div className='modal-body'>
              <p id='expiracaoTexto' className='mb-0'>
                Por falta de uso, a sessão termina em <strong>{relogio(restante)}</strong>. O que não foi salvo pode se perder.
              </p>
            </div>
            <div className='modal-footer'>
              <button type='button' className='btn btn-outline-secondary' onClick={sair}>
                Sair agora
              </button>
              <button
                ref={botao}
                type='button'
                className='btn btn-primary'
                onClick={async () => {
                  try {
                    await api.get('/sessao');
                    setRestante(null);
                  } catch {
                    // 401: o interceptador já leva ao login.
                  }
                }}
              >
                Continuar conectado
              </button>
            </div>
          </div>
        </div>
      </div>
      <div className='modal-backdrop show' />
    </>
  );
}

export default AvisoDeExpiracao;
