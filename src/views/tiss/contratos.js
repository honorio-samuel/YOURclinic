import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import AcoesLinha from '../../components/acoes-linha';
import { emBreve } from '../../components/confirmacao';
import { listar, porId } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { mesAno } from '../../utils/formatos';
import { nomeOperadora } from './comum';

// A-20 · Contratos e tabelas.
function Contratos() {
  const carregar = async () => {
    const [contratos, convenios] = await Promise.all([listar('contratosOperadora', { _sort: 'vigenciaInicio', _order: 'desc' }), listar('convenios')]);
    const convenio = porId(convenios);
    return contratos.map((c) => ({ ...c, operadora: nomeOperadora(convenio[c.idConvenio]) }));
  };
  const { dados, carregando, erro, recarregar } = useCarregar(carregar);
  return (
    <Pagina
      titulo='Contratos e tabelas'
      acoes={
        <button type='button' className='btn btn-primary' onClick={() => emBreve('O cadastro de contrato')}>
          + Novo contrato
        </button>
      }
    >
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados ?? []}
        vazio='Nenhum contrato cadastrado.'
        legenda='Prazos na ordem: apresentação do lote, pagamento após o protocolo e recurso de glosa.'
        colunas={[
          { titulo: 'Operadora', render: (c) => c.operadora },
          { titulo: 'Nº do contrato', render: (c) => c.numero },
          { titulo: 'Vigência', render: (c) => `${mesAno(c.vigenciaInicio)} a ${mesAno(c.vigenciaFim)}` },
          { titulo: 'Versão TISS', render: (c) => c.versaoTiss },
          { titulo: 'Prazos', render: (c) => `${c.prazoApresentacao} · ${c.prazoPagamento} · ${c.prazoRecurso} dias` },
          {
            titulo: 'Status',
            render: (c) => {
              const vigente = ['ATIVO', 'VIGENTE'].includes(c.situacao);
              return <PilulaStatus rotulo={vigente ? 'Vigente' : 'Encerrado'} tom={vigente ? 'sucesso' : 'neutro'} />;
            },
          },
          {
            titulo: 'Ações',
            render: (c) => (
              <AcoesLinha
                acoes={[
                  { tipo: 'ver', alvo: `contrato ${c.numero}`, aoClicar: () => emBreve('A tabela de preços do contrato') },
                  { tipo: 'editar', alvo: `contrato ${c.numero}`, aoClicar: () => emBreve('A edição do contrato') },
                ]}
              />
            ),
          },
        ]}
      />
    </Pagina>
  );
}

export default Contratos;
