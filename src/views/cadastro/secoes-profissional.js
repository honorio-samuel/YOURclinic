import React from 'react';

import PilulaStatus from '../../components/pilula-status';
import { CampoSelecao, CampoTexto, Secao } from '../../components/formulario';
import { DATA_DE_HOJE } from '../../config/axios';
import {
  erroCpf,
  erroData,
  erroEmail,
  erroLogin,
  erroNomeCompleto,
  erroTelefone,
  mascararCpf,
  mascararTelefone,
  sugerirLogin,
} from '../../utils/mascaras';
import { CONTA, rotuloDe } from '../../utils/rotulos';

// Partes comuns aos cadastros de médico (A-03) e de equipe (A-04).

export const PROFISSIONAL_VAZIO = { nome: '', cpf: '', dataNascimento: '', sexo: '', telefone: '', email: '', login: '' };

export function valoresDoProfissional({ pessoa, conta }) {
  return {
    nome: pessoa.nome ?? '',
    cpf: pessoa.cpf ?? '',
    dataNascimento: pessoa.dataNascimento ?? '',
    sexo: pessoa.sexo ?? '',
    telefone: pessoa.telefone ?? '',
    email: pessoa.email ?? conta?.email ?? '',
    login: conta?.login ?? '',
  };
}

// O login é obrigatório no cadastro novo e em quem já tem conta, e não pode
// repetir o de outra conta.
export function errosDoProfissional(v, { logins, contaAtual, comTratamento, novo }) {
  const emUso = logins.filter((c) => c.login !== contaAtual?.login).map((c) => c.login);
  return {
    nome: erroNomeCompleto(v.nome),
    cpf: erroCpf(v.cpf),
    dataNascimento: erroData(v.dataNascimento, { obrigatorio: false }),
    sexo: comTratamento && !v.sexo ? 'Escolha como o nome aparece.' : null,
    telefone: v.telefone ? erroTelefone(v.telefone) : null,
    email: erroEmail(v.email, { obrigatorio: true }),
    login: !novo && !contaAtual && !v.login ? null : erroLogin(v.login, emUso),
  };
}

// Enquanto a pessoa não mexe no login, ele acompanha o nome.
export function useLoginSugerido(form, ativo, logins) {
  const { definir } = form;
  const nome = form.valores.nome;
  const [tocado, setTocado] = React.useState(false);
  React.useEffect(() => {
    if (!ativo || tocado) return;
    const emUso = new Set(logins.map((c) => c.login));
    const base = sugerirLogin(nome);
    let sugestao = base;
    for (let n = 2; emUso.has(sugestao); n++) sugestao = `${base}${n}`;
    definir('login', nome.trim() ? sugestao : '');
  }, [nome, ativo, tocado, logins, definir]);
  return () => setTocado(true);
}

export function SecaoDadosPessoais({ form, comTratamento = false }) {
  return (
    <Secao titulo='Dados pessoais'>
      <CampoTexto {...form.campo('nome')} rotulo='Nome completo' autoComplete='off' />
      <CampoTexto {...form.campo('cpf', mascararCpf)} rotulo='CPF' inputMode='numeric' placeholder='000.000.000-00' />
      <CampoTexto {...form.campo('dataNascimento')} tipo='date' rotulo='Data de nascimento' opcional max={DATA_DE_HOJE} />
      {comTratamento && (
        <CampoSelecao
          {...form.campo('sexo')}
          rotulo='Tratamento'
          opcoes={[
            ['F', 'Dra.'],
            ['M', 'Dr.'],
          ]}
          ajuda='Aparece antes do nome na agenda e no portal.'
        />
      )}
      <CampoTexto
        {...form.campo('telefone', mascararTelefone)}
        tipo='tel'
        rotulo='Telefone'
        opcional
        inputMode='numeric'
        placeholder='(00) 00000-0000'
      />
      <CampoTexto {...form.campo('email')} tipo='email' rotulo='E-mail' ajuda='Recebe o convite de acesso.' />
    </Secao>
  );
}

export function SecaoConta({ form, conta, novo, aoTocarLogin }) {
  const campo = form.campo('login');
  return (
    <Secao titulo='Conta de acesso'>
      <CampoTexto
        {...campo}
        aoMudar={(valor) => {
          aoTocarLogin?.();
          campo.aoMudar(valor.toLowerCase());
        }}
        rotulo='Login'
        opcional={!novo && !conta}
        autoComplete='off'
        ajuda={
          conta
            ? undefined
            : novo
            ? 'A conta nasce com o convite pendente; a senha é definida pela pessoa, pelo link enviado ao e-mail.'
            : 'Sem conta. Preencha o login para enviar o convite ao salvar.'
        }
      />
      {conta && (
        <div className='col-md-6'>
          <span className='form-label d-block'>Situação da conta</span>
          <PilulaStatus {...rotuloDe(CONTA, conta.situacao)} />
        </div>
      )}
    </Secao>
  );
}
