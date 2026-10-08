import React from 'react';

import ListagemUsuarios from './views/listagem-usuarios';

import { Route, Routes, BrowserRouter } from 'react-router-dom';

function Rotas(props) {
  return (
    <BrowserRouter>
      <Routes>
        <Route path='/listagem-usuarios' element={<ListagemUsuarios />} />
      </Routes>
    </BrowserRouter>
  );
}

export default Rotas;