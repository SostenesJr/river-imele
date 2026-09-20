-- ============================================================
-- NAVLOG AMAZÔNIA — SCHEMA SUPABASE
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase
-- (Dashboard → SQL Editor → New query → cole tudo → Run)
-- ============================================================

-- 1) Tabela com os dados operacionais editáveis por município
--    (equivalente ao antigo MUNINFO + as edições de "Configurações")
create table if not exists public.municipios_info (
  seq text primary key,
  ta numeric,
  ps_seca numeric,
  ps_cheia numeric,
  emb_seca jsonb not null default '[]'::jsonb,
  emb_cheia jsonb not null default '[]'::jsonb,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

-- 2) Tabela de observações pessoais por município
--    Cada linha pertence a um usuário (user_id) — cada pessoa só
--    vê e edita as próprias observações.
create table if not exists public.observacoes (
  id uuid primary key default gen_random_uuid(),
  seq text not null,
  user_id uuid not null references auth.users(id) default auth.uid(),
  texto text not null default '',
  updated_at timestamptz not null default now(),
  unique (seq, user_id)
);

-- 3) Segurança (Row Level Security)
alter table public.municipios_info enable row level security;
alter table public.observacoes enable row level security;

-- municipios_info: qualquer pessoa logada pode ler e editar
-- (é a mesma regra que já existia: qualquer operador pode mexer em
-- Configurações — só precisa estar logado)
drop policy if exists "municipios_info_select" on public.municipios_info;
create policy "municipios_info_select" on public.municipios_info
  for select using (auth.role() = 'authenticated');

drop policy if exists "municipios_info_update" on public.municipios_info;
create policy "municipios_info_update" on public.municipios_info
  for update using (auth.role() = 'authenticated');

drop policy if exists "municipios_info_insert" on public.municipios_info;
create policy "municipios_info_insert" on public.municipios_info
  for insert with check (auth.role() = 'authenticated');

-- observacoes: cada usuário só vê e mexe nas próprias linhas
drop policy if exists "observacoes_select_own" on public.observacoes;
create policy "observacoes_select_own" on public.observacoes
  for select using (auth.uid() = user_id);

drop policy if exists "observacoes_insert_own" on public.observacoes;
create policy "observacoes_insert_own" on public.observacoes
  for insert with check (auth.uid() = user_id);

drop policy if exists "observacoes_update_own" on public.observacoes;
create policy "observacoes_update_own" on public.observacoes
  for update using (auth.uid() = user_id);

drop policy if exists "observacoes_delete_own" on public.observacoes;
create policy "observacoes_delete_own" on public.observacoes
  for delete using (auth.uid() = user_id);

-- 4) Trigger: atualiza "updated_at"/"updated_by" automaticamente
--    quando alguém edita um município em Configurações
create or replace function public.set_municipio_updated()
returns trigger as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_municipios_info_updated on public.municipios_info;
create trigger trg_municipios_info_updated
  before update on public.municipios_info
  for each row execute function public.set_municipio_updated();

-- 5) Realtime (opcional, mas deixa a UI reativa quando outra pessoa edita)
alter publication supabase_realtime add table public.municipios_info;

