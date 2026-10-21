import React from 'react';

// Título da tela e ações principais na mesma linha; o conteúdo vem abaixo.
// Quando o título leva um nome, tituloAba dá o título da aba sem ele.
function Pagina({ titulo, tituloAba, acoes, children }) {
  const aba = tituloAba ?? titulo;
  React.useEffect(() => {
    // Título por rota, sem nome de paciente (RNF04).
    document.title = `${aba} · YOURClinic`;
  }, [aba]);

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
