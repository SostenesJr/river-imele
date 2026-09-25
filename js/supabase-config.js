/* ============================================================
   NAVLOG AMAZÔNIA — CONFIGURAÇÃO DO SUPABASE
   A URL e a "anon key" são públicas por design (protegidas pelas
   regras de acesso — RLS — configuradas no banco), então é seguro
   deixá-las aqui no código do site.
   ============================================================ */
const SUPABASE_URL = 'https://dnoppexsrhsueedrejkc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Od6h9Iut-aK7DVtbYQWKJw_NIl37_31';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* Chave pública do VAPID (notificações push) — assim como a anon key
   acima, é pública por design (é ela que vai dentro de cada inscrição
   push, o navegador manda ela pro servidor de push da Apple/Google/
   Mozilla). A chave PRIVADA correspondente NUNCA fica no código do
   site — só como variável de ambiente na Vercel (ver api/_lib/push.js
   e README, seção "Notificações push"). */
const VAPID_PUBLIC_KEY = 'BN-01iwFjGoas6FCTI1Cux4C08V9cmz58uZzNeRiechxmJloQsNpdsogsDXivNDBWveCUe3EVRFImOiI-1Xy69k';
