import React from 'react';

// Janela modal com conteúdo livre (formulário curto dentro de uma tela).
// Esc fecha; o foco vai para o primeiro campo ao abrir. "largo" dá mais
// largura e rolagem interna para conteúdo comprido.
function Modal({ titulo, aoFechar, children, rodape, largo = false }) {
  const caixa = React.useRef(null);
  const fechar = React.useRef(aoFechar);
  fechar.current = aoFechar;
  const id = React.useId();

  React.useEffect(() => {
    const anterior = document.activeElement;
    caixa.current?.querySelector('input, select, textarea, button')?.focus();
    const tecla = (e) => {
      if (e.key === 'Escape') fechar.current();
    };
    document.addEventListener('keydown', tecla);
    return () => {
      document.removeEventListener('keydown', tecla);
      // O foco volta para quem abriu a janela.
      anterior?.focus?.();
    };
  }, []);

  return (
    <>
      <div className='modal d-block' role='dialog' aria-modal='true' aria-labelledby={id} tabIndex='-1'>
        <div className={`modal-dialog modal-dialog-centered${largo ? ' modal-lg modal-dialog-scrollable' : ''}`}>
          <div className='modal-content' ref={caixa}>
            <div className='modal-header'>
              <h2 className='modal-title h5' id={id}>
                {titulo}
              </h2>
            </div>
            <div className='modal-body'>{children}</div>
            <div className='modal-footer'>{rodape}</div>
          </div>
        </div>
      </div>
      <div className='modal-backdrop show' />
    </>
  );
}

export default Modal;
