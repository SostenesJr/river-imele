# NavLog Amazônia

App web mobile-first (iOS, Android e desktop Windows via navegador) para consulta
de rotas fluviais, precificação e embarcações da Fácil Express na malha do Amazonas.

## Estrutura (4 abas)

1. **Rotas** — lista oculta com as 10 calhas (A–J). Ao abrir uma calha, mostra os
   municípios em ordem de passagem, com distância (km) e transit time de cada um.
2. **Informações** — somente leitura. Grade de balões compactos (o código do
   node, cor por calha, borda arredondada) agrupada por calha; municípios
   Aduaneiro/Corredor de Escoamento ganham um selo no canto do balão. Tocar num
   balão abre um pop-up com o nome do município e todas as informações:
   - Transit Time Amazon, distância e transit da rota
   - Preço por saca — **Seca** e **Cheia**
   - Embarcações mais usadas em cada regime do rio
   - Classificação de segurança (Aduaneiro/Corredor), quando aplicável, em
     seção retrátil
   - **Observações** — campo de texto livre por município, pessoal, salvo
     apenas no navegador de cada aparelho (não é a mesma base das edições de
     Configurações).
3. **Configurações** — os mesmos municípios por calha; ao tocar num município
   abre um balão **editável** com:
   - Transit Time Amazon (dias)
   - Preço por saca — Seca e Cheia
   - Embarcações mais usadas em cada regime do rio, com opção de adicionar,
     remover ou renomear e ajustar o transit time de cada uma.
   Edições ficam salvas no navegador do aparelho (localStorage) e podem ser
   restauradas para o valor original a qualquer momento. É o que alimenta o
   que aparece na aba Informações e no mapa.
4. **Mapa** — mapa vetorial (SVG) do Amazonas com as 10 rotas coloridas por calha,
   filtro por rota, zoom (botões e pinça no celular) e popup por município com
   KPIs (transit, distância, TT Amazon) e embarcações principais. Municípios
   classificados como **Aduaneiro** ou **Corredor de Escoamento** (ver abaixo)
   ganham um selo diferenciado no mapa, filtro próprio e um link "ver detalhes"
   que abre o balão somente-leitura da aba Informações.

## Arquivos

- `index.html` — estrutura das 4 abas
- `css/style.css` — tema escuro, responsivo (mobile-first + desktop)
- `js/data.js` — dados estáticos: coordenadas (LATLNG), contorno do Amazonas
  (AM_BORDER), rios (RIOS), rotas e municípios (ROTAS) e a base de informações
  por município (MUNINFO, extraída de `ANALISE_POR_MUNICIPIO.xlsx`)
- `js/app.js` — lógica das 4 abas, persistência de edições e observações
  (localStorage) e renderização do mapa

## Dados de origem

`MUNINFO` foi gerado a partir da planilha `ANALISE_POR_MUNICIPIO.xlsx`
(abas DETALHE_MUNICÍPIOS/RESUMO_MUNICIPIOS), casando os 57 municípios das rotas
com os municípios da planilha. 4 municípios (Iranduba, Balbina, Canutama e
Santa Isabel do Rio Negro) não tinham histórico na planilha e entram com os
campos vazios, prontos para edição manual na aba Configurações.

Preço por saca (seca/cheia) foi aplicado por regra definida pelo operador:
- Não-Transamazônica: R$50 (seca) / R$30 (cheia)
- Transamazônica (9 municípios): R$35 (seca e cheia)
- Apuí, Humaitá e Labréa: R$70 (seca e cheia)
Todos os valores continuam editáveis por município na aba Configurações.

`SEGURANCA` (em `data.js`) classifica 13 municípios como **Aduaneiro**
(fronteira — Tabatinga, Benjamin Constant, Atalaia do Norte, São Gabriel da
Cachoeira, Santo Antônio do Içá, Amaturá) ou **Corredor de Escoamento**
(Coari, Tefé, Jutaí, Codajás, Fonte Boa, Manacapuru, Iranduba).

## Observações por município

Cada operador pode deixar uma nota livre por município na aba Informações.
Esse campo é local — fica salvo em `localStorage` (`riverops_obs_v1`) do
navegador/aparelho de quem escreveu, então cada pessoa vê só as próprias
anotações. Um ponto verde no canto do balão, na grade, indica que existe uma
observação salva ali.

## Publicação (Vercel)

Este é um site estático (HTML/CSS/JS puro, sem build step) — basta apontar o
projeto Vercel para a raiz desta pasta (`index.html` na raiz). Não há variáveis
de ambiente nem backend: os dados editados pelo usuário ficam no localStorage
de cada navegador/aparelho.
