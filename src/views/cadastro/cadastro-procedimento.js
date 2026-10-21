import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import Pagina from '../../components/pagina';
import { CampoMarcar, CampoSelecao, CampoTexto, Formulario, Rodape, Secao, useFormulario, useSairSemSalvar } from '../../components/formulario';
import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { RegistroIndisponivel } from '../geral/avisos';
import { criar, listar } from '../../servicos/dados';
import { atualizarSeMudou } from '../../servicos/pessoas';
import { useCarregar } from '../../hooks/use-carregar';
import { mascararDigitos, mascararMoeda, moedaParaNumero, numeroParaMoeda } from '../../utils/mascaras';
import { TIPO_PROCEDIMENTO } from './comum';

const VAZIO = { codigoInterno: '', codigo: '', nome: '', tipo: '', duracaoPadrao: '', precoParticular: '', exigeAutorizacao: false };

const paraFormulario = (p) => ({
  codigoInterno: p.codigoInterno ?? '',
  codigo: p.codigo ?? '',
  nome: p.nome ?? '',
  tipo: p.tipo ?? '',
  duracaoPadrao: p.duracaoPadrao ? String(p.duracaoPadrao) : '',
  precoParticular: numeroParaMoeda(p.precoParticular),
  exigeAutorizacao: Boolean(p.exigeAutorizacao),
});

// A-06 · Cadastro do procedimento e do preço particular (RF12). O preço
// negociado com cada operadora fica no contrato (A-20). O Médico nunca vê o
// preço (RC06).
function CadastroProcedimento({ modo }) {
  const { id: idTexto } = useParams();
  const id = idTexto ? Number(idTexto) : null;
  const navigate = useNavigate();
  const leitura = modo === 'ver';
  const form = useFormulario(VAZIO);
  const { carregar } = form;
  const [modal, confirmar] = useConfirmacao();
  const [salvando, setSalvando] = React.useState(false);

  const { dados, carregando } = useCarregar(() => listar('procedimentos'), []);
  const atual = id ? dados?.find((p) => p.id === id) : null;

  React.useEffect(() => {
    if (atual) carregar(paraFormulario(atual));
  }, [atual, carregar]);

  const sair = useSairSemSalvar(form.sujo, confirmar, () => navigate(id && !leitura ? `/admin/procedimentos/${id}` : '/admin/procedimentos'));

  if (id && dados && !atual) return <RegistroIndisponivel />;

  const v = form.valores;
  const salvar = async (e) => {
    e.preventDefault();
    const outros = (dados ?? []).filter((p) => p.id !== id);
    const duracao = Number(v.duracaoPadrao);
    const ok = form.validar({
      codigoInterno: v.codigoInterno && outros.some((p) => p.codigoInterno === v.codigoInterno.trim()) ? 'Já existe um procedimento com este código.' : null,
      codigo: !/^\d{8}$/.test(v.codigo)
        ? 'O código TUSS tem 8 dígitos.'
        : outros.some((p) => p.codigo === v.codigo)
        ? 'Já existe um procedimento com este código TUSS.'
        : null,
      nome: v.nome.trim().length >= 3 ? null : 'Informe a descrição.',
      tipo: v.tipo ? null : 'Escolha o tipo.',
      duracaoPadrao: Number.isInteger(duracao) && duracao >= 5 && duracao <= 480 ? null : 'Informe de 5 a 480 minutos.',
      precoParticular: v.precoParticular ? null : 'Informe o preço particular.',
    });
    if (!ok) return;
    setSalvando(true);
    const campos = {
      codigoInterno: v.codigoInterno.trim() || null,
      codigo: v.codigo,
      nome: v.nome.trim(),
      tipo: v.tipo,
      duracaoPadrao: duracao,
      precoParticular: moedaParaNumero(v.precoParticular),
      exigeAutorizacao: v.exigeAutorizacao,
    };
    try {
      let idSalvo = id;
      if (id) await atualizarSeMudou('procedimentos', id, campos, atual);
      else idSalvo = (await criar('procedimentos', { ...campos, situacao: 'ATIVO' })).id;
      mensagemSucesso(id ? 'Procedimento atualizado.' : 'Procedimento cadastrado.');
      navigate(`/admin/procedimentos/${idSalvo}`);
    } catch (falha) {
      mensagemErro(mensagemDeErro(falha));
      setSalvando(false);
    }
  };

  const inativo = atual?.situacao === 'INATIVO';
  return (
    <Pagina
      titulo={id ? `Procedimento · ${atual?.nome ?? '…'}` : 'Novo procedimento'}
      acoes={
        leitura &&
        !inativo && (
          <button type='button' className='btn btn-primary' onClick={() => navigate(`/admin/procedimentos/${id}/editar`)}>
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
          rotulo='Cadastro do procedimento'
          rodape={<Rodape aoCancelar={sair} salvando={salvando} semSalvar={leitura} rotuloCancelar={leitura ? 'Voltar' : 'Cancelar'} />}
        >
          {inativo && (
            <div className='alert alert-secondary mb-0' role='status'>
              Procedimento inativo: não aparece no agendamento nem nos orçamentos. Para editar, reative na lista.
            </div>
          )}
          <Secao titulo='Identificação'>
            <CampoTexto {...form.campo('codigoInterno')} rotulo='Código interno' opcional largura='col-md-3' placeholder='CON-01' />
            <CampoTexto
              {...form.campo('codigo', mascararDigitos(8))}
              rotulo='Código TUSS'
              inputMode='numeric'
              placeholder='00000000'
              largura='col-md-3'
            />
            <CampoSelecao {...form.campo('tipo')} rotulo='Tipo' opcoes={Object.entries(TIPO_PROCEDIMENTO)} />
            <CampoTexto {...form.campo('nome')} rotulo='Descrição' largura='col-12' />
          </Secao>
          <Secao titulo='Agenda e preço'>
            <CampoTexto
              {...form.campo('duracaoPadrao', mascararDigitos(3))}
              rotulo='Duração padrão (minutos)'
              inputMode='numeric'
              largura='col-md-3'
              ajuda='Ocupa a agenda do médico.'
            />
            <div className='col-md-3'>
              <label htmlFor='campo-precoParticular' className='form-label'>
                Preço particular
              </label>
              <div className='input-group has-validation'>
                <span className='input-group-text'>R$</span>
                <input
                  id='campo-precoParticular'
                  className={`form-control text-end${form.erros.precoParticular ? ' is-invalid' : ''}`}
                  inputMode='numeric'
                  value={v.precoParticular}
                  onChange={(e) => form.definir('precoParticular', mascararMoeda(e.target.value))}
                  aria-invalid={form.erros.precoParticular ? true : undefined}
                  aria-describedby={form.erros.precoParticular ? 'campo-precoParticular-erro' : undefined}
                  required
                />
                {form.erros.precoParticular && (
                  <div id='campo-precoParticular-erro' className='invalid-feedback'>
                    {form.erros.precoParticular}
                  </div>
                )}
              </div>
            </div>
            <CampoMarcar
              {...form.marcar('exigeAutorizacao')}
              rotulo='Exige autorização prévia da operadora'
              ajuda='No atendimento por convênio, a guia só é liberada com a autorização.'
            />
          </Secao>
        </Formulario>
      )}
      {modal}
    </Pagina>
  );
}

export default CadastroProcedimento;
