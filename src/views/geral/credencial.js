import React from 'react';
import { Link, useParams } from 'react-router-dom';

import { CampoTexto, useFormulario } from '../../components/formulario';
import { mensagemDeErro } from '../../components/confirmacao';
import {
  aceitarConvite,
  consultarConvite,
  consultarRedefinicao,
  erroDeSenha,
  pedirRecuperacao,
  redefinirSenha,
} from '../../servicos/credencial';
import { erroCpf, mascararCpf } from '../../utils/mascaras';

// Telas sem sessão (G-04a, G-04b, G-05, G-06), no mesmo cartão do login.
function Cartao({ titulo, tituloAba, children }) {
  React.useEffect(() => {
    document.title = `${tituloAba ?? titulo} · YOURClinic`;
  }, [titulo, tituloAba]);
  return (
    <div className='row justify-content-center'>
      <div className='col-md-8 col-lg-6'>
        <div className='card'>
          <div className='card-body p-4 d-flex flex-column gap-3'>
            <h1 className='h3 mb-0'>{titulo}</h1>
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

const VoltarAoLogin = () => (
  <Link to='/entrar' className='btn btn-primary align-self-start'>
    Ir para o login
  </Link>
);

// O token serve uma vez; vencido, usado ou desconhecido dão a mesma resposta.
function LinkSemValidade({ titulo }) {
  return (
    <Cartao titulo={titulo}>
      <div className='alert alert-warning mb-0' role='alert'>
        Este link não vale mais. Peça um novo à clínica.
      </div>
      <VoltarAoLogin />
    </Cartao>
  );
}

function CamposDeSenha({ form }) {
  return (
    <>
      <CampoTexto
        {...form.campo('senha')}
        tipo='password'
        rotulo='Nova senha'
        autoComplete='new-password'
        ajuda='Ao menos 8 caracteres, com letras e números.'
        largura='col-12'
      />
      <CampoTexto {...form.campo('confirmacao')} tipo='password' rotulo='Repita a nova senha' autoComplete='new-password' largura='col-12' />
    </>
  );
}

// G-04a e G-04b · Primeiro acesso por convite (RF02, RF09). Antes de criar a
// senha, a pessoa confere o CPF e uma data de nascimento: a própria, se for
// o paciente; a do representado, se for o responsável (D19, B16). Nada do
// cadastro aparece na tela.
export function PrimeiroAcesso() {
  const { token } = useParams();
  const [estado, setEstado] = React.useState({ fase: 'carregando' });
  const form = useFormulario({ cpf: '', dataNascimento: '', senha: '', confirmacao: '' }, 'convite-');
  const v = form.valores;
  const [erro, setErro] = React.useState(null);
  const [enviando, setEnviando] = React.useState(false);

  React.useEffect(() => {
    let ativo = true;
    consultarConvite(token)
      .then((r) => ativo && setEstado({ fase: 'formulario', papel: r.papel }))
      .catch(() => ativo && setEstado({ fase: 'invalido' }));
    return () => {
      ativo = false;
    };
  }, [token]);

  if (estado.fase === 'carregando') return <Cartao titulo='Primeiro acesso'>Carregando…</Cartao>;
  if (estado.fase === 'invalido') return <LinkSemValidade titulo='Primeiro acesso' />;
  if (estado.fase === 'pronto') {
    return (
      <Cartao titulo='Conta ativada'>
        <div className='alert alert-success mb-0' role='status'>
          Sua senha foi criada. Entre com o seu e-mail e a senha nova.
        </div>
        <VoltarAoLogin />
      </Cartao>
    );
  }

  const responsavel = estado.papel === 'RESPONSAVEL_LEGAL';
  const enviar = async (e) => {
    e.preventDefault();
    setErro(null);
    const ok = form.validar({
      cpf: erroCpf(v.cpf),
      dataNascimento: v.dataNascimento ? null : 'Informe a data de nascimento.',
      senha: erroDeSenha(v.senha),
      confirmacao: v.confirmacao === v.senha ? null : 'As duas senhas não são iguais.',
    });
    if (!ok) return;
    setEnviando(true);
    try {
      await aceitarConvite(token, { cpf: v.cpf, dataNascimento: v.dataNascimento, senha: v.senha });
      setEstado({ fase: 'pronto' });
    } catch (falha) {
      if (falha.response?.status === 410) setEstado({ fase: 'invalido' });
      else setErro(mensagemDeErro(falha));
      setEnviando(false);
    }
  };

  return (
    <Cartao titulo='Primeiro acesso'>
      <p className='mb-0'>
        Para criar a sua senha, confirme {responsavel ? 'o seu CPF e a data de nascimento da pessoa que você representa' : 'o seu CPF e a sua data de nascimento'}, como
        estão no cadastro da clínica.
      </p>
      {erro && (
        <div className='alert alert-danger mb-0' role='alert'>
          {erro}
        </div>
      )}
      <form noValidate onSubmit={enviar} aria-label='Primeiro acesso' className='row g-3'>
        <CampoTexto {...form.campo('cpf', mascararCpf)} rotulo='Seu CPF' inputMode='numeric' autoComplete='off' largura='col-md-6' />
        <CampoTexto
          {...form.campo('dataNascimento')}
          tipo='date'
          rotulo={responsavel ? 'Nascimento de quem você representa' : 'Sua data de nascimento'}
          largura='col-md-6'
        />
        <CamposDeSenha form={form} />
        <div className='col-12'>
          <button type='submit' className='btn btn-primary' disabled={enviando}>
            {enviando ? 'Ativando…' : 'Criar senha e ativar'}
          </button>
        </div>
      </form>
    </Cartao>
  );
}

// G-05 · Recuperar senha. A resposta é sempre a mesma, exista ou não o
// e-mail (RF02, RNF19).
export function RecuperarSenha() {
  const [email, setEmail] = React.useState('');
  const [mensagem, setMensagem] = React.useState(null);
  const [enviando, setEnviando] = React.useState(false);
  const enviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    try {
      setMensagem((await pedirRecuperacao(email.trim())).mensagem);
    } catch {
      setMensagem('Se este e-mail estiver cadastrado, você receberá as instruções em instantes.');
    } finally {
      setEnviando(false);
    }
  };
  return (
    <Cartao titulo='Recuperar senha'>
      {mensagem ? (
        <>
          <div className='alert alert-info mb-0' role='status'>
            {mensagem}
          </div>
          <VoltarAoLogin />
        </>
      ) : (
        <form noValidate onSubmit={enviar} aria-label='Recuperar senha' className='d-flex flex-column gap-3'>
          <p className='mb-0'>Informe o e-mail da sua conta. Se ele estiver cadastrado, enviamos um link para criar uma senha nova.</p>
          <div>
            <label htmlFor='recuperarEmail' className='form-label'>
              E-mail
            </label>
            <input
              id='recuperarEmail'
              type='email'
              className='form-control'
              autoComplete='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className='d-flex flex-wrap gap-2'>
            <button type='submit' className='btn btn-primary' disabled={enviando || !email.trim()}>
              {enviando ? 'Enviando…' : 'Enviar link'}
            </button>
            <Link to='/entrar' className='btn btn-outline-secondary'>
              Voltar
            </Link>
          </div>
        </form>
      )}
    </Cartao>
  );
}

// G-06 · Nova senha pelo link do e-mail. Ao trocar, as sessões abertas
// daquela conta terminam (RF02).
export function RedefinirSenha() {
  const { token } = useParams();
  const [fase, setFase] = React.useState('carregando');
  const form = useFormulario({ senha: '', confirmacao: '' }, 'redefinir-');
  const [erro, setErro] = React.useState(null);
  const [enviando, setEnviando] = React.useState(false);

  React.useEffect(() => {
    let ativo = true;
    consultarRedefinicao(token)
      .then(() => ativo && setFase('formulario'))
      .catch(() => ativo && setFase('invalido'));
    return () => {
      ativo = false;
    };
  }, [token]);

  if (fase === 'carregando') return <Cartao titulo='Nova senha'>Carregando…</Cartao>;
  if (fase === 'invalido') return <LinkSemValidade titulo='Nova senha' />;
  if (fase === 'pronto') {
    return (
      <Cartao titulo='Senha trocada'>
        <div className='alert alert-success mb-0' role='status'>
          Sua senha foi trocada e as sessões abertas foram encerradas. Entre com a senha nova.
        </div>
        <VoltarAoLogin />
      </Cartao>
    );
  }

  const enviar = async (e) => {
    e.preventDefault();
    setErro(null);
    const ok = form.validar({
      senha: erroDeSenha(form.valores.senha),
      confirmacao: form.valores.confirmacao === form.valores.senha ? null : 'As duas senhas não são iguais.',
    });
    if (!ok) return;
    setEnviando(true);
    try {
      await redefinirSenha(token, form.valores.senha);
      setFase('pronto');
    } catch (falha) {
      if (falha.response?.status === 410) setFase('invalido');
      else setErro(mensagemDeErro(falha));
      setEnviando(false);
    }
  };

  return (
    <Cartao titulo='Nova senha'>
      {erro && (
        <div className='alert alert-danger mb-0' role='alert'>
          {erro}
        </div>
      )}
      <form noValidate onSubmit={enviar} aria-label='Nova senha' className='row g-3'>
        <CamposDeSenha form={form} />
        <div className='col-12'>
          <button type='submit' className='btn btn-primary' disabled={enviando}>
            {enviando ? 'Salvando…' : 'Salvar senha nova'}
          </button>
        </div>
      </form>
    </Cartao>
  );
}
