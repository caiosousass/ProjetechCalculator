-- Projetech Calc — acesso aberto ao mercado + painel do administrador
-- Rode uma vez no Supabase: SQL Editor → New query → cole tudo → Run.
-- Pode rodar de novo sem medo: tudo aqui é idempotente.

-- ============================================================
-- 1. Administrador (login só de quem gerencia)
-- ============================================================
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text,
  nome       text,
  is_admin   boolean     not null default false,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, email, nome)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'nome',''))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, email)
select u.id, u.email from auth.users u on conflict (id) do nothing;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false)
$$;

alter table public.profiles enable row level security;
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated using (id = auth.uid() or public.is_admin());

-- ============================================================
-- 2. Visitantes (quem usa) e visitas (cada entrada)
-- ============================================================
create table if not exists public.visitantes (
  device_id  text primary key,
  nome       text,
  area       text,
  cidade     text,
  contato    text,
  created_at timestamptz not null default now()
);

create table if not exists public.visitas (
  id         bigint generated always as identity primary key,
  device_id  text,
  nome       text,
  area       text,
  cidade     text,
  user_agent text,
  ocorreu_em timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists visitas_ocorreu_idx on public.visitas (ocorreu_em desc);
create index if not exists visitas_device_idx  on public.visitas (device_id);

alter table public.visitantes enable row level security;
alter table public.visitas    enable row level security;

-- Leitura só do admin. O público nunca lê os dados de ninguém.
drop policy if exists visitantes_admin_select on public.visitantes;
create policy visitantes_admin_select on public.visitantes
  for select to authenticated using (public.is_admin());
drop policy if exists visitas_admin_select on public.visitas;
create policy visitas_admin_select on public.visitas
  for select to authenticated using (public.is_admin());
grant select on public.visitantes, public.visitas to authenticated;

-- ============================================================
-- 3. Escrita pública via funções (o público não escreve direto nas tabelas)
-- ============================================================
create or replace function public.registrar_visitante(
  p_device text, p_nome text, p_area text, p_cidade text, p_contato text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_device is null or length(p_device) < 8 then return; end if;
  insert into public.visitantes (device_id, nome, area, cidade, contato)
  values (p_device, left(coalesce(p_nome,''),120), left(coalesce(p_area,''),60),
          left(coalesce(p_cidade,''),80), left(coalesce(p_contato,''),120))
  on conflict (device_id) do update
    set nome = excluded.nome, area = excluded.area,
        cidade = excluded.cidade, contato = excluded.contato;
end $$;

create or replace function public.registrar_visita(
  p_device text, p_nome text, p_area text, p_cidade text, p_ua text, p_ocorreu timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_device is null or length(p_device) < 8 then return; end if;
  insert into public.visitas (device_id, nome, area, cidade, user_agent, ocorreu_em)
  values (p_device, left(coalesce(p_nome,''),120), left(coalesce(p_area,''),60),
          left(coalesce(p_cidade,''),80), left(coalesce(p_ua,''),400),
          coalesce(p_ocorreu, now()));
end $$;

grant execute on function public.registrar_visitante(text,text,text,text,text)      to anon, authenticated;
grant execute on function public.registrar_visita(text,text,text,text,text,timestamptz) to anon, authenticated;

-- ============================================================
-- 4. Painel do admin (números agregados)
-- ============================================================
create or replace function public.admin_resumo()
returns json language plpgsql security definer set search_path = '' as $$
declare r json;
begin
  if not public.is_admin() then raise exception 'Apenas administradores.'; end if;
  select json_build_object(
    'total_visitas', (select count(*) from public.visitas),
    'total_pessoas', (select count(*) from public.visitantes),
    'visitas_hoje',  (select count(*) from public.visitas    where ocorreu_em >= date_trunc('day', now())),
    'pessoas_hoje',  (select count(*) from public.visitantes where created_at >= date_trunc('day', now()))
  ) into r;
  return r;
end $$;

create or replace function public.admin_pessoas()
returns table (device_id text, nome text, area text, cidade text, contato text,
               created_at timestamptz, visitas bigint, ultimo_acesso timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Apenas administradores.'; end if;
  return query
    select v.device_id, v.nome, v.area, v.cidade, v.contato, v.created_at,
      (select count(*)          from public.visitas x where x.device_id = v.device_id),
      (select max(x.ocorreu_em) from public.visitas x where x.device_id = v.device_id)
    from public.visitantes v
    order by v.created_at desc;
end $$;

grant execute on function public.admin_resumo()  to authenticated;
grant execute on function public.admin_pessoas() to authenticated;

-- ============================================================
-- 5. Defina o administrador (troque o e-mail se for outro)
-- ============================================================
update public.profiles set is_admin = true where email = 'caio20334@gmail.com';
