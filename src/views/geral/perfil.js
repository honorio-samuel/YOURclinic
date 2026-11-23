import React from 'react';

import Pagina from '../../components/pagina';
import { CampoTexto, Formulario, Secao, useFormulario } from '../../components/formulario';
import { mensagemDeErro } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { alterarSenha, erroDeSenha } from '../../servicos/credencial';
import { buscar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { PAPEIS } from '../../utils/rotulos';

const VAZIO = { atual: '', senha: '', confirmacao: '' };

// G-10 · Meu perfil. Mostra os próprios dados de conta e troca a senha,
// pedindo a atual (RF02); as outras sessões da conta terminam.
function MeuPerfil() {
  const { sessao } = useSessao();
  const { dados } = useCarregar(() => buscar('pessoas', sessao.usuario.idPessoa).catch(() => null), [sessao.usuario.idPessoa]);
  const form = useFormulario(VAZIO, 'perfil-');
  const v = form.valores;
  const [salvando, setSalvando] = React.useState(false);

  const salvar = async (e) => {
    e.preventDefault();
    const ok = form.validar({
      atual: v.atual ? null : 'Informe a senha atual.',
      senha: erroDeSenha(v.senha) ?? (v.senha === v.atual ? 'A senha nova precisa ser diferente da atual.' : null),
      confirmacao: v.confirmacao === v.senha ? null : 'As duas senhas não são iguais.',
    });
    if (!ok) return;
    setSalvando(true);
    try {
      await alterarSenha(v.atual, v.senha);
      mensagemSucesso('Senha alterada. As outras sessões da sua conta foram encerradas.');
      form.carregar(VAZIO);
    } catch (falha) {
      mensagemErro(mensagemDeErro(falha));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Pagina titulo='Meu perfil'>
      <Secao titulo='Conta'>
        <div className='col-md-6'>
          <span className='form-label d-block'>Nome</span>
          <span className='form-control campo-leitura'>{sessao.usuario.nome}</span>
        </div>
        <div className='col-md-6'>
          <span className='form-label d-block'>Papel</span>
          <span className='form-control campo-leitura'>{PAPEIS[sessao.usuario.papel]}</span>
        </div>
        <div className='col-md-6'>
          <span className='form-label d-block'>E-mail</span>
          <span className='form-control campo-leitura'>{dados?.email ?? '—'}</span>
        </div>
        <p className='col-12 small text-body-secondary mb-0'>Para mudar nome ou e-mail, fale com a clínica.</p>
      </Secao>
      <Formulario
        aoEnviar={salvar}
        rotulo='Alterar senha'
        rodape={
          <div className='d-flex justify-content-end'>
            <button type='submit' className='btn btn-primary' disabled={salvando}>
              {salvando ? 'Salvando…' : 'Alterar senha'}
            </button>
          </div>
        }
      >
        <Secao titulo='Alterar senha'>
          <CampoTexto {...form.campo('atual')} tipo='password' rotulo='Senha atual' autoComplete='current-password' largura='col-md-4' />
          <CampoTexto
            {...form.campo('senha')}
            tipo='password'
            rotulo='Nova senha'
            autoComplete='new-password'
            ajuda='Ao menos 8 caracteres, com letras e números.'
            largura='col-md-4'
          />
          <CampoTexto {...form.campo('confirmacao')} tipo='password' rotulo='Repita a nova senha' autoComplete='new-password' largura='col-md-4' />
        </Secao>
      </Formulario>
    </Pagina>
  );
}

export default MeuPerfil;
