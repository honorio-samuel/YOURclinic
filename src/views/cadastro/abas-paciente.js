import React from 'react';
import { NavLink } from 'react-router-dom';

// Abas do cadastro do paciente para a Secretária: Dados (S-01b), Observações
// gerais (S-01c) e Anexos (S-01d). O Administrador não tem as duas últimas
// (A3-R17). No cadastro novo, só Dados fica disponível.
const ABAS = [
  ['dados', 'Dados', '?consulta'],
  ['observacoes', 'Observações gerais', '/observacoes'],
  ['anexos', 'Anexos', '/anexos'],
];

function AbasPaciente({ id, ativa }) {
  return (
    <ul className='nav nav-tabs'>
      {ABAS.map(([chave, rotulo, sufixo]) => (
        <li key={chave} className='nav-item'>
          {id ? (
            <NavLink
              to={`/secretaria/cadastro-pacientes/${id}${sufixo}`}
              end
              className={`nav-link${ativa === chave ? ' active' : ''}`}
              aria-current={ativa === chave ? 'page' : undefined}
            >
              {rotulo}
            </NavLink>
          ) : (
            <span className={`nav-link${ativa === chave ? ' active' : ' disabled'}`} aria-disabled={ativa !== chave}>
              {rotulo}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

export default AbasPaciente;
