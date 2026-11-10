import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import { CampoSelecao, CampoTexto, Formulario, Rodape, Secao, useFormulario, useSairSemSalvar } from '../../components/formulario';
import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { RegistroIndisponivel } from '../geral/avisos';
import { listar } from '../../servicos/dados';
import { carregarProfissional, dadosDaPessoa, loginsEmUso, salvarProfissional } from '../../servicos/profissionais';
import { useCarregar } from '../../hooks/use-carregar';
import { useCadastro } from '../../navegacao/caminhos';
import { nomeMedico, soDigitos } from '../../utils/formatos';
import { mascararDigitos } from '../../utils/mascaras';
import { UFS } from '../../utils/rotulos';
import {
  errosDoProfissional,
  PROFISSIONAL_VAZIO,
  SecaoConta,
  SecaoDadosPessoais,
  useLoginSugerido,
  valoresDoProfissional,
} from './secoes-profissional';

const VAZIO = { ...PROFISSIONAL_VAZIO, crm: '', ufCrm: '', especialidade: '' };

// A-03 · Cadastro do médico: dados pessoais, registro profissional e conta de
// acesso no mesmo fluxo (RF10, RF03). Inativar fica na lista e encerra a
// conta e os vínculos.
function CadastroMedico() {
  const { id, consulta: leitura, listagem, editar } = useCadastro('medicos');
  const navigate = useNavigate();
  const form = useFormulario(VAZIO);
  const { carregar } = form;
  const [modal, confirmar] = useConfirmacao();
  const [salvando, setSalvando] = React.useState(false);

  const { dados, carregando, erro } = useCarregar(async () => {
    const [medicos, logins, atual] = await Promise.all([
      listar('medicos'),
      loginsEmUso(),
      id ? carregarProfissional('medicos', 'MEDICO', id) : null,
    ]);
    return { medicos, logins, atual };
  }, [id]);

  React.useEffect(() => {
    if (dados?.atual) {
      const { cadastro } = dados.atual;
      carregar({ ...valoresDoProfissional(dados.atual), crm: cadastro.crm ?? '', ufCrm: cadastro.ufCrm ?? '', especialidade: cadastro.especialidade ?? '' });
    }
  }, [dados, carregar]);

  const tocarLogin = useLoginSugerido(form, !id, dados?.logins ?? []);
  const sair = useSairSemSalvar(form.sujo, confirmar, () => navigate(listagem));

  if (erro?.status === 404) return <RegistroIndisponivel />;

  const v = form.valores;
  const atual = dados?.atual;
  const especialidades = [...new Set((dados?.medicos ?? []).map((m) => m.especialidade).filter(Boolean))].sort();

  const salvar = async (e) => {
    e.preventDefault();
    const crmRepetido = (dados?.medicos ?? []).some((m) => m.id !== id && m.ufCrm === v.ufCrm && soDigitos(m.crm) === v.crm);
    const erros = {
      ...errosDoProfissional(v, { logins: dados?.logins ?? [], contaAtual: atual?.conta, comTratamento: true, novo: !id }),
      crm: !/^\d{4,7}$/.test(v.crm) ? 'Informe o CRM, só os números.' : crmRepetido ? 'Já existe um médico com este CRM nesta UF.' : null,
      ufCrm: v.ufCrm ? null : 'Escolha a UF do CRM.',
      especialidade: v.especialidade.trim().length >= 3 ? null : 'Informe a especialidade.',
    };
    if (!form.validar(erros)) return;
    setSalvando(true);
    try {
      await salvarProfissional({
        id,
        colecao: 'medicos',
        rotulo: 'um médico',
        papel: 'MEDICO',
        pessoa: dadosDaPessoa(v),
        cadastro: { crm: v.crm, ufCrm: v.ufCrm, especialidade: v.especialidade.trim() },
        login: v.login,
        original: atual,
      });
      mensagemSucesso(id ? 'Cadastro atualizado.' : `Médico cadastrado. O convite foi enviado para ${v.email.trim()}.`);
      navigate(listagem);
    } catch (falha) {
      mensagemErro(mensagemDeErro(falha));
      if (falha.idCriado) navigate(editar(falha.idCriado));
      setSalvando(false);
    }
  };

  const inativo = atual?.cadastro.situacao === 'INATIVO';
  return (
    <Pagina
      titulo={id ? `Médico · ${atual ? nomeMedico(atual.pessoa) : '…'}` : 'Novo médico'}
      tituloAba={id ? 'Cadastro do médico' : 'Novo médico'}
      acoes={
        leitura &&
        !inativo && (
          <button type='button' className='btn btn-primary' onClick={() => navigate(editar())}>
            Editar
          </button>
        )
      }
    >
      {carregando && !dados ? (
        <p className='text-body-secondary'>Carregando…</p>
      ) : (
        <Formulario
          aoEnviar={salvar}
          somenteLeitura={leitura}
          rotulo='Cadastro do médico'
          rodape={<Rodape aoCancelar={sair} salvando={salvando} semSalvar={leitura} rotuloCancelar={leitura ? 'Voltar' : 'Cancelar'} />}
        >
          {inativo && (
            <div className='alert alert-secondary mb-0' role='status'>
              Médico inativo: a conta está encerrada. Para editar, reative o cadastro na lista de médicos.
            </div>
          )}
          <SecaoDadosPessoais form={form} comTratamento />
          <Secao titulo='Registro profissional'>
            <CampoTexto {...form.campo('crm', mascararDigitos(7))} rotulo='CRM' inputMode='numeric' largura='col-md-3' />
            <CampoSelecao {...form.campo('ufCrm')} rotulo='UF do CRM' opcoes={UFS.map((uf) => [uf, uf])} largura='col-md-3' />
            <CampoTexto {...form.campo('especialidade')} rotulo='Especialidade' list='lista-especialidades' autoComplete='off' />
            <datalist id='lista-especialidades'>
              {especialidades.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
          </Secao>
          <SecaoConta form={form} conta={atual?.conta} novo={!id} aoTocarLogin={tocarLogin} />
        </Formulario>
      )}
      {modal}
    </Pagina>
  );
}

export default CadastroMedico;
