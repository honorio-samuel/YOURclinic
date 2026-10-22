import React from 'react';
import { Link, useLocation } from 'react-router-dom';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

import { MENUS } from '../navegacao/menus';

// O item fica aceso na própria rota e nas telas que se abrem a partir dele:
// o cadastro acende a listagem da mesma entidade, e o prontuário, Meus pacientes.
function rotaDaListagem(caminho) {
  const cadastro = caminho.match(/^(\/[a-z]+)\/cadastro-([a-z-]+)/);
  if (cadastro) return `${cadastro[1]}/listagem-${cadastro[2]}`;
  if (caminho.startsWith('/medico/prontuario/')) return '/medico/listagem-pacientes';
  return null;
}

const itemAtivo = (rota, caminho) =>
  caminho === rota || caminho.startsWith(rota + '/') || rotaDaListagem(caminho) === rota;

const contemRota = (grupo, caminho) => grupo.itens.some((item) => itemAtivo(item.rota, caminho));

function ItemMenu({ rota, caminho, children }) {
  const ativo = itemAtivo(rota, caminho);
  return (
    <Link to={rota} className={`nav-link${ativo ? ' active' : ''}`} aria-current={ativo ? 'page' : undefined}>
      {children}
    </Link>
  );
}

function GrupoMenu({ grupo, caminho }) {
  const ativo = contemRota(grupo, caminho);
  const [aberto, setAberto] = React.useState(ativo);
  const id = `submenu-${grupo.rotulo.replace(/\W+/g, '-').toLowerCase()}`;
  const Icone = grupo.icone;

  React.useEffect(() => {
    if (ativo) setAberto(true);
  }, [ativo]);

  return (
    <li className='nav-item'>
      <button
        type='button'
        className={`nav-link w-100 ${ativo ? 'active' : ''}`}
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((a) => !a)}
      >
        <span className='nav-link-icone'>
          <Icone fontSize='small' aria-hidden='true' />
        </span>
        <span className='flex-grow-1 text-start'>{grupo.rotulo}</span>
        <span className='nav-link-seta' aria-hidden='true'>
          {aberto ? <ExpandLessIcon fontSize='small' /> : <ExpandMoreIcon fontSize='small' />}
        </span>
      </button>
      {aberto && (
        <ul id={id} className='nav flex-column submenu'>
          {grupo.itens.map((item) => (
            <li key={item.rota} className='nav-item'>
              <ItemMenu rota={item.rota} caminho={caminho}>
                {item.rotulo}
              </ItemMenu>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

// Menu lateral do papel da sessão, em acordeão: o grupo da tela atual fica aberto.
function MenuLateral({ papel }) {
  const { pathname } = useLocation();
  const itens = MENUS[papel] ?? [];

  return (
    <nav className='card' aria-label='Menu principal'>
      <div className='card-body'>
        <ul className='nav nav-pills flex-column gap-2 menu-lateral'>
          {itens.map((item) =>
            item.itens ? (
              <GrupoMenu key={item.rotulo} grupo={item} caminho={pathname} />
            ) : (
              <li key={item.rota} className='nav-item'>
                <ItemMenu rota={item.rota} caminho={pathname}>
                  <span className='nav-link-icone'>
                    <item.icone fontSize='small' aria-hidden='true' />
                  </span>
                  {item.rotulo}
                </ItemMenu>
              </li>
            )
          )}
        </ul>
      </div>
    </nav>
  );
}

export default MenuLateral;
