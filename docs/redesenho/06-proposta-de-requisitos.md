# 06 · Proposta de requisitos

Requisitos novos e alterações de texto que o redesenho pede. São **propostas**: nenhuma delas muda a v2.0 nem a v2.1 enquanto não for aprovada. A coluna "No redesenho" diz se a tela já foi desenhada assim.

Cada proposta nasce de uma de três situações: uma decisão do pedido que contraria o texto atual; uma tela do redesenho sem requisito que a sustente; ou um valor que os documentos deixam em aberto.

## 1. Alterações em requisitos existentes

| ID | Onde | Texto atual | Texto proposto | Por quê | No redesenho |
|---|---|---|---|---|---|
| PR-01 | RF22, máquina de estados | "Na Recepção → Em Atendimento: Médico ou Secretária". "Em Atendimento → Na Recepção: Secretária ou Médico" | As duas transições passam a ser só do **Médico**. A Secretária fica com Agendado → Na Recepção, Não Compareceu e Cancelar | Decisão D1. A transição concede acesso clínico (RN-05.3); quem atende é quem a dispara | Sim: M-01, S-06 |
| PR-02 | RF28, passo 1, e linha "Anotações privadas" da RC02 | "visível e editável apenas pelos médicos da equipe responsável" | "visível e editável apenas pelo **médico que a escreveu**" | Decisão D2. Alinha o texto à matriz ("apenas as próprias") e à RN-28.5, que as chama de anotações pessoais do profissional | Sim: M-02f |
| PR-03 | RF47, passo 4 | "o sistema deve apresentar o saldo esperado e exigir a informação do saldo contado" | "o sistema deve exigir o saldo contado **sem apresentar o saldo esperado ao operador**. Havendo divergência, o sistema informa apenas que ela existe e exige justificativa. O saldo esperado e o valor da divergência são visíveis só ao Administrador" | Decisão D5. O saldo esperado é a soma dos recebimentos do turno, e a regra de derivação da RC06 faz da soma um dado de nível 3 | Sim: S-09, A-16 |
| PR-04 | RF01, exceção E2 | Mensagem "Conta temporariamente bloqueada. Tente novamente em X03 minutos." | "Não foi possível entrar agora. Aguarde alguns minutos e tente de novo." A mesma resposta é dada a **qualquer e-mail** depois de X01 falhas em X02, exista a conta ou não | A E1 esconde quais e-mails existem; a E2 atual desfaz isso, porque só uma conta real pode estar bloqueada. O RNF19 proíbe revelar a existência | Sim: G-03 |
| PR-05 | RF01, subfluxos por ator | Destino do Administrador: "Painel financeiro (RF35)" | "Início › Painel do dia (RF60)" | O pedido cria o Início como entrada do papel | Sim: A-01 |
| PR-06 | RC03, parágrafo final | Uma mensagem genérica, idêntica para "não autorizado" e "não existe" | Duas mensagens. **Por papel**, quando a rota inteira é vedada: pode nomear o papel, porque a resposta não depende de registro algum. **Por registro**, quando o papel alcança a rota mas não aquele registro: idêntica para inexistente e não autorizado, sem nome, identificador nem motivo. O servidor autoriza pelo papel antes de buscar o registro | Premissa 7 do pedido. Preserva o que a RC03 protege e dá ao usuário uma explicação quando ela não revela nada | Sim: G-08a, G-08b |
| PR-07 | RC06, regra de derivação | Um exemplo: a soma do dia | Acrescentar dois exemplos: o **total de um lote TISS** e o **saldo esperado do caixa** são agregações e, portanto, nível 3 | Decisões D5 e D9. Evita que cada caso novo vire discussão | Sim: S-15, S-09 |
| PR-08 | RF09, passo 3 | "conferência de CPF e data de nascimento" | Para convite ao Paciente: CPF e data de nascimento dele. Para convite ao Responsável Legal: **CPF do responsável e data de nascimento do representado** | Decisão D19. O RF08 não guarda a data de nascimento do responsável | Sim: G-04b |
| PR-09 | Seção 4 da v2.0 e seção 16 da v2.1 | A numeração salta de X29 para X31 | Declarar "X30: não utilizado" | Evita que o salto pareça erro ou parâmetro perdido | Não se aplica |
| PR-24 | RF47, passo 5 | "Havendo divergência, o sistema deve exigir justificativa e aprovação do Administrador para encerrar o turno" | Acrescentar: "O Administrador pode **devolver o fechamento para recontagem**, com motivo. O turno continua aberto até a nova contagem" | O RF47 só prevê aprovar. Sem a devolução, uma contagem errada só pode ser aceita. Achado da verificação independente | Sim: A-16 |
| PR-25 | Matriz de permissões, linha "Orçamento: escopo clínico (RF31)", coluna Médico | "Criar, Editar (equipe)" | "Criar, **Consultar**, Editar (equipe)". O Consultar vale em qualquer etapa e nunca inclui valores | A linha não dá ao Médico a leitura do escopo que ele mesmo escreveu depois de enviá-lo à etapa 2. Achado da verificação independente | Sim: M-04 |
| PR-26 | RC08 e linha "Dispensação identificada ao paciente (RF37)" | "Administrador apenas em forma agregada" | "Administrador apenas em forma agregada, **por item e por mês**, sem data do ato nem paciente" | O texto não diz o grão. Agregado por dia, numa clínica pequena, liga a saída à agenda e reidentifica o paciente. Decisão D31 | Sim: A-27 |

## 2. Parâmetros novos

Hoje estes valores estão fixos no texto ou não existem. Os sugeridos são ponto de partida e precisam da confirmação da clínica.

| ID | Parâmetro | Sugerido | Faixa | Quem configura | Requisito | Por quê |
|---|---|---|---|---|---|---|
| PR-10 | X52 · Limite de conferência do POS avulso: valor acima do qual o lançamento manual exige um segundo usuário | 500,00 reais | 0 ou mais | Administrador | RF46, RN-46.3 | A regra fala em "valor configurável" e não lhe dá código. Zero significa conferir sempre |
| PR-11 | X53 · Prazo de resposta às solicitações do titular | 15 dias | 1 a 15 | Administrador | RF39, RN-39.3 | A regra manda contar o prazo e alertar, sem dizer qual. O teto de 15 dias é o da declaração completa na LGPD (art. 19, II) |
| PR-12 | X54 · Antecedência do aviso de expiração de sessão | 60 segundos | 20 a 120 | Administrador | RNF03 e RNF24 | O piso de 20 s é o tempo mínimo de resposta do critério 2.2.1 da WCAG |
| PR-13 | X55 · Mínimo de registros para exibir um resultado de relatório | 5 registros | 3 a 20 | Administrador | RF42 | O RF42 manda suprimir o recorte estreito "abaixo de um número mínimo" e não diz o número |
| PR-14 | X56 · Janela do padrão atípico de acesso de exceção | 30 dias | 7 a 90 | Administrador | RF06, exceção E3 | Os 30 dias estão escritos no texto, contra a convenção de que valor concreto não fica no requisito |

## 3. Requisitos funcionais novos

Telas que o pedido criou e que nenhum RF descreve. O texto segue a estrutura da v2.0.

### PR-15 · RF60 – Painel do dia do Administrador

**Objetivo:** dar ao Administrador, na entrada, o que depende dele naquele dia, sem abrir cada módulo.

1. O sistema deve exibir a contagem das consultas do dia por status (RF22), sem nome de paciente.
2. O sistema deve listar as pendências que aguardam o Administrador: estornos a aprovar (RF48), divergências de caixa (RF47), orçamentos a aprovar (RF31), recursos de glosa mantidos (RN-57.3), solicitações de titulares com o prazo restante (RF39), acessos de exceção a revisar (RF06), contratos perto do reajuste ou do fim da vigência (RN-51.3) e falhas de gravação do log (RN-40.3).
3. Cada pendência deve levar à tela onde é tratada.

**Regras:** RN-60.1 O painel não exibe dado clínico nem dispensação identificada. RN-60.2 A abertura de um orçamento a partir do painel segue a RC09.

**Permissão:** Administrador, Consultar. Demais papéis, nenhuma. **Tela:** A-01.

### PR-16 · RF61 – Agenda da clínica

**Objetivo:** mostrar a ocupação da agenda no tempo, que hoje só existe como formulário de agendamento.

1. O sistema deve oferecer as visões Dia, Semana e Mês, com filtro por médico.
2. Na visão Dia, o sistema deve mostrar uma coluna por médico. Em Semana e Mês, um médico por vez; com "Todos", só a contagem de consultas por dia.
3. Ao Administrador o sistema deve oferecer também a visão Ano, como mapa de ocupação por dia.
4. Um horário livre deve abrir o agendamento (RF16) já com médico e horário preenchidos.

**Regras:** RN-61.1 A visão Ano não exibe nome de paciente. RN-61.2 Nenhuma cor, ícone ou ordenação da agenda deriva de conteúdo clínico (RN-22.2). RN-61.3 O Médico vê só a própria agenda e nela registra a própria indisponibilidade (RF14). RN-61.4 O titular não vê a agenda: vê disponibilidade, sem motivo de bloqueio (RC02).

**Permissão:** Administrador e Secretária, Consultar; Médico, Consultar a própria. **Telas:** A-07, S-02, M-03.

### PR-17 · RF62 – Parâmetros do sistema

**Objetivo:** dar tela aos valores X, que a seção 4 declara configuráveis e nenhum requisito diz onde se configuram.

1. O sistema deve listar os parâmetros por grupo, com valor atual, valor sugerido, faixa aceita e requisito de origem.
2. O sistema deve permitir ao Administrador editar os parâmetros que a seção 4 lhe atribui.
3. O sistema deve recusar valor fora da faixa, explicando a faixa.
4. O sistema deve registrar no RF40 cada alteração, com valor anterior, valor novo e autor.

**Regras:** RN-62.1 Premissas e metas de projeto (X20 a X29) e valores informados pela operadora (X40, X41) aparecem só para leitura. RN-62.2 Parâmetros por operadora (X37 a X39, X50) são editados no contrato (RF51); os de grade e de produto (X11, X12, X46), nas telas de origem. RN-62.3 O X43 não aceita menos de 20 anos (RNF06). RN-62.4 O X09 não pode ficar menor que o X08, e o X05 não pode ficar maior que o X04, como a seção 4 já recomenda.

**Permissão:** Administrador, Consultar e Editar. **Tela:** A-34.

### PR-18 · RF63 – Listas de trabalho

**Objetivo:** reunir num lugar as pendências que várias regras mandam "entrar em lista de trabalho" sem dizer qual.

1. Para a Secretária, na fila do dia: consultas com convênio a conferir (RN-17.3), notificações sem entrega para contato manual, com reenvio (RN-21.3, RF59), titulares a habilitar por maioridade (RF08, E1) e alertas de estoque (RF38).
2. Para o Médico: justificativas e CID de autorização prévia a preencher (RN-53.1), fundamentações de recurso de glosa a anexar (RN-57.2) e exames enviados pelo titular a aceitar ou recusar (RN-26.6).

**Regras:** RN-63.1 Nenhuma lista da Secretária contém dado clínico. RN-63.2 Os itens da lista do Médico só mostram pacientes com vínculo válido (RC05).

**Telas:** S-06 e M-06.

### PR-19 · RN-43.6 – Cobranças do dia

Acréscimo ao RF43: "O sistema deve oferecer à Secretária a lista das cobranças do dia, item a item, com paciente, procedimento, valor e situação. A lista não exibe soma, subtotal por meio de pagamento ou por médico, nem gráfico (RC06, regra de derivação)." **Tela:** S-08.

## 4. Regra de confidencialidade nova

### PR-20 · RC11 – Sigilo do adolescente

**Problema que esta regra resolve:** o Responsável Legal alcança "exatamente o mesmo conjunto de dados do Paciente representado". O Código de Ética Médica (Resolução CFM nº 2.217/2018, art. 74) veda ao médico revelar aos pais ou representantes o que o paciente criança ou adolescente com capacidade de discernimento lhe confiou, salvo quando a não revelação puder causar dano ao paciente. Hoje o sistema entrega tudo ao responsável e não dá ao médico como cumprir o artigo.

- O Médico da equipe pode marcar um registro clínico, uma prescrição ou um anexo como **sigiloso para o responsável**.
- O registro marcado é excluído de tudo o que o Responsável Legal alcança: telas, lista de documentos e exportação do RF30. A exclusão acontece na consulta que alimenta a tela e o gerador, como na RC04, e não por filtro de apresentação.
- Ao Responsável Legal o sistema não revela a existência do registro.
- A marcação e a retirada da marcação são do Médico, que responde pela avaliação de discernimento e de risco, e são registradas no RF40.
- Encerrada a representação por maioridade, o registro integra normalmente a exportação do titular.

**Impacto:** RC02 (linhas de anamnese, prescrição, anexo e exportação), RF08, RF30, seção 2.5. **Decisão:** D3. **Telas:** R-01, R-04; a marcação fica em M-02b, M-02d e M-02e.

## 5. Requisitos não funcionais

| ID | Proposta | Texto | Por quê |
|---|---|---|---|
| PR-21 | RNF24 – Aviso e extensão de sessão | O sistema deve avisar o usuário X54 antes de a sessão expirar e oferecer "Continuar conectado" e "Sair". A tela de sessão expirada não exibe nenhum conteúdo da tela anterior. Depois de novo login, o sistema só volta à rota anterior se o usuário for o mesmo | O RNF03 define os tempos e não o aviso. O critério 2.2.1 da WCAG, de nível A, exige avisar e permitir estender. Telas: G-07, G-07b |
| PR-22 | RNF18, complemento | Contraste mínimo de 3:1 para bordas de campo, ícones de ação e limites de componentes interativos (critério 1.4.11). Área de toque de pelo menos 24 × 24 px. Idioma da página declarado como `pt-BR` (3.1.1). Toda ação destrutiva pede confirmação | O RNF18 cita só o contraste de texto. O Yeti original reprova nos dois: 1,30 nas bordas de campo e 3,84 no texto dos botões |
| PR-23 | RC03, acréscimo sobre o backend simulado | Enquanto o backend for simulado, ele deve exigir sessão, recusar por papel antes de buscar o registro e não devolver campos restritos. O campo de senha nunca é devolvido, em nenhuma rota | A v1 dizia que o backend simulado recusa e registra; a v2.0 generalizou e a frase se perdeu. A API simulada de hoje entrega todas as coleções sem autenticação ([05-lacunas-no-codigo.md](05-lacunas-no-codigo.md)) |

## 6. Linhas novas na matriz de permissões

| Funcionalidade | Administrador | Médico | Secretária | Paciente | Responsável Legal |
|---|---|---|---|---|---|
| Painel do dia (RF60) | Consultar | — | — | — | — |
| Agenda da clínica (RF61) | Consultar | Consultar (própria) | Consultar | — | — |
| Parâmetros do sistema (RF62) | Consultar, Editar | — | — | — | — |
| Listas de trabalho (RF63) | — | Consultar (própria) | Consultar | — | — |
| Marcação de sigilo (RC11) | — | Executar (equipe) | — | — | — |

## 7. O que não virou proposta

- **Protótipo do portal para celular.** O RNF17 já pede; foi desenhado sem precisar de requisito novo (D29).
- **Administrador operando checkout, recibo e saída de estoque.** O pedido previa; a matriz da v2.0 nega, e o redesenho seguiu a matriz (D27). Se a clínica quiser o contrário, a mudança é na matriz da seção 6, não um requisito novo.
- **Conferência do Responsável Legal por outro dado.** A PR-08 é a opção mais simples com os dados que o cadastro tem; se o RF08 passar a guardar a data de nascimento do responsável, ela deixa de ser necessária.
