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

## Estrutura (5 abas)

1. **Rotas** — lista oculta com as 10 calhas (A–J). Ao abrir uma calha, mostra os
   municípios em ordem de passagem, com distância (km) e transit time de cada um.
2. **Informações** — somente leitura. Grade de balões compactos (o código do
   node, cor por calha, borda arredondada) agrupada por calha; municípios
   Aduaneiro/Corredor de Escoamento ganham um selo no canto do balão. Tocar num
   balão abre um pop-up com o nome do município e todas as informações:
   - Transit Time Amazon, distância e transit da rota
   - Preço por saca — **Seca** e **Cheia**
   - Embarcações mais usadas, com avaliação (estrelas) e dias de saída na
     semana, quando cadastrados
   - Classificação de segurança (Aduaneiro/Corredor), quando aplicável, em
     seção retrátil
   - **Observações** — campo de texto livre por município. Pessoal de cada
     usuário (ninguém mais vê a sua), salvo na conta de quem escreveu — não
     depende do aparelho.
3. **Configurações** — **só aparece pra quem tem perfil admin** (ver "Perfis:
   admin e cliente" abaixo). Os mesmos municípios por calha; ao tocar num
   município abre um balão **editável** com:
   - Transit Time Amazon (dias)
   - Preço por saca — Seca e Cheia
   - Embarcações mais usadas, com opção de adicionar, remover ou renomear,
     ajustar o transit time, dar uma **avaliação (1 a 5 estrelas)** e marcar
     em quais **dias da semana** ela costuma sair (seg a dom).
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
   distância, TT Amazon) e embarcações principais. Ao selecionar uma calha
   específica, uma embarcação (🚤) ou ônibus (🚌, nas calhas rodoviárias) anima
   percorrendo a rota do hub (Manaus) até os municípios. Municípios
   classificados como **Aduaneiro** ou **Corredor de Escoamento** ganham um
   selo diferenciado, uma aura vermelha pulsante (ponto de atenção/
   fiscalização), filtro próprio e um link "ver detalhes" que abre o balão
   somente-leitura da aba Informações.
5. **Notícias** — nível do Rio Negro em Manaus (referência: Porto de
   Manaus), atualizado **automaticamente 1x por dia**: valor atual em
   metros, se está enchendo ou vazando (com a variação do dia em cm),
   medidor visual de baixa/normal/cheia, gráfico com o histórico e um feed
   tipo notícia com as leituras de cada dia. O app só *lê* esses dados — a
   coleta é feita por uma função separada (`api/cron/nivel-rio.js`, rodando
   na Vercel), não pelo navegador de quem usa o app. Veja "Como configurar
   a coleta do nível do rio" abaixo — é um passo a mais, só precisa fazer
   uma vez.

## Arquivos

- `index.html` — estrutura das 5 abas + verificação de login ao abrir
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
- `supabase/migracao-emb-unico.sql` — só pra quem já tinha rodado o
  `schema.sql` **antes de 20/09/2026**: une as colunas antigas `emb_seca`/
  `emb_cheia` numa coluna só `emb` (ver "Dados de origem" abaixo). Instalação
  nova não precisa rodar isso.
- `supabase/migracao-perfis-empresa.sql` — só pra quem já tinha rodado o
  `schema.sql` **antes de 20/09/2026** (versão anterior à divisão admin/
  cliente): cria as tabelas `perfis`/`config_empresa` e restringe edição de
  Configurações a quem for admin (ver "Perfis: admin e cliente" abaixo).
  Instalação nova não precisa rodar isso.
- `manifest.json` — metadados do PWA (nome, ícone, cor, modo "standalone")
  que o navegador lê na hora de instalar o app
- `sw.js` — service worker: guarda o "esqueleto" do app em cache local pra
  abrir instantâneo (inclusive com internet ruim); nunca guarda dados do
  Supabase, que continuam sempre vindo direto da rede em tempo real
- `icons/` — ícones do app em vários tamanhos, usados pelo `manifest.json`
  e como favicon
- `supabase/nivel_rio.sql` — cria a tabela do nível do rio (aba Notícias)
  e a linha inicial ("âncora") pra coleta automática começar a funcionar
- `api/cron/nivel-rio.js` — função que roda 1x por dia (agendada pela
  Vercel, veja `vercel.json`) e busca o nível do dia
- `vercel.json` — configura o agendamento (cron) da função acima: roda
  todo dia às 11h UTC (7h da manhã em Manaus)

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
7. **Defina quem é admin**: por padrão, todo mundo que loga é tratado como
   **cliente** (só visualiza). Pra alguém poder editar Configurações, nova
   query no SQL Editor com (trocando o e-mail pelo da pessoa):
   ```sql
   insert into public.perfis (user_id, role, nome)
   select id, 'admin', email from auth.users where email = 'email-da-pessoa@aqui.com'
   on conflict (user_id) do update set role = 'admin';
   ```
   Repita pra cada pessoa da equipe que deve editar. Quem não for cadastrado
   aqui continua como cliente — só visualiza Rotas/Informações/Mapa/Notícias.

Pronto — depois disso o app já lê e escreve direto no Supabase.

**Já tinha configurado antes de 20/09/2026?** Rode também, uma vez só, os
scripts de migração no SQL Editor (nessa ordem):
1. `supabase/migracao-emb-unico.sql` — une as colunas antigas `emb_seca`/
   `emb_cheia` numa coluna só `emb`, sem perder nenhuma edição que vocês já
   tinham feito.
2. `supabase/migracao-perfis-empresa.sql` — cria os perfis (admin/cliente)
   e os dados da empresa. **Importante**: depois de rodar esse arquivo,
   ninguém mais edita Configurações até você rodar o passo 3 dele (cadastrar
   o primeiro admin) — o próprio arquivo tem esse passo no final, comentado.

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
no futuro vocês souberem realmente quais embarcações rodam só na seca e
quais só na cheia, dá pra reintroduzir essa separação.

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

## Perfis: admin e cliente

Além de logar, cada pessoa tem um **perfil de acesso**, guardado na tabela
`perfis` do Supabase:

- **Admin** — vê e edita tudo, inclusive a aba **Configurações** (preços,
  embarcações, avaliação, dias de saída, dados da empresa).
- **Cliente** — só visualiza: Rotas, Informações, Mapa e Notícias. A aba
  Configurações nem aparece no menu pra esse perfil, e mesmo tentando forçar
  pelo navegador, o Supabase recusa qualquer tentativa de gravação (a regra
  fica no banco, não só escondida na tela).

Quem loga sem ter uma linha em `perfis` é tratado como **cliente** por
padrão (mais seguro). Pra promover alguém a admin, é um INSERT manual no SQL
Editor do Supabase — ver "Como configurar o Supabase", passo 7. Não existe
essa opção dentro do próprio app de propósito: assim ninguém consegue virar
admin sozinho, só quem tem acesso ao painel do Supabase.

Uso típico: cadastre como admin quem realmente opera os preços/embarcações
na empresa, e como cliente qualquer pessoa (cliente final, parceiro) que só
precisa consultar rota, preço e embarcações disponíveis.

## Dados da empresa (nome + logo)

Em Configurações, o card **"Dados da empresa"** (só admin vê) deixa definir:
- **Nome da empresa** — substitui "NAVLOG AMAZÔNIA" no cabeçalho, pra todo
  mundo (admin e cliente).
- **Logo** — uma URL de imagem (pode ser um link de uma imagem já hospedada,
  por exemplo no Google Drive/Imgur, ou um link direto pro arquivo). Substitui
  o pontinho decorativo do cabeçalho por essa imagem.
Ambos ficam salvos no banco (tabela `config_empresa`) e aparecem pra toda a
equipe, em qualquer aparelho, sem precisar publicar o site de novo.

## Publicação (Vercel)

O site continua sendo HTML/CSS/JS estático (sem build step) pra tudo que a
equipe usa — a Vercel só serve os arquivos, e toda a lógica de login e
dados compartilhados roda direto do navegador pro Supabase. A única exceção
é a pasta `api/` (a coleta diária do nível do rio, explicada na próxima
seção): a Vercel detecta esses arquivos automaticamente e roda como função
de servidor, sem precisar configurar nada especial no projeto — o resto do
site continua 100% estático como antes.

Basta apontar o projeto Vercel para a raiz desta pasta (`index.html` na
raiz), do mesmo jeito de sempre (upload do zip).

**Antes de publicar**, garanta que `js/supabase-config.js` já tem a URL e a
anon key reais do seu projeto Supabase (ver seção acima) — sem isso o login
não funciona.

## Como configurar a coleta do nível do rio (uma vez só)

Isso é **opcional** — se você pular esta seção, o app inteiro continua
funcionando normalmente, só a aba Notícias fica vazia (mostra um aviso
"ainda não tem leitura salva") até você configurar.

1. **Rode o SQL**: no Supabase, **SQL Editor → New query**, cole todo o
   conteúdo de `supabase/nivel_rio.sql` e rode. Isso cria a tabela
   `nivel_rio` e já deixa uma primeira leitura salva (do dia em que este
   recurso foi criado), que serve de ponto de partida pra coleta diária.
2. **Pegue a chave "service_role"**: no Supabase, **Project Settings → API
   Keys**, copie a chave **service_role** (não é a mesma "anon" que já está
   em `supabase-config.js` — essa aqui é secreta, nunca cole ela em nenhum
   arquivo do site).
3. **Configure as variáveis de ambiente na Vercel**: no painel do seu
   projeto na Vercel, **Settings → Environment Variables**, adicione:
   - `SUPABASE_URL` → a mesma URL do projeto (a que está em
     `supabase-config.js`)
   - `SUPABASE_SERVICE_ROLE_KEY` → a chave que você copiou no passo 2
   - `CRON_SECRET` → opcional, mas recomendado: invente uma senha
     qualquer só sua (ex: gere uma em [1password.com/password-generator](https://1password.com/password-generator/)
     ou similar) — isso impede que qualquer pessoa na internet chame a
     rota de coleta manualmente
4. **Publique** (upload do zip, como sempre). A Vercel lê o `vercel.json` e
   já agenda a função `api/cron/nivel-rio.js` pra rodar 1x por dia, sozinha,
   sem precisar abrir o app nem ter ninguém logado.

**Pra testar sem esperar o agendamento**: com o site publicado, abra
`https://SEU-SITE.vercel.app/api/cron/nivel-rio` no navegador (ou peça pra
alguém rodar) — se tiver configurado um `CRON_SECRET`, essa chamada manual
pelo navegador vai dar "não autorizado" (isso é esperado e é o que protege
a rota); nesse caso, teste direto no painel da Vercel em **Deployments →
Functions → nivel-rio → Run** (ou similar, o nome exato muda um pouco
conforme a versão do painel).

A fonte dos dados (portodemanaus.com.br) publica a leitura do dia em
formato de página comum (não é uma API oficial), então a função faz uma
leitura simples do texto da página. Se o site mudar de layout no futuro, a
coleta pode parar de reconhecer o valor do dia — nesse caso a função
responde com um erro claro em vez de gravar um número errado, e o app
continua mostrando a última leitura válida até alguém ajustar o texto que a
função procura.

## Histórico completo do nível do rio (opcional, recomendado)

Além da coleta diária (que só grava a partir de hoje em diante), dá pra
carregar de uma vez todo o histórico disponível na fonte:
**9.679 leituras diárias, de 01/01/2000 até 18/09/2026**. Com isso, a aba
Notícias já nasce com gráfico e comparação "mesmo dia do ano passado"
funcionando, em vez de esperar meses pra acumular dados sozinha.

1. Depois de rodar `supabase/nivel_rio.sql` (passo 1 acima), rode também
   `supabase/nivel_rio_backfill.sql` no mesmo **SQL Editor** do Supabase.
   É um arquivo grande (~9.700 linhas, dividido em 20 blocos de `insert`),
   pode demorar alguns segundos pra rodar — é normal.
2. Pode rodar esse arquivo quantas vezes quiser sem medo: cada linha usa
   `on conflict (data) do nothing`, então ele nunca sobrescreve uma leitura
   que já esteja salva (nem as que a coleta automática for adicionando).

Esse histórico foi extraído diretamente do site portodemanaus.com.br
(o mesmo que a coleta diária usa), então tem a mesma origem e confiabilidade
dos dados — só que de uma vez, para todos os anos disponíveis. A aba
Notícias, com o histórico carregado, mostra automaticamente: "hoje: X,XXm
— mesmo dia do ano passado: Y,YYm (diferença)" no card principal, além de
um gráfico com os últimos 90 dias.
