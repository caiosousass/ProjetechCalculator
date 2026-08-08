-- Projetech Calc — estrutura de login e monitoramento de acesso
-- Rode uma vez no painel do Supabase: SQL Editor → New query → cole tudo → Run.
-- Pode rodar de novo sem medo: tudo aqui é idempotente.

-- ============================================================
-- 1. Tabelas
-- ============================================================

-- Um perfil por usuário do Auth. É aqui que ficam admin/bloqueio.
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  nome       text,
  is_admin   boolean     not null default false,
  blocked    boolean     not null default false,
  last_seen  timestamptz,
  created_at timestamptz not null default now()
);

-- Uma linha por entrada no app.
create table if not exists public.access_log (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users(id) on delete cascade,
  email      text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists access_log_created_idx on public.access_log (created_at desc);
create index if not exists access_log_user_idx    on public.access_log (user_id);

-- ============================================================
-- 2. Perfil criado junto com o usuário
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome', ''))
  on conflict (id) do nothing;
  return new;
end
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Cria o perfil de quem já existia antes deste script.
insert into public.profiles (id, email)
select u.id, u.email from auth.users u
on conflict (id) do nothing;

-- ============================================================
-- 3. Quem é admin (security definer: evita recursão no RLS)
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
$$;

-- ============================================================
-- 4. RLS — sem isso, qualquer um com a chave anon lê tudo
-- ============================================================

alter table public.profiles   enable row level security;
alter table public.access_log enable row level security;

-- Perfis: cada um vê o seu; admin vê todos.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- Só o próprio usuário atualiza a própria linha...
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ...e, mesmo assim, apenas a coluna last_seen (ninguém se promove a admin).
revoke update on public.profiles from authenticated;
grant  update (last_seen) on public.profiles to authenticated;

-- Log: cada um grava só o próprio acesso; admin lê todos, usuário lê os seus.
drop policy if exists log_insert on public.access_log;
create policy log_insert on public.access_log
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists log_select on public.access_log;
create policy log_select on public.access_log
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ============================================================
-- 5. Ações de admin (bloquear / promover)
-- ============================================================

create or replace function public.admin_set_blocked(target uuid, value boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem bloquear usuários.';
  end if;
  update public.profiles set blocked = value where id = target;
end
$$;

create or replace function public.admin_set_admin(target uuid, value boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem alterar permissões.';
  end if;
  if target = auth.uid() and value = false then
    raise exception 'Você não pode remover o seu próprio acesso de administrador.';
  end if;
  update public.profiles set is_admin = value where id = target;
end
$$;

-- ============================================================
-- 6. Defina o administrador (troque o e-mail!)
-- ============================================================

update public.profiles
set is_admin = true
where email = 'caio20334@gmail.com';
