import React from 'react';
import { useParams } from 'react-router-dom';

import Pagina from '../../components/pagina';
import Listagem from '../../components/listagem';
import PilulaStatus from '../../components/pilula-status';
import { emBreve } from '../../components/confirmacao';
import { RegistroIndisponivel } from '../geral/avisos';
import { buscar, listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { data } from '../../utils/formatos';
import { rotuloDe } from '../../utils/rotulos';
import { ENVIADO_POR } from '../clinico/comum';

const SITUACAO_ANEXO_RECEPCAO = {
  DISPONIVEL: { rotulo: 'Disponível ao médico', tom: 'sucesso' },
  A_ACEITAR: { rotulo: 'Aguardando o médico', tom: 'aviso' },
  ACEITO: { rotulo: 'Aceito pelo médico', tom: 'sucesso' },
  RECUSADO: { rotulo: 'Recusado pelo médico', tom: 'neutro' },
};

// S-01d · Paciente · anexos, só metadados. Sem conteúdo, sem miniatura e sem Baixar.
function AnexosRecepcao() {
  const { id } = useParams();
  const idPaciente = Number(id);
  const { dados, carregando, erro, recarregar } = useCarregar(async () => {
    const [pessoa, anexos] = await Promise.all([buscar('pessoas', idPaciente), listar('anexos', { idPaciente, _sort: 'dataEnvio', _order: 'desc' })]);
    return { nome: pessoa.nome, anexos };
  }, [idPaciente]);

  if (erro?.status === 404) return <RegistroIndisponivel />;
  return (
    <Pagina
      titulo={`Paciente · ${dados?.nome ?? '…'}`}
      acoes={
        <button type='button' className='btn btn-primary' onClick={() => emBreve('O envio de arquivo')}>
          Enviar arquivo
        </button>
      }
    >
      <div className='alert alert-info mb-0' role='status'>
        O conteúdo dos anexos é do médico e do paciente. Aqui aparecem só os dados de envio.
      </div>
      <Listagem
        carregando={carregando}
        erro={erro}
        aoTentarDeNovo={recarregar}
        linhas={dados?.anexos ?? []}
        vazio='Nenhum anexo enviado para este paciente.'
        colunas={[
          { titulo: 'Arquivo', render: (a) => a.nomeArquivo },
          { titulo: 'Enviado em', render: (a) => data(a.dataEnvio) },
          { titulo: 'Enviado por', render: (a) => ENVIADO_POR[a.enviadoPor] ?? '—' },
          { titulo: 'Situação', render: (a) => <PilulaStatus {...rotuloDe(SITUACAO_ANEXO_RECEPCAO, a.situacao)} /> },
        ]}
      />
    </Pagina>
  );
}

export default AnexosRecepcao;
