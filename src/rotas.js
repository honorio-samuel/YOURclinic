import React from 'react';

import ListagemUsuarios from './views/listagem-usuarios';
import ListagemCadastro from './views/listagem-cadastro';
import ListagemAgenda from './views/listagem-agenda';
import ListagemFilaDia from './views/listagem-filadia';
import ListagemFinanceiro from './views/listagem-financeiro';
import ListagemEstoque from './views/listagem-estoque';
import CadastroPacientes from './views/cadastro-pacientes';

import { Route, Routes, Navigate } from 'react-router-dom';

function Rotas(props) {
  return (
    <Routes>
      <Route path='/' element={<Navigate to='/listagem-cadastro' replace />} />
      <Route path='/listagem-cadastro' element={<ListagemCadastro />} />
      <Route path='/listagem-agenda' element={<ListagemAgenda />} />
      <Route path='/listagem-filadia' element={<ListagemFilaDia />} />
      <Route path='/listagem-financeiro' element={<ListagemFinanceiro />} />
      <Route path='/listagem-estoque' element={<ListagemEstoque />} />
      <Route
        path='/cadastro-pacientes/:idParam?'
        element={<CadastroPacientes />}
      />
      <Route path='/listagem-usuarios' element={<ListagemUsuarios />} />
    </Routes>
  );
}

export default Rotas;
