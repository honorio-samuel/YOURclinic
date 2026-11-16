import React from 'react';
import { Link } from 'react-router-dom';

import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import SearchOffOutlinedIcon from '@mui/icons-material/SearchOffOutlined';
import ConstructionOutlinedIcon from '@mui/icons-material/ConstructionOutlined';

import Pagina from '../../components/pagina';
import { INICIO } from '../../navegacao/menus';
import { PAPEIS } from '../../utils/rotulos';
import { primeiroNome } from '../../utils/formatos';
import { useSessao } from '../../sessao/sessao';

// Cartão central das telas de aviso. O título da tela vem da Pagina; "titulo"
// aqui é o do cartão, quando ele diz outra coisa.
function Aviso({ icone: Icone, titulo, children }) {
  const { sessao } = useSessao();
  return (
    <div className='card'>
      <div className='card-body text-center py-5 d-flex flex-column align-items-center gap-3'>
        <span className='chip-icone text-bg-dark' aria-hidden='true'>
          <Icone fontSize='small' />
        </span>
        {titulo && <h2 className='h4 mb-0'>{titulo}</h2>}
        <div className='col-md-10 col-xl-7'>{children}</div>
        {sessao && (
          <Link to={INICIO[sessao.usuario.papel]} className='btn btn-primary'>
            Voltar ao início
          </Link>
        )}
      </div>
    </div>
  );
}

// G-08a: rota fora do papel. Pode nomear o papel, porque não depende de registro.
export function AcessoNegado() {
  const { sessao } = useSessao();
  const usuario = sessao?.usuario;
  return (
    <Pagina titulo='Acesso negado'>
      <Aviso icone={BlockOutlinedIcon}>
        <p className='mb-0'>
          Olá, {primeiroNome(usuario?.nome)}. Como {PAPEIS[usuario?.papel]}, você não tem acesso a
          esta funcionalidade.
        </p>
      </Aviso>
    </Pagina>
  );
}

// G-08b: mesma mensagem para registro inexistente e registro fora do alcance.
export function RegistroIndisponivel() {
  return (
    <Pagina titulo='Registro indisponível'>
      <Aviso icone={SearchOffOutlinedIcon}>
        <p className='mb-0'>
          Não foi possível abrir este registro. Ele pode não existir ou não estar disponível para o
          seu perfil.
        </p>
      </Aviso>
    </Pagina>
  );
}

// Telas do protótipo que ainda não foram implementadas no app.
export function EmBreve({ codigo, titulo }) {
  return (
    <Pagina titulo={titulo}>
      <Aviso icone={ConstructionOutlinedIcon} titulo='Em construção'>
        <p className='mb-0'>Esta tela ({codigo}) está desenhada no protótipo e entra numa próxima etapa.</p>
      </Aviso>
    </Pagina>
  );
}
