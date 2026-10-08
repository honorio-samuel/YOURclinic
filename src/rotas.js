import React from 'react';

import ListagemUsuarios from './views/listagem-usuarios';
import FilaDoDia from './views/fila-do-dia';
import EmConstrucao from './views/em-construcao';

import { Route, Routes, Navigate } from 'react-router-dom';

function Rotas(props) {
  return (
    <Routes>
      <Route path='/' element={<Navigate to='/fila-do-dia' replace />} />
      <Route path='/cadastro' element={<EmConstrucao title='Cadastro' />} />
      <Route path='/agenda' element={<EmConstrucao title='Agenda' />} />
      <Route path='/fila-do-dia' element={<FilaDoDia />} />
      <Route path='/financeiro' element={<EmConstrucao title='Financeiro' />} />
      <Route path='/estoque' element={<EmConstrucao title='Estoque' />} />
      <Route path='/listagem-usuarios' element={<ListagemUsuarios />} />
    </Routes>
  );
}

export default Rotas;
