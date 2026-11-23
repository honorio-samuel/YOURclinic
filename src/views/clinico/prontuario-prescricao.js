import React from 'react';
import { useNavigate } from 'react-router-dom';

import Listagem from '../../components/listagem';
import Modal from '../../components/modal';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import EstadoErro from '../../components/estado-erro';
import { CampoSelecao, CampoTexto, CampoTextoLongo, useFormulario } from '../../components/formulario';
import { mensagemDeErro } from '../../components/confirmacao';
import { mensagemErro, mensagemSucesso } from '../../components/toastr';
import { atualizar, criar, listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { data } from '../../utils/formatos';
import { mascararDigitos } from '../../utils/mascaras';
import { AVISO_CONTROLE_ESPECIAL, CLASSIFICACAO } from './comum';

const ITEM_VAZIO = { medicamento: '', concentracao: '', posologia: '', quantidade: '', duracao: '', classificacao: '' };

async function carregarPrescricoes(idPaciente, idMedico) {
  const [prescricoes, emAtendimento] = await Promise.all([
    listar('prescricoes', { idPaciente, _sort: 'dataEmissao', _order: 'desc' }),
    listar('consultas', { idPaciente, idMedico, status: 'EM_ATENDIMENTO' }),
  ]);
  const consulta = emAtendimento[0] ?? null;
  const [itens, registros, daConsulta] = await Promise.all([
    prescricoes.length ? listar('itensPrescricao', { idPrescricao: prescricoes.map((p) => p.id) }) : [],
    prescricoes.length ? listar('registrosClinicos', { id: prescricoes.map((p) => p.idRegistroClinico) }) : [],
    consulta ? listar('registrosClinicos', { idConsulta: consulta.id }) : [],
  ]);
  const selado = Object.fromEntries(registros.map((r) => [r.id, r.selado]));
  const aberto = daConsulta.find((r) => !r.selado) ?? null;
  return {
    consulta,
    registroAberto: aberto,
    prescricoes: prescricoes.map((p) => ({
      ...p,
      // Prescrição de registro selado ou de outro médico não se edita.
      editavel: selado[p.idRegistroClinico] === false && aberto?.id === p.idRegistroClinico,
      itens: itens.filter((i) => i.idPrescricao === p.id),
    })),
  };
}

// Um item por vez; a prescrição nova nasce com o primeiro item.
function JanelaItem({ registroAberto, prescricao, item, aoFechar, aoConcluir }) {
  const form = useFormulario(item ? { ...ITEM_VAZIO, ...item, quantidade: String(item.quantidade ?? ''), duracao: item.duracao ?? '' } : ITEM_VAZIO, 'item-');
  const v = form.valores;
  const [salvando, setSalvando] = React.useState(false);

  const salvar = async () => {
    const ok = form.validar({
      medicamento: v.medicamento.trim().length >= 2 ? null : 'Informe o medicamento.',
      concentracao: v.concentracao.trim() ? null : 'Informe a concentração.',
      posologia: v.posologia.trim().length >= 3 ? null : 'Informe a posologia.',
      quantidade: Number(v.quantidade) > 0 ? null : 'Informe a quantidade.',
      duracao: v.duracao.trim() ? null : 'Informe a duração do tratamento.',
      classificacao: v.classificacao ? null : 'Escolha a classificação do item.',
    });
    if (!ok) return;
    setSalvando(true);
    const campos = {
      medicamento: v.medicamento.trim(),
      concentracao: v.concentracao.trim(),
      posologia: v.posologia.trim(),
      quantidade: Number(v.quantidade),
      duracao: v.duracao.trim(),
      classificacao: v.classificacao,
    };
    try {
      if (item) {
        await atualizar('itensPrescricao', item.id, campos);
      } else {
        const destino = prescricao ?? (await criar('prescricoes', { idRegistroClinico: registroAberto.id }));
        await criar('itensPrescricao', { ...campos, idPrescricao: destino.id });
      }
      mensagemSucesso(item ? 'Item atualizado.' : 'Item prescrito.');
      aoConcluir();
    } catch (e) {
      mensagemErro(mensagemDeErro(e));
      setSalvando(false);
    }
  };

  return (
    <Modal
      titulo={item ? 'Editar item da prescrição' : prescricao ? 'Adicionar item' : 'Nova prescrição'}
      aoFechar={aoFechar}
      largo
      rodape={
        <>
          <button type='button' className='btn btn-outline-secondary' onClick={aoFechar} disabled={salvando}>
            Voltar
          </button>
          <button type='button' className='btn btn-primary' onClick={salvar} disabled={salvando}>
            {salvando ? 'Salvando…' : 'Salvar item'}
          </button>
        </>
      }
    >
      <form
        noValidate
        aria-label='Item da prescrição'
        className='row g-3'
        onSubmit={(e) => {
          e.preventDefault();
          salvar();
        }}
      >
        <CampoTexto {...form.campo('medicamento')} rotulo='Medicamento' largura='col-md-8' autoComplete='off' />
        <CampoTexto {...form.campo('concentracao')} rotulo='Concentração' largura='col-md-4' autoComplete='off' />
        <CampoTextoLongo {...form.campo('posologia')} rotulo='Posologia' linhas={2} />
        <CampoTexto {...form.campo('quantidade', mascararDigitos(4))} rotulo='Quantidade' inputMode='numeric' largura='col-md-4' />
        <CampoTexto {...form.campo('duracao')} rotulo='Duração do tratamento' largura='col-md-4' ajuda='Por exemplo: 7 dias.' />
        <CampoSelecao
          {...form.campo('classificacao')}
          rotulo='Classificação'
          opcoes={Object.entries(CLASSIFICACAO)}
          largura='col-md-4'
          ajuda='Sem valor padrão: escolha sempre.'
        />
        {v.classificacao === 'CONTROLE_ESPECIAL' && (
          <div className='col-12'>
            <div className='alert alert-warning mb-0' role='alert'>
              {AVISO_CONTROLE_ESPECIAL}
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
}

// M-02d · Prescrição (RF25). Durante o atendimento, prescreve e edita; depois
// de selada, a correção é pela retificação na aba Anamnese.
function Prescricao({ idPaciente, idMedico }) {
  const navigate = useNavigate();
  const { dados, carregando, erro, recarregar } = useCarregar(() => carregarPrescricoes(idPaciente, idMedico), [idPaciente, idMedico]);
  const [janela, setJanela] = React.useState(null);

  if (erro) return <EstadoErro erro={erro} aoTentarDeNovo={recarregar} />;
  if (carregando && !dados) return <p className='text-body-secondary mb-0'>Carregando…</p>;

  const imprimir = (p) => navigate(`/medico/prontuario/${idPaciente}/prescricoes/${p.id}`);
  let dica = null;
  if (!dados.consulta) dica = 'A prescrição é feita durante o atendimento.';
  else if (!dados.registroAberto) dica = 'Comece o registro na aba Anamnese para prescrever.';

  return (
    <>
      <div className='d-flex flex-wrap justify-content-end align-items-center gap-2'>
        {dica && <span className='small text-body-secondary'>{dica}</span>}
        <button type='button' className='btn btn-primary' disabled={!dados.registroAberto} onClick={() => setJanela({})}>
          + Nova prescrição
        </button>
      </div>
      {dados.prescricoes.length === 0 && <p className='text-body-secondary mb-0'>Nenhuma prescrição para este paciente.</p>}
      {dados.prescricoes.map((p) => (
        <section key={p.id} className='d-flex flex-column gap-2' aria-label={`Prescrição de ${data(p.dataEmissao)}`}>
          <div className='d-flex flex-wrap justify-content-between align-items-center gap-2'>
            <h2 className='h6 mb-0'>
              Emitida em {data(p.dataEmissao)} · válida até {data(p.validade)}{' '}
              {p.tipoReceita === 'CONTROLE_ESPECIAL' && <PilulaStatus rotulo='Controle especial' tom='aviso' />}
            </h2>
            <div className='d-flex flex-wrap gap-2'>
              {p.editavel && (
                <button type='button' className='btn btn-sm btn-outline-primary' onClick={() => setJanela({ prescricao: p })}>
                  Adicionar item
                </button>
              )}
              <button type='button' className='btn btn-sm btn-outline-secondary' onClick={() => imprimir(p)}>
                Via de impressão
              </button>
            </div>
          </div>
          <Listagem
            linhas={p.itens}
            vazio='Prescrição sem itens.'
            colunas={[
              { titulo: 'Medicamento', render: (i) => `${i.medicamento} ${i.concentracao}` },
              { titulo: 'Posologia', render: (i) => i.posologia },
              { titulo: 'Quantidade', render: (i) => i.quantidade },
              { titulo: 'Duração', render: (i) => i.duracao ?? '—' },
              {
                titulo: 'Classificação',
                render: (i) =>
                  i.classificacao === 'CONTROLE_ESPECIAL' ? (
                    <PilulaStatus rotulo='Controle especial' tom='aviso' />
                  ) : (
                    CLASSIFICACAO[i.classificacao] ?? '—'
                  ),
              },
              {
                titulo: 'Ações',
                render: (i) =>
                  p.editavel ? (
                    <AcoesLinha acoes={[{ tipo: 'editar', alvo: i.medicamento, aoClicar: () => setJanela({ prescricao: p, item: i }) }]} />
                  ) : (
                    <span className='small text-body-secondary'>Selada</span>
                  ),
              },
            ]}
          />
        </section>
      ))}
      {janela && (
        <JanelaItem
          registroAberto={dados.registroAberto}
          prescricao={janela.prescricao}
          item={janela.item}
          aoFechar={() => setJanela(null)}
          aoConcluir={() => {
            setJanela(null);
            recarregar();
          }}
        />
      )}
    </>
  );
}

export default Prescricao;
