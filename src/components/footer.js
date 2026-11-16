import React from 'react';

const CLINICA = {
  nome: 'Clínica YOURClinic',
  telefone: '(11) 4002-8922',
  endereco: 'Rua das Acácias, nº 120, Bairro Centro 01000-000',
};

// Contato da clínica: fica no pé da barra lateral e abaixo do login.
function Footer({ className = '' }) {
  return (
    <footer className={`small text-body-secondary ${className}`}>
      <span className='d-block fw-semibold text-body'>{CLINICA.nome}</span>
      <span className='d-block'>{CLINICA.telefone}</span>
      <span className='d-block'>{CLINICA.endereco}</span>
    </footer>
  );
}

export default Footer;
