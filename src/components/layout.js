import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import MenuLateral from './menu-lateral';
import FaixaRepresentado from './faixa-representado';
import { AcessoNegado } from '../views/geral/avisos';
import { useSessao } from '../sessao/sessao';

// Área autenticada: menu do papel à esquerda e a tela à direita.
export function AreaLogada() {
  const { sessao } = useSessao();
  const location = useLocation();

  if (!sessao) return <Navigate to='/entrar' replace state={{ de: location.pathname }} />;

  return (
    <div className='row'>
      <div className='col-lg-3 mb-4'>
        <MenuLateral papel={sessao.usuario.papel} />
      </div>
      <main className='col-lg-9 mb-4' id='conteudo'>
        <FaixaRepresentado />
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
