# 04 · Verificação das telas redesenhadas

Data: 09/10/2026 · Arquivo Figma `VJzwLNJrl8grgstMPlUVw0` · páginas `5 · Geral` a `10 · Responsável Legal`.

A verificação teve três partes: scripts somente leitura rodados por quem construiu as telas; quatro verificadores independentes, um por papel, que receberam só a matriz e as regras; e uma releitura por script depois das correções. Nenhuma tela dá a um papel dado que a matriz oculta. Os verificadores apontaram 43 pontos: 20 viraram correção de tela, 20 viraram ajuste da matriz, 2 ficaram como estão, com justificativa, e 1 ficou pendente (seção 7).

As seções 1 a 10 registram a primeira rodada, de 09/10/2026, com 110 telas. A seção 11 registra a segunda, de 19/10/2026, depois que entraram A-07c, A-07d e os 17 frames de celular do portal: 112 telas ao todo.

## 1. Resultado por critério do pedido

| Critério | Resultado |
|---|---|
| Menu do papel e item ativo corretos | 110 de 110 telas |
| Médico, Secretária, Paciente e Responsável sem valor financeiro consolidado | Nenhuma ocorrência |
| Administrador, Secretária, Paciente e Responsável sem campo clínico | Nenhuma ocorrência |
| Administrador sem "Observações Gerais" | Nenhuma ocorrência |
| Excluir só nas hipóteses de A1-R09 | 3 telas: A-11a, M-02f, S-05b |
| Baixar só onde o papel pode exportar | 5 telas: A-19, A-30, M-02e, M-02g, S-11 |
| Contraste de texto 4,5:1 e de ícone e borda de campo 3:1 | Nenhum texto abaixo do mínimo; ver os isentos na seção 5 |
| Texto de regra fora da interface | 3 ocorrências achadas e corrigidas; 0 na releitura |
| Todo RF com tela | 59 de 59 |
| Toda tela com nota de implementação | 110 de 110 |

## 2. Estrutura e cobertura

| Página | Seções | Telas | Notas | Textos lidos na releitura |
|---|---|---|---|---|
| 5 · Geral | 4 | 14 | 14 | 222 |
| 6 · Administrador | 7 | 39 | 39 | 2.815 |
| 7 · Médico | 6 | 14 | 14 | 671 |
| 8 · Secretária | 6 | 28 | 28 | 1.653 |
| 9 · Paciente | 6 | 7 | 7 | 313 |
| 10 · Responsável Legal | 7 | 8 | 8 | 358 |
| **Total** | **36** | **110** | **110** | **6.032** |

- Os 110 nomes de frame são idênticos à coluna "Nome do frame no Figma" de `02-matriz-por-papel.csv`: 110 iguais, nenhum código sem frame, nenhum frame sem linha. As correções não mudaram nenhum nome.
- Cada tela tem uma `NotaImplementacao` ao lado, fora do frame, com o código igual ao nome da tela.
- Os 59 RF da v2.1 aparecem em pelo menos uma tela. RC01 a RC10 têm ponto de verificação em `02-matriz-por-papel.md`.
- Na matriz, 104 telas estão "ok", 2 em "conflito" (M-02f, R-04) e 4 em "lacuna" (G-04b, A-33, A-34, S-07d), explicadas em `DECISOES.md`.
- As duas páginas antigas foram renomeadas para `z · Arquivo · telas v2.1 (referência)` e `z · Arquivo · navegação antiga`. Nada foi apagado. `00-inventario.md` descreve o arquivo como estava antes do redesenho.

## 3. Menu lateral e item ativo

| Papel | Telas | Erros | Observação |
|---|---|---|---|
| Geral | 14 | 0 | Menu só em G-07b, G-08a, G-08b e G-10; as demais são telas de acesso |
| Administrador | 39 | 0 | Confirmado pelo verificador |
| Médico | 14 | 0 | Confirmado pelo verificador |
| Secretária | 28 | 0 | Confirmado pelo verificador |
| Paciente | 7 | 0 | Confirmado pelo verificador |
| Responsável Legal | 8 | 0 | R-07 sem menu por desenho; `FaixaRepresentado` em R-01 a R-06; nenhum rótulo em primeira pessoa |

## 4. Sigilo

| Regra | Evidência |
|---|---|
| Sem valor consolidado para Médico | Só nomes de etapa ("2. Valores"), "Saldo" como quantidade em estoque e "glosa" sem valor |
| Sem valor consolidado para Secretária | Só valor por linha. "Valor total" (S-07c) é de uma cobrança; "Total do orçamento" (S-10) é de um orçamento. S-09 diz que há divergência, sem valor nem saldo esperado |
| Sem valor consolidado no portal | Só as cobranças e o orçamento do próprio titular ou do representado |
| Sem campo clínico para o Administrador | CID só como código em A-21 e A-22. A-18 mostra procedimento, quantidade e valor, sem justificativa clínica. A-27 passou a mostrar as saídas em atendimento somadas por mês (D31) |
| Sem campo clínico para a Secretária | CID só como código em S-13 e S-14. S-01d lista só metadados do anexo. S-16b mostra a fundamentação clínica como envelope fechado |
| Sem campo clínico no portal | Única menção: a descrição do PDF que o próprio titular gera em P-04 e R-04 |
| Dado de cartão | S-07d tem bandeira, quatro últimos dígitos, NSU e código de autorização, como o RF46 pede. Nenhuma tela tem campo de número, validade, código de segurança ou senha |
| Maioridade | R-07 não mostra o nome nem dado do ex-representado (D30) |

## 5. Contraste (WCAG 2.1 AA)

Critério: 4,5:1 para texto normal; 3:1 para texto grande, ícones e bordas de campo. Razões truncadas em duas casas.

| Página | Textos medidos pelo construtor | Abaixo do mínimo | Medição do verificador |
|---|---|---|---|
| Geral | 216 | 0 | Sem verificador independente |
| Administrador | 2.810 | 0 | 2.816 nós, 0 fora do modal |
| Médico | 666 | 0 | 666 trechos, 0 |
| Secretária | 1.646 | 0 | 1.622 trechos, 0 |
| Paciente | 291 | 0 | 291 nós, 0 |
| Responsável Legal | 336 | 0 | 336 nós, 0 |

Pares mais justos, todos aprovados:

| Par | Razão | Mínimo |
|---|---|---|
| Branco sobre #409fbf (marca de 24 px; ícone do item ativo) | 3,03 | 3 |
| Excluir #da3b21 sobre branco | 4,53 | 3 |
| Ícone de ação #767676 sobre branco | 4,54 | 3 |
| Borda de campo #767676 sobre branco / sobre #f8f9fa | 4,54 / 4,31 | 3 |
| Branco sobre #da3b21 (pílula Perigo) | 4,54 | 4,5 |
| Branco sobre #007fa9 (botão primário, menu ativo, rodapé) | 4,56 | 4,5 |
| Branco sobre #348452 (pílula Sucesso) | 4,60 | 4,5 |

Isentos:

- Componente desabilitado: os campos de G-03 (bloqueio de acesso) e um botão de S-03b e de A-08b.
- Conteúdo inerte atrás de modal: 43 textos de A-11b e de S-04 ficam sob o fundo escurecido; 7 deles cairiam abaixo do mínimo se contassem.
- Fora do critério pedido: borda do `Alerta` (1,98 a 2,48) e divisórias #dee2e6 (1,24 a 1,30) não são bordas de campo.

Corrigido depois da verificação: dados que o usuário só lê estavam em campo desabilitado, a 2,68:1 (G-10, S-07c, S-10, P-06, R-06). O `Campo` ganhou a variante "Somente leitura", com texto #222 sobre #eee (13,5:1), e os 12 campos passaram a usá-la.

## 6. Texto de regra dentro da interface

| Onde | Achado | Situação |
|---|---|---|
| `AreaTexto`, estado Selado (M-02c) | Legenda citava "(RF23)" e "(RF24)" | Corrigido no componente |
| A-31, registro de acessos | Célula "Orçamento · exceção RC09" | Corrigido: "Orçamento · exceção" |
| S-07a | "…segue para faturamento" | Corrigido: "…segue para a operadora" |

Releitura depois das correções: nenhum identificador (RF, RC, RN, RNF, PR, Xnn, An-Rnn) nos 6.032 textos das 110 telas, incluindo o interior das instâncias.

## 7. Verificadores independentes

Cada verificador leu uma página sem ter participado da construção. Colunas: **Tela** = corrigido no Figma; **Matriz** = a tela estava certa e a matriz foi ajustada; **Mantido** = fica como está.

### Administrador · 39 telas

| Achado | Tratamento |
|---|---|
| A-31: texto "RC09" na tabela | Tela |
| A-14: ícone Inativar em título em aberto | Tela: Ver e Editar |
| A-15: ícone Editar na linha divergente | Tela: só Ver; a seta da pílula trata a divergência |
| A-04: pílula com seta em contas de Médico e de Paciente | Tela: sem seta |
| A-27: saídas listadas uma a uma, com destino "Paciente" | Tela: somadas por mês (D31, PR-26) |
| A-11a: Excluir na mesma linha citada pelo alerta de consultas atingidas | Tela: lixeira em bloqueio sem consulta atingida, com legenda |
| A-33: subitem sem "(LGPD)" | Tela: rótulo completo no componente |
| A-10: checkbox "Domingo" fora da área visível | Tela (o mesmo em S-05a) |
| A-11a: datas e rótulo de submenu truncados | Tela (seção 8) |
| A-13a: ícone Estornar em título pago | Matriz: o atalho abre A-17 |
| A-02b: botão "Baixar histórico" | Matriz: Exportar passou a constar em A-02b |
| A-07: botão "+ Novo agendamento" | Matriz: atalho para A-08a |
| A-19: ícones Baixar | Matriz: verbo Exportar |
| A-16: botão "Devolver" | Matriz, e proposta PR-24 |
| A-11b: textos sob o fundo escurecido | Mantido: conteúdo inerte atrás do modal |
| A-07: visões Semana e Mês sem frame | **Pendente** (D33) |

### Médico · 14 telas

| Achado | Tratamento |
|---|---|
| M-02c: legenda com RF23 e RF24 | Tela |
| M-02g: ícone Ver em exportação que ainda está sendo gerada | Tela: linha sem ação |
| M-03: seletor oferecia Dia; o pedido prevê Semana e Mês | Tela: `SeletorVisao` ganhou a propriedade "Dia" |
| M-03: cabeçalho da grade desalinhado das colunas | Tela: sete colunas iguais |
| M-01: pílula "Finalizado" com seta | Matriz: o RF22 permite voltar a Em atendimento, com motivo (D32) |
| M-04: ícone Ver nas etapas 2 em diante | Matriz: Consultar só do escopo clínico (D32, PR-25) |
| M-02d: ícone Ver nos itens da prescrição | Matriz: verbos Consultar e Retificar |
| M-02a, M-05a: link e botão de verbo de outra tela | Matriz: atalhos para M-02h e M-05b |
| M-01: menu de transições aberto cobre a linha seguinte | Mantido: é como um menu aberto se comporta |

### Secretária · 28 telas

| Achado | Tratamento |
|---|---|
| S-05b: nada marcava a linha com Excluir como bloqueio sem consulta atingida | Tela: lixeira em outra linha, com legenda |
| S-01a, S-06: pílulas cortadas pela célula | Tela (seção 8) |
| S-07d: campos "Bandeira" e "Quatro últimos dígitos" | Matriz: o RF46 pede os dois (D32) |
| S-10: botão "Devolver ao médico" | Matriz: previsto na etapa 2 do RF31 |
| S-06: pílula "Na recepção" com seta | Matriz: Não compareceu ou Cancelar; nunca Em atendimento |
| S-16a: pílula "Glosado" com seta | Matriz: abre o recurso (S-16b) |
| S-06, S-08, S-02: "Cobrar", "Recibo", "+ Novo agendamento" | Matriz: atalhos para S-07a, S-11 e S-03a |
| S-01b: "Baixar histórico" e "Registrar pedido do titular" | Matriz: verbos passaram a constar em S-01b |
| S-01d: coluna "Enviado por" | Matriz |
| S-15: coluna "Guias" com a quantidade | Matriz: o oculto é o total em valor |
| S-04, S-10: ícone Ver | Matriz: verbo Consultar |

### Portal · Paciente e Responsável Legal · 15 telas

| Achado | Tratamento |
|---|---|
| R-07: nome do ex-representado no aviso | Tela: texto sem nome (D30) |
| P-05a, R-05a: faltava a NFS-e | Tela: "Recibo" e "NFS-e" na cobrança paga |
| P-06, R-06: faltavam as notificações recebidas e o pedido de revogação | Tela: linha "Revogação de consentimento" e tabela "Notificações recebidas" |
| P-06, R-06: dados cadastrais a 2,68:1 | Tela: campo somente leitura |
| P-03, R-03: "Ligue para a recepção" truncado | Tela (seção 8) |
| P-01, R-01, P-03, R-03: "Pagar" e "Agendar consulta" | Matriz: atalhos |
| R-07: botões "Sair" e "Ver outros representados" | Matriz: são navegação |

## 8. Layout

Um script mediu a largura natural de cada texto e comparou cada filho com o seu contêiner, entrando nas instâncias.

| Medida | Antes das correções | Depois |
|---|---|---|
| Textos truncados com reticências | 85 | 0 |
| Filhos que ultrapassam o contêiner | 297 | 0 |
| Telas com conteúdo ou menu invadindo o rodapé | não medido | 0 |

O que foi feito:

- As colunas de 81 das 82 tabelas foram redistribuídas pela largura que o conteúdo pede. A maioria passava 2 px da linha; as demais cortavam pílula, data ou telefone.
- Em cinco tabelas o conteúdo não cabia e o texto de exemplo foi encurtado: A-02a, A-03, A-31, S-01a e S-06.
- O rótulo do `MenuSubitem` passou a quebrar em duas linhas. Cinco rótulos eram cortados, entre eles "Bloqueios e consultas afetadas".
- 34 frames ficaram mais altos para o rodapé não encostar no menu ou no conteúdo: 32 do Administrador, mais P-06 e R-06.

## 9. O que mudou nos componentes depois da verificação

| Componente | Mudança |
|---|---|
| `Campo` | Variante nova `Tipo=Texto, Estado=Somente leitura` |
| `SeletorVisao` | Propriedade booleana "Dia" |
| `MenuSubitem` | Rótulo em até duas linhas, altura automática |
| `MenuLateral/Acordeao` | Rótulo "Solicitações dos titulares (LGPD)"; variantes reempilhadas |
| `AreaTexto` | Legenda do estado Selado sem citar requisito |

## 10. Limites desta verificação

- **Os verificadores não releram as telas depois das correções.** A releitura das seções 6 e 8 é de quem corrigiu.
- **O contraste não foi medido de novo por script depois das correções.** Os elementos acrescentados usam componentes já medidos; a única combinação nova é a do campo somente leitura.
- **A página Geral não teve verificador independente**: o pedido previa um por papel. Vale a varredura do construtor.
- Duas buscas do construtor não acharam o texto de A-31 porque a busca usada não entrava nas instâncias; foi o verificador que o localizou. As varreduras finais percorrem as instâncias.
- A-34: não foi conferido se os botões Editar ficam só nos parâmetros que cabem ao Administrador.
- O destino dos ícones Ver e o conteúdo dos menus de transição que não foram desenhados abertos não aparecem em frame estático.
- Regras que dependem de dados, como "pacientes da sua equipe" e o sigilo do adolescente em R-04, não aparecem em tela.
- O portal está em 1024 px de largura; a variante de celular não foi desenhada (D29).
- Navegação por teclado, ordem de foco e leitor de tela dependem do código. A aplicação não foi executada.

## 11. Segunda rodada (19/10/2026)

Depois das correções, os quatro verificadores releram as próprias páginas e um quinto, novo, leu a página Geral. Antes disso entraram as telas A-07c (Semana) e A-07d (Mês), e as 15 telas do portal ganharam a versão de celular (D29, D33). A-34 foi conferida: os botões Editar ficam só em parâmetros que a v2.0 atribui ao Administrador.

| Página | Resultado | O que ainda foi corrigido |
|---|---|---|
| Geral (14) | Sem violação de A a H | Rodapé de G-07b atrás do fundo escurecido; frase de projeto trocada por texto de interface; notas de G-08a e G-10 |
| Administrador (41) | Sem violação | Rótulo "(LGPD)" do subitem ativo da A-33; nota de A-07d |
| Médico (14) | Sem violação | Notas de M-01 e M-04 harmonizadas |
| Secretária (28) | Sem violação | Cabeçalho "Valor de tabela" em S-08; nota de S-10 |
| Portal (15 + 17 de celular) | Sem violação nas telas de 1024 px | Cabeçalho de celular com nome e papel; margem de R-07; alvos de toque de 24 px no Checkbox, no "Trocar" e em 54 links em texto |

A última varredura por script, nas 112 telas e nos 17 frames de celular (6.809 textos), não achou identificador de requisito, texto truncado nem elemento fora do frame. Ela rodou antes do ajuste final dos alvos de 24 px, que aumentou a altura de 22 frames; esse ajuste não foi relido por verificador.
