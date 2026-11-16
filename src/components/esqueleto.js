import React from 'react';

// Larguras das barras, para o bloco lembrar um texto e não uma grade.
const LARGURAS = ['w-75', 'w-50', 'w-100'];

// Marcador de carregamento: barras cinzas no lugar do conteúdo. O leitor de
// tela recebe só "Carregando…".
function Esqueleto({ linhas = 3 }) {
  return (
    <div className='placeholder-glow d-flex flex-column gap-3' role='status' aria-busy='true'>
      <span className='visually-hidden'>Carregando…</span>
      {Array.from({ length: linhas }, (_, i) => (
        <span key={i} className={`placeholder rounded-pill ${LARGURAS[i % LARGURAS.length]}`} aria-hidden='true' />
      ))}
    </div>
  );
}

export default Esqueleto;
