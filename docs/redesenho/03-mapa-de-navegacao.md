# 03 · Mapa de navegação

Árvore final de menus por papel e, para cada tela, de onde se chega e para onde se vai. Os códigos são os de [02-matriz-por-papel.md](02-matriz-por-papel.md).

## Regras do menu

- `MenuLateral` tem uma variante por papel. Submenus abrem em acordeão dentro da barra, por clique. Não há flyout por hover, porque as telas clínicas são usadas em tablet (RNF17).
- O grupo da tela atual fica aberto e o item ativo é o da tela. Hoje o primeiro item fica ativo em todos os frames com menu.
- Item sem permissão não aparece. A rota continua recusada no servidor (RC03).
- `Head` mostra nome e papel. O menu do avatar tem Meu perfil (G-10), Alterar senha (G-10) e Sair (G-01).
- Papéis sem submenu (Médico, Paciente, Responsável Legal) têm menu plano. As telas filhas do Médico abrem a partir do paciente, não do menu.
- Ícones: Material Icons, o mesmo conjunto do código. Cadastro, Agenda, Fila do dia, Financeiro e Estoque usam os que o `menu-lateral.js` já importa; os demais são proposta.

## Árvore de menus

### A · Administrador

- **Início** `home`
  - Painel do dia → A-01
- **Cadastro** `how_to_reg`
  - Pacientes → A-02a, A-02b
  - Médicos → A-03
  - Equipe · usuários e papéis → A-04
  - Convênios → A-05
  - Procedimentos e preços → A-06
- **Agenda** `calendar_month`
  - Agenda da clínica → A-07, A-07b, A-07c, A-07d
  - Novo agendamento → A-08a, A-08b
  - Fila do dia · leitura → A-09
  - Grade de horários → A-10
  - Bloqueios e consultas afetadas → A-11a, A-11b
- **Financeiro** `payments`
  - Painel financeiro → A-12
  - Contas a receber → A-13a, A-13b
  - Contas a pagar → A-14
  - Conciliação → A-15
  - Caixas · supervisão → A-16
  - Cancelamentos e estornos → A-17
  - Orçamentos · aprovação → A-18
  - Recibos e NFS-e → A-19
- **Faturamento TISS** `fact_check`
  - Contratos e tabelas → A-20
  - Elegibilidade e autorizações → A-21
  - Guias TISS → A-22
  - Lotes e protocolos → A-23
  - Demonstrativos e glosas → A-24
  - Recursos de glosa → A-25
- **Estoque** `inventory_2`
  - Produtos e lotes → A-26
  - Movimentações → A-27
  - Alertas → A-28
- **Gestão** `insights`
  - Dashboard gerencial → A-29
  - Relatórios → A-30
  - Log de auditoria → A-31
  - Notificações → A-32
  - Solicitações dos titulares (LGPD) → A-33
  - Parâmetros do sistema → A-34

Entrada do papel: Início › Painel do dia (A-01).

### M · Médico

- **Atendimentos do dia** `format_list_numbered` → M-01
- **Meus pacientes** `groups` → M-02a, M-02b, M-02c, M-02d, M-02e, M-02f, M-02g, M-02h
- **Minha agenda** `calendar_month` → M-03
- **Orçamentos** `request_quote` → M-04
- **Estoque** `inventory_2` → M-05a, M-05b
- **Pendências clínicas** `pending_actions` → M-06

Entrada do papel: Atendimentos do dia (M-01).

### S · Secretária

- **Cadastro** `how_to_reg`
  - Pacientes → S-01a, S-01b, S-01c, S-01d
- **Agenda** `calendar_month`
  - Agenda da clínica → S-02
  - Novo agendamento → S-03a, S-03b
  - Reagendar ou cancelar → S-04
  - Grade e bloqueios → S-05a, S-05b
- **Fila do dia** `format_list_numbered` → S-06
- **Caixa e cobranças** `payments`
  - Checkout → S-07a, S-07b, S-07c, S-07d
  - Cobranças do dia → S-08
  - Meu caixa → S-09
  - Orçamentos · valores → S-10
  - Recibos → S-11
  - Estornos · solicitar → S-12
- **Faturamento TISS** `fact_check`
  - Elegibilidade e autorização → S-13
  - Guias TISS → S-14
  - Lotes e protocolos → S-15
  - Glosas e recursos → S-16a, S-16b
- **Estoque** `inventory_2`
  - Produtos e lotes → S-17
  - Movimentações → S-18
  - Alertas → S-19

Entrada do papel: Fila do dia (S-06).

### P · Paciente

- **Início** `home` → P-01
- **Agendar consulta** `event_available` → P-02
- **Meus agendamentos** `event_note` → P-03
- **Meus documentos** `folder_shared` → P-04
- **Orçamentos e cobranças** `receipt_long` → P-05a, P-05b
- **Meus dados e privacidade** `privacy_tip` → P-06

Entrada do papel: Início (P-01). Nenhuma rota do portal recebe identificador de paciente na URL (A1-R11).

### R · Responsável Legal

- **Início** `home` → R-01
- **Agendar consulta** `event_available` → R-02
- **Agendamentos** `event_note` → R-03
- **Documentos** `folder_shared` → R-04
- **Orçamentos e cobranças** `receipt_long` → R-05a, R-05b
- **Dados do representado** `privacy_tip` → R-06

Entrada do papel: G-09 quando há mais de um representado; senão, Início (R-01). Faixa fixa no cabeçalho: "Representando: {nome} · Trocar". Fora do menu: R-07 Acesso encerrado por maioridade.

### G · Geral

Sem menu lateral: G-01 a G-07, G-09 e G-11. Mantêm o menu do papel: G-07b (modal sobre a tela), G-08a, G-08b e G-10.

## De onde se chega e para onde se vai

### G · Geral

| Tela | De onde se chega | Para onde vai |
|---|---|---|
| **G-01** Login | Endereço público; G-07; "Sair" no menu do avatar | Tela de entrada do papel: A-01, M-01, S-06, P-01; Responsável Legal vai a G-09 (mais de um representado) ou R-01. Falha: G-02. Excesso: G-03. Link: G-05 |
| **G-02** Login · credencial inválida | G-01 | G-01 (nova tentativa); G-03; G-05 |
| **G-03** Login · muitas tentativas | G-02 após X01 falhas em X02 | G-01 depois de X03; G-05 |
| **G-04a** Primeiro acesso por convite · Paciente | Link do convite (e-mail) | P-01; link expirado ou tentativas esgotadas: mensagem para pedir novo convite à recepção |
| **G-04b** Primeiro acesso por convite · Responsável Legal | Link do convite (e-mail) | G-09 ou R-01 |
| **G-05** Recuperar senha · solicitação | G-01, G-02, G-03 | G-01 (com a resposta neutra); G-06 pelo link do e-mail |
| **G-06** Recuperar senha · nova senha | Link do e-mail (token X05, uso único) | G-01 |
| **G-07** Sessão expirada | Qualquer tela autenticada, por inatividade | G-01; depois do login volta à rota anterior só se for o mesmo usuário |
| **G-07b** Aviso de expiração · modal | Qualquer tela autenticada, 60 s antes de expirar | Permanece na tela; "Sair" leva a G-01; sem resposta leva a G-07 |
| **G-08a** Acesso negado · por papel | Rota fora do papel (URL digitada ou link antigo) | Tela de entrada do papel ("Voltar ao início") |
| **G-08b** Acesso negado · por registro | Registro fora do alcance do usuário (sem vínculo, de outro titular, inexistente) | Tela de entrada do papel |
| **G-09** Seletor de paciente representado | G-01 (mais de um representado); "Trocar" na FaixaRepresentado | R-01 |
| **G-10** Meu perfil · alterar senha | Menu do avatar, em qualquer tela autenticada | Volta à tela de origem |
| **G-11** Erro inesperado | Falha não tratada em qualquer tela | Tela de entrada do papel; tentar de novo |

### A · Administrador

| Tela | De onde se chega | Para onde vai |
|---|---|---|
| **A-01** Início › Painel do dia | G-01 (entrada do papel); marca no cabeçalho | A-09 (consultas do dia); A-17 (estornos); A-16 (divergências de caixa); A-18 (orçamentos); A-25 (recursos mantidos); A-33 (LGPD); A-31 filtrado (acessos de exceção) |
| **A-02a** Cadastro › Pacientes · listagem | Menu Cadastro | A-02b; A-08a (agendar); convite de portal (modal) |
| **A-02b** Cadastro › Pacientes · cadastro | A-02a | A-02a |
| **A-03** Cadastro › Médicos | Menu Cadastro | A-10 (grade do médico); A-04 (conta criada no mesmo fluxo) |
| **A-04** Cadastro › Equipe · usuários e papéis | Menu Cadastro | A-03 (contas de Médico); A-02a (contas de portal, só por convite) |
| **A-05** Cadastro › Convênios | Menu Cadastro | A-20 (contrato da operadora) |
| **A-06** Cadastro › Procedimentos e preços | Menu Cadastro | A-20 (preço negociado por operadora) |
| **A-07** Agenda › Agenda da clínica | Menu Agenda | A-08a (horário livre); A-11a (bloquear); A-09 (dia de hoje) |
| **A-07b** Agenda › Agenda da clínica · visão Ano | A-07 (seletor de visão) | A-07 (um dia do mapa abre a visão Dia) |
| **A-07c** Agenda › Agenda da clínica · visão Semana | A-07 (seletor de visão) | A-08a (novo agendamento) |
| **A-07d** Agenda › Agenda da clínica · visão Mês | A-07 (seletor de visão) | A-07 (um dia do mês abre a visão Dia) |
| **A-08a** Agenda › Novo agendamento | A-07; A-02a | A-07; A-08b em caso de conflito |
| **A-08b** Agenda › Novo agendamento · conflito de horário | A-08a | A-08a |
| **A-09** Agenda › Fila do dia · leitura | Menu Agenda; A-01 | A-07 |
| **A-10** Agenda › Grade de horários | Menu Agenda; A-03 | A-11a quando a redução atinge horário agendado |
| **A-11a** Agenda › Bloqueios e consultas afetadas | Menu Agenda; A-07; A-10 | A-11b (tratar afetadas) |
| **A-11b** Agenda › Bloqueios e consultas afetadas · reagendamento em lote | A-11a | A-11a; A-07 |
| **A-12** Financeiro › Painel financeiro | Menu Financeiro | Cada número abre a origem: A-13a, A-14, A-15 |
| **A-13a** Financeiro › Contas a receber | Menu Financeiro; A-12 | A-13b (cobrança); A-17 (estorno); A-24 (título glosado) |
| **A-13b** Financeiro › Contas a receber · cobrança | A-13a | A-13a; o recebimento acontece em S-07a ou no portal (P-05a) |
| **A-14** Financeiro › Contas a pagar | Menu Financeiro; A-12 | A-15 (despesa de taxa gerada pela conciliação) |
| **A-15** Financeiro › Conciliação | Menu Financeiro; A-12 | A-13a; A-14; A-17 |
| **A-16** Financeiro › Caixas · supervisão | Menu Financeiro; A-01 | A-31 (registro da divergência) |
| **A-17** Financeiro › Cancelamentos e estornos | Menu Financeiro; A-01; A-13a | A-13a; A-15 |
| **A-18** Financeiro › Orçamentos · aprovação | Menu Financeiro; A-01 | A-13a (cobrança nasce depois do aceite do titular) |
| **A-19** Financeiro › Recibos e NFS-e | Menu Financeiro; A-13a | A-13a |
| **A-20** Faturamento TISS › Contratos e tabelas | Menu Faturamento TISS; A-05 | A-06; A-23 |
| **A-21** Faturamento TISS › Elegibilidade e autorizações | Menu Faturamento TISS | A-22 |
| **A-22** Faturamento TISS › Guias TISS | Menu Faturamento TISS; A-21 | A-23; A-13a (título com devedor operadora) |
| **A-23** Faturamento TISS › Lotes e protocolos | Menu Faturamento TISS; A-22 | A-24 |
| **A-24** Faturamento TISS › Demonstrativos e glosas | Menu Faturamento TISS; A-23; A-13a | A-25; A-30 |
| **A-25** Faturamento TISS › Recursos de glosa | Menu Faturamento TISS; A-24; A-01 | A-13a |
| **A-26** Estoque › Produtos e lotes | Menu Estoque | A-27; A-28; A-14 (entrada por compra) |
| **A-27** Estoque › Movimentações | Menu Estoque; A-26 | A-26; A-14 |
| **A-28** Estoque › Alertas | Menu Estoque | A-26 |
| **A-29** Gestão › Dashboard gerencial | Menu Gestão | A-30; A-24 (índice de glosa); A-16 (divergência de caixa) |
| **A-30** Gestão › Relatórios | Menu Gestão; A-29 | Download do relatório |
| **A-31** Gestão › Log de auditoria | Menu Gestão; A-01 | — |
| **A-32** Gestão › Notificações | Menu Gestão | — |
| **A-33** Gestão › Solicitações dos titulares (LGPD) | Menu Gestão; A-01 | — |
| **A-34** Gestão › Parâmetros do sistema | Menu Gestão | A-20 (X37 a X39, X50); A-10 (X11, X12); A-26 (X46) |

### M · Médico

| Tela | De onde se chega | Para onde vai |
|---|---|---|
| **M-01** Atendimentos do dia | G-01 (entrada do papel) | M-02b (ao chamar); M-02c (consulta finalizada) |
| **M-02a** Meus pacientes · lista | Menu Meus pacientes | M-02b a M-02g (com vínculo); M-02h (sem vínculo) |
| **M-02b** Meus pacientes › Prontuário · anamnese em edição | M-01 (Chamar); M-02a | M-02d; M-02e; M-02f; M-02c depois de selar |
| **M-02c** Meus pacientes › Prontuário · registro selado e retificação | M-02a; M-01 | M-02g |
| **M-02d** Meus pacientes › Prescrição | M-02b | M-02b; M-05b (dispensar) |
| **M-02e** Meus pacientes › Anexos | M-02b; M-02a; M-06 | M-02b |
| **M-02f** Meus pacientes › Anotações privadas | M-02b; M-02a | M-02b |
| **M-02g** Meus pacientes › Exportações | M-02a; M-02c | Download por link que expira em X42 |
| **M-02h** Meus pacientes › Acesso de exceção | M-02a (busca de paciente sem vínculo) | M-02c por X07 |
| **M-03** Minha agenda | Menu Minha agenda | M-02a (paciente) |
| **M-04** Orçamentos · etapa 1 · escopo clínico | Menu Orçamentos; M-02b | M-04 (lista) |
| **M-05a** Estoque · disponibilidade | Menu Estoque | M-05b |
| **M-05b** Estoque · saída por lote | M-05a; M-02d | M-05a |
| **M-06** Pendências clínicas | Menu Pendências clínicas | M-02e; M-02b |

### S · Secretária

| Tela | De onde se chega | Para onde vai |
|---|---|---|
| **S-01a** Cadastro › Pacientes · listagem | Menu Cadastro | S-01b; S-01c; S-01d; S-03a |
| **S-01b** Cadastro › Pacientes · cadastro | S-01a | S-01a; S-01c |
| **S-01c** Cadastro › Pacientes · Observações Gerais | S-01b | S-01b |
| **S-01d** Cadastro › Pacientes · anexos · só metadados | S-01b | S-01b |
| **S-02** Agenda › Agenda da clínica | Menu Agenda | S-03a; S-04; S-05b; S-06 |
| **S-03a** Agenda › Novo agendamento | S-02; S-01a; S-06 | S-02; S-03b |
| **S-03b** Agenda › Novo agendamento · conflito de horário | S-03a | S-03a |
| **S-04** Agenda › Reagendar ou cancelar | S-02; S-06; S-05b | S-02 |
| **S-05a** Agenda › Grade e bloqueios · grade | Menu Agenda | S-05b |
| **S-05b** Agenda › Grade e bloqueios · bloqueio e consultas afetadas | S-05a; S-02 | S-04 |
| **S-06** Fila do dia | G-01 (entrada do papel); menu | S-07a (cobrar); S-04; S-03a; S-13 (convênio a conferir); S-19 |
| **S-07a** Caixa e cobranças › Checkout · seleção de meio | S-06; S-08 | S-07b; S-07c; S-07d; dinheiro (S-09) |
| **S-07b** Caixa e cobranças › Checkout · Pix | S-07a | S-11; S-08 |
| **S-07c** Caixa e cobranças › Checkout · cartão TEF | S-07a | S-11; S-07d (contingência) |
| **S-07d** Caixa e cobranças › Checkout · cartão POS avulso | S-07a; S-07c | S-11; S-08 |
| **S-08** Caixa e cobranças › Cobranças do dia | Menu Caixa e cobranças | S-07a; S-11; S-12 |
| **S-09** Caixa e cobranças › Meu caixa | Menu Caixa e cobranças; S-07a (dinheiro) | Aguarda aprovação do Administrador (A-16) |
| **S-10** Caixa e cobranças › Orçamentos · valores | Menu Caixa e cobranças | S-08 (depois do aceite do titular) |
| **S-11** Caixa e cobranças › Recibos | Menu Caixa e cobranças; S-07b a S-07d | S-08; S-12 |
| **S-12** Caixa e cobranças › Estornos · solicitar | Menu Caixa e cobranças; S-08; S-11 | Aguarda o Administrador (A-17) |
| **S-13** Faturamento TISS › Elegibilidade e autorização | Menu Faturamento TISS; S-06 | S-14; M-06 (pedido ao médico) |
| **S-14** Faturamento TISS › Guias TISS | Menu Faturamento TISS; S-13 | S-15 |
| **S-15** Faturamento TISS › Lotes e protocolos | Menu Faturamento TISS; S-14 | S-16a |
| **S-16a** Faturamento TISS › Glosas e recursos · demonstrativo e glosas | Menu Faturamento TISS; S-15 | S-16b |
| **S-16b** Faturamento TISS › Glosas e recursos · recurso de glosa | S-16a | M-06 (fundamentação); A-25 (recurso mantido) |
| **S-17** Estoque › Produtos e lotes | Menu Estoque | S-18; S-19 |
| **S-18** Estoque › Movimentações | Menu Estoque; S-17 | S-17 |
| **S-19** Estoque › Alertas | Menu Estoque; S-06 | S-17 |

### P · Paciente

| Tela | De onde se chega | Para onde vai |
|---|---|---|
| **P-01** Início | G-01; G-04a | P-03; P-05a; P-05b; P-02 |
| **P-02** Agendar consulta | Menu; P-01; P-03 (remarcar) | P-03 |
| **P-03** Meus agendamentos | Menu; P-01 | P-02 (remarcar é cancelar e agendar de novo) |
| **P-04** Meus documentos | Menu | Download por link que expira em X42 |
| **P-05a** Orçamentos e cobranças · cobranças | Menu; P-01 | P-05b |
| **P-05b** Orçamentos e cobranças · orçamento · aceite | P-05a; P-01 | P-05a (a cobrança nasce do aceite) |
| **P-06** Meus dados e privacidade | Menu | P-04 |

### R · Responsável Legal

| Tela | De onde se chega | Para onde vai |
|---|---|---|
| **R-01** Início | G-09; G-01 (um representado); G-04b | R-03; R-05a; R-05b; R-02 |
| **R-02** Agendar consulta | Menu; R-01 | R-03 |
| **R-03** Agendamentos | Menu; R-01 | R-02 |
| **R-04** Documentos | Menu | Download por link |
| **R-05a** Orçamentos e cobranças · cobranças | Menu; R-01 | R-05b |
| **R-05b** Orçamentos e cobranças · orçamento · aceite | R-05a; R-01 | R-05a |
| **R-06** Dados do representado | Menu | R-04 |
| **R-07** Acesso encerrado por maioridade | G-01 ou G-09, depois que o representado completa 18 anos | G-09 (outros representados) ou G-01 |

## Rotas no app

Desde 21/10/2026 o código segue o padrão de rotas da disciplina: cada entidade tem uma listagem em `/<papel>/listagem-<entidade>` e um cadastro em `/<papel>/cadastro-<entidade>/:idParam?`. Sem `idParam`, o cadastro cria; com ele, edita. O ícone Ver abre o mesmo cadastro em modo consulta (`?consulta`). Telas que não são listagem nem cadastro (painéis, agenda em grade, prontuário, dados do portal) mantêm o nome. As rotas anteriores continuam funcionando e redirecionam para as novas, inclusive as de antes do redesenho (`/listagem-cadastro`, `/listagem-filadia`, `/listagem-agenda`, `/listagem-financeiro` e `/listagem-estoque`). O portal continua sem identificador de paciente na URL (A1-R11), exceto o orçamento, que já levava o do próprio orçamento.

| Papel | Tela | Rota no app | Rota anterior (redireciona) |
|---|---|---|---|
| A | A-01 Painel do dia | `/admin/inicio` | — |
| A | A-02a Pacientes · listagem | `/admin/listagem-pacientes` | `/admin/pacientes` |
| A | A-02b Pacientes · cadastro | `/admin/cadastro-pacientes/:idParam?` | — |
| A | A-03 Médicos · listagem | `/admin/listagem-medicos` | `/admin/medicos` |
| A | A-03 Médicos · cadastro | `/admin/cadastro-medicos/:idParam?` | — |
| A | A-04 Equipe · listagem | `/admin/listagem-equipe` | `/admin/equipe` |
| A | A-04 Equipe · cadastro | `/admin/cadastro-equipe/:idParam?` | — |
| A | A-05 Convênios · listagem | `/admin/listagem-convenios` | `/admin/convenios` |
| A | A-05 Convênios · cadastro | `/admin/cadastro-convenios/:idParam?` | — |
| A | A-06 Procedimentos e preços · listagem | `/admin/listagem-procedimentos` | `/admin/procedimentos` |
| A | A-06 Procedimentos e preços · cadastro | `/admin/cadastro-procedimentos/:idParam?` | — |
| A | A-07 Agenda da clínica | `/admin/agenda` | — |
| A | A-08a Novo agendamento | `/admin/cadastro-agendamentos` | `/admin/agendamento` |
| A | A-09 Fila do dia · leitura | `/admin/listagem-fila-do-dia` | `/admin/fila` |
| A | A-10 Grade de horários | `/admin/grade` | — |
| A | A-11a Bloqueios · listagem | `/admin/listagem-bloqueios` | `/admin/bloqueios` |
| A | A-11a Bloqueios · cadastro | `/admin/cadastro-bloqueios/:idParam?` | — |
| A | A-12 Painel financeiro | `/admin/painel-financeiro` | — |
| A | A-13a Contas a receber | `/admin/listagem-contas-receber` | `/admin/contas-receber` |
| A | A-14 Contas a pagar · listagem | `/admin/listagem-contas-pagar` | `/admin/contas-pagar` |
| A | A-14 Contas a pagar · cadastro | `/admin/cadastro-contas-pagar/:idParam?` | — |
| A | A-15 Conciliação | `/admin/listagem-conciliacao` | `/admin/conciliacao` |
| A | A-16 Caixas · supervisão | `/admin/listagem-caixas` | `/admin/caixas` |
| A | A-17 Cancelamentos e estornos | `/admin/listagem-estornos` | `/admin/estornos` |
| A | A-18 Orçamentos · aprovação | `/admin/listagem-orcamentos` | `/admin/orcamentos` |
| A | A-19 Recibos e NFS-e | `/admin/listagem-recibos-nfse` | `/admin/recibos-nfse` |
| A | A-20 Contratos e tabelas | `/admin/listagem-contratos` | `/admin/contratos` |
| A | A-21 Elegibilidade e autorizações | `/admin/listagem-elegibilidades` | `/admin/elegibilidade` |
| A | A-22 Guias TISS | `/admin/listagem-guias` | `/admin/guias` |
| A | A-23 Lotes e protocolos | `/admin/listagem-lotes` | `/admin/lotes` |
| A | A-24 Demonstrativos e glosas | `/admin/listagem-glosas` | `/admin/glosas` |
| A | A-25 Recursos de glosa | `/admin/listagem-recursos-glosa` | `/admin/recursos` |
| A | A-26 Produtos e lotes · listagem | `/admin/listagem-produtos` | `/admin/produtos` |
| A | A-26 Produtos e lotes · cadastro | `/admin/cadastro-produtos/:idParam?` | — |
| A | A-27 Movimentações | `/admin/listagem-movimentacoes` | `/admin/movimentacoes` |
| A | A-28 Alertas | `/admin/listagem-alertas` | `/admin/alertas` |
| A | A-29 Dashboard gerencial | `/admin/dashboard` | — |
| A | A-30 Relatórios | `/admin/listagem-relatorios` | `/admin/relatorios` |
| A | A-31 Log de auditoria | `/admin/listagem-log-auditoria` | `/admin/log` |
| A | A-32 Notificações | `/admin/listagem-notificacoes` | `/admin/notificacoes` |
| A | A-33 Solicitações dos titulares (LGPD) | `/admin/listagem-solicitacoes` | `/admin/solicitacoes` |
| A | A-34 Parâmetros do sistema | `/admin/listagem-parametros` | `/admin/parametros` |
| M | M-01 Atendimentos do dia | `/medico/listagem-atendimentos` | `/medico/atendimentos` |
| M | M-02a Meus pacientes | `/medico/listagem-pacientes` | `/medico/pacientes` |
| M | M-02 Prontuário, em abas (M-02d a M-02g) | `/medico/prontuario/:id/:aba` | `/medico/pacientes/:id/:aba` |
| M | M-03 Minha agenda | `/medico/agenda` | — |
| M | M-04 Orçamentos · escopo clínico | `/medico/listagem-orcamentos` | `/medico/orcamentos` |
| M | M-05a Estoque · disponibilidade | `/medico/listagem-produtos` | `/medico/estoque` |
| M | M-06 Pendências clínicas | `/medico/listagem-pendencias` | `/medico/pendencias` |
| S | S-01a Pacientes · listagem | `/secretaria/listagem-pacientes` | `/secretaria/pacientes` |
| S | S-01b Pacientes · cadastro | `/secretaria/cadastro-pacientes/:idParam?` | — |
| S | S-01c Pacientes · Observações Gerais | `/secretaria/cadastro-pacientes/:idParam/observacoes` | — |
| S | S-01d Pacientes · anexos | `/secretaria/cadastro-pacientes/:idParam/anexos` | `/secretaria/pacientes/:id/anexos` |
| S | S-02 Agenda da clínica | `/secretaria/agenda` | — |
| S | S-03a Novo agendamento | `/secretaria/cadastro-agendamentos` | `/secretaria/agendamento` |
| S | S-04 Reagendar ou cancelar | `/secretaria/listagem-consultas` | `/secretaria/reagendar` |
| S | S-05b Bloqueios · listagem | `/secretaria/listagem-bloqueios` | `/secretaria/bloqueios` |
| S | S-05b Bloqueios · cadastro | `/secretaria/cadastro-bloqueios/:idParam?` | — |
| S | S-06 Fila do dia | `/secretaria/listagem-fila-do-dia` | `/secretaria/fila` |
| S | S-07a Checkout | `/secretaria/checkout` | — |
| S | S-08 Cobranças do dia | `/secretaria/listagem-cobrancas` | `/secretaria/cobrancas` |
| S | S-09 Meu caixa | `/secretaria/caixa` | — |
| S | S-10 Orçamentos · valores | `/secretaria/listagem-orcamentos` | `/secretaria/orcamentos` |
| S | S-11 Recibos | `/secretaria/listagem-recibos` | `/secretaria/recibos` |
| S | S-12 Estornos · solicitar | `/secretaria/listagem-estornos` | `/secretaria/estornos` |
| S | S-13 Elegibilidade e autorização | `/secretaria/listagem-elegibilidades` | `/secretaria/elegibilidade` |
| S | S-14 Guias TISS | `/secretaria/listagem-guias` | `/secretaria/guias` |
| S | S-15 Lotes e protocolos | `/secretaria/listagem-lotes` | `/secretaria/lotes` |
| S | S-16a Glosas e recursos | `/secretaria/listagem-glosas` | `/secretaria/glosas` |
| S | S-17 Produtos e lotes · listagem | `/secretaria/listagem-produtos` | `/secretaria/produtos` |
| S | S-17 Produtos e lotes · cadastro | `/secretaria/cadastro-produtos/:idParam?` | — |
| S | S-18 Movimentações | `/secretaria/listagem-movimentacoes` | `/secretaria/movimentacoes` |
| S | S-19 Alertas | `/secretaria/listagem-alertas` | `/secretaria/alertas` |
| P e R | P-01 e R-01 Início | `/portal/inicio` | — |
| P e R | P-02 e R-02 Agendar consulta | `/portal/cadastro-agendamentos` | `/portal/agendar` |
| P e R | P-03 e R-03 Agendamentos | `/portal/listagem-agendamentos` | `/portal/agendamentos` |
| P e R | P-04 e R-04 Documentos | `/portal/listagem-documentos` | `/portal/documentos` |
| P e R | P-05a e R-05a Orçamentos e cobranças | `/portal/listagem-cobrancas` | `/portal/cobrancas` |
| P e R | P-05b e R-05b Orçamento · aceite | `/portal/orcamentos/:id` | — |
| P e R | P-06 e R-06 Dados e privacidade | `/portal/dados` | — |
| R | G-09 Seletor de representado | `/portal/representado` | — |

## Percursos que atravessam papéis

| Percurso | Passos |
|---|---|
| Consulta do dia | S-03a agenda → S-06 check-in (Agendado → Na Recepção) → M-01 Chamar (Na Recepção → Em Atendimento) → M-02b registra → M-01 Finalizar e selar → S-06 abre S-07a para cobrar |
| Orçamento em quatro etapas | M-04 escopo → S-10 valores → A-18 aprova ou devolve → P-05b ou R-05b aceita ou recusa → cobrança aparece em S-08 e P-05a |
| Cobrança e estorno | S-07a escolhe o meio → S-07b, S-07c ou S-07d → S-11 recibo → S-12 pede estorno → A-17 aprova e estorna |
| Fechamento de caixa | S-09 informa o valor contado, sem ver o esperado → divergência com justificativa → A-16 aprova |
| Convênio | S-03a marca convênio → S-06 pendência de conferência → S-13 elegibilidade e autorização (M-06 justifica) → S-14 guia → S-15 lote → S-16a demonstrativo → S-16b recurso (M-06 fundamenta em envelope) → A-25 decide recurso mantido |
| Exame enviado pelo titular | P-04 ou R-04 envia → M-06 lista → M-02e aceita ou recusa com motivo → resultado no portal |
| Direitos do titular | P-06 ou R-06 pede, ou S-01a registra → A-33 analisa e responde em até 15 dias → P-06 mostra a resposta |
| Acesso de exceção | M-02a busca paciente sem vínculo → M-02h justifica → M-02c por X07 → A-01 mostra a pendência de revisão → A-31 |
| Negação | Rota fora do papel → G-08a; registro fora do alcance → G-08b; ambos gravam no log (A-31) |
