import React from 'react';

import CampoHorarios from '../../components/campo-horarios';
import { CampoTexto } from '../../components/formulario';
import { DATA_DE_HOJE } from '../../config/axios';
import { diaMes } from '../../utils/formatos';
import { carregarHorarios, DIAS_CURTOS, diaDaSemana, somarDias } from './comum';

// Data e horário livre de um médico para um tipo de atendimento (RF16). Lê
// duas semanas a partir da data escolhida: se o dia não tiver horário, sugere
// as próximas datas que têm. "ocupados" tira da lista horários já escolhidos
// em outra linha da mesma tela ("AAAA-MM-DDTHH:mm"). Mudar "versao" relê os
// horários (depois de um conflito, por exemplo).
function EscolhaDeHorario({
  idData,
  idHorario,
  idMedico,
  idProcedimento,
  idConsulta,
  data,
  aoMudarData,
  horario,
  aoMudarHorario,
  erroData,
  erroHorario,
  versao = 0,
  ocupados = [],
  rotuloData = 'Data',
  larguraData = 'col-md-4',
}) {
  const [disp, setDisp] = React.useState({ dias: null, carregando: false, falhou: false });

  React.useEffect(() => {
    if (!idMedico || !idProcedimento || !data || data < DATA_DE_HOJE) {
      setDisp({ dias: null, carregando: false, falhou: false });
      return undefined;
    }
    let ativo = true;
    setDisp((atual) => ({ ...atual, carregando: true }));
    carregarHorarios({ idMedico, idProcedimento, idConsulta, de: data, ate: somarDias(data, 13) })
      .then((r) => ativo && setDisp({ dias: r.dias, carregando: false, falhou: false }))
      .catch(() => ativo && setDisp({ dias: [], carregando: false, falhou: true }));
    return () => {
      ativo = false;
    };
  }, [idMedico, idProcedimento, idConsulta, data, versao]);

  const livres = (dia) =>
    (disp.dias?.find((d) => d.data === dia)?.horarios ?? []).filter((h) => !ocupados.includes(`${dia}T${h}`));
  const doDia = disp.dias ? livres(data) : null;
  const proximos = disp.dias ? disp.dias.filter((d) => d.data !== data && livres(d.data).length > 0).slice(0, 4) : [];

  // O horário escolhido sai da escolha quando deixa de estar livre.
  const chave = doDia?.join() ?? null;
  React.useEffect(() => {
    if (horario && doDia && !disp.carregando && !doDia.includes(horario)) aoMudarHorario('');
  }, [chave, horario, disp.carregando]); // eslint-disable-line react-hooks/exhaustive-deps

  let vazio = 'Nenhum horário livre neste dia.';
  if (disp.falhou) vazio = 'Não foi possível carregar os horários agora. Tente de novo em instantes.';
  else if (proximos.length === 0) vazio = 'Nenhum horário livre neste dia nem nas duas semanas seguintes.';

  return (
    <>
      <CampoTexto
        id={idData}
        rotulo={rotuloData}
        tipo='date'
        min={DATA_DE_HOJE}
        valor={data}
        aoMudar={(valor) => {
          aoMudarData(valor);
          aoMudarHorario('');
        }}
        erro={erroData}
        largura={larguraData}
      />
      <CampoHorarios
        id={idHorario}
        horarios={data && data < DATA_DE_HOJE ? null : doDia}
        valor={horario}
        aoMudar={aoMudarHorario}
        erro={erroHorario}
        carregando={disp.carregando}
        vazio={vazio}
      />
      {doDia && doDia.length === 0 && proximos.length > 0 && (
        <div className='col-12'>
          <p className='small mb-1'>Próximas datas com horário livre:</p>
          <div className='d-flex flex-wrap gap-2'>
            {proximos.map((d) => (
              <button key={d.data} type='button' className='btn btn-sm btn-outline-secondary' onClick={() => aoMudarData(d.data)}>
                {DIAS_CURTOS[diaDaSemana(d.data)]}, {diaMes(d.data)} · {livres(d.data).length}{' '}
                {livres(d.data).length === 1 ? 'horário' : 'horários'}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

export default EscolhaDeHorario;
