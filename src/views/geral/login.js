import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

import { INICIO } from '../../navegacao/menus';
import { PAPEIS } from '../../utils/rotulos';
import { useSessao } from '../../sessao/sessao';

// Acesso de demonstração, só quando configurado no .env:
// REACT_APP_LOGINS_DEMO=ADMINISTRADOR:login,MEDICO:login,...
// REACT_APP_SENHA_DEMO=senha comum dos usuários de demonstração
const LOGINS_DEMO = (process.env.REACT_APP_LOGINS_DEMO ?? '')
  .split(',')
  .map((par) => par.split(':').map((s) => s.trim()))
  .filter(([papel, login]) => PAPEIS[papel] && login);
const SENHA_DEMO = process.env.REACT_APP_SENHA_DEMO ?? '';

// G-01 Login. A mensagem de falha é a mesma para e-mail inexistente e senha
// errada (RNF19); o excesso de tentativas tem texto neutro (G-03, PR-04).
function Login() {
  const { sessao, motivoSaida, entrar } = useSessao();
  const navigate = useNavigate();
  const [login, setLogin] = React.useState('');
  const [senha, setSenha] = React.useState('');
  const [erro, setErro] = React.useState(null);
  const [enviando, setEnviando] = React.useState(false);

  React.useEffect(() => {
    document.title = 'Entrar · YOURClinic';
  }, []);

  if (sessao) return <Navigate to={INICIO[sessao.usuario.papel]} replace />;

  const enviar = async (evento) => {
    evento.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const dados = await entrar(login.trim(), senha);
      const papel = dados.usuario.papel;
      const precisaEscolher = papel === 'RESPONSAVEL_LEGAL' && !dados.idRepresentado;
      navigate(precisaEscolher ? '/portal/representado' : INICIO[papel], { replace: true });
    } catch (e) {
      const status = e.response?.status;
      if (status === 401) setErro('E-mail ou senha inválidos.');
      else if (status === 429 || status === 423)
        setErro('Não foi possível entrar agora. Aguarde alguns minutos e tente de novo.');
      else setErro('Não foi possível conectar ao servidor. Tente de novo em instantes.');
      setEnviando(false);
    }
  };

  return (
    <div className='row justify-content-center'>
      <div className='col-md-7 col-lg-5'>
        <div className='card'>
          <div className='card-body p-4'>
            <h1 className='h3 mb-3'>Entrar</h1>
            {motivoSaida === 'expirada' && (
              <div className='alert alert-info' role='status'>
                Sua sessão terminou por inatividade. Entre de novo para continuar.
              </div>
            )}
            {erro && (
              <div className='alert alert-danger' role='alert'>
                {erro}
              </div>
            )}
            <form onSubmit={enviar} noValidate>
              <div className='mb-3'>
                <label htmlFor='campoLogin' className='form-label'>
                  E-mail
                </label>
                <input
                  id='campoLogin'
                  type='text'
                  className={`form-control ${erro ? 'is-invalid' : ''}`}
                  autoComplete='username'
                  value={login}
                  onChange={(e) => setLogin(e.target.value)}
                  required
                />
              </div>
              <div className='mb-3'>
                <label htmlFor='campoSenha' className='form-label'>
                  Senha
                </label>
                <input
                  id='campoSenha'
                  type='password'
                  className={`form-control ${erro ? 'is-invalid' : ''}`}
                  autoComplete='current-password'
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  required
                />
              </div>
              <div className='d-flex flex-wrap justify-content-between align-items-center gap-2'>
                <button type='submit' className='btn btn-primary' disabled={enviando || !login || !senha}>
                  {enviando ? 'Entrando…' : 'Entrar'}
                </button>
                <span className='small text-body-secondary'>Esqueci minha senha: fale com a recepção.</span>
              </div>
            </form>
          </div>
        </div>
        {LOGINS_DEMO.length > 0 && (
          <div className='card mt-3'>
            <div className='card-body'>
              <h2 className='h6'>Acesso de demonstração</h2>
              <p className='small text-body-secondary'>Preenche o login de um usuário de cada papel.</p>
              <div className='d-flex flex-wrap gap-2'>
                {LOGINS_DEMO.map(([papel, l]) => (
                  <button
                    key={papel}
                    type='button'
                    className='btn btn-sm btn-outline-primary'
                    onClick={() => {
                      setLogin(l);
                      if (SENHA_DEMO) setSenha(SENHA_DEMO);
                    }}
                  >
                    {PAPEIS[papel]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Login;
