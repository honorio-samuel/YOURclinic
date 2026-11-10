# 02 · Matriz por papel

Uma linha por tela do redesenho, na ordem **Geral › Administrador › Médico › Secretária › Paciente › Responsável Legal**. A mesma tabela está em [02-matriz-por-papel.csv](02-matriz-por-papel.csv) (UTF-8, separador vírgula), com duas colunas a mais: nome do frame no Figma e nota.

| Papel | Telas | ok | conflito | lacuna |
|---|---|---|---|---|
| Geral | 14 | 13 | 0 | 1 |
| Administrador | 41 | 39 | 0 | 2 |
| Médico | 14 | 13 | 1 | 0 |
| Secretária | 28 | 27 | 0 | 1 |
| Paciente | 7 | 7 | 0 | 0 |
| Responsável Legal | 8 | 7 | 1 | 0 |
| **Total** | **112** | **106** | **2** | **4** |

## Como ler

- **Tela (código novo)**: um código por submenu, como no exemplo `A-14 Financeiro › Contas a pagar`. Telas filhas e estados do mesmo submenu ganham letra (`A-02a`, `A-02b`).
- **Origem**: número do frame atual na página "4. Telas do app", ou NOVA.
- **Verbos**: os onze da v2.1 (Criar, Consultar, Editar, Retificar, Inativar, Excluir, Executar, Aprovar, Emitir, Estornar, Exportar). A v2.1 não tem verbo para mudança de estado nem para pedido: mudança de estado (check-in, cancelar, chamar) entra como Executar; pedido (estorno, direito do titular) entra como Criar.
- **Status**: `ok` = as fontes bastam; `conflito` = as fontes divergem e há decisão registrada; `lacuna` = falta informação nas fontes. O motivo está na coluna Nota do CSV e em [DECISOES.md](DECISOES.md).
- Excluir aparece em três lugares: bloqueio de agenda recém-criado (A-11a, S-05b) e anotação privada pelo autor (M-02f). A terceira hipótese da A1-R09, anexo reprovado no antivírus, é do sistema e não tem botão.

## G · Geral

| Papel | Menu › Submenu | Tela (código novo) | Origem | RF | RC e RN que governam | Verbos permitidos | Dados ocultos neste papel | Status |
|---|---|---|---|---|---|---|---|---|
| Geral | — (sem menu lateral) | **G-01** Login | 01 | RF01 | RNF01, RNF19; A1-R01, A1-R02; X01 a X03 | Executar (autenticar) | Nenhum dado antes da autenticação | ok |
| Geral | — (sem menu lateral) | **G-02** Login · credencial inválida | 02 | RF01 | RNF19; RN-01.2 (E1 do RF01) | Executar (autenticar) | Se o e-mail existe ou não | ok |
| Geral | — (sem menu lateral) | **G-03** Login · muitas tentativas | 03 | RF01, RF40 | RN-01.1 (E2 do RF01); RNF19; X01, X02, X03 | Nenhum (aguardar) | Se a conta existe; quantas tentativas restam | ok |
| Geral | — (sem menu lateral) | **G-04a** Primeiro acesso por convite · Paciente | 04 | RF02, RF09 | A1-R03, A1-R04, A1-R12, A1-R13, A1-R14; X04, X01 | Executar (ativar conta e definir senha) | Qualquer dado do cadastro além do que o titular digita | ok |
| Geral | — (sem menu lateral) | **G-04b** Primeiro acesso por convite · Responsável Legal | 04 | RF02, RF09, RF08 | A1-R03, A1-R04, A1-R13, A1-R14; X04, X01 | Executar (ativar conta e definir senha) | Dados do representado antes da ativação | lacuna |
| Geral | — (sem menu lateral) | **G-05** Recuperar senha · solicitação | 05 | RF02 | RNF19; A1-R04 | Executar (solicitar link) | Se o e-mail está cadastrado | ok |
| Geral | — (sem menu lateral) | **G-06** Recuperar senha · nova senha | 06 | RF02 | A1-R03, A1-R04, A1-R05; RNF01, RNF03; X05 | Executar (definir nova senha) | — | ok |
| Geral | — (sem menu lateral) | **G-07** Sessão expirada | 07 | RF01 | RNF03; X15, X16, X17 | Executar (entrar novamente) | Todo o conteúdo da tela anterior | ok |
| Geral | — (mantém o menu do papel) | **G-07b** Aviso de expiração · modal | NOVA | RF01 | RNF03; WCAG 2.2.1 | Executar (continuar conectado ou sair) | — | ok |
| Geral | — (mantém o menu do papel) | **G-08a** Acesso negado · por papel | 08 | RF04, RF40 | RC01, RC03; A1-R10 | Nenhum | Qualquer dado da funcionalidade negada | ok |
| Geral | — (mantém o menu do papel) | **G-08b** Acesso negado · por registro | NOVA | RF04, RF40 | RC03, RC05; RNF19 | Nenhum | Nome, identificador, motivo e a própria existência do registro | ok |
| Geral | — (sem menu lateral) | **G-09** Seletor de paciente representado | 09 | RF08, RF40 | A1-R11, A5-R23, A3-R04 | Consultar (lista dos próprios representados); Executar (selecionar) | Qualquer paciente que não seja representado por esta conta | ok |
| Geral | — (mantém o menu do papel) | **G-10** Meu perfil · alterar senha | NOVA | RF02 | RNF01, RNF03; A1-R05 | Consultar (próprios dados de conta); Executar (alterar senha) | Dados de outros usuários | ok |
| Geral | — (sem menu lateral) | **G-11** Erro inesperado | NOVA | — | RNF19 | Nenhum | Estrutura interna, consulta ao banco, existência de registro de terceiro | ok |

## A · Administrador

| Papel | Menu › Submenu | Tela (código novo) | Origem | RF | RC e RN que governam | Verbos permitidos | Dados ocultos neste papel | Status |
|---|---|---|---|---|---|---|---|---|
| Administrador | Início › Painel do dia | **A-01** Painel do dia | NOVA | RF22, RF48, RF47, RF31, RF57, RF39, RF06 | RC02, RC06; A11-R06; A8-R03, A11-R03 | Consultar | Conteúdo clínico; paciente das dispensações | ok |
| Administrador | Cadastro › Pacientes | **A-02a** Pacientes · listagem | 10 | RF07, RF09, RF29 | RC02; A3-R01, A3-R02, A3-R17 | Criar; Consultar; Editar; Inativar; Executar (convite de portal); Exportar (histórico RF29) | Observações Gerais (campo removido da resposta); anexos (conteúdo e metadados); prontuário; vínculos clínicos; dispensação | ok |
| Administrador | Cadastro › Pacientes | **A-02b** Pacientes · cadastro | 11 | RF07, RF08, RF09 | RC02; A3-R01, A3-R03, A3-R04, A3-R17; A1-R12, A1-R14 | Criar; Editar; Inativar (paciente e representação); Executar (convite ao Paciente ou ao Responsável Legal); Exportar (histórico RF29) | Observações Gerais (o campo não existe nesta variante); aba de anexos | ok |
| Administrador | Cadastro › Médicos | **A-03** Médicos | 12 | RF10, RF03 | A1-R07, A3-R05, A3-R06 | Criar; Consultar; Editar; Inativar | — | ok |
| Administrador | Cadastro › Equipe · usuários e papéis | **A-04** Equipe · usuários e papéis | 52 | RF03, RF09 | A1-R06, A1-R07, A1-R08 | Criar (Secretária e Administrador); Consultar (todas as contas); Editar; Inativar | Senha, tokens e segredos de sessão (RNF01) | ok |
| Administrador | Cadastro › Convênios | **A-05** Convênios | 13 | RF11 | RC06 (nível 1); A3-R07, A3-R08 | Criar; Consultar; Editar; Inativar | — | ok |
| Administrador | Cadastro › Procedimentos e preços | **A-06** Procedimentos e preços | 14 | RF12 | RC06 (nível 2); A3-R09, A3-R10, A3-R11; X11 | Criar; Consultar; Editar; Inativar | — | ok |
| Administrador | Agenda › Agenda da clínica | **A-07** Agenda da clínica | NOVA | RF13, RF14, RF16, RF22 | RC02; A4-R17 | Consultar | Qualquer conteúdo clínico; na visão Ano, nomes de pacientes | ok |
| Administrador | Agenda › Agenda da clínica | **A-07b** Agenda da clínica · visão Ano | NOVA | RF13, RF16 | RC02; RN-22.2 | Consultar | Nomes de pacientes; contagem por paciente; conteúdo clínico | ok |
| Administrador | Agenda › Agenda da clínica | **A-07c** Agenda da clínica · visão Semana | NOVA | RF13, RF14, RF16 | RC02; A4-R17 | Consultar | Qualquer conteúdo clínico | ok |
| Administrador | Agenda › Agenda da clínica | **A-07d** Agenda da clínica · visão Mês | NOVA | RF13, RF14, RF16 | RC02; A4-R17 | Consultar | Qualquer conteúdo clínico; nomes de pacientes nesta visão | ok |
| Administrador | Agenda › Novo agendamento | **A-08a** Novo agendamento | 17 | RF16, RF17, RF05 | A4-R01, A4-R02, A4-R03, A4-R04, A4-R05 | Criar | Nenhum campo clínico existe no fluxo | ok |
| Administrador | Agenda › Novo agendamento | **A-08b** Novo agendamento · conflito de horário | 18 | RF18, RF16 | A4-R06, A4-R07, A4-R08 | Criar (escolher outro horário) | Quem ocupou o horário | ok |
| Administrador | Agenda › Fila do dia | **A-09** Fila do dia · leitura | 19 | RF22 | RC02; A4-R16, A4-R17, A4-R18; X28 | Consultar | Conteúdo clínico; pílula sem seta de status | ok |
| Administrador | Agenda › Grade de horários | **A-10** Grade de horários | 15 | RF13 | A3-R12, A3-R13, A3-R14; X11, X12 | Criar; Consultar; Editar | — | ok |
| Administrador | Agenda › Bloqueios e consultas afetadas | **A-11a** Bloqueios e consultas afetadas | 16 | RF14, RF20, RF21 | A3-R15, A3-R16; A1-R09 (hipótese 1) | Criar; Consultar; Editar; Inativar; Excluir (só bloqueio recém-criado que ainda não afetou consulta) | Motivo clínico: o motivo é de lista fechada | ok |
| Administrador | Agenda › Bloqueios e consultas afetadas | **A-11b** Bloqueios e consultas afetadas · reagendamento em lote | 21 | RF20, RF21 | A4-R09, A4-R10, A4-R11 | Executar (reagendar ou cancelar, com motivo) | — | ok |
| Administrador | Financeiro › Painel financeiro | **A-12** Painel financeiro | 41 | RF35, RF50 | RC06 (nível 3); A7-R13, A7-R14, A7-R15 | Consultar | Conteúdo clínico | ok |
| Administrador | Financeiro › Contas a receber | **A-13a** Contas a receber | 54 | RF32 | RC06; A7-R04, A7-R05, A7-R06; A8-R18 | Consultar; Criar e Editar (cobrança, antes do pagamento); Executar (baixar como perda, com justificativa); Estornar (título pago; abre A-17) | CID e conteúdo clínico da origem do título | ok |
| Administrador | Financeiro › Contas a receber | **A-13b** Contas a receber · cobrança | 31 | RF43 | RN-43.1, RN-43.2, RN-43.3; matriz 6.6 da v2.0 | Criar; Consultar; Editar (antes do pagamento) | A execução do checkout; dado de cartão | ok |
| Administrador | Financeiro › Contas a pagar | **A-14** Contas a pagar | 43 | RF50 | RC06 (nível 3); A7-R19, A7-R20, A7-R21 | Criar; Consultar; Editar (título em aberto); Executar (pagar); Estornar | — | ok |
| Administrador | Financeiro › Conciliação | **A-15** Conciliação | 42 | RF49, RF48 | RC06 (nível 3); A7-R16, A7-R17, A7-R18; X35, X36, X47, X48 | Consultar; Executar (importar e reprocessar extrato; tratar divergência) | — | ok |
| Administrador | Financeiro › Caixas · supervisão | **A-16** Caixas · supervisão | 35 | RF47, RF41 | A6-R18, A6-R19, A6-R20 | Consultar (inclui o saldo esperado); Aprovar (aprovar o fechamento com divergência ou devolver para recontagem) | — | ok |
| Administrador | Financeiro › Cancelamentos e estornos | **A-17** Cancelamentos e estornos | 36 | RF48 | A6-R21, A6-R22, A6-R23; X34 | Consultar; Aprovar (solicitação da Secretária); Estornar | — | ok |
| Administrador | Financeiro › Orçamentos · aprovação | **A-18** Orçamentos · aprovação | 40 | RF31 | RC09; A7-R01, A7-R03 | Consultar (só os pendentes de aprovação); Aprovar (aprovar ou devolver) | Anamnese, diagnóstico e CID; justificativa clínica; orçamentos anteriores do paciente em navegação livre | ok |
| Administrador | Financeiro › Recibos e NFS-e | **A-19** Recibos e NFS-e | 55 | RF33, RF34 | A7-R07 a A7-R12 | Consultar; Criar e Editar (parâmetros fiscais); Emitir (NFS-e); Exportar (baixar NFS-e e recibo já emitidos) | CID e diagnóstico: o documento traz só a descrição do serviço | ok |
| Administrador | Faturamento TISS › Contratos e tabelas | **A-20** Contratos e tabelas | 59 | RF51 | A8-R01, A8-R02, A8-R03, A8-R04; RNF23; X37, X38, X39, X50 | Criar; Consultar; Editar; Inativar | — | ok |
| Administrador | Faturamento TISS › Elegibilidade e autorizações | **A-21** Elegibilidade e autorizações | 44 | RF52, RF53, RF58 | RC10; A8-R05 a A8-R11 | Consultar | Justificativa clínica; descrição textual do CID | ok |
| Administrador | Faturamento TISS › Guias TISS | **A-22** Guias TISS | 45 | RF54 | RC10; A8-R12, A8-R13, A8-R14 | Consultar | Descrição textual do CID; anamnese e prescrição | ok |
| Administrador | Faturamento TISS › Lotes e protocolos | **A-23** Lotes e protocolos | 46 | RF55 | A8-R15, A8-R16, A8-R17; X37, X50; RNF13, RNF21 | Consultar; Executar (enviar lote) | — | ok |
| Administrador | Faturamento TISS › Demonstrativos e glosas | **A-24** Demonstrativos e glosas | 47 | RF56, RF42 | A8-R18, A8-R19, A8-R20; X38, X39 | Consultar; Executar (baixa manual justificada) | Conteúdo clínico do atendimento glosado | ok |
| Administrador | Faturamento TISS › Recursos de glosa | **A-25** Recursos de glosa | 48 | RF57 | RC10; A8-R21, A8-R22, A8-R23, A8-R24; X39 | Consultar; Aprovar (recurso mantido: insistir ou baixar como perda, com justificativa) | Conteúdo do envelope clínico | ok |
| Administrador | Estoque › Produtos e lotes | **A-26** Produtos e lotes | 56 | RF36 | RC06 (nível 3: custo); A9-R01, A9-R02, A9-R03; X46 | Criar; Consultar; Editar; Inativar | — | ok |
| Administrador | Estoque › Movimentações | **A-27** Movimentações | 57 | RF37 | RC08; RN-36.2, RN-37.2; tabela do RF37 na v2.0 | Consultar (saídas em atendimento somadas por mês, sem paciente; entradas, descartes e ajustes um a um); Criar (entrada; ajuste de inventário); Aprovar (ajuste pedido pela Secretária) | Paciente da saída identificada; histórico por paciente | ok |
| Administrador | Estoque › Alertas | **A-28** Alertas | 58 | RF38 | A9-R07, A9-R08; X14, X46 | Consultar | — | ok |
| Administrador | Gestão › Dashboard gerencial | **A-29** Dashboard gerencial | 50 | RF41 | RC06 (derivação); A11-R05, A11-R06, A11-R07; X28 | Consultar | Qualquer indicador derivado de diagnóstico, CID ou prescrição | ok |
| Administrador | Gestão › Relatórios | **A-30** Relatórios | 51 | RF42 | RC04, RC06, RC08; RNF13 | Consultar; Exportar (geração assíncrona) | Dispensação identificada ao paciente: só agregada por item e por período | ok |
| Administrador | Gestão › Log de auditoria | **A-31** Log de auditoria | 49 | RF40, RF05, RF06 | A11-R01 a A11-R04; RNF06, RNF14; X43 | Consultar (log; vínculos de todos; acessos de exceção); Executar (revogar acesso de exceção em curso) | Conteúdo do dado acessado: o log guarda só a referência | ok |
| Administrador | Gestão › Notificações | **A-32** Notificações | 60 | RF59, RF21 | A11-R08, A11-R09; A4-R12 a A4-R15; X09, X44, X45 | Consultar; Editar (modelos e configuração); Executar (reenviar) | Conteúdo do prontuário; nome do procedimento na mensagem | ok |
| Administrador | Gestão › Solicitações dos titulares (LGPD) | **A-33** Solicitações dos titulares (LGPD) | NOVA | RF39 | A10-R01, A10-R02, A10-R03; RNF04, RNF05; LGPD art. 19, II | Consultar; Editar (análise); Executar (responder ou indeferir com motivo); Exportar (declaração) | Conteúdo clínico da exportação entregue ao titular; existência de anotações privadas (A5-R18) | lacuna |
| Administrador | Gestão › Parâmetros do sistema | **A-34** Parâmetros do sistema | NOVA | RF40 | Seção 16 da v2.1 (X01 a X51) | Consultar; Editar (só os X atribuídos ao Administrador) | — | lacuna |

## M · Médico

| Papel | Menu › Submenu | Tela (código novo) | Origem | RF | RC e RN que governam | Verbos permitidos | Dados ocultos neste papel | Status |
|---|---|---|---|---|---|---|---|---|
| Médico | Atendimentos do dia | **M-01** Atendimentos do dia | 20 | RF22, RF05, RF38 | RC05; A2-R03; A4-R16, A4-R17, A4-R18; A9-R09; D1 | Consultar (só os próprios); Executar (Chamar; Finalizar e selar; retroativas com motivo) | Atendimentos de outros médicos; valores | ok |
| Médico | Meus pacientes | **M-02a** Meus pacientes · lista | NOVA | RF05, RF06, RF07, RF15 | RC05; A2-R01, A2-R02, A2-R04; X06 | Consultar | Prontuário de quem não tem vínculo Ativo ou Histórico (só dados administrativos); preços | ok |
| Médico | Meus pacientes › Prontuário | **M-02b** Prontuário · anamnese em edição | 23 | RF23 | RC02, RC05; A5-R01, A5-R02 | Criar; Editar (registro não selado); Executar (finalizar e selar) | — | ok |
| Médico | Meus pacientes › Prontuário | **M-02c** Prontuário · registro selado e retificação | 24 | RF24, RF23 | A5-R03, A5-R04, A5-R05 | Consultar; Retificar (só o autor, com motivo) | — | ok |
| Médico | Meus pacientes › Prescrição | **M-02d** Prescrição | 25 | RF25 | A5-R06, A5-R07, A5-R08 | Consultar; Criar; Editar (antes de selar); Retificar (depois de selar); Emitir (imprimir) | — | ok |
| Médico | Meus pacientes › Anexos | **M-02e** Anexos | 26 | RF26, RF27 | A5-R09 a A5-R13; RNF09; X13 | Criar (enviar); Consultar (conteúdo); Exportar (baixar); Aprovar (aceitar ou recusar exame do titular, com motivo) | — | ok |
| Médico | Meus pacientes › Anotações privadas | **M-02f** Anotações privadas | 28 | RF28 | RC04; A5-R14 a A5-R18; A2-R05; D2 | Criar; Consultar; Editar; Excluir (só o autor) | Anotações de outros médicos | conflito |
| Médico | Meus pacientes › Exportações | **M-02g** Exportações | 30 | RF29, RF30 | RC04; A5-R19 a A5-R24; RNF13; X25, X26, X42 | Exportar (histórico; prontuário, só médico da equipe) | Anotações privadas, que nunca entram no documento | ok |
| Médico | Meus pacientes › Acesso de exceção | **M-02h** Acesso de exceção | 29 | RF06 | RC05; A2-R05, A2-R06; X07 | Executar (pedir acesso com justificativa) | Prontuário até a concessão; anotações privadas de outros médicos, sempre | ok |
| Médico | Minha agenda | **M-03** Minha agenda | NOVA | RF13, RF14, RF16 | A3-R12; A4-R17 | Consultar (grade e agenda próprias); Criar (indisponibilidade própria) | Agenda de outros médicos | ok |
| Médico | Orçamentos | **M-04** Orçamentos · etapa 1 · escopo clínico | 40 | RF31 | A7-R01 | Criar; Consultar (só o escopo clínico, em qualquer etapa); Editar (só a etapa 1); Executar (enviar à etapa 2) | Valores: não vê nem define | ok |
| Médico | Estoque | **M-05a** Estoque · disponibilidade | 56 | RF36, RF38 | RC06; A9-R07, A9-R09 | Consultar | Custo de aquisição; alerta de estoque mínimo | ok |
| Médico | Estoque | **M-05b** Estoque · saída por lote | 57 | RF37 | RC08; A9-R05, A9-R06, A9-R07; A5-R07 | Criar (saída por lote, vinculada a paciente ou a descarte) | Custo; saídas de outros profissionais | ok |
| Médico | Pendências clínicas | **M-06** Pendências clínicas | NOVA | RF53, RF57, RF26 | RC10; A8-R08, A8-R22; A5-R10 | Criar e Editar (justificativa e CID da autorização); Executar (anexar documentação ao envelope); Aprovar (aceitar ou recusar exame do titular) | Valores glosados e demais dados financeiros | ok |

## S · Secretária

| Papel | Menu › Submenu | Tela (código novo) | Origem | RF | RC e RN que governam | Verbos permitidos | Dados ocultos neste papel | Status |
|---|---|---|---|---|---|---|---|---|
| Secretária | Cadastro › Pacientes | **S-01a** Pacientes · listagem | 10 | RF07, RF09, RF29, RF39 | RC02; A3-R01, A3-R02 | Criar; Consultar; Editar; Inativar; Executar (convite de portal); Exportar (histórico RF29); Criar (solicitação do titular) | Prontuário; conteúdo de anexos; anotações privadas; histórico de dispensação | ok |
| Secretária | Cadastro › Pacientes | **S-01b** Pacientes · cadastro | 11 | RF07, RF08, RF09 | RC02; A3-R01, A3-R03, A3-R04; A1-R12, A1-R14 | Criar; Editar; Inativar (paciente); Executar (convite); Exportar (histórico RF29); Criar (solicitação do titular) | Qualquer campo clínico | ok |
| Secretária | Cadastro › Pacientes | **S-01c** Pacientes · Observações Gerais | 53 | RF15 | RC07; A3-R17, A3-R18, A3-R19 | Criar; Editar; Consultar | — | ok |
| Secretária | Cadastro › Pacientes | **S-01d** Pacientes · anexos · só metadados | 27 | RF26, RF27 | RC02; A5-R09, A5-R12 | Criar (enviar arquivo); Consultar (nome, data, situação e quem enviou) | Conteúdo e miniatura do arquivo; não há ícone Baixar | ok |
| Secretária | Agenda › Agenda da clínica | **S-02** Agenda da clínica | NOVA | RF13, RF14, RF16, RF20 | RC02; A4-R17 | Consultar | Conteúdo clínico | ok |
| Secretária | Agenda › Novo agendamento | **S-03a** Novo agendamento | 17 | RF16, RF17, RF05, RF52 | A4-R01 a A4-R05 | Criar | Nenhum campo clínico existe no fluxo | ok |
| Secretária | Agenda › Novo agendamento | **S-03b** Novo agendamento · conflito de horário | 18 | RF18, RF16 | A4-R06, A4-R07, A4-R08 | Criar (escolher outro horário) | Quem ocupou o horário | ok |
| Secretária | Agenda › Reagendar ou cancelar | **S-04** Reagendar ou cancelar | 21 | RF20, RF21 | A4-R09, A4-R10, A4-R11 | Consultar (a consulta a tratar); Executar (reagendar ou cancelar, com motivo) | — | ok |
| Secretária | Agenda › Grade e bloqueios | **S-05a** Grade e bloqueios · grade | 15 | RF13 | A3-R12, A3-R13, A3-R14; X11, X12 | Criar; Consultar; Editar | — | ok |
| Secretária | Agenda › Grade e bloqueios | **S-05b** Grade e bloqueios · bloqueio e consultas afetadas | 16 | RF14, RF20 | A3-R15, A3-R16; A1-R09 (hipótese 1) | Criar; Consultar; Editar; Inativar; Excluir (só bloqueio recém-criado que ainda não afetou consulta) | — | ok |
| Secretária | Fila do dia | **S-06** Fila do dia | 19 | RF22, RF17, RF21, RF59, RF38, RF08 | RC02; A4-R05, A4-R14, A4-R16, A4-R17, A4-R18; X10, X28; D1 | Consultar; Executar (check-in; Não Compareceu depois de X10; Cancelar com motivo; reenviar notificação com falha) | Conteúdo clínico; transição para Em Atendimento | ok |
| Secretária | Caixa e cobranças › Checkout | **S-07a** Checkout · seleção de meio | 31 | RF43, RF58 | RC06; A6-R01, A6-R02, A6-R03, A6-R04, A6-R05; X32, X33 | Executar (iniciar recebimento) | Taxa do adquirente; valor líquido; qualquer total | ok |
| Secretária | Caixa e cobranças › Checkout | **S-07b** Checkout · Pix | 32 | RF44 | A6-R06, A6-R07, A6-R08; RNF15; X31 | Executar (gerar QR; verificar agora) | Chave Pix e credenciais do provedor | ok |
| Secretária | Caixa e cobranças › Checkout | **S-07c** Checkout · cartão TEF | 33 | RF45 | A6-R09 a A6-R12; RNF20, RNF21, RNF22; X49 | Executar (enviar valor ao terminal) | Dado de cartão; motivo detalhado da negação | ok |
| Secretária | Caixa e cobranças › Checkout | **S-07d** Checkout · cartão POS avulso | 34 | RF46 | A6-R13 a A6-R17; X48 | Criar (lançamento manual com bandeira, quatro últimos dígitos, NSU e código de autorização) | Número completo do cartão, validade, código de segurança e senha: não há campo (RN-43.4) | lacuna |
| Secretária | Caixa e cobranças › Cobranças do dia | **S-08** Cobranças do dia | NOVA | RF32, RF43 | RC06 (regra de derivação); A7-R04 | Consultar (item a item); Executar (abrir o checkout) | Soma do dia, por meio de pagamento ou por médico; gráfico; títulos de operadora | ok |
| Secretária | Caixa e cobranças › Meu caixa | **S-09** Meu caixa | 35 | RF47 | A6-R18, A6-R19, A6-R20; RC06; D5 | Executar (abrir turno; registrar sangria; fechar informando o valor contado); Criar (justificativa) | Saldo esperado; valor da divergência | ok |
| Secretária | Caixa e cobranças › Orçamentos · valores | **S-10** Orçamentos · valores | 40 | RF31 | RC06 (nível 2); A7-R01 | Consultar (sem a justificativa clínica); Editar (só a etapa 2); Executar (enviar para aprovação; devolver ao Médico com observação) | Justificativa clínica; a ação Aprovar | ok |
| Secretária | Caixa e cobranças › Recibos | **S-11** Recibos | 55 | RF33 | A7-R07, A7-R08, A7-R09 | Emitir (recibo); Consultar; Exportar (baixar recibo) | NFS-e e parâmetros fiscais | ok |
| Secretária | Caixa e cobranças › Estornos · solicitar | **S-12** Estornos · solicitar | 36 | RF48 | A6-R21, A6-R22, A6-R23; X34 | Criar (solicitação de cancelamento ou estorno; registro de chargeback); Consultar | A ação Estornar; taxas | ok |
| Secretária | Faturamento TISS › Elegibilidade e autorização | **S-13** Elegibilidade e autorização | 44 | RF52, RF53, RF58 | RC10; A8-R05 a A8-R11; X40, X41 | Executar (verificar elegibilidade; transmitir pedido); Consultar | Justificativa clínica; descrição textual do CID | ok |
| Secretária | Faturamento TISS › Guias TISS | **S-14** Guias TISS | 45 | RF54 | RC10; A8-R12, A8-R13, A8-R14; X37, X41 | Criar; Consultar; Editar (antes da liberação); Emitir (liberar depois da crítica); Executar (cancelar) | Descrição textual do CID | ok |
| Secretária | Faturamento TISS › Lotes e protocolos | **S-15** Lotes e protocolos | 46 | RF55 | RC06 (regra de derivação); A8-R15, A8-R16, A8-R17; D9 | Criar; Executar (enviar lote); Consultar | Totais em valor do lote; vê o valor de cada guia e a quantidade de guias | ok |
| Secretária | Faturamento TISS › Glosas e recursos | **S-16a** Glosas e recursos · demonstrativo e glosas | 47 | RF56 | A8-R18, A8-R19, A8-R20 | Executar (importar demonstrativo); Consultar (item a item) | Índice de glosa; totais | ok |
| Secretária | Faturamento TISS › Glosas e recursos | **S-16b** Glosas e recursos · recurso de glosa | 48 | RF57 | RC10; A8-R21, A8-R22, A8-R24; X39 | Criar (recurso); Executar (enviar; pedir fundamentação ao médico) | Conteúdo do envelope clínico; a decisão do recurso mantido | ok |
| Secretária | Estoque › Produtos e lotes | **S-17** Produtos e lotes | 56 | RF36 | RC06; A9-R01, A9-R02, A9-R03; X46 | Criar; Consultar; Editar; Inativar | Custo de aquisição | ok |
| Secretária | Estoque › Movimentações | **S-18** Movimentações | 57 | RF37 | RC08; A9-R04, A9-R05, A9-R06 | Criar (entrada; saída por lote, com paciente ou descarte; pedido de ajuste); Consultar (movimentação física) | Histórico de itens por paciente: a saída identificada mostra só a confirmação do ato | ok |
| Secretária | Estoque › Alertas | **S-19** Alertas | 58 | RF38 | A9-R07, A9-R08; X14, X46 | Consultar | — | ok |

## P · Paciente

| Papel | Menu › Submenu | Tela (código novo) | Origem | RF | RC e RN que governam | Verbos permitidos | Dados ocultos neste papel | Status |
|---|---|---|---|---|---|---|---|---|
| Paciente | Início | **P-01** Início | NOVA | RF16, RF22, RF31, RF43 | A1-R11; RNF03 (X17) | Consultar (só os próprios dados) | Dados de qualquer outro paciente; anotações privadas | ok |
| Paciente | Agendar consulta | **P-02** Agendar consulta | NOVA | RF16, RF17, RF18 | A4-R01, A4-R05; A1-R11 | Criar (agendamento próprio) | Preços; agenda de outros pacientes | ok |
| Paciente | Meus agendamentos | **P-03** Meus agendamentos | 22 | RF19, RF16 | A1-R11; X08 | Consultar; Executar (cancelar até X08 antes) | — | ok |
| Paciente | Meus documentos | **P-04** Meus documentos | 37 | RF29, RF30, RF26, RF27, RF37 | RC04; A5-R10, A5-R24; RNF13; X42 | Exportar (histórico e prontuário); Criar (enviar exame); Consultar (próprios anexos e itens que recebeu) | Anotações privadas: nem o conteúdo nem a existência | ok |
| Paciente | Orçamentos e cobranças | **P-05a** Orçamentos e cobranças · cobranças | 38 | RF43, RF44, RF58, RF33, RF34, RF48 | A8-R27; A7-R12; RNF20 | Consultar (cobranças e estornos); Executar (pagar no ambiente do provedor); Exportar (recibo e NFS-e) | Dado de cartão | ok |
| Paciente | Orçamentos e cobranças | **P-05b** Orçamentos e cobranças · orçamento · aceite | 40 | RF31 | A7-R02 | Consultar; Aprovar (aceitar ou recusar) | Etapas internas do orçamento | ok |
| Paciente | Meus dados e privacidade | **P-06** Meus dados e privacidade | 39 | RF39, RF59, RF07 | A10-R01, A10-R02, A10-R03; A4-R15, A11-R09; A5-R18 | Consultar (dados cadastrais e notificações recebidas); Criar (pedido de acesso, correção, portabilidade, revogação); Executar (revogar canal) | Existência de anotações privadas | ok |

## R · Responsável Legal

| Papel | Menu › Submenu | Tela (código novo) | Origem | RF | RC e RN que governam | Verbos permitidos | Dados ocultos neste papel | Status |
|---|---|---|---|---|---|---|---|---|
| Responsável Legal | Início | **R-01** Início | NOVA | RF16, RF22, RF31, RF43, RF08 | A1-R11; A5-R23; D3 | Consultar (dados do representado selecionado) | Outros pacientes; anotações privadas; registros sob sigilo do adolescente | ok |
| Responsável Legal | Agendar consulta | **R-02** Agendar consulta | NOVA | RF16, RF17, RF18 | A4-R01, A4-R05; A1-R11; A5-R23 | Criar (agendamento do representado) | Preços | ok |
| Responsável Legal | Agendamentos | **R-03** Agendamentos | 22 | RF19, RF16 | A1-R11; A5-R23; X08 | Consultar; Executar (cancelar até X08 antes) | — | ok |
| Responsável Legal | Documentos | **R-04** Documentos | 37 | RF29, RF30, RF26, RF27, RF37 | RC04; A5-R10, A5-R23, A5-R24; D3; X42 | Exportar (histórico e prontuário); Criar (enviar exame); Consultar (anexos e itens do representado) | Anotações privadas; registros sob sigilo do adolescente, filtrados na consulta | conflito |
| Responsável Legal | Orçamentos e cobranças | **R-05a** Orçamentos e cobranças · cobranças | 38 | RF43, RF44, RF58, RF33, RF34, RF48 | A8-R27; A7-R08, A7-R12; A5-R23 | Consultar (cobranças e estornos); Executar (pagar); Exportar (recibo e NFS-e) | Dado de cartão | ok |
| Responsável Legal | Orçamentos e cobranças | **R-05b** Orçamentos e cobranças · orçamento · aceite | 40 | RF31 | A7-R02; A5-R23 | Consultar; Aprovar (aceitar ou recusar) | Etapas internas do orçamento | ok |
| Responsável Legal | Dados do representado | **R-06** Dados do representado | 39 | RF39, RF59, RF08 | A10-R01, A10-R02, A10-R03; A4-R15; A5-R23 | Consultar (dados e notificações do representado); Criar (pedidos do RF39 em nome do representado); Executar (revogar canal) | Existência de anotações privadas | ok |
| Responsável Legal | Acesso encerrado por maioridade | **R-07** Acesso encerrado por maioridade | NOVA | RF08 | RF08, exceção E1 (v2.0); RN-08.2 | Nenhum | Todos os dados do ex-representado | ok |

## Cobertura dos requisitos funcionais

Os 59 RF aparecem em pelo menos uma tela. Onde o ator é o Sistema, a coluna da direita diz como a tela o consome.

| RF | Requisito | Telas | Ator Sistema |
|---|---|---|---|
| RF01 | Autenticação | G-01, G-02, G-03, G-07, G-07b |  |
| RF02 | Ciclo de vida da credencial | G-04a, G-04b, G-05, G-06, G-10 |  |
| RF03 | Gestão de usuários e papéis | A-03, A-04 |  |
| RF04 | Controle de acesso baseado em papel (RBAC) | G-08a, G-08b | O sistema aplica o papel da sessão a menus e rotas |
| RF05 | Vínculo paciente–médico | A-08a, A-31, M-01, M-02a, S-03a | O sistema mantém o estado do vínculo; o médico só dispara a promoção ao chamar o paciente |
| RF06 | Acesso clínico de exceção | A-01, A-31, M-02a, M-02h |  |
| RF07 | Gestão de pacientes | A-02a, A-02b, M-02a, S-01a, S-01b, P-06 |  |
| RF08 | Responsável legal e paciente menor de idade | G-04b, G-09, A-02b, S-01b, S-06, R-01, R-06, R-07 |  |
| RF09 | Acesso ao portal | G-04a, G-04b, A-02a, A-02b, A-04, S-01a, S-01b |  |
| RF10 | Cadastro de médicos | A-03 |  |
| RF11 | Cadastro de convênios | A-05 |  |
| RF12 | Catálogo de procedimentos e serviços | A-06 |  |
| RF13 | Cadastro de grade de horários | A-07, A-07b, A-07c, A-07d, A-10, M-03, S-02, S-05a |  |
| RF14 | Bloqueio de agenda e exceções | A-07, A-07c, A-07d, A-11a, M-03, S-02, S-05b |  |
| RF15 | Observações Gerais | M-02a, S-01c |  |
| RF16 | Solicitação de consulta | A-07, A-07b, A-07c, A-07d, A-08a, A-08b, M-03, S-02, S-03a, S-03b, P-01, P-02, P-03, R-01, R-02, R-03 |  |
| RF17 | Registro do convênio da consulta | A-08a, S-03a, S-06, P-02, R-02 |  |
| RF18 | Bloqueio de duplicidade e concorrência | A-08b, S-03b, P-02, R-02 | O banco recusa a duplicidade; a tela mostra o conflito |
| RF19 | Cancelamento pelo titular | P-03, R-03 |  |
| RF20 | Reagendamento e cancelamento pela clínica | A-11a, A-11b, S-02, S-04, S-05b |  |
| RF21 | Notificações e lembretes | A-11a, A-11b, A-32, S-04, S-06 | O sistema envia; as telas mostram o resultado e a lista de contato manual |
| RF22 | Fila de atendimento do dia | A-01, A-07, A-09, M-01, S-06, P-01, R-01 |  |
| RF23 | Registro de anamnese | M-02b, M-02c |  |
| RF24 | Retificação de prontuário | M-02c |  |
| RF25 | Prescrição médica | M-02d |  |
| RF26 | Anexo de exames, envio | M-02e, M-06, S-01d, P-04, R-04 |  |
| RF27 | Anexo de exames, visualização | M-02e, S-01d, P-04, R-04 |  |
| RF28 | Anotações privadas | M-02f |  |
| RF29 | Exportação do histórico de atendimentos | A-02a, M-02g, S-01a, P-04, R-04 |  |
| RF30 | Exportação do prontuário completo | M-02g, P-04, R-04 |  |
| RF31 | Orçamentos | A-01, A-18, M-04, S-10, P-01, P-05b, R-01, R-05b |  |
| RF32 | Contas a receber e baixa financeira | A-13a, S-08 |  |
| RF33 | Emissão de recibos | A-19, S-11, P-05a, R-05a |  |
| RF34 | Emissão de NFS-e | A-19, P-05a, R-05a |  |
| RF35 | Painel financeiro consolidado | A-12 |  |
| RF36 | Cadastro e inventário de produtos | A-26, M-05a, S-17 |  |
| RF37 | Movimentação de estoque | A-27, M-05b, S-18, P-04, R-04 |  |
| RF38 | Alertas de estoque mínimo e de validade | A-28, M-01, M-05a, S-06, S-19 | O sistema recalcula os alertas a cada movimentação e uma vez por dia |
| RF39 | Direitos do titular dos dados | A-01, A-33, S-01a, P-06, R-06 |  |
| RF40 | Log de auditoria | G-03, G-08a, G-08b, G-09, A-31, A-34 | O sistema registra; só o Administrador lê |
| RF41 | Dashboard gerencial | A-16, A-29 |  |
| RF42 | Relatórios administrativos cruzados | A-24, A-30 |  |
| RF43 | Cobrança e checkout | A-13b, S-07a, S-08, P-01, P-05a, R-01, R-05a |  |
| RF44 | Pagamento por Pix | S-07b, P-05a, R-05a |  |
| RF45 | Cartão via TEF integrado | S-07c |  |
| RF46 | Cartão via POS não integrado | S-07d |  |
| RF47 | Dinheiro e controle de caixa | A-01, A-16, S-09 |  |
| RF48 | Cancelamento e estorno | A-01, A-15, A-17, S-12, P-05a, R-05a |  |
| RF49 | Conciliação de recebíveis | A-15 |  |
| RF50 | Contas a pagar e despesas | A-12, A-14 |  |
| RF51 | Contrato e tabelas da operadora | A-20 |  |
| RF52 | Elegibilidade do beneficiário | A-21, S-03a, S-13 |  |
| RF53 | Autorização prévia | A-21, M-06, S-13 |  |
| RF54 | Geração de guias TISS | A-22, S-14 |  |
| RF55 | Envio de lote e protocolo | A-23, S-15 |  |
| RF56 | Demonstrativo e registro de glosa | A-24, S-16a |  |
| RF57 | Recurso de glosa | A-01, A-25, M-06, S-16b |  |
| RF58 | Coparticipação | A-21, S-07a, S-13, P-05a, R-05a |  |
| RF59 | Configuração, histórico e reenvio de notificações | A-32, S-06, P-06, R-06 |  |

## Onde cada regra de confidencialidade é verificada

| RC | Regra | Ponto de verificação na interface |
|---|---|---|
| RC01 | Princípio geral do mínimo necessário | Coluna "Dados ocultos neste papel" de todas as linhas; G-08a |
| RC02 | Matriz de visibilidade por documento | A-02a e A-02b (sem Observações Gerais e sem anexos); S-01d (só metadados); S-06, A-09 e A-07 (fila e agenda sem dado clínico); M-02b a M-02f (clínico só para o médico) |
| RC03 | Bloqueio em três camadas | MenuLateral por papel (camada 1, interface); G-08a (camada 2, rota recusada antes de qualquer consulta); A-02b (camada 3, campo ausente da resposta); G-08b; A-31 (negações registradas) |
| RC04 | Anotações privadas fora das exportações | M-02g, P-04, R-04; M-02f |
| RC05 | Vínculo como base da autorização clínica | M-02a (filtro por vínculo); M-01 (Chamar concede acesso); M-02h (exceção); G-08b |
| RC06 | Níveis de dado financeiro e regra de derivação | S-08 (sem soma); S-09 (fechamento cego); S-15 (sem total do lote); S-16a (sem índice de glosa); S-17 e M-05a (sem custo); A-12, A-14, A-15, A-29 (nível 3 só no Administrador) |
| RC07 | Fronteira das Observações Gerais | S-01c (aviso permanente no campo) |
| RC08 | Dispensação identificada | S-18 (só a confirmação do ato); A-27 e A-30 (só agregado); M-05b |
| RC09 | Exceção: escopo clínico do orçamento | A-18 (só a fila de aprovação pendente; sem justificativa clínica; cada abertura registrada); A-31 |
| RC10 | Exceção: item de guia TISS | S-13, S-14, S-16b, A-21, A-22, A-25 (CID só como código; envelope fechado); M-06 (só o médico preenche CID e justificativa) |

Em todas elas a interface é a camada mais fraca: a rota e o campo precisam ser recusados no servidor (RC03).

## Matriz consolidada papel × funcionalidade

A v2.1 não traz esta matriz. Ela existe na seção 6 da Especificação v2.0, com cinco papéis e os onze verbos, e está copiada abaixo sem alteração de conteúdo (62 linhas; colunas na ordem do redesenho). "—" significa nenhuma permissão, nem leitura: a rota recusa e registra.

| Funcionalidade | Administrador | Médico | Secretária | Paciente | Responsável Legal |
|---|---|---|---|---|---|
| **Módulo 1 – Identidade e controle de acesso** | | | | | |
| Autenticação (RF01) | Executar | Executar | Executar | Executar | Executar |
| Ciclo de vida da própria credencial (RF02) | Executar (própria) | Executar (própria) | Executar (própria) | Executar (própria) | Executar (própria) |
| Gestão de usuários e papéis (RF03) | Criar, Consultar, Editar, Inativar | — | — | — | — |
| Consulta do estado do vínculo (RF05) | Consultar (todos) | Consultar (próprios) | — | — | — |
| Acesso clínico de exceção (RF06) | Consultar, Executar (revogar) | Executar (solicitar) | — | — | — |
| **Módulo 2 – Cadastros base** | | | | | |
| Cadastro de pacientes (RF07) | Criar, Consultar, Editar, Inativar | Consultar | Criar, Consultar, Editar, Inativar | Consultar (próprio), Executar correção (próprio) | Consultar (representado), Executar correção (representado) |
| Responsável legal e representação (RF08) | Criar, Consultar, Editar, Inativar | Consultar | Criar, Consultar, Editar | Consultar (próprio) | Consultar (próprio vínculo) |
| Convite de acesso ao portal (RF09) | Executar | — | Executar | — | — |
| Cadastro de médicos (RF10) | Criar, Consultar, Editar, Inativar | Consultar (próprio completo, demais apenas nome e especialidade) | Consultar | Consultar (nome, especialidade, registro) | Consultar (nome, especialidade, registro) |
| Cadastro de convênios (RF11) | Criar, Consultar, Editar, Inativar | Consultar | Consultar | Consultar | Consultar |
| Catálogo de procedimentos, dados descritivos (RF12) | Criar, Consultar, Editar, Inativar | Consultar | Consultar | Consultar | Consultar |
| Catálogo de procedimentos, preço de tabela (RF12) | Criar, Consultar, Editar | — | Consultar | Consultar apenas no próprio orçamento, cobrança ou recibo | Consultar apenas no do representado |
| Grade de horários (RF13) | Criar, Consultar, Editar, Inativar | Consultar (própria) | Criar, Consultar, Editar, Inativar | Consultar disponibilidade | Consultar disponibilidade |
| Bloqueio de agenda e motivo (RF14) | Criar, Consultar, Editar, Inativar | Criar (própria), Consultar (própria) | Criar, Consultar, Editar, Inativar | — | — |
| Observações Gerais (RF15) | — | Consultar | Criar, Consultar, Editar | — | — |
| **Módulo 3 – Agendamento e fila** | | | | | |
| Agendamento de consulta (RF16) | Criar, Consultar | Consultar (própria agenda) | Criar, Consultar | Criar (próprio), Consultar (próprio) | Criar (representado), Consultar (representado) |
| Convênio da consulta (RF17) | Criar, Consultar, Editar | Consultar | Criar, Consultar, Editar | Criar (próprio, sujeito a conferência), Consultar (próprio) | Criar (representado, sujeito a conferência), Consultar |
| Cancelamento pelo titular (RF19) | — | — | — | Executar (próprio, respeitando X08) | Executar (representado, respeitando X08) |
| Reagendamento e cancelamento pela clínica (RF20) | Executar | — | Executar | — | — |
| Notificações: recebimento (RF21) | — | — | — | Destinatário | Destinatário |
| Notificações: configuração, histórico e reenvio (RF59) | Criar, Consultar, Editar, Executar reenvio | — | Consultar, Executar reenvio | Consultar (próprias), Executar revogação de canal | Consultar (representado), Executar revogação |
| Fila de atendimento do dia (RF22) | Consultar | Consultar (própria), Editar status (própria) | Consultar, Editar status | Consultar posição e status da própria consulta | Consultar (representado) |
| **Módulo 4 – Prontuário médico** | | | | | |
| Anamnese, exame físico e diagnóstico (RF23) | — | Criar, Consultar (equipe) | — | Consultar via exportação (RF30) | Consultar via exportação (representado) |
| Retificação de prontuário (RF24) | — | Retificar (equipe, apenas registro próprio) | — | — | — |
| Prescrição médica (RF25) | — | Criar, Consultar, Editar antes do selamento, Retificar depois | — | Consultar via exportação | Consultar via exportação |
| Anexo de exames: envio (RF26) | — | Criar | Criar | Criar (próprio, em área de recebimento) | Criar (representado) |
| Anexo de exames: conteúdo (RF27) | — | Consultar (equipe) | Consultar metadados | Consultar (próprio) | Consultar (representado) |
| Anotações privadas (RF28) | — | Criar, Consultar, Editar, Excluir (equipe, apenas as próprias) | — | — | — |
| Exportação, histórico de atendimentos (RF29) | Exportar | Exportar | Exportar | Exportar (próprio) | Exportar (representado) |
| Exportação, prontuário completo (RF30) | — | Exportar (equipe) | — | Exportar (próprio) | Exportar (representado) |
| **Módulo 5 – Orçamento, recibo e nota fiscal** | | | | | |
| Orçamento: escopo clínico (RF31) | Consultar (limitado pela RC09) | Criar, Editar (equipe) | Consultar | Consultar (próprio) | Consultar (representado) |
| Orçamento: valores (RF31) | Consultar | — | Criar, Editar | Consultar (próprio) | Consultar (representado) |
| Orçamento: aprovação (RF31) | Aprovar | — | — | Aprovar aceite (próprio) | Aprovar aceite (representado) |
| Recibo (RF33) | Criar, Editar parâmetros fiscais, Consultar | — | Emitir, Consultar | Consultar (próprio) | Consultar (representado) |
| NFS-e (RF34) | Emitir, Criar, Editar configuração, Consultar | — | — | Consultar (própria) | Consultar (representado) |
| Painel financeiro consolidado (RF35) | Consultar | — | — | — | — |
| **Módulo 6 – Recebimento e checkout** | | | | | |
| Cobrança e checkout (RF43) | Criar, Consultar, Editar antes do pagamento | — | Criar, Consultar, Executar checkout | Consultar (própria), Executar pagamento pelo portal | Consultar (representado), Executar pagamento |
| Pagamento por Pix (RF44) | Consultar, Editar configuração do PSP | — | Executar (gerar QR e confirmar) | Executar (pagar) | Executar (pagar) |
| Pagamento por cartão via TEF (RF45) | Consultar, Editar configuração do terminal | — | Executar | Autoriza no PIN-pad, sem acesso ao sistema | Autoriza no PIN-pad |
| Pagamento por cartão via POS não integrado (RF46) | Consultar | — | Criar lançamento, Consultar | — | — |
| Pagamento em dinheiro e caixa (RF47) | Consultar, Aprovar fechamento com divergência | — | Criar, Consultar, Executar abertura e fechamento | — | — |
| Cancelamento e estorno de transação (RF48) | Aprovar, Estornar | — | Executar solicitação | Consultar (próprio) | Consultar (representado) |
| Conciliação de recebíveis (RF49) | Consultar, Executar, Aprovar tratamento de divergência | — | — | — | — |
| Contas a pagar (RF50) | Criar, Consultar, Editar, Inativar, Estornar | — | — | — | — |
| **Módulo 7 – Faturamento de convênio** | | | | | |
| Contrato e tabelas da operadora (RF51) | Criar, Consultar, Editar, Inativar | — | Consultar | — | — |
| Verificação de elegibilidade (RF52) | Consultar | Consultar resultado | Executar, Consultar | Consultar (próprio resultado) | Consultar (representado) |
| Autorização prévia (RF53) | Consultar | Criar indicação clínica e CID, Consultar | Executar solicitação, Consultar | Consultar status (próprio) | Consultar status |
| Guia TISS (RF54) | Consultar (limitado pela RC10) | Criar campos clínicos, Consultar (equipe) | Criar, Consultar, Editar antes do envio | — | — |
| Lote e protocolo (RF55) | Consultar, Executar | — | Executar, Consultar | — | — |
| Demonstrativo e registro de glosa (RF56) | Consultar | — | Executar importação, Consultar | — | — |
| Recurso de glosa (RF57) | Aprovar, Consultar | Criar anexo de fundamentação clínica (equipe) | Criar, Executar envio | — | — |
| Coparticipação (RF58) | Consultar | — | Criar cobrança, Consultar | Consultar (própria), Executar pagamento | Consultar, Executar pagamento |
| **Módulo 8 – Estoque** | | | | | |
| Cadastro de produtos e lotes (RF36) | Criar, Consultar, Editar, Inativar | Consultar disponibilidade | Criar, Consultar, Editar, Inativar | — | — |
| Custo de aquisição (RF36) | Criar, Consultar, Editar | — | — | — | — |
| Movimentação: entrada (RF37) | Criar | — | Criar | — | — |
| Movimentação: saída (RF37) | — | Criar | Criar | — | — |
| Histórico de dispensação por paciente (RF37) | Consultar (agregado) | Consultar (equipe) | — | Consultar (próprio) | Consultar (representado) |
| Alertas de estoque mínimo e validade (RF38) | Consultar | Consultar (alertas de validade dos itens dispensáveis) | Consultar | — | — |
| **Módulo 9 – Privacidade, relatórios e auditoria** | | | | | |
| Direitos do titular (RF39) | Executar tratamento, Consultar | — | Criar registro de solicitação, Consultar | Criar solicitação (própria), Consultar | Criar solicitação (representado), Consultar |
| Log de auditoria (RF40) | Consultar | — | — | — | — |
| Dashboard gerencial (RF41) | Consultar | — | — | — | — |
| Relatórios cruzados (RF42) | Consultar, Exportar | — | — | — | — |

### Onde o redesenho difere da matriz da v2.0

| Ponto | Matriz ou texto da v2.0 | Redesenho | Decisão |
|---|---|---|---|
| Na Recepção → Em Atendimento | Médico ou Secretária | Só o Médico, com "Chamar paciente" | D1 |
| Anotações privadas | A RC02 e o passo 1 do RF28 falam em médicos da equipe; a matriz, em "apenas as próprias" | Só o autor vê | D2 |
| Fechamento de caixa | O sistema apresenta o saldo esperado ao operador (RF47, passo 4) | Fechamento cego para a Secretária; o esperado aparece só ao Administrador | D5 |
| Total do lote TISS | Não trata | Oculto para a Secretária | D9 |
| Sigilo do adolescente | Não trata | Registro marcado some das telas e exportações do Responsável Legal | D3 |
| Destino do Administrador depois do login | Painel financeiro (RF01) | Início › Painel do dia | D28 |
| Excesso de tentativas de login | Mensagem "Conta temporariamente bloqueada" | Texto neutro para qualquer e-mail | D28 |

Nos demais pontos o redesenho segue a matriz, inclusive onde ela contraria o pedido original: o Administrador não executa checkout, não emite recibo, não registra saída de estoque e só consulta guias (D27), e o Médico registra a própria indisponibilidade (D28).
