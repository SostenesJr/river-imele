# NavLog Amazônia

App web mobile-first (iOS, Android e desktop, via navegador) para consulta
de rotas fluviais, precificação e embarcações na malha do Amazonas. Login
individual por pessoa e dados compartilhados em tempo real via Supabase.
É um **PWA** (Progressive Web App): dá pra "instalar" pelo navegador e usar
como um aplicativo de verdade, com ícone próprio, sem barra de endereço.

## Estrutura (5 abas)

1. **Rotas** — lista com as 10 calhas (A–J). Ao abrir uma calha, mostra os
   municípios em ordem de passagem, com distância (km) e transit time de cada um.
2. **Informações** — somente leitura. Grade de balões compactos (o código do
   node, cor por calha, borda arredondada) agrupada por calha; municípios
   Aduaneiro/Corredor de Escoamento ganham um selo no canto do balão. Tocar num
   balão abre um pop-up com o nome do município e todas as informações:
   - Transit Time Amazon, distância e transit da rota
   - **Dias de saída do porto** (seg a dom), quando cadastrados
   - Preço por saca — **Seca** e **Cheia**
   - Embarcações mais usadas, com avaliação (estrelas) individual de cada
     uma, quando cadastrada
   - Classificação de segurança (Aduaneiro/Corredor), quando aplicável, em
     seção retrátil
   - **Observações** — campo de texto livre por município. Pessoal de cada
     usuário (ninguém mais vê a sua), salvo na conta de quem escreveu — não
     depende do aparelho.
3. **Configurações** — **só aparece pra quem tem perfil admin** (ver "Perfis:
   admin e cliente" abaixo). Os mesmos municípios por calha; ao tocar num
   município abre um balão **editável** com:
   - Transit Time Amazon (dias)
   - **Dias de saída do porto** (seg a dom) — é do **município** (o porto
     sai nesses dias, não muda de embarcação pra embarcação).
   - Preço por saca — Seca e Cheia
   - Embarcações mais usadas, com opção de adicionar, remover ou renomear,
     ajustar o transit time e dar uma **avaliação (1 a 5 estrelas)
     individual** (cada embarcação tem a sua).
   - No topo da aba, um card **"Dados da empresa"** pra definir o nome e o
     logo que aparecem no cabeçalho do app, pra todo mundo.
   Edições são salvas no banco de dados e aparecem **para toda a equipe, em
   qualquer aparelho, na hora** (inclusive pra quem já está com o app aberto,
   via Realtime). "Restaurar original" devolve o valor de fábrica (o que veio
   da planilha), também pra todo mundo.
4. **Mapa** — mapa ilustrado e 100% estático do Amazonas (desenhado em SVG,
   sem depender de internet nem de nenhum serviço de tiles externo), com o
   contorno real do estado, os principais rios e as 10 rotas coloridas por
   calha desenhadas por cima, filtro por rota, zoom/arraste próprios (botões,
   scroll e pinça no celular) e popup por município com KPIs (transit,
   distância, TT Amazon) e embarcações principais. As 8 calhas fluviais (A a
   G, J) têm a linha da rota desenhada **acompanhando o traçado do próprio
   rio** (o fio azul do mapa) em vez de ligar os municípios em linha reta —
   pra Madeira/Purus/Juruá (rotas C/G/J), que nascem longe de Manaus, a linha
   primeiro desce/sobe o rio principal até a foz do afluente, só depois entra
   nele. Município que não fica exatamente na beira do rio (a "entrada" dele
   é por um igarapé/afluente menor, que o mapa não desenha) ganha um fio fino
   pontilhado ligando o ponto do rio mais próximo até ele, pra deixar claro
   que o acesso também é fluvial. As duas calhas rodoviárias (H e I) não têm
   rio pra seguir, então continuam com uma curva suave entre os municípios;
   a I também teve a topologia corrigida — a carga vai direto de Manaus até
   Humaitá e só lá se reparte nas duas pontas (Apuí e Lábrea), em vez do
   traçado antigo em fila única. Em todas as linhas o traço ficou mais fino
   do que a versão original, e o trecho que chega a um município classificado
   como **Aduaneiro** ou **Corredor de Escoamento** (posto de fiscalização/
   polícia) é desenhado tracejado. Ao selecionar uma calha específica, uma
   embarcação (🚤) ou ônibus (🚌, nas calhas rodoviárias) anima percorrendo a
   rota do hub (Manaus) até os municípios, seguindo a mesma linha. Municípios
   classificados como **Aduaneiro** ou **Corredor de Escoamento** ganham
   ainda um selo diferenciado, uma aura vermelha pulsante (ponto de atenção/
   fiscalização), filtro próprio e um link "ver detalhes" que abre o balão
   somente-leitura da aba Informações.
5. **Notícias** — nível do Rio Negro em Manaus (referência: Porto de
   Manaus), atualizado automaticamente 1x por dia: valor atual em metros, se
   está enchendo ou vazando (com a variação do dia em cm), um **selo de
   regime** (Seca severa / Seca / Normal / Atenção / Alerta / Emergência —
   ver "Regime do rio" abaixo) com um **banner de alerta** quando o nível
   entra numa faixa crítica, medidor visual com essas mesmas faixas,
   gráfico com o histórico e um feed tipo notícia com as leituras de cada
   dia. O app só *lê* esses dados — a coleta é feita por uma função
   separada (`api/cron/nivel-rio.js`, agendada pela Vercel via
   `vercel.json`), não pelo navegador de quem usa o app.

## Visual

Tema escuro em tons de floresta (verde-preto, com verde vivo de destaque e
dourado nos realces), com uma foto real de rio cortando a mata amazônica
aparecendo no cabeçalho, no banner de topo da aba Rotas e no fundo da tela
de login (com efeito de vidro fosco no card de login). A URL da foto fica
centralizada na variável `--hero-img`, no topo de `css/style.css`.

**Tema claro/escuro**: botão ☀️/🌙 no cabeçalho alterna entre os dois —
preferência de cada aparelho (fica salva no navegador, não no Supabase).
Cabeçalho, banner da aba Rotas, fundo do login e o mapa (aba Mapa) mantêm o
visual escuro nos dois temas de propósito (é onde a foto/o mapa aparece);
o resto do app (cards, balões, listas, aba Notícias) troca de verdade entre
claro e escuro.

**Idioma**: botão de bandeira/sigla (PT/EN/ES/中文) no cabeçalho e na tela
de login troca o idioma da interface entre português, inglês, espanhol e
chinês — também preferência de cada aparelho (fica salva no navegador,
igual o tema). A tradução cobre todo o "chrome" do app: abas, botões,
rótulos, mensagens, textos da aba Notícias (incluindo o selo de regime e o
alerta de nível crítico) e a tela de login. **O que fica sempre em
português**, porque é conteúdo/dado e não texto de interface: nome dos
municípios e das calhas, direção da rota (ex. "Manaus -> leste"), nome de
embarcações, observações pessoais, nome da empresa, e a nota de segurança
específica de cada município (Aduaneiro/Corredor de Escoamento) — só o
rótulo da categoria é traduzido, o texto individual de cada município não.
Os textos ficam em `js/i18n.js` (um dicionário por idioma); `aplicarIdioma()`
e `alternarIdioma()`, em `js/app.js`, aplicam a troca e reconstroem o
conteúdo das abas.

## Login e perfis (admin/cliente)

Cada pessoa tem sua própria conta (e-mail + senha via Supabase Auth). Além
de logar, cada pessoa tem um **perfil de acesso**, guardado na tabela
`perfis`:

- **Admin** — vê e edita tudo, inclusive a aba **Configurações** (preços,
  embarcações, avaliação, dias de saída, dados da empresa).
- **Cliente** — só visualiza: Rotas, Informações, Mapa e Notícias. A aba
  Configurações nem aparece no menu pra esse perfil, e o Supabase recusa
  qualquer tentativa de gravação por esse perfil (a regra fica no banco,
  não só escondida na tela).

Quem loga sem ter uma linha em `perfis` é tratado como **cliente** por
padrão.

## Dados da empresa (nome + logo)

Em Configurações, o card "Dados da empresa" (só admin vê) define o nome que
substitui "NAVLOG AMAZÔNIA" no cabeçalho e uma URL de logo que substitui o
pontinho decorativo. Ambos ficam salvos no banco (tabela `config_empresa`)
e aparecem pra toda a equipe, em qualquer aparelho, sem precisar publicar o
site de novo.

## Regime do rio (Seca / Normal / Atenção / Alerta / Emergência)

A fonte da coleta diária (portodemanaus.com.br) informa só o valor do dia e
se o rio subiu ou desceu — ela mesma não classifica se "está seco" ou "está
cheio". O selo de regime mostrado na aba Notícias usa cortes de fontes
externas sobre o Rio Negro em Manaus:
- **Atenção (27,00m) · Alerta/cheia (27,50m) · Emergência/cheia (29,00m)** —
  cotas oficiais da Defesa Civil de Manaus e do SGB (Serviço Geológico do
  Brasil), divulgadas em reportagens de 2026.
- **Seca (15,00m–19,00m) e Seca severa (abaixo de 15,00m)** — não existe
  cota oficial de seca equivalente (o "estado de emergência" por seca em
  Manaus é decreto do prefeito, caso a caso, sem cota fixa); esses cortes
  são referência informal, baseada no registro histórico (mínima de
  12,70m em outubro/2023, a pior seca em 121 anos de medição).
- **Normal** — entre os dois extremos acima.

O medidor visual e a nota ao lado dele (aba Notícias) deixam essa origem
explícita. Quando o nível cai em Seca severa, Atenção, Alerta ou
Emergência, aparece também um **banner de alerta** no topo da aba
Notícias e um selinho vermelho pulsante na aba Notícias (cabeçalho e menu
inferior), visível mesmo em outra aba. Os cortes e os textos do alerta
ficam em `NIVEL_REGIMES`/`NIVEL_ALERTA_TEXTOS`, no topo de `js/app.js`.

## Códigos dos municípios (sigla)

Cada município tem um código curto (`seq`) usado como identificador interno
(balões, busca, chave no banco). Desde 24/09/2026 esse código é a **sigla
oficial de 3 letras** de cada município (ex.: Manaus → MAO, Tefé → TEF,
Tabatinga → TBT), no lugar do código antigo tipo "RAU9". Duas exceções, por
não serem município oficial (são vila/distrito dentro de outro município):
Balbina usa `PFI/BALBINA` (distrito de Presidente Figueiredo) e Novo Remanso
usa `ITA/NOVO REMANSO` (distrito de Itacoatiara) — por isso aparecem com
fonte reduzida nos balões, já que são mais longos que os demais.

Quem já tinha o Supabase configurado antes dessa data precisa rodar
`supabase/migracao-sigla-node.sql` uma vez (ver `## Arquivos` abaixo) pra
atualizar os códigos salvos sem perder preços/embarcações/observações já
cadastrados.

## Dados de origem

`MUNINFO`/o seed inicial foi gerado a partir da planilha
`ANALISE_POR_MUNICIPIO.xlsx` (abas DETALHE_MUNICÍPIOS/RESUMO_MUNICIPIOS),
casando os 57 municípios das rotas com os municípios da planilha. 4
municípios (Iranduba, Balbina, Canutama e Santa Isabel do Rio Negro) não
tinham histórico na planilha e entram com os campos vazios.

Preço por saca (seca/cheia) foi aplicado por regra definida pelo operador:
- Não-Transamazônica: R$50 (seca) / R$30 (cheia)
- Transamazônica (9 municípios): R$35 (seca e cheia)
- Apuí, Humaitá e Labréa: R$70 (seca e cheia)
Todos os valores continuam editáveis por município na aba Configurações,
mostrados um embaixo do outro (seca em cima, cheia embaixo).

A lista de "embarcações mais usadas" por município é única (não separada por
seca/cheia): até 20/09/2026 ela existia duplicada nos dois regimes, mas como
as duas listas sempre vinham idênticas (mesma fonte de dados), foi unificada
numa lista só — pra não sugerir uma precisão que a empresa ainda não tem. Se
no futuro for possível saber quais embarcações rodam só na seca e quais só
na cheia, dá pra reintroduzir essa separação.

`SEGURANCA` (em `data.js`) classifica 13 municípios como **Aduaneiro**
(fronteira — Tabatinga, Benjamin Constant, Atalaia do Norte, São Gabriel da
Cachoeira, Santo Antônio do Içá, Amaturá) ou **Corredor de Escoamento**
(Coari, Tefé, Jutaí, Codajás, Fonte Boa, Manacapuru, Iranduba).

A fonte do nível do rio é portodemanaus.com.br. O histórico carregado
(`supabase/nivel_rio_backfill.sql`) cobre 9.679 leituras diárias, de
01/01/2000 até 18/09/2026.

## Arquivos

- `index.html` — estrutura das 5 abas + verificação de login ao abrir
- `login.html` — tela de login (e-mail + senha, via Supabase Auth)
- `css/style.css` — tema escuro em tons de floresta, responsivo (mobile-first + desktop)
- `js/data.js` — dados estáticos que não mudam pelo app: coordenadas
  (LATLNG), contorno do Amazonas (AM_BORDER), rios (RIOS), rotas e
  municípios (ROTAS), classificação de segurança (SEGURANCA) e os valores
  "de fábrica" de cada município (MUNINFO — usados como ponto de partida e
  pelo botão "Restaurar original")
- `js/supabase-config.js` — URL do projeto e chave pública do Supabase
- `js/i18n.js` — dicionário de tradução da interface (PT/EN/ES/中文) e as
  funções `t()`/`tf()` que buscam o texto no idioma atual
- `js/app.js` — lógica das 5 abas, perfis (admin/cliente), dados da empresa,
  leitura/escrita no Supabase (Configurações e Observações), renderização
  do mapa, classificação de regime do rio (`NIVEL_REGIMES`, aba Notícias) e
  troca de idioma (`aplicarIdioma()`)
- `supabase/schema.sql` — tabelas (`municipios_info`, `observacoes`,
  `perfis`, `config_empresa`) e regras de acesso (RLS), incluindo a função
  `is_admin()`
- `supabase/seed.sql` — dados iniciais dos 57 municípios
- `supabase/migracao-emb-unico.sql` — migração histórica: une as colunas
  antigas `emb_seca`/`emb_cheia` numa coluna só `emb`
- `supabase/migracao-perfis-empresa.sql` — migração histórica: cria as
  tabelas `perfis`/`config_empresa` e restringe edição de Configurações a
  quem for admin
- `supabase/migracao-sigla-node.sql` — migração histórica: troca o código
  antigo do município (`seq`) pela sigla oficial de 3 letras, preservando
  preços/embarcações/observações já cadastrados
- `supabase/migracao-dias-porto.sql` — migração histórica: cria a coluna
  `dias` (dias de saída do porto, agora por município) e a preenche a
  partir dos dias que já estavam marcados em cada embarcação
- `manifest.json` — metadados do PWA (nome, ícone, cor, modo "standalone")
- `sw.js` — service worker: guarda o "esqueleto" do app em cache local pra
  abrir instantâneo; nunca guarda dados do Supabase, que continuam sempre
  vindo direto da rede em tempo real
- `icons/` — ícones do app em vários tamanhos, usados pelo `manifest.json`
  e como favicon
- `supabase/nivel_rio.sql` — tabela do nível do rio (aba Notícias) e a
  leitura inicial pra coleta automática funcionar
- `supabase/nivel_rio_backfill.sql` — carga do histórico completo de
  leituras do nível do rio
- `api/cron/nivel-rio.js` — função que roda 1x por dia (agendada pela
  Vercel, ver `vercel.json`) e busca o nível do dia
- `vercel.json` — agenda a função acima (11h UTC / 7h em Manaus)

## Publicação

Site estático (HTML/CSS/JS, sem build step); a Vercel serve os arquivos e
toda a lógica de login e dados compartilhados roda direto do navegador pro
Supabase. A pasta `api/` (coleta diária do nível do rio) é a única exceção:
a Vercel detecta e roda como função de servidor automaticamente.
