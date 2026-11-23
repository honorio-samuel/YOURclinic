import React from 'react';
import { Link, useLocation } from 'react-router-dom';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

import { MENUS } from '../navegacao/menus';

// O item fica aceso na própria rota e nas telas que se abrem a partir dele:
// o cadastro acende a listagem da mesma entidade; o prontuário, Meus pacientes;
// e a grade da Secretária, o item Grade e bloqueios.
function rotaDaListagem(caminho) {
  if (caminho === '/secretaria/grade') return '/secretaria/listagem-bloqueios';
  const cadastro = caminho.match(/^(\/[a-z]+)\/cadastro-([a-z-]+)/);
  if (cadastro) return `${cadastro[1]}/listagem-${cadastro[2]}`;
  if (caminho.startsWith('/medico/prontuario/')) return '/medico/listagem-pacientes';
  return null;
}

// Quando a tela atual é ela mesma um item do menu (exata), só esse item acende:
// "Agendar consulta" não acende também "Meus agendamentos".
const itemAtivo = (rota, caminho, exata) =>
  caminho === rota || (!exata && (caminho.startsWith(rota + '/') || rotaDaListagem(caminho) === rota));

const contemRota = (grupo, caminho, exata) => grupo.itens.some((item) => itemAtivo(item.rota, caminho, exata));

const rotasDoMenu = (itens) => itens.flatMap((item) => (item.itens ? item.itens.map((i) => i.rota) : [item.rota]));

function ItemMenu({ rota, caminho, exata, children }) {
  const ativo = itemAtivo(rota, caminho, exata);
  return (
    <Link to={rota} className={`nav-link${ativo ? ' active' : ''}`} aria-current={ativo ? 'page' : undefined}>
      {children}
    </Link>
  );
}

function GrupoMenu({ grupo, caminho, exata }) {
  const ativo = contemRota(grupo, caminho, exata);
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
              <ItemMenu rota={item.rota} caminho={caminho} exata={exata}>
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
  const exata = rotasDoMenu(itens).includes(pathname);

  return (
    <nav className='card' aria-label='Menu principal'>
      <div className='card-body'>
        <ul className='nav nav-pills flex-column gap-2 menu-lateral'>
          {itens.map((item) =>
            item.itens ? (
              <GrupoMenu key={item.rotulo} grupo={item} caminho={pathname} exata={exata} />
            ) : (
              <li key={item.rota} className='nav-item'>
                <ItemMenu rota={item.rota} caminho={pathname} exata={exata}>
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
