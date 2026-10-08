import React from 'react';
import 'bootswatch/dist/yeti/bootstrap.css';
import 'toastr/build/toastr.min';
import 'toastr/build/toastr.css';
import './custom.css';
import { BrowserRouter } from 'react-router-dom';
import Navbar from './components/navbar.js';
import MenuLateral from './components/menu-lateral.js';
import Footer from './components/footer.js';
import Rotas from './rotas.js';

class App extends React.Component {
  render() {
    return (
      <BrowserRouter>
        <div className='d-flex flex-column min-vh-100 bg-body-tertiary'>
          <Navbar nome='Mariana Alves' papel='Secretária' />
          <div className='container flex-grow-1'>
            <div className='row'>
              <div className='col-lg-3 mb-4'>
                <MenuLateral />
              </div>
              <main className='col-lg-9'>
                <Rotas />
              </main>
            </div>
          </div>
          <Footer contato='Clínica YOURClinic · (11) 4002-8922 · Rua das Acácias, nº 120, Bairro Centro 01000-000' />
        </div>
      </BrowserRouter>
    );
  }
}

export default App;
