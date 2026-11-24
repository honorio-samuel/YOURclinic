import React from 'react';
import { Link } from 'react-router-dom';

// Peças dos painéis (A-12, A-29): número com legenda e barra de proporção.
// A barra nunca fala só por cor: a legenda traz o rótulo, o valor e a parte.

export function CartaoIndicador({ titulo, para, rotuloLink = 'Ver detalhes', children }) {
  return (
    <section className='card h-100' aria-label={titulo}>
      <div className='card-body d-flex flex-column gap-2'>
        <h2 className='h6 mb-0'>{titulo}</h2>
        {children}
        {para && (
          <Link to={para} className='small mt-auto'>
            {rotuloLink}
            <span className='visually-hidden'>: {titulo}</span>
          </Link>
        )}
      </div>
    </section>
  );
}

export function Numero({ valor, rotulo }) {
  return (
    <div>
      <div className='fs-3 fw-light lh-sm'>{valor}</div>
      {rotulo && <div className='small text-body-secondary'>{rotulo}</div>}
    </div>
  );
}

const CLASSE = {
  sucesso: 'bg-success',
  info: 'bg-info',
  aviso: 'bg-warning',
  perigo: 'bg-danger',
  neutro: 'bg-secondary',
  primario: 'bg-primary',
};

// partes: [{ rotulo, valor, tom, texto }] — "texto" é o valor já formatado.
export function BarraProporcao({ partes, rotulo }) {
  const total = partes.reduce((s, p) => s + (p.valor > 0 ? p.valor : 0), 0);
  const porcento = (v) => (total > 0 ? Math.round((v / total) * 1000) / 10 : 0);
  return (
    <div>
      <div className='progress barra-proporcao' role='img' aria-label={rotulo}>
        {partes
          .filter((p) => p.valor > 0)
          .map((p) => (
            <div key={p.rotulo} className={`progress-bar ${CLASSE[p.tom] ?? 'bg-primary'}`} style={{ width: `${porcento(p.valor)}%` }} />
          ))}
      </div>
      <ul className='list-unstyled small mb-0 mt-2 d-flex flex-column gap-1'>
        {partes.map((p) => (
          <li key={p.rotulo} className='d-flex justify-content-between gap-2'>
            <span>
              <span className={`amostra-indicador ${CLASSE[p.tom] ?? 'bg-primary'}`} aria-hidden='true' /> {p.rotulo}
            </span>
            <span className='text-nowrap'>
              {p.texto ?? p.valor} · {porcento(p.valor)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
