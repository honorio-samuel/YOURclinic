import React from 'react';

// Tratamentos e partículas não entram nas iniciais.
const FORA_DAS_INICIAIS = /^(dr|dra|de|da|do|das|dos|e)\.?$/i;

// Primeira letra do primeiro e do último nome.
function iniciais(nome) {
  const partes = (nome ?? '').trim().split(/\s+/).filter((parte) => parte && !FORA_DAS_INICIAIS.test(parte));
  if (partes.length === 0) return '';
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : '';
  return (partes[0][0] + ultima).toUpperCase();
}

// Avatar de iniciais: neutro nas tabelas e escuro no bloco do usuário. Não leva
// foto nem cor por pessoa. O nome sempre aparece ao lado, então o avatar fica
// fora da leitura de tela.
function Avatar({ nome, usuario = false }) {
  return (
    <span className={`avatar ${usuario ? 'avatar-usuario text-bg-dark' : 'bg-body-secondary'}`} aria-hidden='true'>
      {iniciais(nome)}
    </span>
  );
}

// Nome com avatar, para a coluna de nome das tabelas.
export function NomeComAvatar({ nome }) {
  return (
    <span className='d-inline-flex align-items-center gap-2'>
      <Avatar nome={nome} />
      <span className='fw-semibold'>{nome}</span>
    </span>
  );
}

export default Avatar;
