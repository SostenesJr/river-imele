/* ============================================================
   NAVLOG AMAZÔNIA — CONFIGURAÇÃO DO SUPABASE
   A URL e a "anon key" são públicas por design (protegidas pelas
   regras de acesso — RLS — configuradas no banco), então é seguro
   deixá-las aqui no código do site.
   ============================================================ */
const SUPABASE_URL = 'https://dnoppexsrhsueedrejkc.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_Od6h9Iut-aK7DVtbYQWKJw_NIl37_31';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
