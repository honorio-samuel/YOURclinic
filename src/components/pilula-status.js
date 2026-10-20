import React from 'react';

import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { STATUS_CONSULTA } from '../utils/rotulos';

const CLASSE_DO_TOM = {
  neutro: 'pilula-neutra',
  info: 'text-bg-info',
  escuro: 'text-bg-dark',
  sucesso: 'text-bg-success',
  perigo: 'text-bg-danger',
  aviso: 'text-bg-warning',
};

// Pílula de status. Com "transicoes", vira botão que abre só as mudanças de
// estado permitidas ao papel (PilulaStatus/Interativa do Figma).
// Mantém a forma antiga: <PilulaStatus estado='AGENDADO' />.
function PilulaStatus({ estado, rotulo, tom, transicoes }) {
  const [aberta, setAberta] = React.useState(false);
  const raiz = React.useRef(null);

  // Um status fora da lista vindo da API aparece como texto, sem cor.
  const doEstado = estado ? STATUS_CONSULTA[estado] ?? { rotulo: estado, tom: 'neutro' } : null;
  const texto = rotulo ?? doEstado?.rotulo;
  const classe = CLASSE_DO_TOM[tom ?? doEstado?.tom ?? 'neutro'];

  React.useEffect(() => {
    if (!aberta) return undefined;
    const fechar = (evento) => {
      if (raiz.current && !raiz.current.contains(evento.target)) setAberta(false);
    };
    const esc = (evento) => {
      if (evento.key === 'Escape') setAberta(false);
    };
    document.addEventListener('mousedown', fechar);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', fechar);
      document.removeEventListener('keydown', esc);
    };
  }, [aberta]);

  if (!transicoes || transicoes.length === 0) {
    return <span className={`badge rounded-pill pilula-status ${classe}`}>{texto}</span>;
  }

  return (
    <div className='position-relative d-inline-block' ref={raiz}>
      <button
        type='button'
        className={`badge rounded-pill pilula-status pilula-interativa ${classe}`}
        aria-haspopup='menu'
        aria-expanded={aberta}
        onClick={() => setAberta((a) => !a)}
      >
        {texto}
        <ExpandMoreIcon fontSize='inherit' aria-hidden='true' />
        <span className='visually-hidden'>: mudar status</span>
      </button>
      {aberta && (
        <ul className='dropdown-menu show' role='menu'>
          {transicoes.map((t) => (
            <li key={t.rotulo} role='none'>
              <button
                type='button'
                role='menuitem'
                className='dropdown-item'
                disabled={t.desabilitado}
                onClick={() => {
                  setAberta(false);
                  t.aoEscolher();
                }}
              >
                {t.rotulo}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default PilulaStatus;
