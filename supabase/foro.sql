-- =====================================================================
-- Foro NFLARG · pegar completo en Supabase → SQL Editor → Run
-- Se puede volver a ejecutar sin romper nada.
-- Foros: 'general', uno por franquicia NFL ('nfl-<id de ESPN>') y uno por partido ('game-<liga>-<id>').
-- Cada foro tiene un muro de mensajes (posts sin thread_id) y temas (threads).
-- =====================================================================

-- Si quedó instalada la primera versión (categorías), se reemplaza
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'threads')
     and not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'threads' and column_name = 'forum') then
    drop table if exists public.posts cascade;
    drop table if exists public.threads cascade;
  end if;
end $$;
drop function if exists public.create_thread(text, text, text);

-- Perfiles: nombre de usuario y franquicia favorita
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  created_at timestamptz not null default now()
);
alter table public.profiles add column if not exists team_id text;
alter table public.profiles drop constraint if exists profiles_team_id_check;
alter table public.profiles add constraint profiles_team_id_check check (team_id is null or team_id ~ '^[0-9]{1,4}$');
create unique index if not exists profiles_username_lower on public.profiles (lower(username));
-- Foto de perfil: solo puede apuntar a la carpeta propia del almacenamiento de avatares
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles drop constraint if exists profiles_avatar_url_check;
alter table public.profiles add constraint profiles_avatar_url_check check (
  avatar_url is null or avatar_url ~ ('^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/avatars/' || id::text || '/[A-Za-z0-9._-]+(\?v=[0-9]+)?$')
);

-- Temas
create table if not exists public.threads (
  id bigint generated always as identity primary key,
  forum text not null,
  title text not null check (char_length(title) between 3 and 120),
  author uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_post_at timestamptz not null default now(),
  post_count integer not null default 0
);
-- Foros válidos: general, franquicia NFL ('nfl-<id>') y partido ('game-<liga>-<id>')
alter table public.threads drop constraint if exists threads_forum_check;
alter table public.threads add constraint threads_forum_check check (forum ~ '^(general|nfl-[0-9]{1,4}|game-(nfl|fbs|fcs|ufl|cfl)-[0-9]{1,12})$');
create index if not exists threads_forum_last on public.threads (forum, last_post_at desc);

-- Mensajes: con thread_id = respuesta de un tema; sin thread_id = mensaje del muro
create table if not exists public.posts (
  id bigint generated always as identity primary key,
  forum text not null,
  thread_id bigint references public.threads (id) on delete cascade,
  author uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 5000),
  likes integer not null default 0,
  dislikes integer not null default 0,
  created_at timestamptz not null default now()
);
alter table public.posts drop constraint if exists posts_forum_check;
alter table public.posts add constraint posts_forum_check check (forum ~ '^(general|nfl-[0-9]{1,4}|game-(nfl|fbs|fcs|ufl|cfl)-[0-9]{1,12})$');
create index if not exists posts_wall on public.posts (forum, id desc) where thread_id is null;
create index if not exists posts_thread on public.posts (thread_id, id);
create index if not exists posts_author_time on public.posts (author, created_at desc);

-- Me gusta / no me gusta: uno por persona y mensaje
create table if not exists public.reactions (
  post_id bigint not null references public.posts (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  value smallint not null check (value in (-1, 1)),
  primary key (post_id, user_id)
);

-- Mail de contacto (opcional y privado: nadie lo puede leer desde la página).
-- La cuenta usa por dentro un mail interno <usuario>@foro-nflarg.com; con este se puede entrar también.
create table if not exists public.account_emails (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email text not null check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')
);
create unique index if not exists account_emails_lower on public.account_emails (lower(email));

-- Al registrarse se crea el perfil con el usuario, la franquicia y el mail opcional
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  contact text := nullif(btrim(new.raw_user_meta_data ->> 'contact_email'), '');
begin
  insert into public.profiles (id, username, team_id)
  values (new.id, new.raw_user_meta_data ->> 'username', nullif(new.raw_user_meta_data ->> 'team_id', ''));
  if contact is not null then
    insert into public.account_emails (user_id, email) values (new.id, lower(contact));
  end if;
  return new;
end;
$$;

-- Cuentas creadas con la versión que pedía el mail: pasan al mail interno y su mail queda como contacto
do $$
declare
  r record;
  syn text;
begin
  for r in
    select u.id, u.email, p.username from auth.users u join public.profiles p on p.id = u.id
     where u.email is not null and u.email not like '%@foro-nflarg.com'
  loop
    syn := lower(r.username) || '@foro-nflarg.com';
    insert into public.account_emails (user_id, email) values (r.id, lower(r.email)) on conflict do nothing;
    update auth.users set email = syn where id = r.id;
    update auth.identities set identity_data = jsonb_set(identity_data, '{email}', to_jsonb(syn))
     where user_id = r.id and provider = 'email';
  end loop;
end $$;

-- Entrar con usuario o mail: devuelve el mail interno de la cuenta (o nada)
create or replace function public.login_email(p_login text)
returns text language sql stable security definer set search_path = '' as $$
  select u.email from public.profiles p join auth.users u on u.id = p.id
   where lower(p.username) = lower(btrim(p_login))
  union all
  select u.email from public.account_emails a join auth.users u on u.id = a.user_id
   where lower(a.email) = lower(btrim(p_login))
  limit 1;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Antes de guardar un mensaje: hereda el foro del tema, contadores en cero y antispam (1 cada 10 s)
create or replace function public.posts_before_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.thread_id is not null then
    select t.forum into new.forum from public.threads t where t.id = new.thread_id;
  end if;
  if exists (select 1 from public.posts p where p.author = new.author and p.created_at > now() - interval '10 seconds') then
    raise exception 'too_fast';
  end if;
  new.likes := 0;
  new.dislikes := 0;
  new.created_at := now();
  return new;
end;
$$;
drop trigger if exists posts_before_insert on public.posts;
create trigger posts_before_insert before insert on public.posts
  for each row execute function public.posts_before_insert();

-- Cada respuesta actualiza el contador y la última actividad del tema
create or replace function public.bump_thread()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.thread_id is not null then
    update public.threads set last_post_at = new.created_at, post_count = post_count + 1 where id = new.thread_id;
  end if;
  return new;
end;
$$;
drop trigger if exists posts_bump_thread on public.posts;
create trigger posts_bump_thread after insert on public.posts
  for each row execute function public.bump_thread();

-- Notificaciones: te responden en un tema tuyo o te citan
create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  actor uuid not null references public.profiles (id) on delete cascade,
  post_id bigint not null references public.posts (id) on delete cascade,
  thread_id bigint references public.threads (id) on delete cascade,
  forum text not null,
  kind text not null check (kind in ('reply', 'quote')),
  read boolean not null default false,
  created_at timestamptz not null default now(),
  unique (user_id, post_id)
);
create index if not exists notifications_user on public.notifications (user_id, id desc);
create index if not exists notifications_unread on public.notifications (user_id) where not read;

create or replace function public.notify_on_post()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  t_author uuid;
  quoted text;
  target uuid;
begin
  if new.thread_id is not null then
    select t.author into t_author from public.threads t where t.id = new.thread_id;
    if t_author is not null and t_author <> new.author then
      insert into public.notifications (user_id, actor, post_id, thread_id, forum, kind)
      values (t_author, new.author, new.id, new.thread_id, new.forum, 'reply')
      on conflict (user_id, post_id) do nothing;
    end if;
  end if;
  for quoted in
    select distinct lower(m[1]) from regexp_matches(new.body, '\[quote=([A-Za-z0-9_]{1,20})\]', 'g') as m
  loop
    select p.id into target from public.profiles p where lower(p.username) = quoted;
    if target is not null and target <> new.author then
      insert into public.notifications (user_id, actor, post_id, thread_id, forum, kind)
      values (target, new.author, new.id, new.thread_id, new.forum, 'quote')
      on conflict (user_id, post_id) do update set kind = 'quote';
    end if;
  end loop;
  return new;
end;
$$;
drop trigger if exists posts_notify on public.posts;
create trigger posts_notify after insert on public.posts
  for each row execute function public.notify_on_post();

-- Recuento de likes / dislikes
create or replace function public.count_reactions()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  pid bigint := coalesce(new.post_id, old.post_id);
begin
  update public.posts p
     set likes = (select count(*) from public.reactions r where r.post_id = pid and r.value = 1),
         dislikes = (select count(*) from public.reactions r where r.post_id = pid and r.value = -1)
   where p.id = pid;
  return null;
end;
$$;
drop trigger if exists reactions_count on public.reactions;
create trigger reactions_count after insert or update or delete on public.reactions
  for each row execute function public.count_reactions();

-- Crear tema + primer mensaje en una sola operación
create or replace function public.create_thread(p_forum text, p_title text, p_body text)
returns bigint language plpgsql security invoker set search_path = '' as $$
declare
  tid bigint;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;
  insert into public.threads (forum, title, author) values (p_forum, btrim(p_title), auth.uid()) returning id into tid;
  insert into public.posts (forum, thread_id, body, author) values (p_forum, tid, p_body, auth.uid());
  return tid;
end;
$$;

-- Rankings (solo números por equipo y nombres de usuario públicos; nada privado)
create or replace function public.ranking_hinchas()
returns table (team_id text, fans bigint)
language sql stable security invoker set search_path = '' as $$
  select p.team_id, count(*) from public.profiles p
   where p.team_id is not null
   group by p.team_id
   order by 2 desc, 1;
$$;
create or replace function public.ranking_actividad()
returns table (team_id text, posts bigint, autores bigint, likes bigint)
language sql stable security invoker set search_path = '' as $$
  select p.team_id, count(po.id), count(distinct p.id), coalesce(sum(po.likes), 0)
    from public.posts po join public.profiles p on p.id = po.author
   where p.team_id is not null
   group by p.team_id
   order by 2 desc, 4 desc, 1;
$$;
create or replace function public.ranking_usuarios(p_limit integer default 10)
returns table (username text, team_id text, avatar_url text, posts bigint, likes bigint)
language sql stable security invoker set search_path = '' as $$
  select p.username, p.team_id, p.avatar_url, count(po.id), coalesce(sum(po.likes), 0)
    from public.posts po join public.profiles p on p.id = po.author
   group by p.id, p.username, p.team_id, p.avatar_url
   order by 4 desc, 5 desc, 1
   limit least(greatest(coalesce(p_limit, 10), 1), 50);
$$;
grant execute on function public.ranking_hinchas() to anon, authenticated;
grant execute on function public.ranking_actividad() to anon, authenticated;
grant execute on function public.ranking_usuarios(integer) to anon, authenticated;

-- Permisos: todos leen; los usuarios registrados escriben siempre a su nombre
alter table public.profiles enable row level security;
alter table public.threads enable row level security;
alter table public.posts enable row level security;
alter table public.reactions enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "leer perfiles" on public.profiles;
drop policy if exists "editar mi perfil" on public.profiles;
drop policy if exists "leer hilos" on public.threads;
drop policy if exists "crear hilos" on public.threads;
drop policy if exists "leer mensajes" on public.posts;
drop policy if exists "crear mensajes" on public.posts;
drop policy if exists "leer reacciones" on public.reactions;
drop policy if exists "reaccionar" on public.reactions;
drop policy if exists "cambiar reaccion" on public.reactions;
drop policy if exists "quitar reaccion" on public.reactions;

create policy "leer perfiles" on public.profiles for select using (true);
create policy "editar mi perfil" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "leer hilos" on public.threads for select using (true);
create policy "crear hilos" on public.threads for insert to authenticated with check (author = auth.uid());
create policy "leer mensajes" on public.posts for select using (true);
create policy "crear mensajes" on public.posts for insert to authenticated with check (author = auth.uid());
create policy "leer reacciones" on public.reactions for select using (true);
create policy "reaccionar" on public.reactions for insert to authenticated with check (user_id = auth.uid());
create policy "cambiar reaccion" on public.reactions for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "quitar reaccion" on public.reactions for delete to authenticated using (user_id = auth.uid());

grant usage on schema public to anon, authenticated;
grant select on public.profiles, public.threads, public.posts, public.reactions to anon, authenticated;
grant insert on public.threads, public.posts, public.reactions to authenticated;
grant update, delete on public.reactions to authenticated;
revoke update on public.profiles from anon, authenticated;
grant update (team_id, avatar_url) on public.profiles to authenticated;
revoke update, delete on public.posts, public.threads from anon, authenticated;
drop policy if exists "ver mis notificaciones" on public.notifications;
drop policy if exists "marcar mis notificaciones" on public.notifications;
drop policy if exists "borrar mis notificaciones" on public.notifications;
create policy "ver mis notificaciones" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "marcar mis notificaciones" on public.notifications for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "borrar mis notificaciones" on public.notifications for delete to authenticated using (user_id = auth.uid());
revoke all on public.notifications from anon;
revoke insert, update on public.notifications from authenticated;
grant select, delete on public.notifications to authenticated;
grant update (read) on public.notifications to authenticated;
revoke insert, update, delete on public.threads, public.posts, public.reactions, public.profiles from anon;
alter table public.account_emails enable row level security;
revoke all on public.account_emails from anon, authenticated;
grant execute on function public.login_email(text) to anon, authenticated;
grant usage on all sequences in schema public to authenticated;
revoke execute on function public.create_thread(text, text, text) from public, anon;
grant execute on function public.create_thread(text, text, text) to authenticated;

-- Almacenamiento de fotos de perfil: público para ver, cada uno sube/cambia/borra solo la suya.
-- Va en un bloque aparte: si el proyecto no permitiera crearlo, el resto del foro igual queda instalado.
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', true, 262144, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;
  execute 'drop policy if exists "avatares: ver" on storage.objects';
  execute 'drop policy if exists "avatares: subir el mio" on storage.objects';
  execute 'drop policy if exists "avatares: cambiar el mio" on storage.objects';
  execute 'drop policy if exists "avatares: borrar el mio" on storage.objects';
  execute $p$create policy "avatares: ver" on storage.objects for select using (bucket_id = 'avatars')$p$;
  execute $p$create policy "avatares: subir el mio" on storage.objects for insert to authenticated
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  execute $p$create policy "avatares: cambiar el mio" on storage.objects for update to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
    with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  execute $p$create policy "avatares: borrar el mio" on storage.objects for delete to authenticated
    using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
exception when others then
  raise warning 'No se pudo configurar el almacenamiento de fotos de perfil: %', sqlerrm;
end $$;

-- Que la API de Supabase vea los cambios de inmediato
notify pgrst, 'reload schema';
