import React from 'react';
import { Link, useParams } from 'react-router-dom';

import Pagina from '../../components/pagina';
import EstadoErro from '../../components/estado-erro';
import { RegistroIndisponivel } from '../geral/avisos';
import { api } from '../../config/axios';
import { buscar, listar } from '../../servicos/dados';
import { useCarregar } from '../../hooks/use-carregar';
import { useSessao } from '../../sessao/sessao';
import { data, diaMesHora, nomeMedico } from '../../utils/formatos';
import { AVISO_CONTROLE_ESPECIAL, CAMPOS_CLINICOS, CLASSIFICACAO } from './comum';

const CLINICA = 'Clínica YOURClinic · Rua das Acácias, nº 120, Bairro Centro · (11) 4002-8922';

function BarraDeImpressao({ voltar }) {
  return (
    <div className='d-flex flex-wrap gap-2 no-print'>
      <button type='button' className='btn btn-primary' onClick={() => window.print()}>
        Imprimir ou salvar em PDF
      </button>
      <Link to={voltar} className='btn btn-outline-secondary'>
        Voltar ao prontuário
      </Link>
    </div>
  );
}

// M-02d · Via de impressão da prescrição (RN-25.1): médico com registro
// profissional, data, itens e, se houver controle especial, a advertência.
export function ViaDaPrescricao() {
  const { id, idPrescricao } = useParams();
  const { sessao } = useSessao();
  const { dados, carregando, erro } = useCarregar(async () => {
    const prescricao = await buscar('prescricoes', idPrescricao);
    const autor = prescricao.idMedico ?? sessao.usuario.idPessoa;
    const [itens, paciente, medico, pessoaMedico] = await Promise.all([
      listar('itensPrescricao', { idPrescricao }),
      buscar('pessoas', prescricao.idPaciente),
      buscar('medicos', autor).catch(() => null),
      buscar('pessoas', autor).catch(() => null),
    ]);
    return { prescricao, itens, paciente, medico, pessoaMedico };
  }, [idPrescricao]);
  const voltar = `/medico/prontuario/${id}/prescricao`;

  if (erro?.status === 404) return <RegistroIndisponivel />;
  if (erro) return <EstadoErro erro={erro} />;
  if (carregando && !dados) return <p className='text-body-secondary'>Carregando…</p>;

  const { prescricao, itens, paciente, medico, pessoaMedico } = dados;
  const controle = prescricao.tipoReceita === 'CONTROLE_ESPECIAL' || itens.some((i) => i.classificacao === 'CONTROLE_ESPECIAL');
  return (
    <Pagina titulo='Via da prescrição' tituloAba='Prescrição'>
      <BarraDeImpressao voltar={voltar} />
      <article className='card card-body documento-impresso'>
        <p className='small text-body-secondary mb-1'>{CLINICA}</p>
        <h2 className='h4'>{controle ? 'Receita de controle especial' : 'Receita'}</h2>
        <p>
          <strong>Paciente:</strong> {paciente.nome}
        </p>
        <ol className='d-flex flex-column gap-2'>
          {itens.map((i) => (
            <li key={i.id}>
              <strong>
                {i.medicamento} {i.concentracao}
              </strong>{' '}
              · {i.quantidade} {i.quantidade === 1 ? 'unidade' : 'unidades'}
              {i.duracao ? ` · ${i.duracao}` : ''}
              <span className='d-block'>{i.posologia}</span>
              {i.classificacao !== 'COMUM' && <span className='d-block small'>{CLASSIFICACAO[i.classificacao]}</span>}
            </li>
          ))}
        </ol>
        {controle && (
          <div className='alert alert-warning' role='note'>
            {AVISO_CONTROLE_ESPECIAL}
          </div>
        )}
        <div className='mt-4 pt-3 border-top'>
          <p className='mb-0'>{nomeMedico(pessoaMedico)}</p>
          <p className='mb-0 small'>
            {medico?.crm ? `CRM ${medico.crm}/${medico.ufCrm}` : 'Registro profissional não disponível'}
            {medico?.especialidade ? ` · ${medico.especialidade}` : ''}
          </p>
          <p className='mb-0 small'>
            Emitida em {data(prescricao.dataEmissao)} · válida até {data(prescricao.validade)}
          </p>
        </div>
      </article>
    </Pagina>
  );
}

const MENSAGEM = {
  403: 'Este documento é de quem o pediu.',
  409: 'O documento ainda está sendo gerado. Tente de novo em instantes.',
  410: 'O link expirou. Peça a exportação de novo.',
};

// M-02g · Documento exportado (RF29, RF30), montado pelo servidor: o
// histórico sem conteúdo clínico e o prontuário sem anotações privadas.
export function DocumentoExportado() {
  const { id, idExportacao } = useParams();
  const { dados, carregando, erro } = useCarregar(async () => (await api.get(`/exportacoes/${idExportacao}/documento`)).data, [idExportacao]);
  const voltar = `/medico/prontuario/${id}/exportacoes`;

  if (erro?.status === 404) return <RegistroIndisponivel />;
  if (erro) {
    return (
      <Pagina titulo='Documento exportado'>
        <div className='alert alert-warning mb-0' role='alert'>
          {MENSAGEM[erro.status] ?? 'Não foi possível abrir o documento agora.'}
        </div>
        <div>
          <Link to={voltar} className='btn btn-outline-secondary'>
            Voltar ao prontuário
          </Link>
        </div>
      </Pagina>
    );
  }
  if (carregando && !dados) return <p className='text-body-secondary'>Carregando…</p>;

  const historico = dados.tipo === 'HISTORICO';
  return (
    <Pagina titulo={historico ? 'Histórico de atendimentos' : 'Prontuário completo'} tituloAba='Documento exportado'>
      <BarraDeImpressao voltar={voltar} />
      <article className='card card-body documento-impresso'>
        <p className='small text-body-secondary mb-1'>{CLINICA}</p>
        <h2 className='h4'>{historico ? 'Histórico de atendimentos' : 'Prontuário completo'}</h2>
        <p>
          <strong>Paciente:</strong> {dados.paciente.nome}
          {dados.paciente.dataNascimento ? ` · nascimento em ${data(dados.paciente.dataNascimento)}` : ''}
        </p>
        {historico ? (
          <div className='table-responsive'>
            <table className='table table-sm'>
              <thead>
                <tr>
                  <th scope='col'>Data</th>
                  <th scope='col'>Atendimento</th>
                  <th scope='col'>Médico</th>
                  <th scope='col'>Especialidade</th>
                  <th scope='col'>Situação</th>
                </tr>
              </thead>
              <tbody>
                {dados.atendimentos.map((a) => (
                  <tr key={a.dataHora + a.medico}>
                    <td>{diaMesHora(a.dataHora)}</td>
                    <td>{a.tipo}</td>
                    <td>{a.medico}</td>
                    <td>{a.especialidade ?? '—'}</td>
                    <td>{a.situacao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : dados.registros.length === 0 ? (
          <p>Nenhum registro selado neste prontuário.</p>
        ) : (
          dados.registros.map((r) => (
            <section key={r.dataHora} className='mb-3 pb-3 border-bottom'>
              <h3 className='h6'>
                {diaMesHora(r.dataHora)} · {r.medico.nome}
                {r.medico.crm ? ` · CRM ${r.medico.crm}` : ''}
                {r.sobExcecao ? ' · feito sob acesso de exceção' : ''}
              </h3>
              <dl className='row mb-0'>
                {CAMPOS_CLINICOS.map(([campo, rotulo]) => (
                  <React.Fragment key={campo}>
                    <dt className='col-sm-3'>{rotulo}</dt>
                    <dd className='col-sm-9'>{r[campo] || '—'}</dd>
                  </React.Fragment>
                ))}
              </dl>
              {r.prescricoes.map((p) => (
                <div key={p.dataEmissao + p.itens.length} className='mt-2'>
                  <p className='mb-1 fw-semibold'>Prescrição de {data(p.dataEmissao)}</p>
                  <ul className='mb-0'>
                    {p.itens.map((i) => (
                      <li key={i.medicamento + i.posologia}>
                        {i.medicamento} {i.concentracao} · {i.posologia}
                        {i.duracao ? ` · ${i.duracao}` : ''}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {r.correcaoDaPrescricao && <p className='mt-2 mb-0'>Correção da prescrição: {r.correcaoDaPrescricao}</p>}
              {r.retificacoes.length > 0 && (
                <p className='small text-body-secondary mt-2 mb-0'>
                  Retificado: {r.retificacoes.map((x) => `${diaMesHora(x.dataHora)} por ${x.autor} (${x.motivo})`).join('; ')}.
                </p>
              )}
            </section>
          ))
        )}
        <footer className='mt-3 pt-3 border-top small'>
          Pedido por {dados.solicitante} · emitido em {diaMesHora(dados.emitidoEm)} · verificação {dados.verificacao}
        </footer>
      </article>
    </Pagina>
  );
}
