import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import CloseIcon from '@mui/icons-material/Close';

import Navbar, { Marca } from './navbar';
import MenuLateral from './menu-lateral';
import Footer from './footer';
import { AcessoNegado } from '../views/geral/avisos';
import { INICIO } from '../navegacao/menus';
import { useSessao } from '../sessao/sessao';

const PORTAL = ['PACIENTE', 'RESPONSAVEL_LEGAL'];

// Área autenticada. A partir de 992 px a barra lateral fica fixa à esquerda,
// com a marca, o menu do papel e o contato da clínica. Abaixo disso ela vira
// gaveta, aberta pelo botão da barra do topo.
export function AreaLogada() {
  const { sessao } = useSessao();
  const { pathname } = useLocation();
  const [gavetaAberta, setGavetaAberta] = React.useState(false);
  const gaveta = React.useRef(null);

  // Trocar de tela fecha a gaveta, inclusive pelo botão de voltar do navegador.
  React.useEffect(() => {
    setGavetaAberta(false);
  }, [pathname]);

  React.useEffect(() => {
    if (!gavetaAberta) return undefined;
    const anterior = document.activeElement;
    gaveta.current?.querySelector('button')?.focus();
    const tecla = (e) => {
      if (e.key === 'Escape') setGavetaAberta(false);
    };
    // Se a janela alargar com a gaveta aberta, a barra volta a ficar fixa e o
    // conteúdo não pode continuar inerte.
    const telaLarga = window.matchMedia('(min-width: 992px)');
    const aoAlargar = (e) => {
      if (e.matches) setGavetaAberta(false);
    };
    document.addEventListener('keydown', tecla);
    telaLarga.addEventListener('change', aoAlargar);
    return () => {
      document.removeEventListener('keydown', tecla);
      telaLarga.removeEventListener('change', aoAlargar);
      // O foco volta para o botão que abriu a gaveta.
      anterior?.focus?.();
    };
  }, [gavetaAberta]);

  if (!sessao) return <Navigate to='/entrar' replace state={{ de: pathname }} />;

  const { papel } = sessao.usuario;
  const fechar = () => setGavetaAberta(false);

  return (
    // No portal, abaixo de 992 px, as linhas das tabelas viram cartões (custom.css).
    <div className={`casca${PORTAL.includes(papel) ? ' casca-portal' : ''}`}>
      <Navbar menuAberto={gavetaAberta} aoAbrirMenu={() => setGavetaAberta(true)} />
      <div
        id='barra-lateral'
        ref={gaveta}
        className={`barra-lateral${gavetaAberta ? ' aberta' : ''}`}
        role={gavetaAberta ? 'dialog' : undefined}
        aria-modal={gavetaAberta ? true : undefined}
        aria-label={gavetaAberta ? 'Menu' : undefined}
        // O item da tela atual não muda a rota, mas também fecha a gaveta.
        onClick={(e) => e.target.closest('a') && fechar()}
      >
        <div className='d-flex align-items-center justify-content-between'>
          <Marca para={INICIO[papel]} />
          <button type='button' className='btn botao-menu d-lg-none' aria-label='Fechar menu' onClick={fechar}>
            <CloseIcon aria-hidden='true' />
          </button>
        </div>
        <MenuLateral papel={papel} />
        <Footer className='mt-auto px-2' />
      </div>
      {gavetaAberta && <div className='offcanvas-backdrop show d-lg-none' onClick={fechar} />}
      <main id='conteudo' className='conteudo p-3 p-sm-4' inert={gavetaAberta}>
        <Outlet />
      </main>
    </div>
  );
}

// Rota restrita a papéis. O front só esconde; quem recusa de fato é o servidor.
export function Permitido({ papeis, children }) {
  const { sessao } = useSessao();
  if (!papeis.includes(sessao?.usuario?.papel)) return <AcessoNegado />;
  return children;
}
