import React from 'react';

// Os seis estados da consulta (RF22). Não existe um sétimo.
const estados = {
  AGENDADO: { rotulo: 'Agendado', classe: 'bg-secondary text-dark' },
  NA_RECEPCAO: { rotulo: 'Na Recepção', classe: 'bg-info text-dark' },
  EM_ATENDIMENTO: { rotulo: 'Em Atendimento', classe: 'bg-dark text-white' },
  FINALIZADO: { rotulo: 'Finalizado', classe: 'bg-success text-white' },
  CANCELADO: { rotulo: 'Cancelado', classe: 'bg-danger text-white' },
  NAO_COMPARECEU: { rotulo: 'Não Compareceu', classe: 'bg-warning text-dark' },
};

function PilulaStatus(props) {
  // Um status fora da lista vindo da API aparece como texto, sem cor.
  const { rotulo, classe } = estados[props.estado] ?? {
    rotulo: props.estado,
    classe: 'bg-light text-dark',
  };

  return (
    <span className={`badge rounded-pill pilula-status ${classe}`}>
      {rotulo}
    </span>
  );
}

export default PilulaStatus;
