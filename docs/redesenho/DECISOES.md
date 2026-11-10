# Decisões

D1 a D9 vieram no pedido, já com o padrão definido. D10 a D26 apareceram na leitura das fontes e foram aprovadas no checkpoint de 8 de outubro de 2026. D27 a D29 surgiram depois, com a chegada da Especificação v2.0. D30 a D33 vieram da verificação independente das telas. Para trocar qualquer uma, basta dizer o número.

Ordem de precedência usada: lei e norma; RC01 a RC10; RF, RN e RNF da v2.1 e da v2.0, que são a mesma versão em duas organizações; v1 onde as duas são omissas; pedidos do prompt; Figma e código atuais.

## Respostas recebidas no checkpoint

1. **Histórico do Figma:** não há versão salva; existe uma cópia do arquivo, feita por você, que serve de backup. As alterações de tokens foram liberadas.
2. **Decisões D10 a D26:** aprovadas. Ficou autorizada a proposta de novos RC, RF e RNF onde algo estiver faltando ou em aberto: está em [06-proposta-de-requisitos.md](06-proposta-de-requisitos.md).
3. **Outras versões:** dos três documentos enviados, um é a Especificação v2.0 completa e dois são cópias da v1. A v2.0 fechou 13 das 15 lacunas ([01-comparativo-v1-v2.1.md](01-comparativo-v1-v2.1.md), seção 5).

## Decisões do pedido

| ID | Decisão | Padrão aplicado | O que a v2.0 diz | Onde aparece |
|---|---|---|---|---|
| D1 | Quem move para Em Atendimento | O Médico, com "Chamar paciente"; a Secretária só faz check-in | Permite ao Médico ou à Secretária (RF22). Proposta PR-01 alinha o texto | M-01, S-06 |
| D2 | Visibilidade das anotações privadas | Só o autor | A RC02 e o passo 1 do RF28 falam em médicos da equipe; a matriz, em "apenas as próprias". Proposta PR-02 | M-02f |
| D3 | Sigilo do adolescente (Código de Ética Médica, art. 74) | O médico marca um registro como sigiloso para o responsável; ele some das telas e exportações do Responsável Legal | Não trata. Proposta PR-20 cria a RC11 | R-01, R-04 |
| D4 | Pessoa que é paciente e responsável | Duas contas | Confirma: o responsável "não herda nada" de outro papel, ainda que seja a mesma pessoa | G-09 |
| D5 | Fechamento de caixa da Secretária | Cego | O passo 4 do RF47 apresenta o saldo esperado. A RC06 prevalece sobre o RF; proposta PR-03 | S-09, A-16 |
| D6 | Faturamento TISS | Menu próprio | A v2.0 o trata como módulo próprio (Módulo 7) | Menus A e S |
| D7 | Visão "Ano" da agenda | Mapa de ocupação sem nomes | Não trata. Proposta PR-16 | A-07 |
| D8 | Conjunto de ícones | Material Icons | — | Menus e ações |
| D9 | Totais de lote TISS para a Secretária | Ocultos; ela vê o valor de cada guia | Não trata. Proposta PR-07 | S-15 |

No fechamento cego a tela também não mostra o valor da divergência, porque esse valor mais o contado revela o esperado. A Secretária vê só "Há divergência. Informe a justificativa."

## Decisões aprovadas no checkpoint

### D10 · Cores de texto sobre fundo que não é branco

O pedido define `primary` #007fa9 também como cor de link e texto secundário "#767676 ou mais escuro". Os dois passam sobre branco, mas o app usa #f8f9fa como fundo de página, #eee em superfícies secundárias e escurece a linha da tabela no hover.

| Uso | Pedido | Aplicado | Branco | #f8f9fa | #eee | Linha em hover |
|---|---|---|---|---|---|---|
| Preenchimento primary, texto branco | #007fa9 | #007fa9 | 4,55 | — | — | — |
| Link e texto colorido | #007fa9 | **#006f94** | 5,67 | 5,38 | 4,89 | 4,80 |
| — o #007fa9 como texto daria | | | 4,55 | 4,32 | 3,92 | 3,85 |
| Texto secundário | #767676 ou mais escuro | **#222 a 75%**, que é o `--bs-secondary-color` do Bootstrap e equivale a #595959 sobre branco | 6,97 | 6,77 | 6,42 | 6,36 |
| — o #767676 daria | | | 4,54 | 4,30 | 3,91 | 3,84 |
| Preenchimento danger, texto branco | #da3b21 | #da3b21 | 4,53 | — | — | — |
| Texto de erro | não definido | **#c0341d** | 5,59 | 5,31 | 4,82 | 4,73 |
| Preenchimento success, texto branco | #348452 | #348452 | 4,59 | — | — | — |
| Texto de sucesso | não definido | **#2e7548** | 5,59 | 5,30 | 4,82 | 4,73 |
| Bordas de campo e ícones de ação (mínimo 3:1) | ex.: #888 | **#767676** | 4,54 | 4,30 | 3,91 | 3,84 |
| — o #888 daria | | | 3,54 | 3,36 | 3,05 | 3,00 |

Os números estão truncados em duas casas, por isso diferem em um centésimo dos do pedido. Warning e info ficam com texto #222 (6,40 e 7,60). No Yeti 5.3.8 compilado, `.text-muted` e `.text-body-secondary` já usam #222 a 75%; o #888 só sobra na paginação e no botão de fechar.

### D11 · Terracota e areia: remapear em vez de apagar

Os dois aliases não estão ligados a nenhum nó das páginas 1 a 4. Nenhuma variável é excluída: eles passam a apontar para `danger` e `light`, com a descrição "obsoleto, não usar".

### D12 · Estilos de texto em Open Sans

| Estilo | Hoje | Aplicado |
|---|---|---|
| H1 (36), H2 (32), H3 (24) | Inter Medium | Open Sans Light |
| H4 (20), H5 (16), H6 (13) | Inter Medium | Open Sans SemiBold |
| Body/Strong (14) | Inter Medium | Open Sans SemiBold |
| Body/Regular (14), Body/Small (12) | Inter Regular | Open Sans Regular |
| Body/Caption (11) | Inter Regular | Open Sans Regular, 12 |
| Rótulo de botão e de pílula | Body/Strong | Open Sans Regular |

O corpo fica em 14 px no Figma; o tema do código precisa de `$font-size-base: .875rem`.

### D13 · A página 4 arquivada muda de aparência

Os valores das variáveis são trocados no lugar. A página de arquivo passa a aparecer em Yeti; a aparência antiga fica na cópia de backup.

### D14 · Um código por submenu

Um código por submenu; telas filhas e estados recebem letra. São 112 telas: 14 em Geral, 41 no Administrador, 14 no Médico, 28 na Secretária, 7 no Paciente e 8 no Responsável Legal. A agenda do Administrador tem quatro: as visões Dia (A-07), Ano (A-07b), Semana (A-07c) e Mês (A-07d). As versões de celular do portal não ganham código (D29).

### D15 · Telas iguais em mais de um papel

Um frame por papel quando o conteúdo muda; quando muda só o menu, um frame representativo e uma nota.

### D16 · Saída de estoque pelo Administrador

**Resolvida pela v2.0.** A tabela do RF37 diz: entrada, Administrador e Secretária; saída, Secretária e Médico; ajuste de inventário, Administrador, ou Secretária com aprovação. O Administrador não registra saída nem descarte. A-27 foi ajustada.

### D17 · Parâmetros que fogem do padrão

| Grupo | Parâmetros | Aplicado |
|---|---|---|
| Configurados por "Administrador ou Secretária" | X11, X12, X46 | Editados na tela de origem; em A-34, só leitura com link |
| Do Administrador, sem faixa no documento | X18, X19, X51 | Editáveis, com o aviso "faixa não definida" |
| Do Administrador, com piso | X43 | Recusa menos de 20 anos |
| Conforme contrato com o adquirente | X34, X35, X36, X47 | Grupo "Adquirente" em A-34; o X47 é uma tabela |

O X31 aparece com dois valores, balcão e portal. A proposta PR-17 cria o RF62 para esta tela.

### D18 · Limite de conferência do POS avulso

Continua sem código nas duas versões. S-07d tem o estado "aguardando confirmação de outro usuário" e A-34 mostra o valor como parâmetro sem código. A proposta PR-10 cria o X52.

### D19 · Primeiro acesso do Responsável Legal

A v2.0 diz só "CPF e data de nascimento", sem distinguir o responsável. G-04b pede o CPF do responsável e a data de nascimento do representado. Proposta PR-08.

### D20 · Prazo das solicitações do titular

A-33 mostra 15 dias para todos os tipos, com alerta antes do vencimento. A v2.0 não dá o número. Proposta PR-11 cria o X53.

### D21 · Aviso de expiração: 60 segundos

Valor fixo em G-07b. Propostas PR-12 (X54) e PR-21 (RNF24).

### D22 · Borda na pílula interativa

`PilulaStatus/Interativa` tem borda de 1 px em #767676 e seta na cor do texto, porque três estados têm fundo claro (1,16, 2,09 e 2,48 contra o branco). A pílula estática fica sem borda.

### D23 · Orçamento: quatro etapas

Quatro etapas, uma por papel. A v2.0 acrescenta os estados Devolvido e Expirado e, em convênio, a separação entre coparticipação e parte do plano.

### D24 · Pendências extras no Painel do dia

Reajuste e fim de vigência de contrato (RN-51.3) e falha de gravação do log (RN-40.3) entram no A-01. Proposta PR-15 cria o RF60.

### D25 · Limites da RC09

**Resolvida pela v2.0.** O Administrador vê código e descrição do procedimento, quantidade, valor, médico solicitante, data e paciente. Não vê anamnese, diagnóstico, CID, justificativa clínica nem orçamentos anteriores em navegação livre: o acesso é sempre pela fila de aprovação pendente.

### D26 · Onde ficam as notas de requisito

Um frame "Notas de implementação" ao lado de cada tela, com o mesmo código.

## Decisões novas, depois da v2.0

### D27 · O Administrador não opera o balcão

O pedido dizia que o Administrador faz "todas as funções administrativas, operacionais e financeiras de todos os papéis". A matriz da seção 6 da v2.0 separa quem opera de quem aprova:

| Função | Pedido | Matriz da v2.0 | Aplicado |
|---|---|---|---|
| Checkout (RF43 a RF46) | "Cobrar" abre o checkout | Cria e edita a cobrança; não executa o checkout | A-13b virou "cobrança"; o recebimento é da Secretária ou do titular no portal |
| Recibo (RF33) | — | Configura parâmetros; quem emite é a Secretária | A-19 emite só NFS-e |
| Guia TISS (RF54) | — | Consultar, limitado pela RC10 | A-22 é leitura |
| Demonstrativo (RF56) | — | Consultar; a Secretária importa | A-24 |
| Recurso de glosa (RF57) | "decide o recurso mantido" | Aprovar e Consultar; a Secretária cria e envia | A-25 |
| Estoque (RF37) | "Movimentações" | Entrada e ajuste; nunca saída | A-27 |

**Aplicado:** a matriz da v2.0. A razão está escrita nela: "nenhum estorno ocorre com um só par de olhos". Quem aprova estorno e divergência de caixa não pode ser quem recebe. **Alternativa:** seguir o pedido e dar ao Administrador a operação inteira, o que exige mudar a matriz.

### D28 · Outros pontos em que a v2.0 contraria o pedido

| Ponto | Pedido | v2.0 | Aplicado |
|---|---|---|---|
| Minha agenda do Médico | Somente leitura | O Médico registra a própria indisponibilidade (RF14) | A v2.0: M-03 tem "Registrar indisponibilidade" |
| Mensagem de credencial inválida | "E-mail ou senha incorretos" | "E-mail ou senha inválidos." | A v2.0, que é também o texto do frame atual |
| Excesso de tentativas | Texto neutro para qualquer e-mail | "Conta temporariamente bloqueada" | O pedido, porque a mensagem da v2.0 revela que a conta existe (RNF19). Proposta PR-04 |
| Entrada do Administrador | Início › Painel do dia | Painel financeiro | O pedido. Proposta PR-05 |
| Notificações para a Secretária | Só a lista de contato manual | Consulta o histórico e reenvia (RF59) | A v2.0, dentro do painel do S-06, sem item novo de menu |
| Portal | — | Status da consulta do dia, itens dispensados, estornos e notificações recebidas | A v2.0: P-01, P-04, P-05a, P-06 |

### D29 · Portal priorizado para celular

O RNF17 da v2.0 define o celular como dispositivo prioritário do portal e o tablet para o atendimento clínico. O protótipo inteiro está em 1024 × 720, e o pedido manda duplicar os frames existentes.

**Aplicado:** as 15 telas do portal têm duas versões. A de 1024 px segue o padrão das demais páginas. A de 390 px fica ao lado da nota de cada seção, com o mesmo nome terminado em " · celular", e há mais dois frames com o menu aberto (P-01 e R-01). Na versão de celular, o conteúdo vira uma coluna, as linhas de campos empilham, cada linha de tabela vira um cartão e o menu lateral vira gaveta, aberta pelo botão de 48 × 48 do componente novo `CabecalhoCelular`. A versão de celular não ganha código próprio na matriz: é a mesma tela, com os mesmos verbos e os mesmos dados ocultos. **Alternativa:** navegação inferior com quatro itens e "Mais", que exige escolher quais itens ficam fora.

## Decisões depois da verificação independente

Quatro verificadores que não participaram da construção leram as telas só com a matriz e as regras ([04-verificacao.md](04-verificacao.md)). O que eles apontaram e exigiu escolha está aqui.

### D30 · R-07 não mostra o nome do ex-representado

A primeira versão da tela dizia "{nome} completou 18 anos". A matriz manda ocultar todos os dados do ex-representado a partir do aniversário (RF08, exceção E1).

**Aplicado:** texto sem nome: "A pessoa que você representava atingiu a maioridade. A partir de agora, só ela acessa os próprios dados." **Alternativa:** mostrar só o primeiro nome, para quem representa mais de uma pessoa saber de quem se trata; exige abrir essa exceção no RF08.

### D31 · Movimentações do Administrador: agregado por item e por mês

A v2.0 dá ao Administrador a dispensação "apenas em forma agregada" e não diz o grão. A-27 listava saída por saída, com data e destino "Paciente".

**Aplicado:** saídas em atendimento somadas por item e por mês, sem data do ato; entradas, descartes e ajustes continuam um a um. Proposta PR-26. **Alternativa:** agregar por dia, que numa clínica pequena permite ligar a saída à agenda.

### D32 · Achados que corrigiram a matriz, e não a tela

| Tela | Achado do verificador | Por que a tela fica | O que mudou |
|---|---|---|---|
| M-01 | Pílula "Finalizado" com seta | A máquina de estados do RF22 permite ao Médico voltar de Finalizado para Em atendimento, com motivo, sem reabrir o registro selado | A nota da matriz lista as transições por estado |
| M-04 | Ícone Ver nas etapas 2 em diante | O Médico lê o escopo clínico que escreveu; valores continuam fora | Verbo Consultar na matriz, limitado ao escopo. Proposta PR-25 |
| S-07d | Campos "Bandeira" e "Quatro últimos dígitos" | O passo 4 do RF46 manda lançá-los; a RN-43.4 proíbe número completo, validade, código de segurança e senha | "Dados ocultos" da matriz passou a dizer exatamente isso |
| S-10 | Botão "Devolver ao médico" | Etapa 2 do RF31: "Se discordar, devolve ao Médico com observação" | Verbo na matriz |
| S-06 | Pílula "Na recepção" com seta | A Secretária ainda pode marcar Não compareceu ou cancelar | A nota diz que Em atendimento nunca aparece para ela (D1) |
| A-16 | Botão "Devolver" | Quem aprova precisa poder recusar | Verbo na matriz. Proposta PR-24, porque o RF47 só prevê aprovar |
| A-13a, A-07, S-02, S-06, S-08, M-02a, M-05a, P-01, P-03, R-01, R-03 | Botão ou link de um verbo que a matriz lista em outra tela | São atalhos de navegação para a tela que tem o verbo | A nota de cada linha diz para onde o atalho leva |

### D33 · Agenda da clínica: Semana e Mês sem frame próprio no Administrador

A-07 desenhava a visão Dia e A-07b, a visão Ano. Semana só existia em S-02 e Mês, em M-03.

**Aplicado:** dois frames novos. A-07c mostra a semana de um médico, com a grade de S-02. A-07d mostra o mês com "Todos os médicos", só com a contagem de consultas por dia, com a grade de M-03. Juntos, cobrem os dois modos do filtro que o pedido descreve. A matriz ganhou duas linhas. **Alternativa:** desenhar também a semana com "Todos" e o mês de um médico, que repetem padrões já desenhados.

## Estado das telas

Das 112 telas, 106 estão `ok`, 2 em `conflito` e 4 em `lacuna`.

| Tela | Status | Motivo |
|---|---|---|
| G-04b Primeiro acesso por convite · Responsável Legal | lacuna | Quais dados o responsável confere não está escrito (D19). |
| A-33 Solicitações dos titulares (LGPD) | lacuna | Prazo de 15 dias para a declaração completa; prazo dos demais direitos sem parâmetro (D20). |
| A-34 Parâmetros do sistema | lacuna | X30 não existe; quatro parâmetros do Administrador não têm faixa; o limite de conferência do POS não tem código (D17, D18). |
| M-02f Anotações privadas | conflito | Único lugar do papel com a lixeira. O passo 1 do RF28 na v2.0 e o frame 28 dizem "médicos da equipe"; o pedido decide "só o autor" (D2). |
| S-07d Checkout · cartão POS avulso | lacuna | Acima de um valor configurável exige confirmação de segundo usuário; o valor não tem código X (D18). |
| R-04 Documentos | conflito | Sigilo do adolescente (D3) não está na v2.1. Variante de celular de 390 px no frame de mesmo nome terminado em " · celular" (D29). |
