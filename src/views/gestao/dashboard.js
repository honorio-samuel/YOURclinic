import React from 'react';

import Pagina from '../../components/pagina';
import EstadoErro from '../../components/estado-erro';
import { BarraProporcao, CartaoIndicador, Numero } from '../../components/indicadores';
import { api, DATA_DE_HOJE } from '../../config/axios';
import { listar } from '../../servicos/dados';
import { data, moeda } from '../../utils/formatos';
import { MOTIVO_BLOQUEIO } from '../../utils/rotulos';
import { somarDias } from '../agenda/comum';

const porcento = (v) => (v === null || v === undefined ? '—' : `${String(v).replace('.', ',')}%`);
const TONS = ['primario', 'info', 'sucesso', 'aviso', 'perigo', 'neutro'];

// A-29 · Dashboard gerencial (RF41). Indicadores operacionais do período,
// calculados pela API sem nada clínico (RN-41.2), atualizados a cada X28
// segundos e com a data-base do cálculo (RN-41.3).
function Dashboard() {
  const [periodo, setPeriodo] = React.useState({ de: somarDias(DATA_DE_HOJE, -29), ate: DATA_DE_HOJE });
  const [estado, setEstado] = React.useState({ dados: null, erro: null, atualizadoEm: null });
  const [intervalo, setIntervalo] = React.useState(30);

  React.useEffect(() => {
    listar('parametros', { chave: 'X28' })
      .then((p) => setIntervalo(Number(p[0]?.valor) || 30))
      .catch(() => {});
  }, []);

  const carregar = React.useCallback(async () => {
    try {
      const { data: dados } = await api.get('/indicadores/gerencial', { params: periodo });
      setEstado({ dados, erro: null, atualizadoEm: new Date() });
    } catch (e) {
      setEstado((atual) => ({ ...atual, erro: { status: e.response?.status ?? null } }));
    }
  }, [periodo]);

  React.useEffect(() => {
    carregar();
    const relogio = setInterval(carregar, intervalo * 1000);
    return () => clearInterval(relogio);
  }, [carregar, intervalo]);

  const d = estado.dados;
  const mudar = (campo, valor) => valor && setPeriodo((atual) => ({ ...atual, [campo]: valor }));

  return (
    <Pagina titulo='Dashboard gerencial'>
      <div className='d-flex flex-wrap align-items-end gap-3'>
        <div className='filtro'>
          <label htmlFor='dashDe' className='form-label'>
            De
          </label>
          <input id='dashDe' type='date' className='form-control' value={periodo.de} max={periodo.ate} onChange={(e) => mudar('de', e.target.value)} />
        </div>
        <div className='filtro'>
          <label htmlFor='dashAte' className='form-label'>
            Até
          </label>
          <input id='dashAte' type='date' className='form-control' value={periodo.ate} min={periodo.de} onChange={(e) => mudar('ate', e.target.value)} />
        </div>
        <p className='small text-body-secondary mb-2' aria-live='polite'>
          {d ? `Data-base ${data(d.dataBase)} · atualizado às ${estado.atualizadoEm.toLocaleTimeString('pt-BR')} · atualiza a cada ${intervalo} s` : ''}
        </p>
      </div>
      {estado.erro && !d && <EstadoErro erro={estado.erro} aoTentarDeNovo={carregar} />}
      {!d && !estado.erro && <p className='text-body-secondary'>Carregando…</p>}
      {d && (
        <div className='row g-3'>
          <div className='col-lg-6'>
            <CartaoIndicador titulo='Desfecho das consultas'>
              <BarraProporcao
                rotulo='Consultas por desfecho'
                partes={[
                  { rotulo: 'Finalizadas', valor: d.desfecho.FINALIZADO, tom: 'sucesso' },
                  { rotulo: 'Canceladas', valor: d.desfecho.CANCELADO, tom: 'perigo' },
                  { rotulo: 'Não compareceu', valor: d.desfecho.NAO_COMPARECEU, tom: 'aviso' },
                ]}
              />
            </CartaoIndicador>
          </div>
          <div className='col-lg-6'>
            <CartaoIndicador titulo='Tipo de atendimento'>
              <BarraProporcao
                rotulo='Consultas por tipo de atendimento'
                partes={[
                  { rotulo: 'Particular', valor: d.tipoAtendimento.particular, tom: 'primario' },
                  ...d.tipoAtendimento.convenio.map((c, i) => ({ rotulo: c.operadora, valor: c.quantidade, tom: TONS[(i + 1) % TONS.length] })),
                ]}
              />
            </CartaoIndicador>
          </div>
          <div className='col-md-6 col-lg-3'>
            <CartaoIndicador titulo='Tempo médio de espera'>
              <Numero
                valor={d.tempoMedioEspera.minutos === null ? '—' : `${d.tempoMedioEspera.minutos} min`}
                rotulo={`Da chegada ao chamado · ${d.tempoMedioEspera.amostra} atendimentos`}
              />
            </CartaoIndicador>
          </div>
          <div className='col-md-6 col-lg-3'>
            <CartaoIndicador titulo='Conversão de orçamento' para='/admin/listagem-orcamentos' rotuloLink='Abrir Orçamentos'>
              <Numero valor={porcento(d.conversaoOrcamento.taxa)} rotulo={`${d.conversaoOrcamento.aceitos} aceitos de ${d.conversaoOrcamento.emitidos} emitidos`} />
            </CartaoIndicador>
          </div>
          <div className='col-lg-6'>
            <CartaoIndicador titulo='Ociosidade da agenda' para='/admin/agenda?visao=mes' rotuloLink='Abrir a agenda'>
              <BarraProporcao
                rotulo='Blocos da grade no período'
                partes={[
                  { rotulo: 'Ocupados', valor: d.ociosidade.ocupados, tom: 'primario' },
                  { rotulo: 'Livres', valor: d.ociosidade.livres, tom: 'neutro' },
                  ...d.ociosidade.bloqueados.map((b) => ({ rotulo: `Bloqueados · ${MOTIVO_BLOQUEIO[b.motivo] ?? b.motivo}`, valor: b.blocos, tom: 'aviso' })),
                ]}
              />
            </CartaoIndicador>
          </div>
          <div className='col-lg-6'>
            <CartaoIndicador titulo='Divergência de caixa' para='/admin/listagem-caixas' rotuloLink='Abrir Caixas'>
              {d.divergenciaCaixa.length === 0 ? (
                <p className='mb-0'>Nenhuma divergência.</p>
              ) : (
                <table className='table table-sm mb-0'>
                  <caption className='visually-hidden'>Divergências de caixa por operador</caption>
                  <thead>
                    <tr>
                      <th scope='col'>Operador</th>
                      <th scope='col' className='text-end'>
                        Ocorrências
                      </th>
                      <th scope='col' className='text-end'>
                        Valor
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.divergenciaCaixa.map((o) => (
                      <tr key={o.operador}>
                        <td>{o.operador}</td>
                        <td className='text-end'>{o.ocorrencias}</td>
                        <td className='text-end'>{moeda(o.valor)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CartaoIndicador>
          </div>
          <div className='col-lg-6'>
            <CartaoIndicador titulo='Índice de glosa' para='/admin/listagem-glosas' rotuloLink='Abrir Demonstrativos e glosas'>
              <Numero valor={porcento(d.indiceGlosa.indice)} rotulo={`${moeda(d.indiceGlosa.glosado)} glosados de ${moeda(d.indiceGlosa.apresentado)} apresentados`} />
              <table className='table table-sm mb-0'>
                <caption className='visually-hidden'>Índice de glosa por operadora</caption>
                <thead>
                  <tr>
                    <th scope='col'>Operadora</th>
                    <th scope='col' className='text-end'>
                      Glosado
                    </th>
                    <th scope='col' className='text-end'>
                      Índice
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {d.indiceGlosa.porOperadora.map((o) => (
                    <tr key={o.operadora}>
                      <td>{o.operadora}</td>
                      <td className='text-end'>{moeda(o.glosado)}</td>
                      <td className='text-end'>{porcento(o.indice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {d.indiceGlosa.porMotivo.length > 0 && (
                <details>
                  <summary className='small'>Por motivo</summary>
                  <ul className='small mb-0 mt-1'>
                    {d.indiceGlosa.porMotivo.map((m) => (
                      <li key={m.motivo}>
                        {m.motivo}: {moeda(m.valor)}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </CartaoIndicador>
          </div>
        </div>
      )}
    </Pagina>
  );
}

export default Dashboard;
