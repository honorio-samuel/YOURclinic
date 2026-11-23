import React from 'react';
import { useNavigate } from 'react-router-dom';

import Pagina from '../../components/pagina';
import PilulaStatus from '../../components/pilula-status';
import {
  CampoMoeda,
  CampoSelecao,
  CampoTexto,
  Formulario,
  Rodape,
  Secao,
  useFormulario,
  useSairSemSalvar,
} from '../../components/formulario';
import { mensagemDeErro, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { RegistroIndisponivel } from '../geral/avisos';
import { DATA_DE_HOJE } from '../../config/axios';
import { atualizar, buscar, criar, listar, pessoasPorId, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useCadastro } from '../../navegacao/caminhos';
import { corresponde, data, diaMes, moeda } from '../../utils/formatos';
import { mascararMoeda, moedaParaNumero, numeroParaMoeda } from '../../utils/mascaras';
import { MEIO_PAGAMENTO, rotuloDe, SITUACAO_PAGAMENTO, SITUACAO_TITULO } from '../../utils/rotulos';

const VOLTAR = '/admin/listagem-contas-receber';
const VAZIO = { busca: '', consulta: '', valor: '', vencimento: DATA_DE_HOJE };
// Pagamento que não aconteceu não impede a edição (RN-32.1).
const SEM_EFEITO = ['NEGADO', 'EXPIRADO', 'CANCELADO', 'NAO_REALIZADO', 'RECUSADO'];

const atendimento = (consulta, proc) =>
  `${proc?.tipo === 'CONSULTA' || !proc ? 'Consulta' : 'Procedimento'} · ${consulta.idConvenio != null ? 'convênio' : 'particular'}`;

// Consultas finalizadas que ainda não têm cobrança, com o valor sugerido:
// o preço gravado no agendamento ou a coparticipação apurada.
async function carregarOrigens() {
  const [consultas, cobrancas, procedimentos, coparticipacoes] = await Promise.all([
    listar('consultas', { status: 'FINALIZADO', _sort: 'dataHora', _order: 'desc' }),
    listar('cobrancas'),
    listar('procedimentos'),
    listar('coparticipacoes'),
  ]);
  const comCobranca = new Set(cobrancas.map((c) => c.idConsulta).filter(Boolean));
  const livres = consultas.filter((c) => !comCobranca.has(c.id));
  const pessoas = await pessoasPorId(livres.map((c) => c.idPaciente));
  const proc = porId(procedimentos);
  const copart = new Map(coparticipacoes.map((c) => [c.idConsulta, c]));
  return livres.map((c) => ({
    id: c.id,
    paciente: pessoas[c.idPaciente]?.nome ?? '—',
    rotulo: `${pessoas[c.idPaciente]?.nome ?? '—'} · ${diaMes(c.dataHora)} · ${atendimento(c, proc[c.idProcedimento])}`,
    sugerido:
      c.idConvenio != null ? copart.get(c.id)?.valorApurado ?? null : c.valorReferencia ?? proc[c.idProcedimento]?.precoParticular ?? null,
  }));
}

async function carregarCobranca(id) {
  const cobranca = await buscar('cobrancas', id);
  const [titulos, pagamentos, consulta, procedimentos] = await Promise.all([
    listar('titulosReceber', { idCobranca: id }),
    listar('pagamentos', { idCobranca: id, _sort: 'dataHora' }),
    cobranca.idConsulta ? buscar('consultas', cobranca.idConsulta) : null,
    listar('procedimentos'),
  ]);
  const pessoas = await pessoasPorId([consulta?.idPaciente]);
  const origem = consulta
    ? `Consulta de ${diaMes(consulta.dataHora)} · ${atendimento(consulta, porId(procedimentos)[consulta.idProcedimento])}`
    : `Orçamento nº ${cobranca.idOrcamento}`;
  return {
    cobranca,
    titulo: titulos[0] ?? null,
    pagamentos,
    paciente: consulta ? pessoas[consulta.idPaciente]?.nome ?? '—' : '—',
    origem,
    editavel: cobranca.situacao === 'ABERTA' && !pagamentos.some((p) => !SEM_EFEITO.includes(p.situacao)),
  };
}

// A-13b · Contas a receber › cobrança (RF43). O Administrador cria a cobrança
// de uma consulta finalizada que ficou sem ela e edita valor e vencimento até
// o primeiro pagamento; depois, a correção é por estorno. O título nasce
// junto. Quem recebe é a recepção, no checkout.
function CadastroCobranca() {
  const { id, consulta: soLeitura, editar } = useCadastro('cobrancas');
  const navigate = useNavigate();
  const form = useFormulario(VAZIO);
  const { carregar, definir } = form;
  const v = form.valores;
  const [modal, confirmar] = useConfirmacao();
  const [salvando, setSalvando] = React.useState(false);
  const { dados, carregando, erro } = useCarregar(() => (id ? carregarCobranca(id) : carregarOrigens()), [id]);
  const sair = useSairSemSalvar(form.sujo, confirmar, () => navigate(VOLTAR));

  React.useEffect(() => {
    if (id && dados?.cobranca) {
      carregar({
        ...VAZIO,
        valor: numeroParaMoeda(dados.cobranca.valorTotal),
        vencimento: dados.cobranca.vencimento ?? dados.titulo?.vencimento ?? DATA_DE_HOJE,
      });
    }
  }, [id, dados, carregar]);

  if (erro?.status === 404) return <RegistroIndisponivel />;

  const leitura = soLeitura || (Boolean(id) && dados && !dados.editavel);
  const origens = id ? [] : (dados ?? []).filter((o) => String(o.id) === v.consulta || corresponde(v.busca, o.paciente));

  const salvar = async (e) => {
    e.preventDefault();
    const valor = moedaParaNumero(v.valor);
    const ok = form.validar({
      consulta: id || v.consulta ? null : 'Escolha a consulta de origem.',
      valor: valor ? null : 'Informe o valor.',
      vencimento: /^\d{4}-\d{2}-\d{2}$/.test(v.vencimento) ? null : 'Informe o vencimento.',
    });
    if (!ok) return;
    setSalvando(true);
    try {
      if (id) {
        await atualizar('cobrancas', id, { valorTotal: valor, vencimento: v.vencimento });
        mensagemSucesso('Cobrança atualizada.');
      } else {
        await criar('cobrancas', { idConsulta: Number(v.consulta), idOrcamento: null, valorTotal: valor, vencimento: v.vencimento });
        mensagemSucesso('Cobrança criada. A recepção recebe pelo checkout.');
      }
      navigate(VOLTAR);
    } catch (falha) {
      mensagemErro(mensagemDeErro(falha));
      setSalvando(false);
    }
  };

  return (
    <Pagina
      titulo={id ? 'Cobrança' : 'Nova cobrança'}
      acoes={
        soLeitura &&
        dados?.editavel && (
          <button type='button' className='btn btn-primary' onClick={() => navigate(editar())}>
            Editar
          </button>
        )
      }
    >
      {carregando && !dados ? (
        <p className='text-body-secondary'>Carregando…</p>
      ) : erro ? (
        <div className='alert alert-danger' role='alert'>
          Não foi possível carregar a cobrança agora.
        </div>
      ) : (
        <Formulario
          aoEnviar={salvar}
          somenteLeitura={leitura}
          rotulo={id ? 'Cobrança' : 'Nova cobrança'}
          rodape={<Rodape aoCancelar={sair} salvando={salvando} semSalvar={leitura} rotuloCancelar={leitura ? 'Voltar' : 'Cancelar'} />}
        >
          {id && !dados.editavel && (
            <div className='alert alert-secondary mb-0' role='status'>
              {dados.cobranca.situacao === 'PAGA'
                ? 'Cobrança paga: não se edita. A correção é por estorno.'
                : 'Esta cobrança já tem pagamento: não se edita. A correção é por estorno.'}
            </div>
          )}
          <Secao titulo='Origem'>
            {id ? (
              <>
                <div className='col-md-6'>
                  <span className='form-label d-block'>Paciente</span>
                  <span className='form-control campo-leitura'>{dados.paciente}</span>
                </div>
                <div className='col-md-6'>
                  <span className='form-label d-block'>Origem</span>
                  <span className='form-control campo-leitura'>{dados.origem}</span>
                </div>
                <div className='col-md-6'>
                  <span className='form-label d-block'>Emissão</span>
                  <span className='form-control campo-leitura'>{data(dados.cobranca.dataEmissao)}</span>
                </div>
                <div className='col-md-6'>
                  <span className='form-label d-block'>Situação do título</span>
                  <PilulaStatus {...rotuloDe(SITUACAO_TITULO, dados.titulo?.situacao ?? dados.cobranca.situacao)} />
                </div>
              </>
            ) : (
              <>
                <CampoTexto
                  {...form.campo('busca')}
                  rotulo='Buscar paciente'
                  tipo='search'
                  opcional
                  ajuda='Só aparecem consultas finalizadas que ainda não têm cobrança.'
                />
                <CampoSelecao
                  {...form.campo('consulta')}
                  aoMudar={(valor) => {
                    definir('consulta', valor);
                    const escolhida = dados.find((o) => String(o.id) === valor);
                    if (escolhida?.sugerido) definir('valor', numeroParaMoeda(escolhida.sugerido));
                  }}
                  rotulo='Consulta'
                  opcoes={origens.map((o) => [String(o.id), o.rotulo])}
                />
              </>
            )}
          </Secao>
          <Secao titulo='Valor e vencimento'>
            <CampoMoeda
              {...form.campo('valor', mascararMoeda)}
              rotulo='Valor a cobrar do paciente'
              largura='col-md-6'
              ajuda={id ? null : 'Vem do preço do agendamento ou da coparticipação apurada; confira antes de salvar.'}
            />
            <CampoTexto {...form.campo('vencimento')} tipo='date' rotulo='Vencimento' largura='col-md-6' />
          </Secao>
          {id && dados.pagamentos.length > 0 && (
            <Secao titulo='Pagamentos'>
              <ul className='col-12 list-unstyled mb-0 d-flex flex-column gap-2'>
                {dados.pagamentos.map((p) => (
                  <li key={p.id} className='d-flex flex-wrap justify-content-between align-items-center gap-2'>
                    <span>
                      {MEIO_PAGAMENTO[p.meio] ?? p.meio} · {moeda(p.valor)} · {data(p.dataHora)}
                    </span>
                    <PilulaStatus {...rotuloDe(SITUACAO_PAGAMENTO, p.situacao)} />
                  </li>
                ))}
              </ul>
            </Secao>
          )}
        </Formulario>
      )}
      {modal}
    </Pagina>
  );
}

export default CadastroCobranca;
