import React from 'react';

import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { emBreve } from '../../components/confirmacao';
import { listar, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { data } from '../../utils/formatos';

// M-02d · Prescrição. Item de controle especial aparece destacado.
function Prescricao({ idPaciente }) {
  const { dados, carregando, erro, recarregar } = useCarregar(async () => {
    const prescricoes = await listar('prescricoes', { idPaciente });
    if (prescricoes.length === 0) return [];
    const itens = await listar('itensPrescricao', { idPrescricao: prescricoes.map((p) => p.id) });
    const prescricao = porId(prescricoes);
    return itens.map((i) => ({ ...i, emissao: prescricao[i.idPrescricao]?.dataEmissao }));
  }, [idPaciente]);

  return (
    <>
      <div className='d-flex justify-content-end'>
        <button type='button' className='btn btn-primary' onClick={() => emBreve('A nova prescrição')}>
          + Nova prescrição
        </button>
      </div>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados ?? []}
        vazio='Nenhuma prescrição para este paciente.'
        colunas={[
          { titulo: 'Medicamento', render: (i) => `${i.medicamento} ${i.concentracao}` },
          { titulo: 'Posologia', render: (i) => i.posologia },
          { titulo: 'Emitida em', render: (i) => data(i.emissao) },
          {
            titulo: 'Classificação',
            render: (i) => (i.classificacao === 'CONTROLE_ESPECIAL' ? <PilulaStatus rotulo='Controle especial' tom='aviso' /> : 'Comum'),
          },
          {
            titulo: 'Ações',
            render: (i) => (
              <AcoesLinha
                acoes={[
                  { tipo: 'ver', alvo: i.medicamento, aoClicar: () => emBreve('A via de impressão') },
                  { tipo: 'editar', alvo: i.medicamento, aoClicar: () => emBreve('A edição da prescrição') },
                ]}
              />
            ),
          },
        ]}
      />
    </>
  );
}

export default Prescricao;
