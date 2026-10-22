import {
  corresponde,
  data,
  diaMesHora,
  diasEntre,
  hora,
  mesAno,
  moeda,
  nomeMedico,
  quantidadeComSinal,
} from './formatos';
import { STATUS_CONSULTA, rotuloDe } from './rotulos';

test('datas da API viram texto sem conversão de fuso', () => {
  expect(data('2026-09-28T23:30:00')).toBe('28/09/2026');
  expect(hora('2026-09-28T08:05:00')).toBe('08h05');
  expect(diaMesHora('2026-10-01T14:00:00')).toBe('01/10 · 14h00');
  expect(mesAno('2026-09-14')).toBe('09/2026');
  expect(data(null)).toBe('—');
});

test('valores em reais e quantidades com sinal', () => {
  expect(moeda(1234.5).replace(/\s/g, ' ')).toBe('R$ 1.234,50');
  expect(moeda(null)).toBe('—');
  expect(quantidadeComSinal(3)).toBe('+3');
  expect(quantidadeComSinal(-2)).toBe('−2');
});

test('título do médico depende do cadastro e some quando a API não manda o sexo', () => {
  expect(nomeMedico({ nome: 'Ana Souza', sexo: 'F' })).toBe('Dra. Ana Souza');
  expect(nomeMedico({ nome: 'Rui Lima', sexo: 'M' })).toBe('Dr. Rui Lima');
  expect(nomeMedico({ nome: 'Rui Lima' })).toBe('Rui Lima');
});

test('busca ignora acento e caixa e exige todas as palavras', () => {
  expect(corresponde('jose silva', 'José da Silva')).toBe(true);
  expect(corresponde('jose souza', 'José da Silva')).toBe(false);
  expect(corresponde('', 'qualquer')).toBe(true);
});

test('diferença em dias entre duas datas', () => {
  expect(diasEntre('2026-09-28', '2026-10-13')).toBe(15);
  expect(diasEntre('2026-09-28T10:00:00', '2026-09-27')).toBe(-1);
});

test('status fora da lista aparece como texto, sem cor', () => {
  expect(rotuloDe(STATUS_CONSULTA, 'FINALIZADO')).toEqual({ rotulo: 'Finalizado', tom: 'sucesso' });
  expect(rotuloDe(STATUS_CONSULTA, 'OUTRO')).toEqual({ rotulo: 'OUTRO', tom: 'neutro' });
});
