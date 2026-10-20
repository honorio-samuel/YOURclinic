import React from 'react';

// Título da tela e ações principais na mesma linha; o conteúdo vem abaixo.
function Pagina({ titulo, acoes, children }) {
  React.useEffect(() => {
    // Título por rota, sem nome de paciente (RNF04).
    document.title = `${titulo} · YOURClinic`;
  }, [titulo]);

  return (
    <section aria-labelledby='titulo-pagina'>
      <div className='d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3'>
        <h1 id='titulo-pagina' className='h3 mb-0'>
          {titulo}
        </h1>
        {acoes && <div className='d-flex flex-wrap gap-2'>{acoes}</div>}
      </div>
      <div className='d-flex flex-column gap-3'>{children}</div>
    </section>
  );
}

export default Pagina;
