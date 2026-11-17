import React from 'react';
import { Link, useLocation } from 'react-router-dom';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

import { MENUS } from '../navegacao/menus';

// Telas que se abrem a partir de um item acendem esse item: o cadastro acende a
// listagem da mesma entidade, e o prontuário, Meus pacientes.
function rotaDaListagem(caminho) {
  const cadastro = caminho.match(/^(\/[a-z]+)\/cadastro-([a-z-]+)/);
  if (cadastro) return `${cadastro[1]}/listagem-${cadastro[2]}`;
  if (caminho.startsWith('/medico/prontuario/')) return '/medico/listagem-pacientes';
  return null;
}

// Rota do único item aceso. A própria tela vem primeiro; só quando ela não está
// no menu vale a listagem a que pertence. Sem essa ordem, "Agendar consulta" do
// portal acendia também "Meus agendamentos".
function rotaAcesa(itens, caminho) {
  const rotas = itens.flatMap((item) => (item.itens ? item.itens.map((sub) => sub.rota) : [item.rota]));
  return (
    rotas.find((rota) => caminho === rota || caminho.startsWith(rota + '/')) ??
    rotas.find((rota) => rota === rotaDaListagem(caminho)) ??
    null
  );
}

function ItemMenu({ rota, acesa, children }) {
  const ativo = rota === acesa;
  return (
    <Link to={rota} className={`nav-link${ativo ? ' active' : ''}`} aria-current={ativo ? 'page' : undefined}>
      {children}
    </Link>
  );
}

// A pílula preenchida fica só no item da tela atual; o grupo que o contém
// abre e ganha peso, sem preenchimento.
function GrupoMenu({ grupo, acesa }) {
  const ativo = grupo.itens.some((item) => item.rota === acesa);
  const [aberto, setAberto] = React.useState(ativo);
  const id = `submenu-${grupo.rotulo.replace(/\W+/g, '-').toLowerCase()}`;
  const Icone = grupo.icone;
  const Seta = aberto ? ExpandLessIcon : ExpandMoreIcon;

  React.useEffect(() => {
    if (ativo) setAberto(true);
  }, [ativo]);

  return (
    <li className='nav-item'>
      <button
        type='button'
        className={`nav-link${ativo ? ' grupo-ativo' : ''}`}
        aria-expanded={aberto}
        aria-controls={id}
        onClick={() => setAberto((a) => !a)}
      >
        <Icone fontSize='small' aria-hidden='true' />
        <span className='flex-grow-1'>{grupo.rotulo}</span>
        <Seta fontSize='small' className='text-body-secondary' aria-hidden='true' />
      </button>
      {aberto && (
        <ul id={id} className='nav flex-column submenu'>
          {grupo.itens.map((item) => (
            <li key={item.rota} className='nav-item'>
              <ItemMenu rota={item.rota} acesa={acesa}>
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
  const acesa = rotaAcesa(itens, pathname);

  return (
    <nav aria-label='Menu principal'>
      <ul className='nav nav-pills flex-column menu-lateral'>
        {itens.map((item) =>
          item.itens ? (
            <GrupoMenu key={item.rotulo} grupo={item} acesa={acesa} />
          ) : (
            <li key={item.rota} className='nav-item'>
              <ItemMenu rota={item.rota} acesa={acesa}>
                <item.icone fontSize='small' aria-hidden='true' />
                {item.rotulo}
              </ItemMenu>
            </li>
          )
        )}
      </ul>
    </nav>
  );
}

export default MenuLateral;
