import React from 'react';

import HowToRegIcon from '@mui/icons-material/HowToReg';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import FormatListNumberedIcon from '@mui/icons-material/FormatListNumbered';
import PaymentsIcon from '@mui/icons-material/Payments';
import Inventory2Icon from '@mui/icons-material/Inventory2';

import NavbarItem from './navbarItem';

function MenuLateral(props) {
  return (
    <div className='card'>
      <div className='card-body'>
        <ul className='nav nav-pills flex-column gap-2 menu-lateral'>
          <NavbarItem
            render='true'
            href='/listagem-cadastro'
            label='Cadastro'
            icone={<HowToRegIcon fontSize='small' />}
          />
          <NavbarItem
            render='true'
            href='/listagem-agenda'
            label='Agenda'
            icone={<CalendarMonthIcon fontSize='small' />}
          />
          <NavbarItem
            render='true'
            href='/listagem-filadia'
            label='Fila do Dia'
            icone={<FormatListNumberedIcon fontSize='small' />}
          />
          <NavbarItem
            render='true'
            href='/listagem-financeiro'
            label='Financeiro'
            icone={<PaymentsIcon fontSize='small' />}
          />
          <NavbarItem
            render='true'
            href='/listagem-estoque'
            label='Estoque'
            icone={<Inventory2Icon fontSize='small' />}
          />
        </ul>
      </div>
    </div>
  );
}

export default MenuLateral;
