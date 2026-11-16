import React from 'react';
import './tema.scss';
import 'toastr/build/toastr.min';
import 'toastr/build/toastr.css';
import './custom.css';
import { BrowserRouter } from 'react-router-dom';
import Rotas from './rotas.js';
import { SessaoProvider } from './sessao/sessao';

// A casca de cada área (login ou área logada, com barra lateral) vem das rotas.
function App() {
  return (
    <BrowserRouter>
      <SessaoProvider>
        <div className='min-vh-100 bg-body-tertiary'>
          <a href='#conteudo' className='pular-para-conteudo visually-hidden-focusable btn btn-primary position-absolute m-2'>
            Ir para o conteúdo
          </a>
          <Rotas />
        </div>
      </SessaoProvider>
    </BrowserRouter>
  );
}

export default App;
