import React from 'react';

import SearchIcon from '@mui/icons-material/Search';

// Campos de filtro das listagens: busca, seleção e chips, sempre com rótulo visível.

export function CampoBusca({ id, rotulo, valor, aoMudar, dica = 'Buscar…' }) {
  return (
    <div className='filtro filtro-busca'>
      <label htmlFor={id} className='form-label'>
        {rotulo}
      </label>
      <div className='position-relative'>
        <SearchIcon
          fontSize='small'
          className='position-absolute top-50 start-0 translate-middle-y ms-2 text-body-secondary pe-none'
          aria-hidden='true'
        />
        <input
          id={id}
          type='search'
          className='form-control'
          placeholder={dica}
          value={valor}
          onChange={(e) => aoMudar(e.target.value)}
        />
      </div>
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

// Quantas linhas carregadas cabem em cada opção de um filtro, sem os demais
// filtros da tela; "Todos" ('') conta todas. valorDe(linha) devolve o valor da
// opção a que a linha pertence. Enquanto não há linhas, não há número.
export const contarPor = (linhas, valorDe) => (opcao) =>
  linhas ? (opcao ? linhas.filter((linha) => valorDe(linha) === opcao).length : linhas.length) : undefined;

// Mesmas props do CampoSelect, para lista fixa de até quatro opções: todas
// ficam à vista e a escolhida vai preenchida. São botões de rádio, então o
// teclado e o leitor de tela tratam o grupo como uma escolha só. Com
// "contagem" (de contarPor), cada chip mostra quantas linhas tem.
export function CampoChips({ id, rotulo, valor, aoMudar, opcoes, contagem }) {
  return (
    <fieldset className='filtro-chips'>
      <legend className='form-label float-none w-auto'>{rotulo}</legend>
      <div className='d-flex flex-wrap gap-2'>
        {opcoes.map(([v, r], i) => {
          const n = contagem?.(v);
          return (
            <React.Fragment key={v}>
              <input
                type='radio'
                className='btn-check'
                name={id}
                id={`${id}-${i}`}
                checked={valor === v}
                onChange={() => aoMudar(v)}
              />
              <label htmlFor={`${id}-${i}`} className='btn btn-sm btn-outline-secondary rounded-pill chip'>
                {r}
                {n !== undefined && (
                  <>
                    {' '}
                    <span className='chip-contagem'>{n}</span>
                  </>
                )}
              </label>
            </React.Fragment>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Filtros({ children }) {
  return <div className='d-flex flex-wrap align-items-end gap-3'>{children}</div>;
}
