import React from 'react';
import { NavLink } from 'react-router-dom';

function NavbarItem({ render, ...props }) {
  if (render) {
    return (
      <li className='nav-item'>
        <NavLink onClick={props.onClick} className='nav-link' to={props.href}>
          {props.icone && <span className='nav-link-icone'>{props.icone}</span>}
          {props.label}
        </NavLink>
      </li>
    );
  } else {
    return false;
  }
}

export default NavbarItem;
