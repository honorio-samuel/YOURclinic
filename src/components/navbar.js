import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

import MenuIcon from '@mui/icons-material/Menu';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';

import Avatar from './avatar';
import { INICIO } from '../navegacao/menus';
import { PAPEIS } from '../utils/rotulos';
import { useSessao } from '../sessao/sessao';

// Marca do app. Com "para", é o link para a tela de entrada do papel.
export function Marca({ para }) {
  const texto = (
    <>
      YOUR<span className='marca-realce'>Clinic</span>
    </>
  );
  const classe = 'marca fs-4 fw-bold text-body text-decoration-none';
  return para ? (
    <Link to={para} className={classe}>
      {texto}
    </Link>
  ) : (
    <span className={classe}>{texto}</span>
  );
}

// Quem está logado, com o menu de Meu perfil e Sair. A partir de 992 px fica no
// topo de cada tela, com nome e papel; abaixo disso, na barra do topo, só o
// avatar aparece e o nome fica no rótulo do botão.
export function BlocoUsuario({ className = '' }) {
  const { sessao, sair } = useSessao();
  const navigate = useNavigate();
  const [aberto, setAberto] = React.useState(false);
  const raiz = React.useRef(null);
  const usuario = sessao?.usuario;

  React.useEffect(() => {
    if (!aberto) return undefined;
    const fechar = (e) => {
      if (raiz.current && !raiz.current.contains(e.target)) setAberto(false);
    };
    const esc = (e) => {
      if (e.key === 'Escape') setAberto(false);
    };
    document.addEventListener('mousedown', fechar);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fechar);
      document.removeEventListener('keydown', esc);
    };
  }, [aberto]);

  if (!usuario) return null;

  const terminar = async () => {
    setAberto(false);
    await sair();
    navigate('/entrar', { replace: true });
  };

  return (
    <div className={`position-relative ${className}`} ref={raiz}>
      <button
        type='button'
        className='btn bloco-usuario d-flex align-items-center gap-2 p-1 pe-lg-3 text-start rounded-pill'
        aria-label={`${usuario.nome}, ${PAPEIS[usuario.papel]}`}
        aria-haspopup='menu'
        aria-expanded={aberto}
        onClick={() => setAberto((a) => !a)}
      >
        <Avatar nome={usuario.nome} usuario />
        <span className='d-none d-lg-block lh-sm'>
          <span className='d-block fw-semibold'>{usuario.nome}</span>
          <span className='d-block small fw-normal text-body-secondary'>{PAPEIS[usuario.papel]}</span>
        </span>
        <ExpandMoreIcon fontSize='small' className='d-none d-lg-block text-body-secondary' aria-hidden='true' />
      </button>
      {aberto && (
        <ul className='dropdown-menu dropdown-menu-end show' role='menu'>
          <li role='none'>
            <Link role='menuitem' className='dropdown-item d-flex align-items-center gap-2' to='/perfil' onClick={() => setAberto(false)}>
              <PersonOutlinedIcon fontSize='small' aria-hidden='true' /> Meu perfil
            </Link>
          </li>
          <li role='none'>
            <button type='button' role='menuitem' className='dropdown-item d-flex align-items-center gap-2' onClick={terminar}>
              <LogoutOutlinedIcon fontSize='small' aria-hidden='true' /> Sair
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}

// Barra do topo, só abaixo de 992 px: botão que abre a gaveta do menu, marca
// e avatar. Com a gaveta aberta, a barra fica inerte, como o resto da tela.
function Navbar({ menuAberto, aoAbrirMenu }) {
  const { sessao } = useSessao();

  return (
    <header className='barra-topo d-lg-none' inert={menuAberto}>
      <button
        type='button'
        className='btn botao-menu'
        aria-label='Abrir menu'
        aria-expanded={menuAberto}
        aria-controls='barra-lateral'
        onClick={aoAbrirMenu}
      >
        <MenuIcon aria-hidden='true' />
      </button>
      <Marca para={INICIO[sessao.usuario.papel]} />
      <BlocoUsuario className='ms-auto' />
    </header>
  );
}

export default Navbar;
