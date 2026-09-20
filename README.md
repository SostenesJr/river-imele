# NavLog Amazônia

App web mobile-first (iOS, Android e desktop Windows via navegador) para consulta
de rotas fluviais, precificação e embarcações na malha do Amazonas.
Login individual por pessoa e dados compartilhados em tempo real via Supabase.
É um **PWA** (Progressive Web App): dá pra "instalar" pelo navegador e usar
como um aplicativo de verdade, com ícone próprio, sem barra de endereço —
ver seção "Instalar como aplicativo" abaixo.

## Instalar como aplicativo

O site já vem pronto pra ser instalado direto do navegador — não precisa de
loja de aplicativo nem de instalador separado.

**No computador (Windows/Mac/Linux), pelo Chrome ou Edge:**
1. Abra o site normalmente e faça login.
2. Na barra de endereço, clique no ícone de instalar (um monitor com uma
   setinha ⊕, do lado direito, perto dos favoritos) — ou vá no menu ⋮ →
   **"Instalar NavLog Amazônia..."**.
3. Confirme. O app abre numa janela própria (sem abas nem barra de
   endereço), com ícone na área de trabalho e no menu iniciar/dock, igual
   qualquer outro programa instalado.

**No celular (Android, pelo Chrome):** menu ⋮ → **"Instalar aplicativo"**
(ou o banner que aparece sozinho). **No iPhone (Safari):** botão de
compartilhar → **"Adicionar à Tela de Início"**.

O app instalado continua sendo o mesmo site (os dados vêm do Supabase em
tempo real, do mesmo jeito) — só abre mais rápido, como janela própria, e o
"esqueleto" do app (telas, mapa, ícones) fica salvo no aparelho, então abre
na hora mesmo com internet ruim. Toda vez que o site for atualizado e
publicado de novo, o app instalado atualiza sozinho, sem precisar
reinstalar nada.

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
   - **Observações** — campo de texto livre por município. Pessoal de cada
     usuário (ninguém mais vê a sua), salvo na conta de quem escreveu — não
     depende do aparelho.
3. **Configurações** — os mesmos municípios por calha; ao tocar num município
   abre um balão **editável** com:
   - Transit Time Amazon (dias)
   - Preço por saca — Seca e Cheia
   - Embarcações mais usadas em cada regime do rio, com opção de adicionar,
     remover ou renomear e ajustar o transit time de cada uma.
   Edições são salvas no banco de dados e aparecem **para toda a equipe, em
   qualquer aparelho, na hora** (inclusive pra quem já está com o app aberto,
   via Realtime). "Restaurar original" devolve o valor de fábrica (o que veio
   da planilha), também pra todo mundo.
4. **Mapa** — mapa ilustrado e 100% estático do Amazonas (desenhado em SVG,
   sem depender de internet nem de nenhum serviço de tiles externo), com o
   contorno real do estado, os principais rios e as 10 rotas coloridas por
   calha desenhadas por cima, filtro por rota, zoom/arraste próprios (botões,
   scroll e pinça no celular) e popup por município com KPIs (transit,
   distância, TT Amazon) e embarcações principais. Ao selecionar uma calha
   específica, uma embarcação (🚤) ou ônibus (🚌, nas calhas rodoviárias) anima
   percorrendo a rota do hub (Manaus) até os municípios. Municípios
   classificados como **Aduaneiro** ou **Corredor de Escoamento** ganham um
   selo diferenciado, uma aura vermelha pulsante (ponto de atenção/
   fiscalização), filtro próprio e um link "ver detalhes" que abre o balão
   somente-leitura da aba Informações.

## Arquivos

- `index.html` — estrutura das 4 abas + verificação de login ao abrir
- `login.html` — tela de login (e-mail + senha, via Supabase Auth)
- `css/style.css` — tema escuro, responsivo (mobile-first + desktop)
- `js/data.js` — dados estáticos que não mudam pelo app: coordenadas
  (LATLNG), contorno do Amazonas (AM_BORDER), rios (RIOS), rotas e
  municípios (ROTAS), classificação de segurança (SEGURANCA) e os valores
  "de fábrica" de cada município (MUNINFO — usados como ponto de partida e
  pelo botão "Restaurar original")
- `js/supabase-config.js` — URL do projeto e chave pública do Supabase
- `js/app.js` — lógica das 4 abas, leitura/escrita no Supabase (Configurações
  e Observações) e renderização do mapa
- `supabase/schema.sql` — cria as tabelas e as regras de acesso (rode uma vez)
- `supabase/seed.sql` — popula as tabelas com os dados atuais dos 57
  municípios (rode uma vez, depois do schema.sql)
- `manifest.json` — metadados do PWA (nome, ícone, cor, modo "standalone")
  que o navegador lê na hora de instalar o app
- `sw.js` — service worker: guarda o "esqueleto" do app em cache local pra
  abrir instantâneo (inclusive com internet ruim); nunca guarda dados do
  Supabase, que continuam sempre vindo direto da rede em tempo real
- `icons/` — ícones do app em vários tamanhos, usados pelo `manifest.json`
  e como favicon

## Como configurar o Supabase (uma vez só)

1. **Crie o projeto**: em [supabase.com](https://supabase.com), crie uma
   conta gratuita e um novo projeto (ex: "navlog-amazonia").
2. **Rode o schema**: no painel do projeto, abra **SQL Editor → New query**,
   cole todo o conteúdo de `supabase/schema.sql` e clique em **Run**. Isso
   cria as tabelas `municipios_info` e `observacoes` com as regras de acesso
   (cada pessoa só edita observações suas; Configurações vale pra quem
   estiver logado).
3. **Popule os dados**: nova query, cole todo o conteúdo de
   `supabase/seed.sql` e rode. Isso carrega os 57 municípios com os valores
   atuais (o mesmo que já estava em `data.js`).
4. **Pegue a URL e a chave pública**: em **Project Settings → API Keys**,
   copie o **Project URL** e a chave **anon/public** (NÃO a `service_role`,
   essa é secreta). Cole essas duas informações em `js/supabase-config.js`,
   substituindo os textos `COLE_AQUI_A_PROJECT_URL` e `COLE_AQUI_A_ANON_KEY`.
5. **Crie as contas da equipe**: em **Authentication → Users → Add user**,
   crie um usuário (e-mail + senha) pra cada pessoa que vai acessar o app.
   Marque a opção de já confirmar o e-mail automaticamente (já que é você,
   administrador, criando a conta — não precisa de um fluxo de confirmação
   por e-mail). Cada pessoa loga com o e-mail e senha que você definir.
6. **Desative cadastro público** (recomendado): em
   **Authentication → Sign In / Providers → Email**, deixe desligada a opção
   de permitir que qualquer um se cadastre sozinho — assim só entra quem
   você cadastrar manualmente no passo 5.

Pronto — depois disso o app já lê e escreve direto no Supabase.

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
Todos os valores continuam editáveis por município na aba Configurações.

`SEGURANCA` (em `data.js`) classifica 13 municípios como **Aduaneiro**
(fronteira — Tabatinga, Benjamin Constant, Atalaia do Norte, São Gabriel da
Cachoeira, Santo Antônio do Içá, Amaturá) ou **Corredor de Escoamento**
(Coari, Tefé, Jutaí, Codajás, Fonte Boa, Manacapuru, Iranduba).

## Login (contas individuais)

Cada pessoa da equipe tem seu próprio e-mail/senha (criados pelo
administrador no painel do Supabase — ver "Como configurar o Supabase"
acima, passo 5). Funciona assim:
- `login.html` pede e-mail e senha, e usa o Supabase Auth pra conferir.
- `index.html` confere se há uma sessão válida assim que abre; se não
  houver, redireciona pra `login.html`.
- O botão ⏻ no cabeçalho desconecta a sessão atual.

Não existe cadastro público — só quem o administrador cadastrar no Supabase
consegue entrar. A URL e a chave pública do projeto (`js/supabase-config.js`)
são seguras de ficar no código: o acesso de verdade é controlado pelas
regras (Row Level Security) configuradas no banco, não por essas duas
informações ficarem "escondidas".

## Publicação (Vercel)

O site é HTML/CSS/JS estático (sem build step) — a Vercel só serve os
arquivos, sem precisar de nenhuma função de servidor. Basta apontar o
projeto Vercel para a raiz desta pasta (`index.html` na raiz). Toda a lógica
de login e dados compartilhados roda direto do navegador pro Supabase, sem
passar pelo servidor da Vercel.

**Antes de publicar**, garanta que `js/supabase-config.js` já tem a URL e a
anon key reais do seu projeto Supabase (ver seção acima) — sem isso o login
não funciona.
