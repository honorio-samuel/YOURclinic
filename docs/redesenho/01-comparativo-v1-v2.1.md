# 01 · Comparativo v1 × v2.1

Uma linha por identificador (RF, RNF, RC), com o que cada versão diz, o tipo de mudança e o efeito nas telas. Depois vêm os defeitos da v2.1, as lacunas do documento e o que a Especificação v2.0, recebida depois do checkpoint, resolveu.

Há três versões: a **v1** (42 RF), a **v2.0** (especificação completa, com fluxos, matriz de permissões e tabelas) e a **v2.1** (as mesmas regras da v2.0, reorganizadas por aspecto de uso, sem os fluxos e sem várias tabelas). As tabelas das seções 1 a 3 comparam a v1 com a v2.1; onde a coluna diz "lacuna", a seção 5 mostra o que a v2.0 traz.

| | v1 | v2.1 |
|---|---|---|
| Título | Requisitos Funcionais e Não Funcionais | Catálogo de regras por aspecto de uso |
| Requisitos funcionais | 42 (RF01 a RF42) | 59 (RF01 a RF59) |
| Requisitos não funcionais | 19 | 23 |
| Regras de confidencialidade | 8 | 10 |
| Papéis | 4 | 5 (Responsável Legal vira papel) |
| Permissões | matriz de 31 funcionalidades, em CRUD | 11 verbos; não há matriz consolidada |
| Regras de negócio numeradas | nenhuma | 174, em 11 aspectos (A1 a A11) |
| Parâmetros | valores fixos no texto | 50 (X01 a X51, sem X30) |
| Telas | — | 60 |

Tipos de mudança usados abaixo: **igual**, **alterado**, **novo**, **renumerado** (o conteúdo mudou de RF), **corrompido** (o texto da v2.1 não serve) e **lacuna** (a v2.1 anuncia uma lista ou tabela que não está no arquivo).

Os códigos de tela (G-01, A-14, S-06…) são os de [02-matriz-por-papel.md](02-matriz-por-papel.md).

## 1. Requisitos funcionais

| ID | v1 | v2.1 | Mudança | Impacto em tela |
|---|---|---|---|---|
| RF01 | Login por e-mail e senha; 5 falhas em 15 min bloqueiam por 15 min; tudo no RF40 | Limites viram X01 a X03; bloqueio por conta e não por IP (A1-R01); tempo de resposta igual para conta existente ou não (A1-R02) | alterado | G-01, G-02, G-03 com texto neutro |
| RF02 | Convite de 72 h e uso único; redefinição por e-mail; troca pelo usuário; logout; não revela se o e-mail existe | X04 e X05; novo token invalida o anterior (A1-R04); eventos no RF40 | alterado | G-04a, G-04b, G-05, G-06, G-10; menu do avatar |
| RF03 | Administrador cria, edita e desativa; um papel por conta; nunca exclui | Troca de papel encerra vínculos (A1-R06); Médico exige cadastro por restrição de banco (A1-R07); sempre um Administrador ativo (A1-R08); três hipóteses de exclusão (A1-R09) | alterado | A-04; nenhuma lixeira fora da A1-R09 |
| RF04 | Menus e rotas por papel (4 papéis); bloqueio também em campo e backend | Três camadas da RC03; papel lido da sessão (A1-R10); rota do portal não recebe ID de paciente (A1-R11) | alterado | MenuLateral por papel; G-08a, G-08b |
| RF05 | Vínculo pendente → ativo → histórico por 90 dias → encerrado | X06; vários médicos por paciente (A2-R01); promoção só no dia e a partir de Na Recepção, registrada como concessão (A2-R03); expiração avaliada a cada requisição (A2-R04) | alterado | M-01 (Chamar), M-02a (filtro por vínculo) |
| RF06 | Justificativa obrigatória; destaque no log; avisa o Administrador; expira em 24 h | X07; não alcança anotações privadas de outros (A2-R05); registro criado sob exceção fica marcado (A2-R06) | alterado | M-02h; pendência no A-01 |
| RF07 | CRUD pela Secretária e pelo Administrador; campos obrigatórios; CPF único; exceção sem CPF | Sem campo clínico, com auditoria de esquema (A3-R01); paciente é inativado, não excluído (A3-R02). A lista de campos não é repetida | alterado | A-02a, A-02b, S-01a, S-01b; Inativar no lugar de Excluir |
| RF08 | Registro do responsável (nome, CPF, parentesco); acesso encerra aos 18 anos | Responsável Legal é papel com conta própria (A1-R14); não vê anotações privadas (A3-R03); inativar o paciente inativa as representações (A3-R04) | alterado | G-09, G-04b, telas R, R-07 |
| RF09 | Convite a partir do cadastro; confere CPF e nascimento; sem autocadastro | Tentativas limitadas por X01 e token invalidado no excesso (A1-R13); o destinatário do convite define o papel (A1-R14) | alterado | G-04a, G-04b; ação de convite em A-02 e S-01 |
| RF10 | CRUD pelo Administrador; vínculo com a conta | Médico é inativado, não excluído (A3-R05); inativar encerra conta e vínculos (A3-R06) | alterado | A-03 |
| RF11 | Nome, operadora, contato | Registro ANS obrigatório (A3-R07); inativa, não exclui (A3-R08) | alterado | A-05 |
| RF12 | Código, descrição, tipo, duração, preço particular e por convênio | Duração múltipla de X11 (A3-R09); preço copiado na emissão (A3-R10); TUSS obrigatório para convênio (A3-R11); preço por operadora passa ao contrato (RF51) | alterado | A-06, A-20 |
| RF13 | Blocos por médico, pelo Administrador ou pela Secretária | X11, X12; grade por médico (A3-R12); horário em UTC, exibido no fuso da clínica (A3-R14) | alterado | A-10, S-05a, M-03 |
| RF14 | Bloqueio pontual ou recorrente; lista as consultas afetadas | Recorrência avaliada a cada agendamento (A3-R15); motivo de lista fechada (A3-R16) | alterado | A-11a, S-05b |
| RF15 | Secretária escreve; Secretária e Médico leem | Invisível ao Administrador, com bloqueio na serialização (A3-R17); fora das exportações (A3-R18); aviso em vez de classificação automática (A3-R19) | alterado | S-01c; campo ausente em A-02b; leitura em M-02a |
| RF16 | Secretária e Paciente agendam: médico, horário, tipo | Só a confirmação cria vínculo pendente (A4-R01); grava o preço vigente (A4-R02) | alterado | A-08a, S-03a, P-02, R-02 |
| RF17 | Convênio da consulta, pela Secretária | Trocar depois da guia exige cancelar a guia (A4-R04); lista de pendências de conferência (A4-R05) | alterado | S-03a; painel do S-06 |
| RF18 | Validação de paciente e de médico; unicidade no banco | Erro de unicidade tratado como conflito, nunca como erro interno (A4-R07); índice único parcial por estado (A4-R08) | alterado | A-08b, S-03b |
| RF19 | Paciente cancela até 24 h antes | X08; vale também para o Responsável Legal; sem regra própria | alterado | P-03, R-03 |
| RF20 | Secretária e Administrador remarcam ou cancelam com motivo, inclusive em lote | Lote transacional (A4-R09); troca de médico troca o vínculo (A4-R10); confere a validade da autorização X41 (A4-R11) | alterado | S-04, A-11b |
| RF21 | Confirmação, lembrete de 24 h e aviso; só data, hora, médico e local | X09, X44, X45; sem nome de procedimento (A4-R12); falha vira contato manual (A4-R14); revogação suprime lembretes (A4-R15) | alterado | A-32; painel do S-06; P-06 |
| RF22 | Máquina de seis estados; retroativas com registro; Secretária marca Não Compareceu após 30 min | X10, X28; carimbo em cada transição (A4-R16); nada deriva de dado clínico (A4-R17); atualização empurrada (A4-R18) | alterado | S-06, M-01, A-09; PilulaStatus/Interativa |
| RF23 | Médico registra com a consulta Em Atendimento; sela ao finalizar | Criptografia em repouso (A5-R01); selamento irreversível (A5-R02) | alterado | M-02b |
| RF24 | Retificação cria nova versão com autor, data e motivo | Nenhuma rota apaga conteúdo selado (A5-R03); só o autor retifica (A5-R04); motivo distinto a cada vez (A5-R05) | alterado | M-02c; ícone Retificar |
| RF25 | Itens, classificação e aviso de controle especial | Impressão com identificação do médico (A5-R06); item controlado exige conferência no estoque (A5-R07) | alterado | M-02d, M-05b |
| RF26 | Médico e Secretária enviam PDF, JPG ou PNG de até 5 MB | X13; o titular também envia, e o arquivo fica pendente de aceite médico (A5-R10) | alterado | M-02e, S-01d, P-04, R-04, M-06 |
| RF27 | Conteúdo para o Médico da equipe e o Paciente; metadados para a Secretária | URL assinada não reutilizável (A5-R11); sem miniatura para a Secretária (A5-R12) | alterado | M-02e, S-01d, P-04 |
| RF28 | "Visível e editável apenas pelos médicos da equipe responsável" | "Anotações pessoais do profissional"; fora de toda exportação; exclusão permitida e registrada; não revelada ao titular (A5-R14 a A5-R18) | alterado | M-02f; decisão D2 |
| RF29 | PDF administrativo para os quatro papéis | X25, X26; identificador de verificação (A5-R19); sem motivo de cancelamento (A5-R20); inclui o Responsável Legal | alterado | M-02g, A-02a, S-01a, P-04, R-04 |
| RF30 | PDF clínico para o Médico da equipe e o Paciente, por link com expiração | X42; a rota recusa Secretária e Administrador (A5-R22); dois identificadores quando pedido pelo responsável (A5-R23); arquivo estruturado na portabilidade (A5-R24) | alterado | M-02g, P-04, R-04 |
| RF31 | Três etapas: Médico, Secretária, Administrador aprova | Quatro etapas, com aceite do titular (A7-R02); acesso do Administrador pela RC09 (A7-R03) | alterado | M-04, S-10, A-18, P-05b, R-05b |
| RF32 | Registro de pagamento e baixa, pela Secretária; estorno com aprovação | Contas a receber: razão de títulos; título pago não se edita (A7-R04); glosado aguarda o recurso (A7-R05); bruto e líquido separados (A7-R06). O pagamento em si foi para RF43 a RF48 | renumerado | A-13a, S-08 |
| RF33 | Secretária emite depois da baixa | Numeração sem lacunas, cancelado mantém o número (A7-R07); pagador e paciente distintos (A7-R08); sem CID (A7-R09) | alterado | S-11, A-19, P-05a |
| RF34 | Interface preparada; só o Administrador; IBS e CBS fora | Campos da reforma tributária; alíquotas em tabela (A7-R11); nota visível ao titular (A7-R12) | alterado | A-19, P-05a |
| RF35 | Saldo, a receber e a pagar; só o Administrador | X35, X36, X38; todo número navega até a origem (A7-R14); competência separada de caixa (A7-R15) | alterado | A-12 |
| RF36 | CRUD pela Secretária e pelo Administrador; lote e validade; custo só para o Administrador | X46; saldo calculado pelas movimentações (A9-R02); produto é inativado (A9-R03) | alterado | A-26, S-17, M-05a |
| RF37 | Entrada por Secretária e Administrador; saída por Secretária e Médico, por lote | Secretária vê só a confirmação (A9-R04); associação item e paciente criptografada (A9-R05); item controlado exige conferência (A9-R06) | alterado | A-27, S-18, M-05b |
| RF38 | Alertas para Secretária e Administrador; 60 dias; vencido bloqueia | X14, X46; ninguém desbloqueia lote vencido (A9-R07); o Médico vê o alerta no atendimento (A9-R09) | alterado | A-28, S-19, S-06, M-01, M-02b |
| RF39 | Acesso, correção, portabilidade, revogação; registro com prazo | O responsável é um Administrador designado (A10-R01); prazo contado da abertura, com alerta (A10-R03) | alterado | P-06, R-06, S-01a, A-33 |
| RF40 | Lista de eventos; somente inserção | X43; gravação assíncrona (A11-R02); falha é incidente (A11-R03); guarda só a referência (A11-R04); registra RC09 e RC10 | alterado | A-31 |
| RF41 | Desfecho, tipo de atendimento e tempo de espera | X28; nada deriva de dado clínico (A11-R06); declara a data-base (A11-R07); ganha conversão de orçamento, divergência de caixa e índice de glosa | alterado | A-29 |
| RF42 | Relatórios que cruzam financeiro, estoque e atendimentos, sem dispensação identificada | Objetivo copiado do RNF20, parâmetros de backup e rastreabilidade errada | corrompido | A-30, com o texto da v1 |
| RF43 | — (era parte do RF32) | Checkout: cobrança com identificador próprio; parcelas por X32 e X33; nenhuma tela captura cartão (A6-R04); idempotente | novo | S-07a, A-13b, P-05a |
| RF44 | — | Pix com QR dinâmico; txid gerado pelo sistema; X31 | novo | S-07b, P-05a |
| RF45 | — | Cartão por TEF; um recebível por parcela no lojista; NSU obrigatório; X49 | novo | S-07c |
| RF46 | — | Cartão por maquininha avulsa; NSU e autorização obrigatórios; NSU repetido recusado; segundo usuário acima de um valor | novo | S-07d |
| RF47 | — | Dinheiro com abertura e fechamento de caixa; um operador por caixa; divergência no RF40 e no RF41 | novo | S-09, A-16 |
| RF48 | — (uma frase no RF32) | Cancelamento, estorno e chargeback distintos; o lançamento original nunca é apagado; X34 | novo | S-12, A-17 |
| RF49 | — | Conciliação com adquirente e PSP; nível 3; X35, X36, X47, X48 | novo | A-15 |
| RF50 | — (lacuna declarada) | Contas a pagar; taxa do adquirente como despesa; só o Administrador | novo | A-14 |
| RF51 | — (TISS fora do escopo) | Contrato e tabelas da operadora; X37, X38, X39, X50 | novo | A-20 |
| RF52 | — | Elegibilidade; nunca impede o atendimento; nível 2 | novo | S-13, A-21 |
| RF53 | — | Autorização prévia; só o Médico preenche justificativa e CID; X41 | novo | S-13, A-21, M-06 |
| RF54 | — | Guia TISS com crítica prévia; CID só como código | novo | S-14, A-22 |
| RF55 | — | Lote e protocolo imutável | novo | S-15, A-23 |
| RF56 | — | Demonstrativo e glosa; não baixa perda sozinho | novo | S-16a, A-24 |
| RF57 | — | Recurso de glosa; envelope clínico fechado; decisão do Administrador | novo | S-16b, A-25, M-06 |
| RF58 | — | Coparticipação; a clínica não arbitra o percentual; titular consulta a origem | novo | S-07a, S-13, P-05a, R-05a |
| RF59 | — (uma frase no RF21) | Tela, histórico e reenvio de notificações; supressão por revogação | novo | A-32, P-06, R-06 |

## 2. Requisitos não funcionais

| ID | v1 | v2.1 | Mudança | Impacto em tela |
|---|---|---|---|---|
| RNF01 | Argon2id ou bcrypt com custo 12 ou mais; tokens sob hash | Igual, incluindo o token de convite | igual | G-01 a G-06 |
| RNF02 | Lista: anamnese e diagnóstico, prescrições, anexos, anotações privadas | Anuncia "a lista completa" e não a traz; acrescenta credenciais de PSP e adquirente e o certificado da NFS-e; a A9-R05 inclui a dispensação | alterado, lacuna | nenhuma |
| RNF03 | 15 min em telas clínicas e financeiras; 8 h em administrativas | O texto só fala da rotação do identificador (agora também na troca de senha); os tempos estão em X15, X16 e X17, e o portal conta como tela clínica | alterado, lacuna | G-07, G-07b |
| RNF04 | Nada restrito em log, erro, URL ou título de página | Acrescenta as notificações | alterado | portal sem ID na URL |
| RNF05 | Guarda de 20 anos | Cita a Lei 13.787/2018 e proíbe exclusão em cascata | alterado | sem Excluir em paciente, médico, prontuário |
| RNF06 | Log somente inserção, encadeado | Retenção em X43, com piso de 20 anos | alterado | A-31 sem ações |
| RNF07 | Integridade referencial; unicidade do CPF e de médico com horário | Inclui responsáveis, contratos, guias e lotes; anuncia as "restrições de unicidade obrigatórias" e não as lista | alterado, lacuna | mensagens de conflito |
| RNF08 | CPF, telefone e anexos validados nos dois lados | Inclui valores monetários em decimal de precisão fixa | alterado | Campo em estado de erro |
| RNF09 | MIME real, antivírus, URL assinada, identificador não sequencial | Igual | igual | M-02e |
| RNF10 | RPO de 24 h, RTO de 4 h, teste trimestral | X18, X19, X51 | alterado | A-34 |
| RNF11 | 5.000 pacientes, 120 consultas, 15 simultâneos | X20, X21, X22 | alterado | A-34, só leitura |
| RNF12 | 1,5 s e 3 s nas telas transacionais | X23, X24; inclui o checkout | alterado | nenhuma |
| RNF13 | PDF e relatórios assíncronos | X25, X26; inclui os lotes TISS | alterado | estado "gerando" em M-02g, P-04, A-30, S-15 |
| RNF14 | Auditoria acrescenta no máximo 50 ms | X27 | alterado | nenhuma |
| RNF15 | Fila e dashboard em até 5 s | X28; inclui a espera do Pix | alterado | S-06, M-01, A-09, A-29, S-07b |
| RNF16 | Gateway, NFS-e e nuvem, para o futuro | Inclui PSP Pix, TEF, adquirente e TISS; exige camada de abstração | alterado | nenhuma |
| RNF17 | Tablet nas telas clínicas, desktop na recepção; 768 px | X29; anuncia "prioridades por contexto" e não as lista | alterado, lacuna | acordeão por clique; alvos de toque |
| RNF18 | WCAG 2.1 AA; contraste de 4,5:1 | Igual; declara que os valores são normativos | igual | tokens Yeti AA |
| RNF19 | Correlação; não revela registro de terceiro | Inclui dado de cartão e credenciais; sustenta a mensagem única da RC03 | alterado | G-02, G-08b, G-11 |
| RNF20 | — | Segurança de dados de cartão; anuncia "consequências de projeto" e não as lista | novo, lacuna | nenhuma tela tem campo de cartão |
| RNF21 | — | Idempotência; operação com dinheiro é atômica; lista ausente | novo, lacuna | S-07c |
| RNF22 | — | Contingência do checkout; lista ausente | novo, lacuna | S-07c para S-07d |
| RNF23 | — | Várias versões TISS ao mesmo tempo, por operadora | novo | A-20 |

## 3. Regras de confidencialidade

| ID | v1 | v2.1 | Mudança | Impacto em tela |
|---|---|---|---|---|
| RC01 | Mínimo necessário à função | Igual; as exceções são só as escritas (RC09 e RC10), sem analogia | alterado | todas |
| RC02 | Tabela de 15 documentos: quem edita, quem vê, observação | Só o parágrafo que explica a coluna Nível; a tabela não está no arquivo | lacuna | todas; vale a tabela da seção 6 |
| RC03 | Bloqueio na rota e no campo; o backend recusa e registra | "Três camadas", sem listá-las; mensagem idêntica para não autorizado e inexistente | alterado, lacuna | G-08a, G-08b |
| RC04 | Anotações privadas fora das exportações | Igual; a exclusão acontece na consulta, não na apresentação | alterado | M-02g, P-04, R-04 |
| RC05 | Efeito de cada estado do vínculo | Só a primeira frase; os efeitos por estado não estão no arquivo | lacuna | M-02a, M-02h |
| RC06 | Três níveis descritos | Os níveis não estão no arquivo; ganha a regra de derivação: somar eleva o nível | alterado, lacuna | S-08, S-09, S-15, S-16a |
| RC07 | Observações Gerais só com conteúdo logístico | Aviso permanente "com os exemplos acima"; os exemplos não estão no arquivo | alterado, lacuna | S-01c |
| RC08 | Secretária registra e não consulta; Administrador vê agregado | Igual, estendido aos relatórios; a associação passa a ser criptografada | alterado | S-18, A-27, A-30 |
| RC09 | — | Administrador vê o escopo do orçamento para aprovar, com registro; a lista de limites não está no arquivo | novo, lacuna | A-18 |
| RC10 | — | Secretária e Administrador veem o CID só como código; documentação clínica em envelope fechado | novo | S-13, S-14, S-16b, A-21, A-22, A-25, M-06 |

## 4. Defeitos da v2.1

Os seis primeiros estavam no pedido e foram confirmados no arquivo. Os demais apareceram na leitura.

| # | Defeito | Onde | Tratamento |
|---|---|---|---|
| 1 | RF42 com objetivo do RNF20 ("manter o sistema fora do escopo de armazenamento de dados de portador"), parâmetros X18, X19 e X51 e rastreabilidade RF51, RF57, RNF16 | Seção 13.3 | Vale o RF42 da v1 |
| 2 | X30 não existe: a tabela vai de X29 a X31 | Seção 16 | A capa fala em "50 parâmetros (X01 a X51)", o que é coerente com a ausência. Nenhuma regra do documento cita X30 |
| 3 | Tela 07 Sessão expirada rastreada ao RF30 | RF30, seções 17 e 18 | O correto é RNF03 e RF01. A tabela da seção 15 e o nome do frame no Figma já dizem RNF03 |
| 4 | Listas e tabelas anunciadas e ausentes | RC02, RC03, RC05, RC06, RC07, RC09, RNF02, RNF03, RNF07, RNF17, RNF20, RNF21, RNF22 | Faltam no .docx da v2.1 e estão todas na v2.0. Ver seção 5 |
| 5 | Sem matriz papel × funcionalidade | Documento inteiro | Existe na seção 6 da v2.0 e está copiada em [02-matriz-por-papel.md](02-matriz-por-papel.md) |
| 6 | Regras citam passos e exceções de fluxos que não estão no documento | Ver seção 7 | Os fluxos estão na v2.0 |
| 7 | O objetivo do RF31 fala em "três etapas"; a tela 40 e a A7-R02 têm quatro | Seção 9.1 | Valem quatro etapas. A v2.0 tem o mesmo descuido no título do fluxo, e a tabela dela lista as quatro |
| 8 | A célula da A6-R09 contém a tabela de exceções E1 a E6 do RF45 e o rótulo "Regras adicionais:", colados dentro do enunciado | Seção 8.3 | O texto é aproveitável: é o único fluxo de exceção que sobrou e serve à tela S-07c |
| 9 | "versãoável" no lugar de "versionado" ou "versionável" | A7-R10, A7-R11, A8-R02 | Erro de substituição automática; sem efeito em tela |
| 10 | A A6-R15 exige segundo usuário "acima de um valor configurável", e esse valor não tem código X | Seção 8.4 | Também sem código na v2.0; decisão D18 e proposta PR-10 |
| 11 | Salto na origem: a A5-R10 vem da RN-26.6 e a anterior, da RN-26.1 | Seção 7.4 | O salto existe também na v2.0: não há regra perdida |
| 12 | A evidência do RNF17 cita `componentes.css` com cortes em 900 e 600 px | Seções 15 e 19 | Esse arquivo não existe no repositório, que usa Bootstrap |
| 13 | RF11 e RNF16 citam "Módulo 7" | Seções 5.4 e 15.16 | Numeração da Especificação v2.0. Na v2.1 corresponde ao aspecto A8 (TISS) |
| 14 | Anotações privadas: a A3-R03 fala em "equipe médica" e a A5-R18, em "anotações pessoais do profissional" | Seções 5.2 e 7.6 | Decisão D2 |
| 15 | Unidade grudada no valor em alguns parâmetros: "1 dias úteis", "último dia dia do mês" | X12, X36, X37, X38, X39, X50 | Sem efeito; a tela A-34 mostra valor e unidade separados |

## 5. Lacunas documentais e o que a v2.0 resolveu

Em todos os casos abaixo o texto de abertura está na v2.1 e a lista ou tabela que ele anuncia não está. A conversão não perdeu nada (70.230 caracteres de um lado e do outro), então a falta é do arquivo.

A **Especificação de Requisitos v2.0** ("Requisitos_Sistema_Clinico_v2", de 25/08/2026) chegou depois do checkpoint. É o documento que a v2.1 reorganiza: as 174 regras da v2.1 estão nela com os mesmos identificadores, e os 50 parâmetros são os mesmos. Ela traz o que a v2.1 anunciava e não trazia.

| Cód. | O que falta na v2.1 | Está na v2.0? | O que a v2.0 traz | Situação |
|---|---|---|---|---|
| L1 | Texto do RF42 | Sim | Objetivo, fluxo de quatro passos e quatro restrições de conteúdo, entre elas suprimir o resultado quando o recorte identifica um único paciente | Fechada |
| L2 | Tabela da RC02 com a coluna Nível | Sim | 26 linhas, com nível, quem edita, quem consulta e justificativa | Fechada |
| L3 | As três camadas da RC03 | Sim | Interface, rota e campo no backend, cada uma com o seu teste. Campo mascarado reprova: ele não pode nem ser serializado | Fechada |
| L4 | Limites da exceção RC09 | Sim | Tabela do que o Administrador enxerga e não enxerga no orçamento | Fechada |
| L5 | Exemplos do aviso da RC07 | Sim | Quatro pares "pertence / não pertence" | Fechada |
| L6 | Fluxos, subfluxos por ator e exceções | Sim | Em cada RF | Fechada |
| L7 | Efeitos por estado do vínculo na RC05 | Sim | Tabela de quatro estados | Fechada |
| L8 | Os três níveis da RC06 | Sim | Tabela com abrangência, quem alcança e racional | Fechada |
| L9 | Lista de dados criptografados do RNF02 | Sim | Sete itens, incluindo CID em guia, dispensação e anexo de recurso | Fechada |
| L10 | Tempos de sessão do RNF03 | Sim | Tabela por contexto; as telas financeiras incluem RF43 a RF50 | Fechada |
| L11 | Restrições de unicidade do RNF07 | Sim | Seis restrições | Fechada |
| L12 | Prioridades por contexto do RNF17 | Sim | Tablet no atendimento clínico e na fila do Médico; desktop na recepção e no checkout; **celular no portal** | Fechada; consequência em D29 |
| L13 | Listas do RNF20, do RNF21 e do RNF22 | Sim | O que pode e o que nunca pode ser guardado de cartão; chave de idempotência por operação; contingência por provedor | Fechada |
| L14 | Parâmetro X30 | Não | A v2.0 também vai de X29 a X31 | Aberta |
| L15 | Código do limite de conferência do POS | Não | A RN-46.3 tem o mesmo texto, sem código | Aberta: D18 e proposta PR-10 |
| L16 | Salto de RN-26.1 para RN-26.6 | — | O salto existe também na v2.0: não há regra perdida | Esclarecida |

Continuam sem resposta em qualquer versão: o X30; o limite do POS; o que o Responsável Legal confere no primeiro acesso (D19); o prazo de resposta ao titular (D20); o número mínimo de registros do RF42; e os "30 dias" do padrão atípico de acesso de exceção, que estão fixos no texto do RF06. Cada um tem uma proposta em [06-proposta-de-requisitos.md](06-proposta-de-requisitos.md).

## 6. O que a v2.0 muda no redesenho

A tabela da RC02 e a matriz de permissões da v2.0 substituem as reconstruções feitas antes do checkpoint. A matriz está copiada em [02-matriz-por-papel.md](02-matriz-por-papel.md).

| Ponto | O que a v2.0 diz | Efeito |
|---|---|---|
| Matriz papel × funcionalidade | Seção 6, com cinco papéis e os onze verbos | Passa a ser a referência de verbos da matriz de telas |
| Administrador e a operação | Cria e edita a cobrança, mas não executa o checkout; não emite recibo; não registra saída de estoque; só consulta guias; aprova estorno, divergência de caixa e recurso mantido | A-13b, A-19, A-22, A-24, A-25 e A-27 mudaram (D27) |
| Indisponibilidade do Médico | O Médico registra bloqueio na própria agenda (RF14) | M-03 deixa de ser só leitura (D28) |
| Vínculos e exceções | O Administrador consulta todos os vínculos e pode revogar um acesso de exceção antes de X07 (RF05, RF06) | A-31 |
| Notificações | A Secretária consulta o histórico e reenvia notificação com falha (RF59) | Painel do S-06 |
| Portal | O titular vê o status da própria consulta no dia (RF22), os itens dispensados a ele (RF37), os estornos (RF48) e as notificações recebidas (RF59) | P-01, P-04, P-05a, P-06 e as equivalentes do Responsável |
| Agendar pelo portal | Começa pela especialidade; o titular informa o convênio, que fica "a conferir" (RF16, RF17) | P-02, R-02 |
| Orçamento | Etapa 2 registra desconto e validade; estados Devolvido e Expirado; em convênio, coparticipação e parte do plano aparecem separadas (RF31) | M-04, S-10, A-18, P-05b |
| Responsável legal | Natureza da representação; dois responsáveis com acesso independente; incapaz maior de idade não perde a representação aos 18; a recepção recebe a pendência de habilitar o titular (RF08) | S-01b, S-06, R-07 |
| Acesso de exceção | Justificativa com conteúdo mínimo; repetição em 30 dias é marcada como padrão atípico (RF06) | M-02h, A-31 |
| Estoque | Ajuste de inventário: Administrador sim, Secretária com aprovação; descarte com motivo de lista fechada (RF37) | A-27, S-18 |
| Dispositivo do portal | Celular (RNF17) | Cada tela do portal tem versão de 1024 px e de 390 px (D29) |

Três decisões do pedido contrariam o texto da v2.0 e foram mantidas, porque você as tomou conhecendo a alternativa: quem chama o paciente (D1), quem vê a anotação privada (D2) e o fechamento cego (D5). Para cada uma há uma proposta de alteração do requisito em [06-proposta-de-requisitos.md](06-proposta-de-requisitos.md).

## 7. Fluxos citados pela v2.1

Todos estão na v2.0. O que cada um definiu nas telas:

| Requisito | O que a v2.1 citava | O que a v2.0 traz | Tela |
|---|---|---|---|
| RF01 | Exceções E1, E2 e E3 | E1 "E-mail ou senha inválidos."; E2 bloqueio com mensagem que revela a conta; E3 usuário inativo com a mesma mensagem de E1; E4 primeiro acesso não concluído | G-02, G-03 |
| RF09 | Passo 3 | Conferência de CPF e data de nascimento antes de definir a senha | G-04a |
| RF16 | Exceção E1 | "Este horário acabou de ser preenchido. Escolha outro." | A-08b, S-03b |
| RF25 | Passo 3 | Aviso destacado em item de controle especial; classificação sem valor padrão | M-02d |
| RF39 | Passo 2 | Registro de data, tipo de direito, canal de entrada, responsável designado e prazo | A-33 |
| RF44 | Exceção E3 | Proibição de dar baixa por comprovante na tela do celular | S-07b |
| RF45 | Exceções E1 a E6 e passo 4 | Fluxo do balcão e as seis exceções | S-07c |
| RF57 | Passo 4 | Anexo clínico em envelope fechado | S-16b, M-06 |
| RF14 | Lista fechada de motivos | Férias, feriado, congresso, intervalo, outro | A-11a, S-05b, M-03 |
| RF54 | Bloqueios da crítica prévia | Oito bloqueios numerados | S-14 |
| RF56, RF59, RF48 | Quem executa | A Secretária importa o demonstrativo, reenvia notificação e solicita estorno; o Administrador aprova | S-16a, S-06, S-12, A-17 |

## 8. Parâmetros X

| Grupo | Parâmetros | Onde aparecem no redesenho |
|---|---|---|
| Administrador, com faixa | X01 a X10, X13 a X17, X31 a X33, X42, X44, X45, X48, X49 | A-34, editáveis, com recusa fora da faixa |
| Administrador, sem faixa | X18, X19, X43 (piso de 20 anos), X51 | A-34 (D17) |
| Administrador, conforme contrato com o adquirente | X34, X35, X36, X47 | A-34; o X47 é uma tabela por bandeira e modalidade |
| Administrador ou Secretária | X11, X12, X46 | Na tela de origem: grade (A-10, S-05a) e produto (A-26, S-17) |
| Por operadora | X37, X38, X39, X50 | A-20 |
| Informados pela operadora | X40, X41 | Só leitura |
| Premissas e metas de projeto | X20 a X29 | A-34, só leitura |
| Inexistente | X30 | — |

O X31 pede valor distinto por canal: balcão e portal.
