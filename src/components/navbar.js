import React from 'react';
import { Link } from 'react-router-dom';

import avatar from '../assets/avatar.svg';

function Navbar(props) {
  return (
    <div className='navbar navbar-dark bg-primary py-0 mb-4'>
      <div className='container'>
        <div className='row flex-fill'>
          <div className='col-auto col-lg-3 py-4 cabecalho-divisao'>
            <Link to='/' className='navbar-brand marca'>
              <span className='text-dark'>YOUR</span>
              <span className='text-white'>Clinic</span>
            </Link>
          </div>
          <div className='col py-4 d-flex justify-content-end align-items-center'>
            <div className='usuario-ativo bg-white d-flex align-items-center gap-3 px-3 py-1'>
              <img src={avatar} alt='' width='40' height='40' />
              <div className='d-none d-sm-block'>
                <div className='fw-normal text-dark'>{props.nome}</div>
                <div className='small text-body-secondary'>{props.papel}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Navbar;
