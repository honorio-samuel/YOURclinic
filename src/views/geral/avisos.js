import React from 'react';
import { Link } from 'react-router-dom';

import BlockIcon from '@mui/icons-material/Block';
import SearchOffIcon from '@mui/icons-material/SearchOff';
import ConstructionIcon from '@mui/icons-material/Construction';

import Pagina from '../../components/pagina';
import { INICIO } from '../../navegacao/menus';
import { PAPEIS } from '../../utils/rotulos';
import { primeiroNome } from '../../utils/formatos';
import { useSessao } from '../../sessao/sessao';

function Aviso({ icone: Icone, titulo, children }) {
  const { sessao } = useSessao();
  return (
    <div className='card'>
      <div className='card-body text-center py-5 d-flex flex-column align-items-center gap-3'>
        <Icone fontSize='large' className='text-body-secondary' aria-hidden='true' />
        <h1 className='h3 mb-0'>{titulo}</h1>
        <div className='mx-auto' style={{ maxWidth: '36rem' }}>
          {children}
        </div>
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
    <Aviso icone={BlockIcon} titulo='Acesso negado'>
      <p className='mb-0'>
        Olá, {primeiroNome(usuario?.nome)}. Como {PAPEIS[usuario?.papel]}, você não tem acesso a
        esta funcionalidade.
      </p>
    </Aviso>
  );
}

// G-08b: mesma mensagem para registro inexistente e registro fora do alcance.
export function RegistroIndisponivel() {
  return (
    <Aviso icone={SearchOffIcon} titulo='Registro indisponível'>
      <p className='mb-0'>
        Não foi possível abrir este registro. Ele pode não existir ou não estar disponível para o
        seu perfil.
      </p>
    </Aviso>
  );
}

// Telas que não são listagem ficam para a próxima etapa; o desenho está no Figma.
export function EmBreve({ codigo, titulo }) {
  return (
    <Pagina titulo={titulo}>
      <Aviso icone={ConstructionIcon} titulo='Em construção'>
        <p className='mb-0'>
          Esta tela ({codigo}) está desenhada no protótipo e entra numa próxima etapa. Nesta versão
          estão implementadas as telas de listagem de cada papel.
        </p>
      </Aviso>
    </Pagina>
  );
}
