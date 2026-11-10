import React from 'react';
import { Link, useNavigate } from 'react-router-dom';

import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';

import avatar from '../assets/avatar.svg';
import { INICIO } from '../navegacao/menus';
import { PAPEIS } from '../utils/rotulos';
import { useSessao } from '../sessao/sessao';

// Cabeçalho com a marca e o menu do avatar (Meu perfil e Sair).
function Navbar() {
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

  const terminar = async () => {
    setAberto(false);
    await sair();
    navigate('/entrar', { replace: true });
  };

  return (
    <header className='navbar navbar-dark bg-primary py-0 mb-4'>
      <div className='container'>
        <div className='row flex-fill'>
          <div className='col-auto col-lg-3 py-4 cabecalho-divisao'>
            <Link to={usuario ? INICIO[usuario.papel] : '/entrar'} className='navbar-brand marca'>
              <span className='text-dark'>YOUR</span>
              <span className='text-white'>Clinic</span>
            </Link>
          </div>
          {usuario && (
            <div className='col py-4 d-flex justify-content-end align-items-center'>
              <div className='position-relative' ref={raiz}>
                <button
                  type='button'
                  className='usuario-ativo bg-white border-0 d-flex align-items-center gap-3 px-3 py-1 text-start'
                  aria-haspopup='menu'
                  aria-expanded={aberto}
                  onClick={() => setAberto((a) => !a)}
                >
                  <img src={avatar} alt='' width='40' height='40' />
                  <span className='d-none d-sm-block'>
                    <span className='d-block fw-normal text-dark'>{usuario.nome}</span>
                    <span className='d-block small text-body-secondary'>{PAPEIS[usuario.papel]}</span>
                  </span>
                </button>
                {aberto && (
                  <ul className='dropdown-menu dropdown-menu-end show' role='menu'>
                    <li role='none'>
                      <Link role='menuitem' className='dropdown-item d-flex align-items-center gap-2' to='/perfil' onClick={() => setAberto(false)}>
                        <PersonIcon fontSize='small' aria-hidden='true' /> Meu perfil
                      </Link>
                    </li>
                    <li role='none'>
                      <button type='button' role='menuitem' className='dropdown-item d-flex align-items-center gap-2' onClick={terminar}>
                        <LogoutIcon fontSize='small' aria-hidden='true' /> Sair
                      </button>
                    </li>
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

export default Navbar;
