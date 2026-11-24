import React from 'react';

import Pagina from '../../components/pagina';
import EstadoErro from '../../components/estado-erro';
import { BarraProporcao, CartaoIndicador, Numero } from '../../components/indicadores';
import { api } from '../../config/axios';
import { useCarregar } from '../../hooks/use-carregar';
import { data, diaMes, moeda } from '../../utils/formatos';

const quantos = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;

// A-12 · Painel financeiro (RF35). Calculado pela API, só para o
// Administrador. Cada bloco leva à tela de origem dos números (RN-35.2), e o
// saldo separa o realizado (caixa) do projetado (RN-35.3).
function PainelFinanceiro() {
  const { dados, carregando, erro, recarregar } = useCarregar(async () => (await api.get('/indicadores/financeiro')).data);

  if (erro) {
    return (
      <Pagina titulo='Painel financeiro'>
        <EstadoErro erro={erro} aoTentarDeNovo={recarregar} />
      </Pagina>
    );
  }
  if (carregando && !dados) {
    return (
      <Pagina titulo='Painel financeiro'>
        <p className='text-body-secondary'>Carregando…</p>
      </Pagina>
    );
  }

  const { receberPaciente: rp, receberOperadora: ro, cartaoEmTransito: ct, pagar, saldo } = dados;
  return (
    <Pagina titulo='Painel financeiro'>
      <p className='mb-0 text-body-secondary'>Data-base: {data(dados.dataBase)}. Valores do banco de demonstração.</p>
      <div className='row g-3'>
        <div className='col-md-6'>
          <CartaoIndicador titulo='Saldo realizado (caixa)'>
            <Numero valor={moeda(saldo.realizado)} rotulo='Recebido menos pago até a data-base' />
          </CartaoIndicador>
        </div>
        <div className='col-md-6'>
          <CartaoIndicador titulo='Saldo projetado'>
            <Numero valor={moeda(saldo.projetado)} rotulo='Realizado, mais o que está para receber, menos o que está para pagar' />
          </CartaoIndicador>
        </div>
        <div className='col-lg-6'>
          <CartaoIndicador titulo='A receber de pacientes' para='/admin/listagem-contas-receber' rotuloLink='Abrir Contas a receber'>
            <BarraProporcao
              rotulo='Títulos de pacientes por situação'
              partes={[
                { rotulo: `A vencer (${quantos(rp.aVencer.quantidade, 'título', 'títulos')})`, valor: rp.aVencer.valor, texto: moeda(rp.aVencer.valor), tom: 'info' },
                { rotulo: `Vencido (${quantos(rp.vencido.quantidade, 'título', 'títulos')})`, valor: rp.vencido.valor, texto: moeda(rp.vencido.valor), tom: 'perigo' },
                { rotulo: `Pago (${quantos(rp.pago.quantidade, 'título', 'títulos')})`, valor: rp.pago.valor, texto: moeda(rp.pago.valor), tom: 'sucesso' },
              ]}
            />
          </CartaoIndicador>
        </div>
        <div className='col-lg-6'>
          <CartaoIndicador titulo='A receber de operadoras' para='/admin/listagem-guias' rotuloLink='Abrir Guias TISS'>
            <BarraProporcao
              rotulo='Guias por situação'
              partes={[
                { rotulo: `A apresentar (${quantos(ro.aApresentar.quantidade, 'guia', 'guias')})`, valor: ro.aApresentar.valor, texto: moeda(ro.aApresentar.valor), tom: 'neutro' },
                { rotulo: `Apresentado (${quantos(ro.apresentado.quantidade, 'guia', 'guias')})`, valor: ro.apresentado.valor, texto: moeda(ro.apresentado.valor), tom: 'info' },
                { rotulo: `Glosado (${quantos(ro.glosado.quantidade, 'guia', 'guias')})`, valor: ro.glosado.valor, texto: moeda(ro.glosado.valor), tom: 'perigo' },
                { rotulo: `Em recurso (${quantos(ro.emRecurso.quantidade, 'guia', 'guias')})`, valor: ro.emRecurso.valor, texto: moeda(ro.emRecurso.valor), tom: 'aviso' },
                { rotulo: `Pago (${quantos(ro.pago.quantidade, 'guia', 'guias')})`, valor: ro.pago.valor, texto: moeda(ro.pago.valor), tom: 'sucesso' },
              ]}
            />
          </CartaoIndicador>
        </div>
        <div className='col-lg-6'>
          <CartaoIndicador titulo='Cartão em trânsito' para='/admin/listagem-conciliacao' rotuloLink='Abrir Conciliação'>
            <div className='d-flex flex-wrap gap-4'>
              <Numero valor={moeda(ct.bruto)} rotulo={`Bruto · ${quantos(ct.quantidade, 'transação', 'transações')}`} />
              <Numero valor={moeda(ct.taxa)} rotulo='Taxa do adquirente' />
              <Numero valor={moeda(ct.liquido)} rotulo='Líquido previsto' />
            </div>
            {ct.porData.length > 0 && (
              <div className='table-responsive'>
                <table className='table table-sm mb-0'>
                  <caption className='visually-hidden'>Recebíveis de cartão por data prevista</caption>
                  <thead>
                    <tr>
                      <th scope='col'>Previsto para</th>
                      <th scope='col' className='text-end'>
                        Bruto
                      </th>
                      <th scope='col' className='text-end'>
                        Líquido
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {ct.porData.map((d) => (
                      <tr key={d.data}>
                        <td>{diaMes(d.data)}</td>
                        <td className='text-end'>{moeda(d.bruto)}</td>
                        <td className='text-end'>{moeda(d.liquido)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CartaoIndicador>
        </div>
        <div className='col-lg-6'>
          <CartaoIndicador titulo='Contas a pagar' para='/admin/listagem-contas-pagar' rotuloLink='Abrir Contas a pagar'>
            <BarraProporcao
              rotulo='Contas a pagar por situação'
              partes={[
                { rotulo: `A vencer (${quantos(pagar.aVencer.quantidade, 'conta', 'contas')})`, valor: pagar.aVencer.valor, texto: moeda(pagar.aVencer.valor), tom: 'info' },
                { rotulo: `Vencida (${quantos(pagar.vencido.quantidade, 'conta', 'contas')})`, valor: pagar.vencido.valor, texto: moeda(pagar.vencido.valor), tom: 'perigo' },
                { rotulo: `Paga (${quantos(pagar.pago.quantidade, 'conta', 'contas')})`, valor: pagar.pago.valor, texto: moeda(pagar.pago.valor), tom: 'sucesso' },
              ]}
            />
          </CartaoIndicador>
        </div>
      </div>
    </Pagina>
  );
}

export default PainelFinanceiro;
