import React from 'react';

import { CampoSelecao, CampoTexto, Secao } from '../../components/formulario';
import { mascararCpf } from '../../utils/mascaras';
import { GRAU_PARENTESCO, NATUREZA_REPRESENTACAO } from '../../utils/rotulos';

// Bloco "Responsável legal" do cadastro do paciente (RF08). Com representação
// em vigor, nome e CPF ficam só para leitura: trocar de responsável é
// encerrar a representação (Administrador) e registrar outra.
function SecaoResponsavel({ form, existente, podeEncerrar, aoEncerrar }) {
  return (
    <Secao titulo='Responsável legal'>
      {existente ? (
        <>
          <CampoTexto id='campo-respNome' rotulo='Nome do responsável' valor={existente.nome} aoMudar={() => {}} readOnly className='form-control campo-leitura' />
          <CampoTexto id='campo-respCpf' rotulo='CPF do responsável' valor={existente.cpf ?? '—'} aoMudar={() => {}} readOnly className='form-control campo-leitura' />
        </>
      ) : (
        <>
          <CampoTexto {...form.campo('respNome')} rotulo='Nome do responsável' autoComplete='off' />
          <CampoTexto
            {...form.campo('respCpf', mascararCpf)}
            rotulo='CPF do responsável'
            inputMode='numeric'
            placeholder='000.000.000-00'
            ajuda='Se o responsável já tem cadastro, o CPF liga este paciente a ele.'
          />
        </>
      )}
      <CampoSelecao {...form.campo('grauParentesco')} rotulo='Grau de parentesco' opcoes={Object.entries(GRAU_PARENTESCO)} />
      <CampoSelecao {...form.campo('natureza')} rotulo='Natureza da representação' opcoes={Object.entries(NATUREZA_REPRESENTACAO)} />
      <CampoTexto
        {...form.campo('respEmail')}
        tipo='email'
        rotulo='E-mail do responsável'
        opcional
        ajuda='Usado no convite do portal.'
      />
      {podeEncerrar && (
        <div className='col-md-6 d-flex align-items-end'>
          <button type='button' className='btn btn-outline-danger' onClick={aoEncerrar}>
            Encerrar representação
          </button>
        </div>
      )}
    </Secao>
  );
}

export default SecaoResponsavel;
