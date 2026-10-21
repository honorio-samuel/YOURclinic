import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { emBreve, salvarComAviso, useConfirmacao } from '../../components/confirmacao';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { data } from '../../utils/formatos';
import { ETAPA_ORCAMENTO, rotuloDe } from '../../utils/rotulos';
import { carregarOrcamentos, DetalheItens } from './orcamentos-comum';

// M-04 · Orçamentos · etapa 1 · escopo clínico. Nenhuma coluna de preço: o
// Médico não vê nem define valores. O Ver das etapas seguintes abre só o escopo.
function OrcamentosMedico() {
  const { sessao } = useSessao();
  const { dados, carregando, erro, recarregar } = useCarregar(() => carregarOrcamentos({ idMedico: sessao.usuario.idPessoa }));
  const [modal, confirmar] = useConfirmacao();
  const [aberto, setAberto] = React.useState(null);

  const enviar = async (o) => {
    const ok = await confirmar({ titulo: 'Enviar para valores?', texto: 'A Secretária aplica os preços. Depois disso, o escopo não pode mais ser editado.', rotuloConfirmar: 'Enviar para valores' });
    if (ok && (await salvarComAviso('orcamentos', o.id, { etapa: 'VALORES' }, 'Escopo enviado para a etapa de valores.'))) {
      setAberto(null);
      recarregar();
    }
  };

  return (
    <Pagina
      titulo='Orçamentos'
      acoes={
        <button type='button' className='btn btn-primary' onClick={() => emBreve('A criação de orçamento')}>
          + Novo orçamento
        </button>
      }
    >
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados ?? []}
        vazio='Você ainda não criou orçamentos.'
        colunas={[
          { titulo: 'Paciente', render: (o) => o.paciente },
          { titulo: 'Criado em', render: (o) => data(o.dataEmissao) },
          { titulo: 'Itens', classe: 'text-end', render: (o) => o.itens.length },
          { titulo: 'Situação', render: (o) => <PilulaStatus {...rotuloDe(ETAPA_ORCAMENTO, o.etapa)} /> },
          {
            titulo: 'Ações',
            render: (o) => {
              const alvo = `orçamento de ${o.paciente}`;
              const ver = { tipo: 'ver', alvo, aoClicar: () => setAberto(o) };
              return <AcoesLinha acoes={['ESCOPO', 'DEVOLVIDO'].includes(o.etapa) ? [ver, { tipo: 'editar', alvo, aoClicar: () => setAberto(o) }] : [ver]} />;
            },
          },
        ]}
      />
      {aberto && (
        <>
          {aberto.observacaoDevolucao && aberto.etapa === 'DEVOLVIDO' && (
            <div className='alert alert-warning mb-0' role='status'>
              Devolvido com a observação: {aberto.observacaoDevolucao}
            </div>
          )}
          <DetalheItens orcamento={aberto} comValores={false} aoFechar={() => setAberto(null)} />
          {['ESCOPO', 'DEVOLVIDO'].includes(aberto.etapa) && (
            <div className='d-flex justify-content-end'>
              <button type='button' className='btn btn-primary' onClick={() => enviar(aberto)}>
                Enviar para valores
              </button>
            </div>
          )}
        </>
      )}
      {modal}
    </Pagina>
  );
}

export default OrcamentosMedico;
