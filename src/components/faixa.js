import React from 'react';

import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';

// Fundo suave da faixa e chip do ícone em cada tom. O tom nunca vai sozinho:
// o texto diz do que se trata (D10).
const TONS = {
  info: { faixa: 'alert-info', chip: 'text-bg-info', icone: InfoOutlinedIcon },
  aviso: { faixa: 'alert-warning', chip: 'text-bg-warning', icone: WarningAmberOutlinedIcon },
  perigo: { faixa: 'alert-danger', chip: 'text-bg-danger', icone: ErrorOutlineOutlinedIcon },
  neutro: { faixa: 'alert-secondary', chip: 'text-bg-dark', icone: InfoOutlinedIcon },
};

// Faixa de aviso: chip de ícone, texto e ações à direita.
// "papel" é o role do leitor de tela: alert para erro, status para aviso que
// surge depois da tela aberta.
function Faixa({ tom = 'info', icone, acoes, papel, children }) {
  const { faixa, chip, icone: IconeDoTom } = TONS[tom];
  const Icone = icone ?? IconeDoTom;

  return (
    <div className={`alert ${faixa} d-flex flex-wrap align-items-center gap-3 mb-0`} role={papel}>
      <span className={`chip-icone ${chip}`} aria-hidden='true'>
        <Icone fontSize='small' />
      </span>
      <div className='faixa-texto'>{children}</div>
      {acoes && <div className='d-flex flex-wrap align-items-center gap-2'>{acoes}</div>}
    </div>
  );
}

export default Faixa;
