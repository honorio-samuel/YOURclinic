import React from 'react';

// Horários livres como botões de opção: um só fica escolhido e as setas do
// teclado andam entre eles. O grupo leva o id do campo, para o foco ir até ele
// quando o formulário acusa erro. horarios: ['08:00', ...] ou null (ainda sem
// médico, tipo ou data, e então aparece o "aviso").
function CampoHorarios({
  id,
  rotulo = 'Horário',
  horarios,
  valor,
  aoMudar,
  erro,
  carregando = false,
  aviso = 'Escolha o médico, o tipo de atendimento e a data para ver os horários livres.',
  vazio = 'Nenhum horário livre neste dia.',
  opcional = false,
}) {
  const manha = (horarios ?? []).filter((h) => h < '12:00');
  const tarde = (horarios ?? []).filter((h) => h >= '12:00');

  const opcoes = (lista) => (
    <div className='d-flex flex-wrap gap-2'>
      {lista.map((h) => (
        <React.Fragment key={h}>
          <input
            type='radio'
            className='btn-check'
            name={id}
            id={`${id}-${h}`}
            value={h}
            checked={valor === h}
            onChange={() => aoMudar(h)}
          />
          <label className='btn btn-outline-primary btn-sm botao-horario' htmlFor={`${id}-${h}`}>
            {h.replace(':', 'h')}
          </label>
        </React.Fragment>
      ))}
    </div>
  );

  let conteudo;
  if (carregando) conteudo = <p className='text-body-secondary mb-0'>Carregando horários…</p>;
  else if (horarios === null || horarios === undefined) conteudo = <p className='text-body-secondary mb-0'>{aviso}</p>;
  else if (horarios.length === 0) conteudo = <p className='mb-0'>{vazio}</p>;
  else {
    conteudo = (
      <div className='d-flex flex-column gap-2'>
        {manha.length > 0 && (
          <div>
            <p className='small text-body-secondary mb-1'>Manhã</p>
            {opcoes(manha)}
          </div>
        )}
        {tarde.length > 0 && (
          <div>
            <p className='small text-body-secondary mb-1'>Tarde</p>
            {opcoes(tarde)}
          </div>
        )}
      </div>
    );
  }

  return (
    <fieldset id={id} tabIndex={-1} className='col-12 campo-horarios' aria-describedby={erro ? `${id}-erro` : undefined}>
      <legend className='form-label fs-6 mb-2'>
        {rotulo}
        {!opcional && (
          <span className='text-danger' aria-hidden='true'>
            {' '}
            *
          </span>
        )}
      </legend>
      <div aria-live='polite'>{conteudo}</div>
      {erro && (
        <div id={`${id}-erro`} className='invalid-feedback d-block'>
          {erro}
        </div>
      )}
    </fieldset>
  );
}

export default CampoHorarios;
