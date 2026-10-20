import React from 'react';
import './tema.scss';
import 'toastr/build/toastr.min';
import 'toastr/build/toastr.css';
import './custom.css';
import { BrowserRouter } from 'react-router-dom';
import Navbar from './components/navbar.js';
import Footer from './components/footer.js';
import Rotas from './rotas.js';
import { SessaoProvider } from './sessao/sessao';

function App() {
  return (
    <BrowserRouter>
      <SessaoProvider>
        <div className='d-flex flex-column min-vh-100 bg-body-tertiary'>
          <a href='#conteudo' className='visually-hidden-focusable btn btn-primary position-absolute m-2'>
            Ir para o conteúdo
          </a>
          <Navbar />
          <div className='container flex-grow-1'>
            <Rotas />
          </div>
          <Footer contato='Clínica YOURClinic · (11) 4002-8922 · Rua das Acácias, nº 120, Bairro Centro 01000-000' />
        </div>
      </SessaoProvider>
    </BrowserRouter>
  );
}

export default App;
