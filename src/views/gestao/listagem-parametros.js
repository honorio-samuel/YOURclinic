import React from 'react';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import { CampoSelect, Filtros } from '../../components/campos';
import { salvarComAviso, useConfirmacao } from '../../components/confirmacao';
import { mensagemErro } from '../../components/toastr';
import { listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';

const GRUPO = {
  AUTENTICACAO: 'Autenticação e sessão',
  ACESSO_CLINICO: 'Acesso clínico',
  NOTIFICACOES: 'Notificações',
  CONTINUIDADE: 'Continuidade',
  PREMISSAS: 'Premissas de projeto',
};

// A-34 · Parâmetros do sistema. Premissas aparecem só para leitura; o valor
// novo precisa estar dentro da faixa.
function Parametros() {
  const { dados, carregando, erro, recarregar } = useCarregar(() => listar('parametros', { _sort: 'chave' }));
  const [modal, confirmar] = useConfirmacao();
  const grupos = [...new Set((dados ?? []).map((p) => p.grupo).filter(Boolean))];
  const [escolhido, setGrupo] = React.useState(null);
  const grupo = escolhido ?? grupos[0] ?? '';

  const editar = async (p) => {
    const faixa = p.faixaMinima !== null && p.faixaMaxima !== null ? `Faixa aceita: ${p.faixaMinima} a ${p.faixaMaxima} ${p.unidade}.` : 'Faixa não definida no documento.';
    const texto = await confirmar({ titulo: p.descricao, texto: `Valor atual: ${p.valor} ${p.unidade}. ${faixa}`, campo: `Novo valor (${p.unidade})`, rotuloConfirmar: 'Salvar' });
    if (!texto) return;
    const valor = Number(texto.replace(',', '.'));
    if (Number.isNaN(valor) || (p.faixaMinima !== null && valor < p.faixaMinima) || (p.faixaMaxima !== null && valor > p.faixaMaxima)) {
      mensagemErro(`Valor fora da faixa. ${faixa}`);
      return;
    }
    if (await salvarComAviso('parametros', p.id, { valor }, 'Parâmetro salvo. A alteração fica no log.')) recarregar();
  };

  const linhas = (dados ?? []).filter((p) => !grupo || p.grupo === grupo);
  return (
    <Pagina titulo='Parâmetros do sistema'>
      <Filtros>
        <CampoSelect id='parGrupo' rotulo='Grupo' valor={grupo} aoMudar={setGrupo} opcoes={[...grupos.map((g) => [g, GRUPO[g] ?? g]), ['', 'Todos']]} />
      </Filtros>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={linhas}
        vazio='Nenhum parâmetro neste grupo.'
        colunas={[
          { titulo: 'Parâmetro', render: (p) => p.descricao },
          { titulo: 'Valor', render: (p) => `${p.valor} ${p.unidade}` },
          { titulo: 'Sugerido', render: (p) => `${p.valorSugerido ?? p.valor} ${p.unidade}` },
          {
            titulo: 'Faixa',
            render: (p) => (!p.editavel ? 'premissa' : p.faixaMinima !== null && p.faixaMaxima !== null ? `${p.faixaMinima} a ${p.faixaMaxima}` : 'não definida'),
          },
          {
            titulo: '',
            render: (p) =>
              p.editavel ? (
                <button type='button' className='btn btn-sm btn-outline-primary' onClick={() => editar(p)}>
                  Editar
                </button>
              ) : (
                '—'
              ),
          },
        ]}
      />
      {modal}
    </Pagina>
  );
}

export default Parametros;
