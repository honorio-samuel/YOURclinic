# 00 · Inventário

O que existe hoje nas quatro fontes: documentos de requisitos, arquivo do Figma, código React e API simulada. Levantado em 8 de outubro de 2026. Nada foi alterado no Figma nem no código; todas as consultas ao Figma foram de leitura.

## 1. Fontes e como foram lidas

| Fonte | De onde veio | Como foi lida | Conferência |
|---|---|---|---|
| Requisitos v1 | Google Drive, ID `1ov6IoESKQxuMmAG4MfJNE2u7X6b4ySJ5` ("SistemaClinicoRequisitosMaxSamuel.docx", 29.614 bytes, modificado em 11/08/2026) | Texto integral pelo conector do Drive, com as duas tabelas preservadas | 4 atores, RC01 a RC08, matriz de 31 funcionalidades × 4 papéis, RF01 a RF42 em 7 módulos, RNF01 a RNF19, seção Restrições e Escopo |
| Requisitos v2.1 | Google Drive, ID `1pJZMZtqx6l5NN7fAec8ZVaGdNieRH-Xt` ("Sistema Clinico - Regras por aspecto de uso v2.1.docx", 70.924 bytes) | Arquivo .docx baixado e convertido para Markdown por script próprio que lê `word/document.xml` | 2.235 parágrafos, 114 títulos, 77 tabelas, 530 linhas de tabela. 70.230 caracteres no .docx e 70.230 no Markdown: nada se perdeu |
| Especificação v2.0 | Google Docs, ID `1U9oSa-B2AaajB0Wz13UokAtC8UDW2F6AXV_tc22bxgw` ("Requisitos_Sistema_Clinico_v2", de 25/08/2026), enviado depois do checkpoint | Exportado como .docx e convertido pelo mesmo script | 3.636 parágrafos, 155 títulos, 85 tabelas, 636 linhas de tabela, 334 itens de lista. 159.818 caracteres dos dois lados. É o documento que a v2.1 reorganiza: as 174 regras da v2.1 estão todas nele, com os mesmos identificadores |
| Duas cópias da v1 | Google Docs, IDs `1E-oJWlvV_sINsIsnYn-58eXdP037UhxI-CvB-70BnMQ` e `1Srb1PMWpV435fAyKKyBtOknJ3evQ5Cr3JhDcEprnz-o` | Texto integral pelo conector | Mesmo conteúdo da v1 já lida, do título à seção Restrições e Escopo. Não acrescentam nada |
| Figma | file key `VJzwLNJrl8grgstMPlUVw0` | Scripts de leitura pela API de plugins | 5 páginas, 60 frames de tela, 17 componentes, 59 variantes, 49 variáveis. Os três últimos números batem com a capa da v2.1 |
| Código | `honorio-samuel/YOURclinic`, branch `main` no commit `6112afa` | Leitura de todos os arquivos de `src/` e de `public/index.html` | 7 rotas e um redirecionamento, 10 componentes, 7 telas. A branch `feat/tema-yeti-fila-do-dia` (`4e64581`) já está toda em `main` |
| Tema | `bootswatch@5.3.8`, a versão travada no `package-lock.json` | `dist/yeti/_variables.scss` e `dist/yeti/bootstrap.css` extraídos do pacote | Valores iguais aos da seção 6 do pedido |
| API simulada | `https://yourclinic-api.onrender.com` | Uma requisição GET a `/db`; lidos só os nomes das coleções e dos campos, nenhum valor | 52 coleções; responde sem autenticação |

**Quanto da v2.0 foi lido linha a linha:** as seções 2.5, 2.6 e 4.8, a seção 5 inteira (RC01 a RC10), a seção 6 inteira (matriz de permissões), os requisitos RF01, RF06, RF08, RF09, RF14, RF16, RF22, RF28, RF31, RF39, RF42, RF47 e RF59, trechos de RF25, RF37, RF46, RF48 e RF54, os RNF02, RNF03, RNF07, RNF17, RNF20, RNF21 e RNF22 e as seções 19.2 e 19.3. O restante foi conferido por script contra a v2.1 (regras e parâmetros iguais) e não foi lido por extenso.

Três ressalvas sobre a leitura:

- **Não há `docs/requisitos/` no repositório.** As duas versões vieram do Drive. Na pasta Downloads desta máquina existe outra revisão da v1 (39.540 bytes), com a mesma estrutura e pelo menos uma frase diferente; ela não foi usada.
- **`pandoc` não está instalado.** A conversão da v2.1 foi feita por script próprio, com a contagem de conferência acima. O .docx não tem imagens nem objetos embutidos, e o arquivo de comentários está vazio. Logo, as listas e tabelas que faltam na v2.1 faltam no documento original, não na conversão. Quase todas estão na v2.0 (seção 5 do [01-comparativo-v1-v2.1.md](01-comparativo-v1-v2.1.md)).
- **O app não foi executado.** `npm install` não foi rodado, porque o repositório está clonado numa pasta temporária e o Create React App traz mais de mil dependências. As duas rotas implementadas foram lidas no código-fonte, e os valores do tema vieram do pacote do Bootswatch.

## 2. Figma

### 2.1 Páginas

A ordem das abas no arquivo não é a numérica.

| Posição | Nó | Página | Conteúdo |
|---|---|---|---|
| 1 | `0:1` | 0. Componentes misturados | 8 seções e 1 frame: navegação antiga do Administrador, três homes, login antigo, design system antigo, importação de HTML |
| 2 | `4:266` | 3. Componentes de dados | 7 componentes |
| 3 | `4:264` | 1. Componentes base | 5 conjuntos de variantes |
| 4 | `4:265` | 2. Componentes Layout | 5 componentes |
| 5 | `4:267` | 4. Telas do app | 60 frames de 1024 × 720 |

### 2.2 Variáveis

Quatro coleções, 49 variáveis, um modo em cada uma.

**Primitives (13)**

| Variável | Valor | Está no Yeti? |
|---|---|---|
| brand/blue-500 | #6096b4 | não |
| brand/blue-300 | #93bfcf | não |
| brand/blue-200 | #bdcdd6 | não |
| neutral/0 | #ffffff | sim |
| neutral/50 | #f8f9fa | sim (gray-100) |
| neutral/700 | #334155 | não |
| neutral/900 | #1e1e1e | não; nenhum alias aponta para ela |
| accent/terracotta | #e07a5f | não |
| accent/sand | #f2cc8f | não |
| green/500 | #10b981 | não |
| amber/500 | #f59e0b | não |
| red/500 | #ef4444 | não |
| blue/500 | #3b82f6 | não |

**Color (26 aliases)**, com o número de preenchimentos e contornos ligados a cada um:

| Alias | Aponta para | Pág. 1 | Pág. 2 | Pág. 3 | Pág. 4 |
|---|---|---|---|---|---|
| color/brand/primary | brand/blue-500 | 7 | 13 | 7 | 257 |
| color/brand/secondary | brand/blue-300 | 0 | 6 | 0 | 52 |
| color/brand/tertiary | brand/blue-200 | 0 | 23 | 1 | 325 |
| color/surface/page | neutral/50 | 1 | 5 | 0 | 115 |
| color/surface/card | neutral/0 | 17 | 22 | 19 | 1.190 |
| color/surface/header | brand/blue-500 | 0 | 2 | 0 | 60 |
| color/surface/panel | brand/blue-300 | 0 | 0 | 0 | 24 |
| color/surface/disabled | brand/blue-200 | 7 | 0 | 0 | 3 |
| color/text/primary | neutral/700 | 33 | 50 | 19 | 1.562 |
| color/text/inverse | neutral/0 | 9 | 9 | 2 | 218 |
| color/text/muted | brand/blue-500 | 19 | 1 | 6 | 237 |
| color/text/link | blue/500 | 2 | 0 | 0 | 4 |
| color/text/error | red/500 | 4 | 0 | 0 | 15 |
| color/border/default | neutral/700 | 2 | 20 | 4 | 348 |
| color/border/subtle | brand/blue-200 | 9 | 5 | 13 | 712 |
| color/border/focus | blue/500 | 9 | 0 | 0 | 4 |
| color/border/error | red/500 | 4 | 0 | 0 | 22 |
| color/status/agendado | brand/blue-200 | 1 | 0 | 0 | 6 |
| color/status/recepcao | brand/blue-300 | 1 | 0 | 0 | 2 |
| color/status/atendimento | neutral/700 | 1 | 0 | 0 | 6 |
| color/status/finalizado | green/500 | 1 | 0 | 0 | 3 |
| color/status/cancelado | red/500 | 3 | 0 | 0 | 2 |
| color/status/naocompareceu | amber/500 | 1 | 0 | 0 | 8 |
| color/status/info | blue/500 | 0 | 0 | 0 | 21 |
| color/accent/terracotta | accent/terracotta | 0 | 0 | 0 | 0 |
| color/accent/sand | accent/sand | 0 | 0 | 0 | 0 |

**Terracota e areia não estão ligadas a nada** nas páginas 1 a 4. Só aparecem como cor crua, uma vez cada, nas amostras do design system antigo da página 0.

**Spacing (6):** xs 4, sm 8, md 16, lg 24, xl 32, 2xl 48. **Radius (4):** sm 4, md 8, lg 12, full 999.

Nas páginas 1 a 4 não existe cor crua: todo preenchimento e contorno está ligado a uma variável, e todo raio da página 4 também (1.023 nós com raio 4, 836 com raio 8, 96 com raio 12, 16 com raio 999). Trocar o valor de uma variável muda todos os componentes e os 60 frames de uma vez.

### 2.3 Estilos

Dez estilos de texto, todos em Inter. Não há estilos de cor nem de efeito.

| Estilo | Fonte | Tamanho | Usos na pág. 4 |
|---|---|---|---|
| H1 | Inter Medium | 36 | 0 |
| H2 | Inter Medium | 32 | 0 |
| H3 | Inter Medium | 24 | 182 |
| H4 | Inter Medium | 20 | 7 |
| H5 | Inter Medium | 16 | 0 |
| H6 | Inter Medium | 13 | 158 |
| Body/Regular | Inter Regular | 14 | 641 |
| Body/Small | Inter Regular | 12 | 252 |
| Body/Strong | Inter Medium | 14 | 537 |
| Body/Caption | Inter Regular | 11 | 25 |

Todos os 1.802 textos da página 4 usam um desses estilos. Fontes disponíveis no arquivo para a troca: **Open Sans** nos pesos Light, Regular, SemiBold, Bold e ExtraBold (não existe Medium), e **Material Icons** (também Round, Sharp, Symbols Rounded e Symbols Sharp).

### 2.4 Componentes

Contraste medido pela fórmula da WCAG, truncado em duas casas. O mínimo é 4,5:1 para texto e 3:1 para texto de 24 px ou mais e para bordas de componente.

| Página | Componente | Nó | Variantes e propriedades | Problemas medidos |
|---|---|---|---|---|
| 1 | Botao | `5:235` | Variante (Primario, Secundario, Perigo, Texto) × Estado (Default, Foco, Desabilitado) = 12; texto Rotulo | Raio 8. Primario: branco sobre #6096b4 = 3,22. Secundario: #6096b4 sobre branco = 3,22. Perigo: branco sobre #ef4444 = 3,76, e a cor vem de `color/status/cancelado`. Texto: #3b82f6 sobre branco = 3,67 |
| 1 | PilulaStatus | `6:217` | Estado (6) | Finalizado: branco sobre #10b981 = 2,53. Cancelado: branco sobre #ef4444 = 3,76. Os outros quatro passam (4,82 a 10,35). Não há variante com seta |
| 1 | Campo | `7:287` | Tipo (Texto, Senha, Select, Data) × Estado (Default, Foco, Erro, Desabilitado) = 16; textos Rotulo e Valor | Borda #bdcdd6 sobre branco = 1,63. Valor em #6096b4 = 3,22 (1,97 no desabilitado). Mensagem de erro #ef4444 = 3,76 |
| 1 | Checkbox | `21:209` | Estado (Desmarcado, Marcado) | Marca branca sobre #6096b4 = 3,22 |
| 1 | AreaTexto | `30:215` | Estado (Default, Foco, Selado) | Borda 1,63; texto de exemplo 3,22; legenda "Selado" 11 px = 3,22 |
| 2 | IconePlaceholder | `9:201` | — | Quadrado #334155 de 16 × 16; é o único "ícone" do menu |
| 2 | MenuItem | `9:217` | Estado (Default, Ativo); texto Rotulo | Raio 8. Ativo: branco sobre #6096b4 = 3,22 |
| 2 | MenuLateral | `10:344` | Papel (Administrador, Secretaria, Medico, Paciente, Responsavel) | Lista plana, sem submenus. O primeiro item é sempre o ativo e não há propriedade para mudar. Raio 12 |
| 2 | Head | `15:302` | Contexto (Aplicacao, Autenticacao); textos Nome e Papel | "Clinic" branco sobre #bdcdd6 = 1,63. Papel em #6096b4 de 12 px = 3,22. Sem menu do avatar |
| 2 | Footer | `10:213` | — | Branco sobre #6096b4 em 12 px = 3,22. Raio 8 |
| 3 | CelulaCabecalho | `11:201` | texto | — |
| 3 | CelulaTabela | `11:204` | texto | Só texto: não comporta pílula nem ícone |
| 3 | LinhaTabela | `11:225` | Conteudo (Dados, Vazia) | Não é usada em nenhum frame da página 4 |
| 3 | Paginacao | `11:234` | texto Pagina | — |
| 3 | StatCard | `12:213` | Valor, Rotulo, Detalhe1, Detalhe2 | Valor em #6096b4 de 24 px = 3,22, que passa como texto grande |
| 3 | EstadoVazio | `12:218` | Titulo, Descricao | Descrição 3,22. Não é usado em nenhum frame da página 4 |
| 3 | Modal | `13:229` | Tipo (Confirmacao, ComMotivo); Titulo, Descricao | Descrição 3,22; botão Confirmar 3,22 |

Menus atuais do `MenuLateral`, confirmados: Administrador (Cadastro, Agenda, Financeiro, Estoque, Gestão); Secretária (Cadastro, Agenda, Fila do Dia, Financeiro, Estoque); Médico (Atendimentos do Dia, Meus Pacientes, Minha Agenda, Meus Vínculos, Orçamentos, Estoque); Paciente (Meus Agendamentos, Meus Documentos, Minhas Cobranças, Meus Dados); Responsável (Agendamentos, Documentos, Cobranças, Dados do Representado).

Faltam para o redesenho: `PilulaStatus/Interativa`, `AcoesLinha`, `FiltroMedico`, `SeletorVisao`, `FaixaRepresentado`, `MenuLateral` com acordeão e item ativo configurável, ícones de verdade e uma célula de tabela que aceite pílula e ações.

### 2.5 Página 0 · navegação antiga

| Nó | Conteúdo | O que foi confirmado |
|---|---|---|
| `1:1748` NavegacaoADM | "02 - HomeAdm" e os flyouts 02.1 a 02.5 | Rótulos certos com camadas trocadas: "Grade de Horários" e "Bloqueios de Agenda" estão em camadas "Medicos" e "Convenios"; "Relatórios Cruzados" e "Log de Auditoria" em "Produtos" e "Movimentações"; "NFS-e" numa camada "NSF-e". Financeiro tem Orçamentos, Pagamentos, Recibos, NFS-e e Painel Financeiro: faltam contas a pagar, contas a receber e conciliação. Agenda tem só Grade e Bloqueios: não há visão de calendário |
| `1:2960` 03 - HomeMedico | Fila do médico | Cabeçalho "Dr. Marcos Lima / Médico". O menu está numa camada chamada "MenuLateralAdm" e tem cinco itens, sem "Meus Vínculos" |
| `1:3117` 04 - HomePaciente | Cópia da home do Administrador | Menu do Administrador, cabeçalho "Eduardo Soares / Administrador", cartões "Contas a Pagar R$ 9.740,00" e "Contas a Receber R$ 18.320,00" |
| `1:3289` 05 - HomeSecretária | Cópia da home do Administrador | Idêntica à anterior, com os mesmos dois cartões financeiros |
| `1:3461` Login | "01 — Login" e "01.1 — ErroLogin" | A tela de erro mostra "5/5 tentativa…", que informa quantas tentativas restam |
| `1:3528` Componentes | 23 peças soltas | Pílulas e colunas como grupos, não como componentes |
| `1:3723` Design System | Paleta e tipografia antigas | 6096B4, 93BFCF, BDCDD6, E07A5F, F2CC8F, 334155, F8F9FA, 10B981, F59E0B, EF4444, 3B82F6; Inter |
| `1:3826` Section 1 | Vazia | — |
| `1:4774` Importação html.to.design | Dois frames de 1920 × 6730, de 26/08/2026 | Camadas genéricas ("Section", "Paragraph+Background") |

A página 0 não tem nenhum componente local. Suas 201 instâncias vêm de bibliotecas externas (ícones no estilo Feather, "Stats Card", "Menu Shortcut", "Generic avatar") e usam variáveis dessas bibliotecas. Ela não usa nenhuma das 49 variáveis locais, então a troca de tokens não a altera.

### 2.6 Página 4 · os 60 frames

A coluna Destino mostra para quais telas novas cada frame serve de origem. Todos os 60 têm destino.

| Nº | Nó | Nome atual do frame | Menu (papel) | Conteúdo lido | Destino no redesenho |
|---|---|---|---|---|---|
| 01 | `17:199` | Login (RF01) | — | Campos E-mail e Senha; botão Entrar; link de recuperação | G-01 |
| 02 | `17:218` | Login · Credencial inválida (RF01 E1) | — | Campos em erro; "E-mail ou senha inválidos."; nota de regra visível | G-02 |
| 03 | `17:242` | Login · Conta bloqueada (RF01 E2) | — | "Conta temporariamente bloqueada."; botão desabilitado; nota com X01 a X03 | G-03 |
| 04 | `18:234` | Primeiro acesso por convite (RF02, RF09) | — | Campos CPF e Data de Nascimento; botão Continuar | G-04a, G-04b |
| 05 | `18:255` | Recuperar senha · Solicitação (RF02) | — | Campo E-mail; botão Enviar instruções | G-05 |
| 06 | `18:272` | Recuperar senha · Nova senha (RF02) | — | Campos Nova senha e Confirmar; botão Salvar senha | G-06 |
| 07 | `18:293` | Sessão expirada (RNF03) | — | Mensagem de inatividade; botão Entrar novamente | G-07 |
| 08 | `19:269` | Acesso Negado (RF04, RC01, RC03) | Secretária | "Você não tem permissão para acessar este conteúdo com o papel…"; Voltar para o início | G-08a |
| 09 | `19:335` | Seletor de paciente representado (RF08) | Responsável (sem menu) | Dois cartões de representado; botão Selecionar | G-09 |
| 10 | `22:337` | Pacientes · Listagem (RF07) | Secretária | Tabela Nome, CPF, Nascimento, Telefone, Tipo, Ações (só "Abrir"); busca; + Novo paciente | A-02a, S-01a |
| 11 | `23:424` | Paciente · Cadastro (RF07, RF08) | Secretária | 9 campos; checkboxes "sem CPF" e "menor ou incapaz"; bloco Responsável Legal | A-02b, S-01b |
| 12 | `24:495` | Médicos (RF10) | Administrador | Tabela Nome, Registro, Especialidade, Conta, Situação, Ações; + Novo médico | A-03 |
| 13 | `24:663` | Convênios (RF11) | Administrador | Tabela Nome, Operadora, Registro ANS, Contato, Situação, Ações | A-05 |
| 14 | `24:811` | Procedimentos e preços (RF12) | Administrador | Tabela Código, TUSS, Descrição, Tipo, Duração, Preço part. | A-06 |
| 15 | `25:776` | Grade de horários (RF13) | Secretária | Médico, Granularidade, janela; dias da semana; Gerar blocos | A-10, S-05a |
| 16 | `25:856` | Bloqueio de agenda · Consultas afetadas (RF14) | Secretária | Médico, Início, Fim, Motivo; "X consultas serão afetadas"; Tratar pelo RF20 | A-11a, S-05b |
| 17 | `26:897` | Agenda · Novo agendamento (RF16, RF17) | Secretária | Três passos: Paciente, Médico e horário, Atendimento; Convênio e Carteirinha | A-08a, S-03a |
| 18 | `26:984` | Agendamento · Conflito de horário (RF18 E1) | Secretária | Horário em erro: "Este horário acabou de ser preenchido. Escolha outro." | A-08b, S-03b |
| 19 | `27:1020` | Fila de atendimento do dia · Secretária (RF22) | Secretária | Tabela Paciente, Horário, Médico, Status, Espera; 6 pílulas; com paginação | A-09, S-06 |
| 20 | `28:1096` | Fila do dia · Médico (RF22, RN-05.3) | Médico | Tabela Paciente, Horário, Status, Prontuário; aviso "Iniciar atendimento concede acesso clínico" | M-01 |
| 21 | `29:1172` | Reagendamento pela clínica (RF20) | Secretária | Agenda do dia com modal "Remarcar consulta" e motivo obrigatório | A-11b, S-04 |
| 22 | `29:1280` | Portal · Cancelamento pelo titular (RF19) | Paciente | Dois cartões de consulta; Cancelar consulta; "Ligue para a recepção" desabilitado | P-03, R-03 |
| 23 | `34:1289` | Prontuário · Anamnese em edição (RF23) | Médico | Queixas, Exame físico geral, Diagnóstico; Salvar rascunho; Finalizar consulta e selar | M-02b |
| 24 | `34:1358` | Prontuário · Registro selado e retificação (RF24) | Médico | Anamnese versão vigente (v2); lista de retificações; Retificar com motivo | M-02c |
| 25 | `34:1423` | Prescrição médica (RF25) | Médico | Medicamento, Concentração, Classificação, Posologia, Quantidade, Duração; aviso de controle especial | M-02d |
| 26 | `35:1445` | Anexos · Visão do Médico (RF27) | Médico | Tabela Arquivo, Enviado em, Enviado por, Ação | M-02e |
| 27 | `35:1529` | Anexos · Visão da Secretária, só metadados (RF27) | Secretária | Mesma tabela; "Você vê apenas os metadados"; + Enviar anexo | S-01d |
| 28 | `37:1551` | Anotações privadas (RF28) | Médico | Área de texto; Excluir anotação (Perigo); "Visível apenas aos médicos da equipe responsável" | M-02f |
| 29 | `37:1609` | Acesso clínico de exceção (RF06) | Médico | "Sem vínculo com este paciente"; modal com motivo obrigatório | M-02h |
| 30 | `38:1645` | Exportações · Histórico e Prontuário (RF29, RF30) | Médico | Dois blocos com "Quem acessa"; Gerar histórico; Gerar prontuário | M-02g |
| 31 | `40:1686` | Checkout · Seleção de meio (RF43) | Secretária | Dois títulos (coparticipação e guia); meios Pix, TEF, POS, dinheiro | A-13b, S-07a |
| 32 | `40:1745` | Pagamento por Pix · QR dinâmico (RF44) | Secretária | Valor, expiração X31, txid; Verificar agora; Copiar código | S-07b |
| 33 | `42:1756` | Cartão via TEF integrado (RF45) | Secretária | Modalidade, Parcelas, Valor total; instruções do terminal; timeout X49 | S-07c |
| 34 | `42:1820` | Cartão via POS avulso (RF46) | Secretária | NSU, Código de autorização, Bandeira; aviso de meio sem confirmação | S-07d |
| 35 | `46:1845` | Caixa · Fechamento com divergência (RF47) | Secretária | Saldo esperado, Saldo contado, Divergência, Justificativa; Registrar sangria | A-16, S-09 |
| 36 | `46:1913` | Cancelamento e estorno · Matriz por meio (RF48) | Secretária | Tabela explicativa Meio, Reverte como, Janela, Exigência física | A-17, S-12 |
| 37 | `47:1950` | Portal · Meus documentos (RF29, RF30) | Paciente | Histórico, Prontuário completo, Meus exames enviados; Gerar PDF; Enviar exame | P-04, R-04 |
| 38 | `47:2004` | Portal · Minhas cobranças e coparticipação (RF43, RF58) | Paciente | Coparticipação com origem; cobranças em aberto e pagas; Pagar com Pix; Baixar recibo | P-05a, R-05a |
| 39 | `47:2055` | Portal · Direitos do titular (RF39) | Paciente | Quatro direitos com botão Solicitar; Revogar canais | P-06, R-06 |
| 40 | `48:2046` | Orçamento · Fluxo de quatro etapas (RF31) | Administrador | Tabela Etapa, Quem faz, O que faz, Não pode; aviso RC09; Devolver; Aprovar | A-18, M-04, S-10, P-05b, R-05b |
| 41 | `48:2140` | Painel financeiro consolidado (RF35) | Administrador | Quatro cartões: a receber de paciente, de operadora, cartão em trânsito, contas a pagar | A-12 |
| 42 | `48:2209` | Conciliação de recebíveis (RF49) | Administrador | Tabela explicativa Divergência, Causa provável, Tratamento | A-15 |
| 43 | `49:2205` | Contas a pagar (RF50) | Administrador | Tabela Fornecedor, Categoria, Vencimento, Valor, Situação | A-14 |
| 44 | `49:2316` | Elegibilidade e autorização prévia (RF52, RF53) | Secretária | Tabela explicativa Resultado, O que significa, Conduta | A-21, S-13 |
| 45 | `49:2405` | Guia TISS · Crítica prévia (RF54) | Secretária | Guia SP/SADT em rascunho; Carteirinha, Senha, CID; crítica com 3 de 8 motivos | A-22, S-14 |
| 46 | `51:2364` | Lote de cobrança e protocolo (RF55) | Secretária | Tabela Lote, Operadora, Guias, Enviado, Protocolo, Situação | A-23, S-15 |
| 47 | `51:2476` | Demonstrativo de análise e glosa (RF56) | Secretária | Tabela explicativa Natureza, Exemplo, Recorrível, Prevenção; texto cita o índice de glosa | A-24, S-16a |
| 48 | `51:2566` | Recurso de glosa (RF57) | Secretária | Tabela Item glosado, Valor, Motivo, Prazo restante; envelope fechado | A-25, S-16b |
| 49 | `52:2532` | Log de auditoria (RF40) | Administrador | Tabela Data e hora, Usuário, Papel, Ação, Registro | A-31 |
| 50 | `52:2653` | Dashboard gerencial (RF41) | Administrador | Quatro cartões: absenteísmo, espera média, conversão de orçamento, índice de glosa | A-29 |
| 51 | `52:2722` | Relatórios administrativos cruzados (RF42) | Administrador | Dimensão, De, Até; Gerar relatório; supressão por recorte estreito | A-30 |
| 52 | `74:199` | Usuários e papéis (RF03) | Administrador | Tabela Nome, E-mail, Papel, Situação, Último acesso | A-04 |
| 53 | `75:3383` | Observações Gerais · fronteira de conteúdo (RF15, RC07) | Secretária | Área de texto; "Pertence aqui" e "Não pertence aqui"; cabeçalho "Dr. XXXXX / Secretária" | S-01c |
| 54 | `74:332` | Contas a receber · baixa financeira (RF32) | Administrador | Tabela Devedor, Origem, Vencimento, Valor, Situação | A-13a |
| 55 | `75:436` | Recibo e NFS-e · emissão (RF33, RF34) | Administrador | Título pago, Pagador, Valor, Beneficiário, Forma, Número sequencial; IBS e CBS | A-19, S-11 |
| 56 | `74:441` | Estoque · Produtos e lotes (RF36) | Administrador | Tabela Produto, Tipo, Unidade, Saldo, Lote · validade | A-26, M-05a, S-17 |
| 57 | `74:550` | Estoque · Movimentação (RF37) | Secretária | Tabela Data, Produto, Lote, Tipo, Quantidade | A-27, M-05b, S-18 |
| 58 | `75:199` | Estoque · Alertas de mínimo e validade (RF38) | Administrador | Tabela explicativa Alerta, Gatilho, Destinatários, Efeito, Situação | A-28, S-19 |
| 59 | `75:554` | Contrato e tabelas da operadora (RF51) | Administrador | Operadora, Nº do contrato, Vigência, Versão TISS, Meio de transmissão, Cód. do prestador | A-20 |
| 60 | `75:327` | Notificações · Configuração e histórico (RF59) | Administrador | Tabela Evento, Canal, Destinatário, Enviado em, Situação | A-32 |

Na página, os frames 52, 54, 56, 57, 58, 60, 55, 59 e 53 estão depois do 51, fora de ordem.

### 2.7 Problemas transversais, confirmados e completados

| # | Problema | Evidência |
|---|---|---|
| 1 | Item ativo do menu errado | Nos 52 frames com menu, o ativo é sempre o primeiro item da variante: "Cadastro" em 40 frames (23 da Secretária e 17 do Administrador), "Atendimentos do Dia" nos 8 do Médico, "Meus Agendamentos" nos 4 do Paciente |
| 2 | Texto de regra exibido ao usuário | 151 textos em 59 dos 60 frames citam um identificador (RN-, RC, RF, RNF, A-R ou X). Só o frame 01 não tem nenhum. Há ainda notas explicativas sem identificador |
| 3 | Listagens sem ações e sem status editável | Nenhum frame de listagem tem ícone: zero vetores. Não existe pílula com seta. A coluna Ações só existe nos frames 10 (texto "Abrir"), 12, 13, 26, 27 e 49 |
| 4 | Tabelas que explicam em vez de listar | Os frames 36, 42, 44, 47 e 58 mostram uma tabela sobre a regra, não os registros. O 40 mostra a tabela das quatro etapas no lugar do orçamento |
| 5 | Cabeçalho do frame 53 | "Dr. XXXXXXXXX XXXXX / Secretária" |
| 6 | Frame 35 mostra o esperado à Secretária | Campos "Saldo esperado" e "Divergência" |
| 7 | Contraste | 496 de 1.733 textos visíveis da página 4 ficam abaixo do mínimo (28,6%). Lista abaixo |
| 8 | Mensagens que revelam demais | Frame 03: "Conta temporariamente bloqueada". Página 0, login com erro: "5/5 tentativa…" |
| 9 | Texto do frame 28 | "Visível apenas aos médicos da equipe responsável", contra a decisão D2 |
| 10 | Protótipo só em 1024 × 720 | O RNF17 pede largura mínima de 768 px nas telas clínicas; a seção 19 da v2.1 declara que o layout responsivo não foi desenhado |

Sobre as pílulas, uma correção ao que o pedido dizia: **Finalizado** (branco sobre verde, 2,53) e **Cancelado** (branco sobre vermelho, 3,76) reprovam; **Não Compareceu** usa texto #334155 sobre âmbar, dá 4,82 e passa.

Combinações que reprovam na página 4:

| Texto sobre fundo | Tamanho | Razão | Textos | Onde |
|---|---|---|---|---|
| #6096b4 sobre #ffffff | 11, 12 e 14 px | 3,22 | 221 | notas, valores de campo, botão secundário, legendas |
| #ffffff sobre #6096b4 | 11 a 14 px | 3,22 | 147 | botão primário, item ativo do menu, rodapé, marca do checkbox |
| #ffffff sobre #bdcdd6 | 24 px | 1,63 | 60 | "Clinic" na marca, uma vez por frame |
| #6096b4 sobre #f8f9fa | 11 e 12 px | 3,06 | 42 | legendas sobre o fundo da página |
| #ef4444 sobre #ffffff ou #f8f9fa | 11 a 20 px | 3,5 a 3,7 | 14 | mensagens de erro |
| #3b82f6 sobre #ffffff ou #f8f9fa | 12 e 14 px | 3,4 a 3,6 | 4 | links |
| #ffffff sobre #10b981 | 13 px | 2,53 | 3 | pílula Finalizado |
| #71808f sobre #bdcdd6 | 14 px | 2,48 | 3 | botão desabilitado, que a WCAG isenta |
| #ffffff sobre #ef4444 | 13 e 14 px | 3,76 | 2 | pílula Cancelado e botão Perigo |

### 2.8 O que existe por papel no Figma

| Papel | Frames hoje | Menu hoje | O que falta |
|---|---|---|---|
| Geral | 8 (01 a 07 e 09) | — | Aviso de expiração, acesso negado por registro, meu perfil, erro inesperado, variante do convite para o Responsável |
| Administrador | 17 | 5 itens, sem submenu | Início, agenda da clínica, fila em leitura, supervisão de caixa, aprovação de estornos, solicitações LGPD, parâmetros; variantes próprias de pacientes, TISS e movimentações |
| Médico | 8 | 6 itens | Meus pacientes, minha agenda, orçamento na etapa 1, estoque, pendências clínicas |
| Secretária | 23 | 5 itens, sem submenu | Agenda da clínica, cobranças do dia, caixa com fechamento cego, orçamento na etapa 2, recibos, produtos sem custo, alertas |
| Paciente | 4 | 4 itens | Início, agendar consulta, aceite de orçamento, dados cadastrais |
| Responsável Legal | 0 com menu (o 09 é dele, sem menu) | 4 itens na variante | Todas as telas do portal na terceira pessoa, faixa do representado, acesso encerrado por maioridade |

## 3. Código React

Create React App (`react-scripts` 5.0.1) com React 19.3.0, `react-router-dom` 7.18.4, `bootswatch` 5.3.8, `@mui/icons-material` 9.4.0, `axios` 1.20.0 e `toastr` 2.1.4. O `README.md` é o padrão do Create React App, sem imagens.

| Rota | Componente | Estado |
|---|---|---|
| `/` | redireciona para `/listagem-cadastro` | — |
| `/listagem-cadastro` | `views/listagem-cadastro.js` | Implementada: pacientes com busca e paginação de 6 |
| `/listagem-filadia` | `views/listagem-filadia.js` | Implementada: fila do dia com pílulas, paginada |
| `/listagem-agenda` | `views/listagem-agenda.js` | "Tela em construção." |
| `/listagem-financeiro` | `views/listagem-financeiro.js` | "Tela em construção." |
| `/listagem-estoque` | `views/listagem-estoque.js` | "Tela em construção." |
| `/cadastro-pacientes/:idParam?` | `views/cadastro-pacientes.js` | "Tela em construção." |
| `/listagem-usuarios` | `views/listagem-usuarios.js` | Componente vazio; a rota existe e não está no menu |

| Componente | O que faz | Classes Bootstrap |
|---|---|---|
| `navbar.js` | Marca "YOURClinic" e bloco de usuário (nome e papel) | `navbar navbar-dark bg-primary` |
| `menu-lateral.js` | Cinco itens fixos: Cadastro, Agenda, Fila do Dia, Financeiro, Estoque | `nav nav-pills flex-column` |
| `navbarItem.js` | Item de menu com `NavLink` e ícone | `nav-item`, `nav-link` |
| `pilula-status.js` | Os seis estados do RF22 | `badge rounded-pill` |
| `paginacao.js` | Voltar, "Página X de Y", Avançar | `pagination` |
| `footer.js` | Contato da clínica | `bg-primary text-white` |
| `card.js`, `sub-card.js` | Cartão com título | `card` |
| `form-group.js` | Rótulo e campo | — |
| `toastr.js` | Mensagens de sucesso, erro e alerta | — |

Ícones já importados no menu: HowToReg, CalendarMonth, FormatListNumbered, Payments, Inventory2.

**Por papel:** só existe a visão da Secretária. O `App.js` fixa o usuário "Mariana Alves" e o papel "Secretária", e o menu é único. Não há login, guarda de rota, acesso negado nem sessão expirada. As lacunas estão em [05-lacunas-no-codigo.md](05-lacunas-no-codigo.md).

## 4. API simulada

`https://yourclinic-api.onrender.com` responde no estilo json-server, com 52 coleções, sem autenticação e sem distinção de papel. Entre elas: `usuarios` (com um campo `senha`), `registrosClinicos`, `prescricoes`, `anotacoesPrivadas`, `pacientes` (com `observacoesGerais`), `produtos` (com `custoAquisicao`), `caixas` e `logsAuditoria`. Só os nomes de coleções e campos foram lidos. O detalhe e as consequências estão em [05-lacunas-no-codigo.md](05-lacunas-no-codigo.md).
