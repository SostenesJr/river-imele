# NavLog Amazônia

App web mobile-first (iOS, Android e desktop, via navegador) para consulta
de rotas fluviais, precificação e embarcações na malha do Amazonas. Login
individual por pessoa e dados compartilhados em tempo real via Supabase.
É um **PWA** (Progressive Web App): dá pra "instalar" pelo navegador e usar
como um aplicativo de verdade, com ícone próprio, sem barra de endereço.

## Estrutura (6 abas)

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
4. **Mapa** — mapa real e interativo (Leaflet + tiles do OpenStreetMap/
   Esri, ver "Mapa real (Leaflet + tiles)" abaixo), com zoom/pan de
   verdade (arrastar, roda do mouse, pinça no celular, botões +/−/⟳), os
   principais rios e as 10 rotas coloridas por calha desenhados por cima,
   filtro por rota e popup por município com KPIs (transit, distância, TT
   Amazon) e embarcações principais. As 8 calhas fluviais (A a G, J) têm a
   linha da rota desenhada **acompanhando o traçado do próprio rio** (o fio
   azul do mapa) em vez de ligar os municípios em linha reta — pra Madeira/
   Purus/Juruá (rotas C/G/J), que nascem longe de Manaus, a linha primeiro
   desce/sobe o rio principal até a foz do afluente, só depois entra nele.
   Município que não fica exatamente na beira do rio (a "entrada" dele é por
   um igarapé/afluente menor, que o mapa não desenha) ganha um fio fino
   pontilhado ligando o ponto do rio mais próximo até ele, pra deixar claro
   que o acesso também é fluvial. As duas calhas rodoviárias (H e I) não têm
   rio pra seguir, então continuam com uma curva suave entre os municípios;
   a I também tem a topologia corrigida — a carga vai direto de Manaus até
   Humaitá e só lá se reparte nas duas pontas (Apuí e Lábrea). O trecho que
   chega a um município classificado como **Aduaneiro** ou **Corredor de
   Escoamento** (posto de fiscalização/polícia) é desenhado tracejado.
   Municípios classificados como **Aduaneiro** ou **Corredor de Escoamento**
   ganham ainda um selo diferenciado, uma aura vermelha pulsante (ponto de
   atenção/fiscalização), filtro próprio e um link "ver detalhes" que abre o
   balão somente-leitura da aba Informações.
5. **Notícias** — nível do Rio Negro em Manaus (referência: Porto de
   Manaus), atualizado automaticamente 1x por dia: valor atual em metros, se
   está enchendo ou vazando (com a variação do dia em cm), um **selo de
   regime** (Seca severa / Seca / Normal / Atenção / Alerta / Emergência —
   ver "Regime do rio" abaixo) com um **banner de alerta** quando o nível
   entra numa faixa crítica, medidor visual com essas mesmas faixas (que
   "respira" bem devagar — um brilho na cor do regime que cresce e some —
   quando a faixa é crítica, reforçando o alerta sem precisar ficar olhando
   o selo), gráfico com o histórico e um feed tipo notícia com as leituras
   de cada dia. O app só *lê* esses dados — a coleta é feita por uma função
   separada (`api/cron/nivel-rio.js`, agendada pela Vercel via
   `vercel.json`), não pelo navegador de quem usa o app.
6. **Clima** — clima atual (temperatura, sensação térmica, chuva e vento) e
   **qualidade do ar** (índice europeu, PM2,5 e PM10) de todos os 57
   municípios, um cartão por município. Ver "Clima nos municípios" abaixo
   pra detalhes de como isso é buscado.

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

## Animações e microinterações da página

Além das animações do mapa (rota, `## Estrutura (6 abas)` / seção Mapa) e do
selo "respirando" de nível crítico do rio (aba Notícias), a página inteira
tem um conjunto de microinterações discretas — todas respeitam a preferência
do sistema **"reduzir movimento"** (`prefers-reduced-motion: reduce`), que
desliga ou simplifica cada uma delas:

- **Troca de aba com fade + indicador deslizante**: o conteúdo de cada aba
  entra com um fade/leve deslize (`.scr-enter`, em `css/style.css`), e uma
  "pílula" (desktop, `#htab-pill`) ou barrinha (mobile, `#btab-ind`) desliza
  por trás do botão da aba ativa em vez de simplesmente trocar de cor —
  calculado em `atualizarIndicadorAbas()` (`js/app.js`).
- **Carregamento com esqueleto (skeleton)**: enquanto os dados ainda estão
  vindo do Supabase, as abas Rotas e Notícias mostram blocos cinzas
  "pulsando" (`.skel-card`) no lugar das listas/cards reais — some sozinho
  assim que `bRO()`/`bNIVEL()` trocam o conteúdo pelo de verdade.
- **Contador animado no banner da aba Rotas**: "10 calhas · 57 municípios"
  conta a partir de zero até o valor final quando a aba abre ou o idioma
  muda (`atualizarHeroSub()`).
- **Feedback de salvar/restaurar**: os botões de salvar (balão de edição,
  dados da empresa) e de restaurar padrão mostram um "✓ Salvo!"/
  "✓ Restaurado!" com o botão ficando verde por um instante antes de fechar
  o balão ou voltar ao normal; ao salvar um município, a linha dele também
  pisca de leve na lista (reaproveita o mesmo flash usado quando outra
  pessoa atualiza algo em tempo real).
- **Tela de login**: o card de login entra com um fade + leve deslize ao
  abrir a página; o fundo (foto do rio) tem um zoom lento e contínuo
  ("efeito Ken Burns"); e o card balança de leve (shake) quando o e-mail ou
  a senha estão incorretos.
- **Troca de tema claro/escuro suavizada**: em vez de trocar instantaneamente,
  cores de fundo/texto/borda fazem um crossfade rápido (~0,3s) ao alternar
  entre os dois temas.
- **Efeito de ondulação (ripple) nos botões**: botões de tema, idioma, sair
  e das abas mostram uma ondulação saindo do ponto do toque/clique, no
  estilo "material" — puramente visual, não muda o comportamento do botão.
- **Busca sem resultado**: quando o texto digitado na busca (abas Rotas,
  Informações ou Configurações) não bate com nenhum município/rota, em vez
  de a lista simplesmente ficar em branco aparece uma mensagem com um ícone
  de lupa, entrando com fade (`emptyStateHTML()` em `js/app.js`, elemento
  `.search-empty`) — some sozinha assim que a busca volta a encontrar algo
  ou é apagada.

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

## Clima nos municípios

A aba **Clima** (separada da aba Notícias, que ficou só com o nível do rio)
mostra uma grade com o **clima atual** e a **qualidade do ar** de todos os
municípios, um cartão por município, agrupados na mesma ordem das calhas —
**mais Manaus**, sempre o primeiro cartão da grade (selo "CAPITAL · HUB"
em vez de calha, já que ela é o hub e não faz parte de nenhuma das 10
calhas). Sem isso, a capital — de onde partem todas as rotas — não tinha
clima/qualidade do ar em lugar nenhum do site. Cada cartão traz: ícone e
temperatura/sensação térmica, chuva e vento atuais, e um selo de
qualidade do ar; clicar abre o mesmo balão de detalhe dos outros
municípios (com previsão de 5 dias). Implementado em
`climaMunicipiosOrdenados()` (`js/app.js`, monta o cartão de Manaus a
partir de `LATLNG.MAO`, nova entrada em `js/data.js`) e em
`renderClimaView()` (trata o caso de Manaus não ter calha).

- **Fonte**: [Open-Meteo](https://open-meteo.com/) — serviço público e
  gratuito, sem necessidade de conta nem chave de API. Duas APIs da mesma
  família: a de previsão do tempo (`api.open-meteo.com`) e a de qualidade
  do ar (`air-quality-api.open-meteo.com`, subdomínio separado). As duas
  chamadas rodam **direto no navegador de quem está usando o app**, não
  passam pelo Supabase nem por nenhum servidor próprio.
- **Uma chamada só (x2) pra todos os municípios**: as duas APIs aceitam
  várias coordenadas (lat/lng) numa única requisição e devolvem uma lista
  de resultados na mesma ordem — em vez de 57×2 chamadas separadas, o app
  manda a latitude/longitude de todos os municípios (as mesmas usadas no
  mapa, em `LATLNG`, `js/data.js`) de uma vez pras duas APIs em paralelo, e
  casa as duas respostas pelo índice da lista.
- **Qualidade do ar**: usa o **índice europeu (European AQI)**, escala de
  0 a 100+ (mais simples de mostrar num selinho que o índice americano,
  0–500), em 6 faixas — Bom / Razoável / Moderado / Ruim / Muito ruim /
  Extremamente ruim — cada uma com uma cor própria. O valor de PM2,5 e
  PM10 (µg/m³) fica disponível ao passar o mouse/tocar no selo. É
  particularmente relevante na época de seca, quando a fumaça de queimada
  costuma piorar a qualidade do ar na região.
- **Cache simples**: a busca automática só é refeita se ainda não tiver
  nenhum dado ou se já fizer mais de 10 minutos da última — abrir e fechar
  a aba Clima repetidas vezes não dispara uma chamada nova a cada vez. Tem
  também um **botão "atualizar agora"** (⟳, ao lado do "atualizado às"),
  pra forçar uma busca nova na hora, sem esperar os 10 minutos.
- **Não é um radar de chuva ao vivo**: a Open-Meteo (como qualquer serviço
  de previsão do tempo) trabalha com **modelos meteorológicos** — os
  valores de "agora" são a leitura mais recente desses modelos, não uma
  medição direta de pluviômetro/radar local. Isso é normal em qualquer
  fonte assim (inclusive apps de tempo famosos) e funciona bem pra
  tendência geral, mas uma chuva forte e repentina, bem localizada (comum
  na Amazônia) pode demorar alguns minutos pra aparecer no dado do
  modelo — daí o aviso fixo embaixo do título da aba e o botão de
  atualizar, pra pessoa nunca ficar refém só do intervalo automático.
- **Se a chamada falhar** (sem internet, bloqueio de rede, API fora do ar),
  a aba mostra um aviso com botão "Tentar de novo" em vez de travar o
  resto do app — o card de nível do rio, na aba Notícias (que já vem do
  Supabase, sem depender dessas chamadas externas), continua funcionando
  normalmente.
- **Cartão clicável**: tocar/clicar num cartão abre o detalhe daquele
  município — ícone e descrição do tempo maiores, temperatura, sensação
  térmica, chuva, vento e o bloco de qualidade do ar (categoria, índice,
  PM2,5 e PM10) — no mesmo balão (bottom sheet) já usado nos balões de
  Informações/Configurações: desliza de baixo pra cima e ocupa a largura
  toda no celular (Android e iPhone), e aparece centralizado, com cantos
  arredondados e largura máxima de 600px, no computador. Fecha tocando
  fora do balão ou arrastando pra baixo.
- Implementado em `carregarClima()`/`bCLIMA()`/`climaCategoria()`/
  `aqiCategoria()`/`abrirClimaView()`/`renderClimaView()` (`js/app.js`) e
  no elemento `#climabdy`, dentro da aba `#sc-w` (`index.html`).

### Previsão dos próximos 5 dias

O balão de detalhe de cada município (abre ao clicar no cartão, ver acima)
traz também uma tira com a **previsão dos próximos 5 dias**: um cartãozinho
por dia com a letra do dia da semana (ou "Hoje" pro primeiro), ícone do
tempo, temperatura máxima/mínima e chuva prevista. Vem na mesma chamada do
clima atual (`carregarClima()` já pede `daily=weather_code,
temperature_2m_max,temperature_2m_min,precipitation_sum&forecast_days=5`
pra API de previsão do tempo), então não é uma chamada extra. Implementado
em `climaPrevisaoHTML()` (`js/app.js`), reaproveitando o mesmo sistema de
tradução da letra do dia da semana já usado nos dias de saída do porto
(`DIAS_SEMANA_KEYS`/`diaLetra()`).

## Radar de chuva ao vivo (RainViewer)

Complementa a limitação explicada acima (Open-Meteo = modelo, não radar):
agora o app também mostra o **radar/satélite de chuva de verdade**, vindo
da [RainViewer](https://www.rainviewer.com/) — serviço público e gratuito,
sem chave de API, que publica mosaicos de radar terrestre + satélite
(onde não tem radar de solo, como boa parte do interior do Amazonas, ela
completa com satélite) atualizados a cada ~5-10min. Duas formas de ver:

- **Camada animada no mapa** (aba Mapa): botão "📡 Radar" no canto
  inferior direito liga uma camada de nuvens de chuva por cima do mapa,
  recortada no contorno do estado — com **play/pausa** e um rótulo
  mostrando se o frame na tela é "agora", "Nmin atrás" (até ~2h de
  histórico) ou "+Nmin · previsão" (nowcast de curtíssimo prazo, ~30-60min
  à frente). Toca sozinha (troca de frame a cada 600ms) assim que é
  ligada; pausa automaticamente se a pessoa sai da aba Mapa (economiza
  rede/bateria) e continua de onde parou ao voltar. A projeção Web
  Mercator usada pelos tiles da RainViewer é **exatamente a mesma** do
  `proj(lat,lng)` que o app já usa pra desenhar rios/rotas/pinos — por
  isso os tiles encaixam certinho no contorno do estado sem nenhuma
  calibração manual (diferente do que foi preciso fazer com a foto de
  satélite de fundo, que é só uma ilustração, não um raster
  georreferenciado). Implementado no bloco `RADAR_*`/`radar*()` (topo de
  `js/app.js`, logo antes de `renderMap()`) e no elemento `#map-radar-ctl`
  (`index.html`).
- **Mini radar no balão de cada município** (aba Clima → clicar num
  cartão): uma janelinha 120×120 com o radar/satélite atual, **centrada
  na cidade** (com um pino marcando o centro exato) — complementa o
  número de chuva do Open-Meteo com uma conferência visual rápida no dado
  real. Mostra só o frame mais recente (sem animar) e só busca a imagem
  quando o balão é aberto, pra não gerar 57+ pedidos de uma vez.
  Implementado em `climaRadarMiniHTML()`/`climaRadarMiniCarregar()`
  (`js/app.js`), chamado no fim de `renderClimaView()`.
- **Sem calibração/servidor próprio**: os tiles usam o esquema padrão de
  mapas (`z/x/y`, Web Mercator) e são pedidos direto do navegador de quem
  usa o app — não passa pelo Supabase nem por nenhum `/api` próprio, igual
  a Open-Meteo. A lista de frames disponíveis (`weather-maps.json`) é
  cacheada por 10 minutos (`RADAR_META_TTL_MS`) pra não buscar de novo
  toda vez que a camada é ligada.
- **Atribuição obrigatória**: os termos de uso gratuito da RainViewer
  pedem crédito visível — por isso o texto "Radar + satélite: RainViewer"
  aparece tanto no painel da camada do mapa quanto embaixo de cada mini
  radar.

## Alerta de qualidade do ar ruim

Igual ao regime do nível do rio (abaixo), a aba **Clima** mostra um
**banner de alerta** no topo sempre que um ou mais municípios estiverem com
qualidade do ar na faixa "Muito ruim" ou "Extremamente ruim" (ver escala
acima) — situação comum na época de seca, com fumaça de queimadas. O
banner lista os municípios afetados (até 4 nomes, com "e mais N" se
passar disso) e um selinho vermelho aparece também na aba Clima (cabeçalho
e menu inferior), visível mesmo em outra aba — o mesmo mecanismo de selo
usado no alerta de nível do rio, generalizado em `atualizarAlertaAba(tab,
critico, tituloKey)` pra funcionar em qualquer aba. Implementado em
`climaArCriticoLista()`/`climaArAlertaHTML()` (`js/app.js`).

## Nível do rio no mapa (cor do traçado pelo regime atual)

Na aba **Mapa**, o traçado dos rios agora reflete visualmente o **regime
atual do nível do rio** (mesma classificação da aba Notícias, ver seção
"Regime do rio" abaixo): cada rio ganha um brilho colorido por cima do
traçado normal, na cor do regime vigente (verde em regime Normal, laranja/
vermelho em regimes críticos), com uma leve animação "respirando" quando o
regime é crítico (Seca severa/Atenção/Alerta/Emergência). Uma legenda
fixa no canto inferior esquerdo do mapa mostra o nome do regime atual;
tocar/clicar nela leva direto pra aba Notícias, onde está o detalhe
completo. Atualiza sozinha em tempo real (Realtime do Supabase), junto com
o resto do app, quando uma nova leitura do nível é gravada. Implementado
em `regimeAtual()` e no `RIOS.forEach()` de `renderMap()` (`js/app.js`),
e no elemento `#map-regime-legend` (`index.html`).

## Mapa real (Leaflet + tiles)

O mapa da aba **Mapa** deixou de ser uma ilustração estática em SVG (com
zoom/arraste feitos à mão) e passou a ser um mapa de verdade, construído
com [Leaflet](https://leafletjs.com/) sobre tiles reais — dá pra ir de "o
Amazonas inteiro" até o nível de rua de um município, com zoom contínuo
nativo, do mesmo jeito que qualquer mapa (Google Maps, OpenStreetMap etc.).

- **Dois estilos de tile, com botão pra trocar**: o botão 🌗, na barra de
  ferramentas do mapa, alterna entre tiles **escuros** (Esri Dark Gray
  Canvas — o padrão, combina com o resto do app; livre pra uso sem
  conta/API key) e **claros** (OpenStreetMap padrão). O CartoDB Dark
  Matter usado na primeira versão desta migração foi trocado pelo Esri
  porque a CARTO passou a exigir conta/API key pra uso anônimo (o tile
  ficava com um watermark "API KEY REQUIRED" cobrindo o mapa). A escolha
  de estilo fica salva (`localStorage`, `navlog-tile-estilo`) — cada
  aparelho lembra a própria preferência, do mesmo jeito que o tema
  claro/escuro do app. Implementado em
  `initLeafletMapa()`/`toggleTileEstilo()` (`js/app.js`).
- **Pan/zoom/pinça nativos do Leaflet**: arrastar (mouse/toque), zoom pela
  roda do mouse, pinça de dois dedos no celular e os botões +/−/⟳ da barra
  de ferramentas — tudo isso já vem de graça do Leaflet, sem nenhum código
  próprio de arrasto/beliscar (o antigo sistema manual, com a matriz de
  transformação `T.x/T.y/T.s`, foi removido inteiro).
- **Rios, rotas e pinos continuam os mesmos dados de sempre** (`RIOS`,
  `ROTAS`, `LATLNG` em `js/data.js`), incluindo a lógica de "seguir o
  traçado do rio" (`idxMaisPerto`/`trechoRio`) — só que desenhados como
  camadas do Leaflet (`L.polyline`/`L.marker` com ícone HTML) em vez de
  `<path>`/`<rect>` de SVG feitos na mão. O selo de cada município
  (código da rota, ex. `D3`) agora é um `L.divIcon` (HTML/CSS puro),
  então o tamanho acompanha o texto sozinho e fica do mesmo tamanho em
  qualquer nível de zoom — não precisa mais recalcular a largura a partir
  do comprimento do rótulo.
- **O radar de chuva ao vivo (RainViewer)**, quando ligado, também virou
  uma camada normal do Leaflet (`L.tileLayer`, mesmo esquema `{z}/{x}/{y}`
  de qualquer camada de mapa) em vez da grade de imagens SVG posicionadas
  na mão que era necessária antes.
- **O que foi removido nesta migração** (efeitos decorativos que só faziam
  sentido em cima do mapa ilustrado antigo, e não tinham como continuar
  com tiles reais por baixo): a animação de uma embarcação/ônibus
  percorrendo a rota selecionada, a entrada animada (fade + escala) dos
  pinos/linhas ao abrir a aba Mapa, o fundo de foto de satélite
  (`img/mapa-fundo.png`) e os efeitos de "mapa 2.5D" (luz rasante,
  vinheta e paralaxe) — o próprio mapa real substitui a necessidade
  desses efeitos ilustrativos. Tudo o mais (regime do rio colorindo os
  rios, fio d'água, tracejado em ponto de fiscalização, filtros, popup,
  calculadora de rota, radar) continua funcionando igual.

Como o Leaflet mede o tamanho do container na hora em que é criado, e a
aba Mapa fica com `display:none` até ser aberta pela primeira vez, o app
chama `LMAP.invalidateSize()` toda vez que a aba Mapa é aberta (dentro de
`SS()`, `js/app.js`) — sem isso o mapa nasceria com um tamanho errado
(cortado/deslocado) até a janela ser redimensionada. Implementado em
`initLeafletMapa()`, `renderMap()`, `toggleTileEstilo()`, `zI()`/`zO()`/
`zR()` (`js/app.js`), no CSS de `.leaflet-*`/`.lm-node*`/`.lm-hub*`
(`css/style.css`) e nas tags do Leaflet (CDN cdnjs) em `index.html`.

## Filtros/ferramentas do mapa numa gaveta lateral

Os filtros por calha/segurança e os botões de ferramenta (🧭 calculadora de
rota, 🌗 trocar tile, +/−/⟳) deixaram de ficar numa barra fixa em cima do
mapa — ocupando altura da tela o tempo todo, mesmo sem estar em uso — e
passaram a viver numa **gaveta lateral** (`#map-toolbar`), escondida por
padrão e que só desliza por cima do mapa quando aberta:

- Um botão flutuante ☰, sempre visível no canto superior esquerdo do mapa,
  abre a gaveta; clicando nele de novo (agora com ícone ✕) ela fecha.
- Clicar em qualquer ponto do mapa (com a gaveta aberta) também fecha —
  reaproveita o mesmo clique do Leaflet que já fechava o popup do
  município (`LMAP.on('click', ...)` em `initLeafletMapa()`).
- Escolher um filtro (uma calha específica, "Todas", Aduaneiro ou Corredor
  de Escoamento) fecha a gaveta sozinha, pra já mostrar o mapa filtrado em
  vez de deixar o painel tampando a tela.
- Dentro da gaveta, os filtros ficam empilhados verticalmente (antes era
  uma fileira horizontal com rolagem lateral) — mais fácil de ler e tocar
  numa gaveta estreita do que numa barra comprida.
- Os botões de ferramenta (calculadora de rota, trocar tile, zoom) não
  fecham a gaveta sozinhos, pra dar pra clicar em "+"/"−" várias vezes
  seguidas sem o painel sumir a cada clique.

Implementado em `toggleMapToolbar()`/`fecharMapToolbar()` (`js/app.js`,
chamado também no fim de `filtrarRota()`/`filtrarTipo()` e do clique em
"Todas" dentro de `buildMapFilters()`), no CSS de `.map-toolbar-toggle`/
`#map-toolbar`/`#map-filters` (`css/style.css`) e no HTML de `#sc-m`
(`index.html`).

## Alerta de embarcação mal avaliada

Quando a avaliação de uma embarcação cadastrada num município está baixa
(⭐️ 1 ou 2), um aviso visual chama atenção antes mesmo de abrir o balão:
um selo ⚠️ aparece no chip do município (abas Rotas/Configurações) e um
banner de aviso aparece no topo da lista de embarcações, dentro do balão
de Informações e do balão de edição. Ajuda a não recomendar sem querer
uma embarcação com histórico ruim pro cliente. Implementado em
`embAvaliacaoRuim()`, `bINFO()`, `bCO()`, `renderInfoView()` e
`renderSheet()` (`js/app.js`).

## Contato do município (agente local/porto)

Cada município agora tem um campo de contato — nome e telefone de um
agente local, porto ou ponto de referência — editável pelo balão de
Configurações (aba **Configurações**) e visível (somente leitura, com o
telefone já como link `tel:` pra ligar direto do celular) pelo balão de
Informações. Fica guardado junto com o resto dos dados do município no
Supabase (colunas `contato_nome`/`contato_tel`, ver
`supabase/migracao-contato-municipio.sql`). Implementado em `rowToInfo()`,
`getInfo()`, `setInfo()`, `resetInfo()`, `renderInfoView()` e
`renderSheet()` (`js/app.js`).

## Calculadora de rota (distância/tempo entre dois municípios quaisquer)

Um botão 🧭 na barra de ferramentas do mapa abre uma calculadora que
estima distância e tempo de viagem entre **dois municípios quaisquer**
(não só a partir de Manaus): escolhe origem e destino em dois menus, e o
resultado aparece com a rota desenhada no mapa (linha tracejada rosa,
some quando o balão fecha só se o botão "Limpar" for usado). Como os
dados de cada município só guardam a distância até Manaus (não a
distância real entre dois pontos quaisquer), o cálculo é uma
**estimativa**, sempre identificada como tal na tela, usando duas regras:

- **Mesma calha, sem bifurcação**: subtrai a distância até Manaus de um
  município da do outro (`|kmB − kmA|`).
- **Calhas diferentes (ou passando pela bifurcação da Rota I)**: soma as
  duas distâncias até Manaus (`kmA + kmB`), como se o trajeto passasse
  pelo hub.

O tempo estimado é somado a partir do tempo de trânsito (`tt`) cadastrado
de cada município até Manaus. Implementado em `calcularRotaEstimada()`,
`renderRotaCalc()`, `abrirRotaCalc()` e no bloco `ROTA_CALC` de
`js/app.js`, com o botão em `index.html` (`.map-zoomctl .mcb`).

## Notificações push

Um sininho (🔔/🔕) no cabeçalho, ao lado do botão de idioma, liga/desliga
notificações push no aparelho — funciona mesmo com o app fechado ou o
celular bloqueado (é o mesmo tipo de notificação de apps nativos). Tocar
pede a permissão do navegador (uma vez só) e ativa; tocar de novo
desativa. É por **aparelho + navegador**, não por conta: a mesma pessoa
pode ativar no celular e no computador ao mesmo tempo, cada um recebe as
notificações separadamente.

Dispara em **qualquer mudança relevante**, sem precisar que ninguém
esteja com o app aberto pra ver:
- **Nível do rio**: toda vez que o regime muda de faixa (Seca severa /
  Seca / Normal / Atenção / Alerta / Emergência) em relação à leitura
  anterior — não a cada leitura diária, só quando a faixa muda de
  verdade.
- **Edição de município**: toda vez que alguém salva uma alteração de
  preço, embarcação ou dias de saída do porto em Configurações.
- **Qualidade do ar**: toda vez que um município entra ou sai da faixa
  crítica (Muito ruim/Extremamente ruim), mesma escala da aba Clima —
  geralmente fumaça de queimada na região.
- **Chuva forte / risco de alagamento**: toda vez que um município entra
  ou sai de chuva forte — pela chuva **acontecendo agora** (≥10mm na
  última hora) ou pela chuva **prevista pra hoje** (≥50mm acumulados,
  referência de risco de alagamento do INMET).
- **Risco de queimada**: toda vez que um município entra ou sai de risco
  alto, numa **estimativa aproximada** (a Open-Meteo não tem um índice
  de incêndio pronto) que combina umidade relativa baixa, vento forte e
  pouca chuva nos últimos 7 dias — ver `calcularRiscoQueimada()` em
  `api/cron/clima-alertas.js` pros pesos exatos. **Não substitui** uma
  fonte oficial de risco de incêndio (pra isso, o INPE tem o Programa
  Queimadas).

Os três alertas de clima (qualidade do ar, chuva forte, risco de queimada)
cobrem **Manaus também**, automaticamente — o cron lê todas as
coordenadas de `LATLNG` (`js/data.js`), sem depender das calhas, então a
entrada `MAO` (adicionada junto com o clima de Manaus na aba Clima, ver
"Clima nos municípios") já entra na conta sem precisar mexer em
`api/cron/clima-alertas.js`.

### Como funciona por baixo dos panos

- **Cliente** (`js/app.js`, funções `ativarPush()`/`desativarPush()`/
  `atualizarBotaoPush()`): usa a Web Push API padrão do navegador
  (`PushManager`), com uma chave pública VAPID (`VAPID_PUBLIC_KEY`, em
  `js/supabase-config.js` — pública por design, como a anon key do
  Supabase) pra criar a inscrição. A inscrição (endpoint + chaves)
  fica salva na tabela `push_subscriptions` do Supabase, uma linha por
  aparelho/navegador que ativou. Ver `sw.js` (eventos `push` e
  `notificationclick`) pra como a notificação aparece e o que acontece
  ao tocar nela (foca uma aba já aberta do app, ou abre uma nova).
- **Backend** (Vercel, `api/_lib/push.js`): quem manda a notificação de
  verdade — nunca o navegador de quem ativou. Usa a biblioteca
  `web-push` (Node) com a chave VAPID **privada**, que só existe como
  variável de ambiente na Vercel, nunca no código do site.
- **Gatilhos**:
  - Nível do rio: o cron diário já existente (`api/cron/nivel-rio.js`)
    compara o regime antes/depois de cada leitura e manda push se mudou.
  - Edição de município: um **Database Webhook** do Supabase (configurado
    no painel, não em código) chama `api/webhook-municipio.js` toda vez
    que `municipios_info` é atualizada.
  - Qualidade do ar, chuva forte e risco de queimada: um segundo cron
    diário, em horário diferente do de nível do rio
    (`api/cron/clima-alertas.js`) — os três moram no MESMO cron porque
    o plano Hobby da Vercel só permite 2 cron jobs. Busca o clima de
    todos os municípios direto na Open-Meteo (a busca de dentro do app
    roda só no navegador de cada pessoa e não fica salva em lugar
    nenhum, por isso esse cron busca de novo, a partir do servidor) e
    compara cada um dos três alertas com a rodada anterior (guardados
    em `push_estado`, uma linha por alerta) pra só notificar quando
    algum município entra ou sai da faixa crítica de cada um.

### Configuração necessária (uma vez só)

1. Rodar, em sequência, `supabase/migracao-push.sql` e
   `supabase/migracao-push2-alertas-clima.sql` no SQL Editor do
   Supabase (cria `push_subscriptions` e `push_estado`, com RLS).
2. Nas variáveis de ambiente do projeto na Vercel, adicionar (além das
   que o cron do nível do rio já usa — `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `CRON_SECRET`):
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — par de chaves gerado
     especialmente pra este projeto (a pública já está em
     `js/supabase-config.js`; a privada correspondente foi entregue à
     parte, nunca vai no repositório).
   - `WEBHOOK_SECRET` — uma senha à sua escolha.
3. No painel do Supabase, **Database → Webhooks → Create a new hook**:
   tabela `municipios_info`, evento `Update`, tipo `HTTP Request`,
   método `POST`, URL `https://SEU-DOMINIO.vercel.app/api/webhook-municipio`,
   com o header `x-webhook-secret` igual ao `WEBHOOK_SECRET` do passo 2.
4. `vercel.json` já inclui o segundo cron (`clima-alertas`, uma vez por
   dia — o plano Hobby da Vercel só permite crons diários); não precisa
   de configuração extra além do deploy.

Se essas variáveis não estiverem configuradas, o app continua
funcionando normalmente (rotas, mapa, clima, nível do rio) — só as
notificações push ficam inativas, sem travar nada.

Os limiares de "crítico" de cada alerta (AQI ≥80, chuva ≥10mm/h ou
≥50mm/dia, risco de queimada ≥55) ficam no topo de
`api/cron/clima-alertas.js` — dá pra ajustar sem mexer no resto da
lógica, se a experiência de uso mostrar que estão apertados ou frouxos
demais pra realidade de cada município.

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
- `img/mapa-fundo.png` — foto de satélite/relevo do Amazonas usada como
  fundo da aba Mapa na versão antiga (SVG ilustrado); não é mais usada
  desde a migração pro mapa real (Leaflet + tiles, ver "Mapa real (Leaflet
  + tiles)" acima), mas o arquivo continua no projeto por segurança
  (ver "Foto de satélite como fundo do mapa")
- `supabase/nivel_rio.sql` — tabela do nível do rio (aba Notícias) e a
  leitura inicial pra coleta automática funcionar
- `supabase/nivel_rio_backfill.sql` — carga do histórico completo de
  leituras do nível do rio
- `api/cron/nivel-rio.js` — função que roda 1x por dia (agendada pela
  Vercel, ver `vercel.json`) e busca o nível do dia; também manda push se
  o regime mudou de faixa (ver "Notificações push")
- `api/cron/clima-alertas.js` — função que roda 1x por dia e manda push
  se algum município entrou/saiu da faixa crítica de qualidade do ar,
  chuva forte/alagamento ou risco de queimada (três alertas, um cron só)
- `api/webhook-municipio.js` — chamada pelo Supabase (Database Webhook,
  configurado no painel) toda vez que um município é editado; manda push
- `api/_lib/supabase.js` — helper compartilhado pelas funções acima pra
  chamar o Supabase com a chave `service_role`
- `api/_lib/push.js` — envia notificações Web Push (biblioteca `web-push`)
  pra todo mundo com inscrição salva em `push_subscriptions`
- `api/_lib/regime.js` — cópia server-side da classificação de regime do
  rio (espelha `NIVEL_REGIMES` de `js/app.js`), usada só pelo cron acima
- `supabase/migracao-push.sql` — cria `push_subscriptions` (inscrições de
  notificação push)
- `supabase/migracao-push2-alertas-clima.sql` — cria `push_estado`
  (estado genérico dos 3 alertas do cron `clima-alertas.js`), substitui
  a `push_estado_ar` (mais estreita) criada no arquivo acima
- `supabase/migracao-contato-municipio.sql` — adiciona as colunas
  `contato_nome`/`contato_tel` em `municipios_info` (contato do agente
  local/porto por município)
- `package.json` — declara a dependência `web-push`, usada pelas funções
  serverless acima
- `vercel.json` — agenda os dois crons (nível do rio às 11h UTC / 7h em
  Manaus; alertas climáticos às 15h UTC / 11h em Manaus)

## Publicação

Site estático (HTML/CSS/JS, sem build step); a Vercel serve os arquivos e
toda a lógica de login e dados compartilhados roda direto do navegador pro
Supabase. A pasta `api/` (coleta diária do nível do rio, qualidade do ar e
notificações push) é a única exceção: a Vercel detecta e roda como função
de servidor automaticamente (instalando a dependência de `package.json`).
