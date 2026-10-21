import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import Pagina from '../../components/pagina';
import { CampoSelecao, Formulario, Rodape, Secao, useFormulario, useSairSemSalvar } from '../../components/formulario';
import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { RegistroIndisponivel } from '../geral/avisos';
import { buscar, listar } from '../../servicos/dados';
import { dadosDaPessoa, loginsEmUso, salvarProfissional } from '../../servicos/profissionais';
import { useCarregar } from '../../hooks/use-carregar';
import { PAPEIS, TURNO } from '../../utils/rotulos';
import {
  errosDoProfissional,
  PROFISSIONAL_VAZIO,
  SecaoConta,
  SecaoDadosPessoais,
  useLoginSugerido,
  valoresDoProfissional,
} from './secoes-profissional';

// Papéis criados aqui. Médico nasce em Cadastro › Médicos; paciente e
// responsável, por convite no cadastro do paciente.
const COLECAO = { SECRETARIA: 'secretarias', ADMINISTRADOR: 'administradores' };
const VAZIO = { ...PROFISSIONAL_VAZIO, papel: '', turno: '' };

async function carregarMembro(id) {
  const [pessoa, contas] = await Promise.all([buscar('pessoas', id), listar('usuarios', { idPessoa: id })]);
  const conta = contas.find((c) => COLECAO[c.papel]) ?? null;
  if (!conta) return null;
  const cadastro = await buscar(COLECAO[conta.papel], id);
  return { pessoa, conta, cadastro, papel: conta.papel };
}

// A-04 · Cadastro de usuário da equipe: Secretária ou Administrador (RF03).
// O papel não muda depois de criado; para outro papel, outra conta.
function CadastroEquipe({ modo }) {
  const { id: idTexto } = useParams();
  const id = idTexto ? Number(idTexto) : null;
  const navigate = useNavigate();
  const leitura = modo === 'ver';
  const form = useFormulario(VAZIO);
  const { carregar } = form;
  const [modal, confirmar] = useConfirmacao();
  const [salvando, setSalvando] = React.useState(false);

  const { dados, carregando, erro } = useCarregar(async () => {
    const [logins, atual] = await Promise.all([loginsEmUso(), id ? carregarMembro(id) : null]);
    return { logins, atual };
  }, [id]);

  React.useEffect(() => {
    if (dados?.atual) {
      carregar({ ...valoresDoProfissional(dados.atual), papel: dados.atual.papel, turno: dados.atual.cadastro.turno ?? '' });
    }
  }, [dados, carregar]);

  const tocarLogin = useLoginSugerido(form, !id, dados?.logins ?? []);
  const sair = useSairSemSalvar(form.sujo, confirmar, () => navigate(id && !leitura ? `/admin/equipe/${id}` : '/admin/equipe'));

  if (erro?.status === 404 || (id && dados && !dados.atual)) return <RegistroIndisponivel />;

  const v = form.valores;
  const atual = dados?.atual;
  const ehSecretaria = v.papel === 'SECRETARIA';

  const salvar = async (e) => {
    e.preventDefault();
    const erros = {
      papel: v.papel ? null : 'Escolha o papel.',
      ...errosDoProfissional(v, { logins: dados?.logins ?? [], contaAtual: atual?.conta, novo: !id }),
      turno: ehSecretaria && !v.turno ? 'Escolha o turno.' : null,
    };
    if (!form.validar(erros)) return;
    setSalvando(true);
    try {
      const idSalvo = await salvarProfissional({
        id,
        colecao: COLECAO[v.papel],
        rotulo: ehSecretaria ? 'uma secretária' : 'um administrador',
        papel: v.papel,
        pessoa: dadosDaPessoa(v),
        cadastro: ehSecretaria ? { turno: v.turno } : {},
        login: v.login,
        original: atual,
      });
      mensagemSucesso(id ? 'Cadastro atualizado.' : `Usuário cadastrado. O convite foi enviado para ${v.email.trim()}.`);
      navigate(`/admin/equipe/${idSalvo}`);
    } catch (falha) {
      mensagemErro(mensagemDeErro(falha));
      if (falha.idCriado) navigate(`/admin/equipe/${falha.idCriado}/editar`);
      setSalvando(false);
    }
  };

  const inativo = atual?.conta.situacao === 'INATIVO';
  return (
    <Pagina
      titulo={id ? `Usuário · ${atual?.pessoa.nome ?? '…'}` : 'Novo usuário'}
      tituloAba={id ? 'Usuário da equipe' : 'Novo usuário'}
      acoes={
        leitura &&
        !inativo && (
          <button type='button' className='btn btn-primary' onClick={() => navigate(`/admin/equipe/${id}/editar`)}>
            Editar
          </button>
        )
      }
    >
      {!id && (
        <div className='alert alert-info mb-0' role='note'>
          Contas de médico são criadas em Cadastro › Médicos. Pacientes e responsáveis entram só por convite, no cadastro do paciente.
        </div>
      )}
      {carregando && !dados ? (
        <p className='text-body-secondary'>Carregando…</p>
      ) : (
        <Formulario
          aoEnviar={salvar}
          somenteLeitura={leitura}
          rotulo='Cadastro de usuário da equipe'
          rodape={<Rodape aoCancelar={sair} salvando={salvando} semSalvar={leitura} rotuloCancelar={leitura ? 'Voltar' : 'Cancelar'} />}
        >
          {inativo && (
            <div className='alert alert-secondary mb-0' role='status'>
              Conta inativa. Para editar, reative a conta na lista da equipe.
            </div>
          )}
          <Secao titulo='Papel'>
            <CampoSelecao
              {...form.campo('papel')}
              rotulo='Papel'
              opcoes={Object.keys(COLECAO).map((p) => [p, PAPEIS[p]])}
              disabled={Boolean(id)}
              ajuda={id ? 'O papel não muda depois de criado.' : undefined}
            />
            {ehSecretaria && <CampoSelecao {...form.campo('turno')} rotulo='Turno' opcoes={Object.entries(TURNO)} />}
          </Secao>
          <SecaoDadosPessoais form={form} />
          <SecaoConta form={form} conta={atual?.conta} novo={!id} aoTocarLogin={tocarLogin} />
        </Formulario>
      )}
      {modal}
    </Pagina>
  );
}

export default CadastroEquipe;
