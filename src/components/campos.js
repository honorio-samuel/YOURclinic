import React from 'react';

// Campos de filtro das listagens: busca e seleção, sempre com rótulo visível.

export function CampoBusca({ id, rotulo, valor, aoMudar, dica = 'Buscar…' }) {
  return (
    <div className='filtro'>
      <label htmlFor={id} className='form-label'>
        {rotulo}
      </label>
      <input
        id={id}
        type='search'
        className='form-control'
        placeholder={dica}
        value={valor}
        onChange={(e) => aoMudar(e.target.value)}
      />
    </div>
  );
}

// opcoes: [[valor, rotulo]]
export function CampoSelect({ id, rotulo, valor, aoMudar, opcoes }) {
  return (
    <div className='filtro'>
      <label htmlFor={id} className='form-label'>
        {rotulo}
      </label>
      <select id={id} className='form-select' value={valor} onChange={(e) => aoMudar(e.target.value)}>
        {opcoes.map(([v, r]) => (
          <option key={v} value={v}>
            {r}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Filtros({ children }) {
  return <div className='d-flex flex-wrap align-items-end gap-3'>{children}</div>;
}
