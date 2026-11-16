import React from 'react';

import { BlocoUsuario } from './navbar';
import FaixaRepresentado from './faixa-representado';

// Topo de cada tela: título e ações na mesma linha e, a partir de 992 px, o
// bloco do usuário no canto direito (abaixo disso ele fica na barra do topo).
// Quando o título leva um nome, tituloAba dá o título da aba sem ele.
// Com "saudacao", o título vai grande e centralizado, sem ações.
function Pagina({ titulo, tituloAba, acoes, saudacao = false, children }) {
  const aba = tituloAba ?? titulo;
  React.useEffect(() => {
    // Título por rota, sem nome de paciente (RNF04).
    document.title = `${aba} · YOURClinic`;
  }, [aba]);

  return (
    <section aria-labelledby='titulo-pagina' className='pagina'>
      {saudacao ? (
        <>
          <div className='d-none d-lg-flex justify-content-end'>
            <BlocoUsuario />
          </div>
          <h1 id='titulo-pagina' className='display-6 text-center my-4'>
            {titulo}
          </h1>
        </>
      ) : (
        <div className='d-flex align-items-start gap-3 mb-4'>
          {/* Se faltar largura, as ações descem para baixo do título e o
              bloco do usuário continua no canto. */}
          <div className='pagina-titulo d-flex flex-wrap align-items-center gap-3 flex-grow-1'>
            <h1 id='titulo-pagina' className='h3 mb-0 me-auto'>
              {titulo}
            </h1>
            {acoes && <div className='d-flex flex-wrap gap-2'>{acoes}</div>}
          </div>
          <BlocoUsuario className='d-none d-lg-block' />
        </div>
      )}
      <div className='d-flex flex-column gap-3'>
        <FaixaRepresentado />
        {children}
      </div>
    </section>
  );
}

export default Pagina;
