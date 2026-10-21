-- =====================================================================
-- Foro NFLARG · pegar completo en Supabase → SQL Editor → Run
-- Se puede volver a ejecutar sin romper nada.
-- =====================================================================

-- Perfiles: un nombre de usuario por cuenta
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);
create unique index if not exists profiles_username_lower on public.profiles (lower(username));

-- Hilos
create table if not exists public.threads (
  id bigint generated always as identity primary key,
  category text not null check (category in ('general', 'nfl', 'ncaa', 'ufl', 'cfl')),
  title text not null check (char_length(title) between 3 and 120),
  author uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_post_at timestamptz not null default now(),
  post_count integer not null default 0
);
create index if not exists threads_category_last on public.threads (category, last_post_at desc);
create index if not exists threads_last on public.threads (last_post_at desc);

-- Mensajes
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  thread_id bigint not null references public.threads (id) on delete cascade,
  author uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  created_at timestamptz not null default now()
);
create index if not exists posts_thread on public.posts (thread_id, id);

-- Al registrarse se crea el perfil con el nombre de usuario elegido
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username)
  values (new.id, new.raw_user_meta_data ->> 'username');
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Cada mensaje nuevo actualiza el contador y la última actividad del hilo
create or replace function public.bump_thread()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.threads
     set last_post_at = new.created_at,
         post_count = post_count + 1
   where id = new.thread_id;
  return new;
end;
$$;
drop trigger if exists posts_bump_thread on public.posts;
create trigger posts_bump_thread
  after insert on public.posts
  for each row execute function public.bump_thread();

-- Crear hilo + primer mensaje en una sola operación
create or replace function public.create_thread(p_category text, p_title text, p_body text)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  tid bigint;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  insert into public.threads (category, title, author)
  values (p_category, btrim(p_title), auth.uid())
  returning id into tid;
  insert into public.posts (thread_id, body, author)
  values (tid, p_body, auth.uid());
  return tid;
end;
$$;

-- Permisos: todos leen; solo usuarios registrados escriben, y siempre a su nombre
alter table public.profiles enable row level security;
alter table public.threads enable row level security;
alter table public.posts enable row level security;

drop policy if exists "leer perfiles" on public.profiles;
drop policy if exists "leer hilos" on public.threads;
drop policy if exists "leer mensajes" on public.posts;
drop policy if exists "crear hilos" on public.threads;
drop policy if exists "crear mensajes" on public.posts;

create policy "leer perfiles" on public.profiles for select using (true);
create policy "leer hilos" on public.threads for select using (true);
create policy "leer mensajes" on public.posts for select using (true);
create policy "crear hilos" on public.threads for insert to authenticated with check (author = auth.uid());
create policy "crear mensajes" on public.posts for insert to authenticated with check (author = auth.uid());

grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.threads, public.posts to anon, authenticated;
grant insert on public.threads, public.posts to authenticated;
grant usage on all sequences in schema public to authenticated;
revoke execute on function public.create_thread(text, text, text) from public, anon;
grant execute on function public.create_thread(text, text, text) to authenticated;
