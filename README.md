# NavLog Amazônia

App web mobile-first (iOS, Android e desktop Windows via navegador) para consulta
de rotas fluviais, precificação e embarcações da Fácil Express na malha do Amazonas.

## Estrutura (3 abas)

1. **Rotas** — lista oculta com as 10 calhas (A–J). Ao abrir uma calha, mostra os
   municípios em ordem de passagem, com distância (km) e transit time de cada um.
2. **Informações** — mesma lista por calha; ao tocar num município abre um balão
   (bottom sheet) **editável** com:
   - Transit Time Amazon (dias)
   - Preço por saca — **Seca** e **Cheia** (em branco, para preenchimento manual)
   - Embarcações mais usadas em cada regime do rio (seca/cheia), com opção de
     adicionar, remover ou renomear e ajustar o transit time de cada uma.
   Edições ficam salvas no navegador do aparelho (localStorage) e podem ser
   restauradas para o valor original a qualquer momento.
3. **Mapa** — mapa vetorial (SVG) do Amazonas com as 10 rotas coloridas por calha,
   filtro por rota, zoom (botões e pinça no celular) e popup por município com
   KPIs (transit, distância, TT Amazon) e embarcações principais. Municípios
   classificados como **Aduaneiro** ou **Corredor de Escoamento** (ver abaixo)
   ganham um selo diferenciado no mapa, filtro próprio e uma seção retrátil
   com o contexto completo no balão da aba Informações.

## Arquivos

- `index.html` — estrutura das 3 abas
- `css/style.css` — tema escuro, responsivo (mobile-first + desktop)
- `js/data.js` — dados estáticos: coordenadas (LATLNG), contorno do Amazonas
  (AM_BORDER), rios (RIOS), rotas e municípios (ROTAS) e a base de informações
  por município (MUNINFO, extraída de `ANALISE_POR_MUNICIPIO.xlsx`)
- `js/app.js` — lógica das 3 abas, persistência de edições (localStorage) e
  renderização do mapa

## Dados de origem

`MUNINFO` foi gerado a partir da planilha `ANALISE_POR_MUNICIPIO.xlsx`
(abas DETALHE_MUNICÍPIOS/RESUMO_MUNICIPIOS), casando os 57 municípios das rotas
com os municípios da planilha. 4 municípios (Iranduba, Balbina, Canutama e
Santa Isabel do Rio Negro) não tinham histórico na planilha e entram com os
campos vazios, prontos para edição manual na aba Informações.

Preço por saca (seca/cheia) foi aplicado por regra definida pelo operador:
- Não-Transamazônica: R$30 (seca) / R$50 (cheia)
- Transamazônica (9 municípios): R$35 (seca e cheia)
- Apuí, Humaitá e Labréa: R$70 (seca e cheia)
Todos os valores continuam editáveis por município na aba Informações.

`SEGURANCA` (em `data.js`) classifica 13 municípios como **Aduaneiro**
(fronteira — Tabatinga, Benjamin Constant, Atalaia do Norte, São Gabriel da
Cachoeira, Santo Antônio do Içá, Amaturá) ou **Corredor de Escoamento**
(Coari, Tefé, Jutaí, Codajás, Fonte Boa, Manacapuru, Iranduba).

## Publicação (Vercel)

Este é um site estático (HTML/CSS/JS puro, sem build step) — basta apontar o
projeto Vercel para a raiz desta pasta (`index.html` na raiz). Não há variáveis
de ambiente nem backend: os dados editados pelo usuário ficam no localStorage
de cada navegador/aparelho.
