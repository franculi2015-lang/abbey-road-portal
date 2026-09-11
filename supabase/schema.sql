-- ABBEY ROAD PORTAL v2.0
-- Ejecutar el archivo COMPLETO en Supabase > SQL Editor > Run.
-- Es idempotente: se puede volver a ejecutar si fuera necesario.
-- No elimina tablas ni datos existentes.

create extension if not exists citext;
create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum ('supervisor', 'profesor', 'alumno');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext not null unique check (username::text ~ '^[A-Za-z0-9._-]{3,30}$'),
  full_name text not null check (char_length(full_name) between 2 and 80),
  role public.user_role not null default 'alumno',
  active boolean not null default true,
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  storage_path text generated always as (
    'Usuarios/' ||
    case role
      when 'supervisor' then 'Supervisores/'
      when 'profesor' then 'Profesores/'
      else 'Alumnos/'
    end || id::text || '.json'
  ) stored
);

alter table public.profiles
  add column if not exists must_change_password boolean not null default false;

create table if not exists public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 80),
  description text not null default '' check (char_length(description) <= 500),
  teacher_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  title text not null check (char_length(title) between 2 and 120),
  content text not null default '' check (char_length(content) <= 5000),
  resource_url text check (resource_url is null or resource_url ~ '^https?://'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.profiles(id) on delete cascade,
  teacher_id uuid references public.profiles(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  title text not null check (char_length(title) between 2 and 120),
  score numeric(6,2) not null check (score >= 0),
  max_score numeric(6,2) not null default 10 check (max_score > 0 and score <= max_score),
  feedback text not null default '' check (char_length(feedback) <= 1500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete set null,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists idx_profiles_role on public.profiles(role, active);
create index if not exists idx_groups_teacher on public.groups(teacher_id);
create index if not exists idx_members_user on public.group_members(user_id);
create index if not exists idx_materials_group on public.materials(group_id, created_at desc);
create index if not exists idx_grades_student on public.grades(student_id, created_at desc);
create index if not exists idx_grades_teacher on public.grades(teacher_id, created_at desc);
create index if not exists idx_messages_group on public.messages(group_id, created_at);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists groups_set_updated_at on public.groups;
create trigger groups_set_updated_at
before update on public.groups
for each row execute function public.set_updated_at();

drop trigger if exists materials_set_updated_at on public.materials;
create trigger materials_set_updated_at
before update on public.materials
for each row execute function public.set_updated_at();

drop trigger if exists grades_set_updated_at on public.grades;
create trigger grades_set_updated_at
before update on public.grades
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  proposed_username text;
  proposed_name text;
begin
  proposed_username := lower(regexp_replace(
    coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), split_part(coalesce(new.email, ''), '@', 1)),
    '[^A-Za-z0-9._-]', '', 'g'
  ));

  if proposed_username !~ '^[a-z0-9._-]{3,30}$' then
    proposed_username := 'user_' || left(replace(new.id::text, '-', ''), 12);
  end if;

  proposed_name := trim(coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), proposed_username));
  if char_length(proposed_name) < 2 then proposed_name := proposed_username; end if;
  proposed_name := left(proposed_name, 80);

  insert into public.profiles (id, username, full_name, role, active)
  values (new.id, proposed_username, proposed_name, 'alumno', true)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Si había usuarios creados antes del esquema, crea sus perfiles faltantes.
insert into public.profiles (id, username, full_name, role, active)
select
  u.id,
  case
    when lower(split_part(coalesce(u.email, ''), '@', 1)) ~ '^[a-z0-9._-]{3,30}$'
      then lower(split_part(u.email, '@', 1))
    else 'user_' || left(replace(u.id::text, '-', ''), 12)
  end,
  left(coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), split_part(coalesce(u.email, ''), '@', 1), 'Usuario'), 80),
  'alumno',
  true
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
on conflict do nothing;

create or replace function public.is_active_user(check_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = check_id and active = true
  );
$$;

create or replace function public.is_supervisor(check_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = check_id and active = true and role = 'supervisor'
  );
$$;

create or replace function public.is_staff(check_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = check_id and active = true and role in ('supervisor', 'profesor')
  );
$$;

create or replace function public.can_manage_group(check_group uuid, check_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_supervisor(check_id) or exists (
    select 1 from public.groups
    where id = check_group and teacher_id = check_id and public.is_staff(check_id)
  );
$$;

create or replace function public.can_access_group(check_group uuid, check_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select public.is_active_user(check_id) and (
    public.is_supervisor(check_id)
    or exists (select 1 from public.groups where id = check_group and teacher_id = check_id)
    or exists (select 1 from public.group_members where group_id = check_group and user_id = check_id)
  );
$$;

create or replace function public.protect_last_supervisor()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if tg_op = 'DELETE' then
    if old.role = 'supervisor' and old.active = true
      and (select count(*) from public.profiles where role = 'supervisor' and active = true) <= 1 then
      raise exception 'last active supervisor';
    end if;
    return old;
  end if;

  if old.role = 'supervisor' and old.active = true
    and (new.role <> 'supervisor' or new.active = false) then
    if (select count(*) from public.profiles where role = 'supervisor' and active = true) <= 1 then
      raise exception 'last active supervisor';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists protect_last_supervisor_trigger on public.profiles;
create trigger protect_last_supervisor_trigger
before update or delete on public.profiles
for each row execute function public.protect_last_supervisor();

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.materials enable row level security;
alter table public.grades enable row level security;
alter table public.messages enable row level security;

-- Limpia únicamente políticas anteriores de las tablas propias del portal.
-- Esto evita que una instalación previa deje permisos incompatibles.
do $$
declare
  existing_policy record;
begin
  for existing_policy in
    select tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('profiles', 'groups', 'group_members', 'materials', 'grades', 'messages')
  loop
    execute format('drop policy if exists %I on public.%I', existing_policy.policyname, existing_policy.tablename);
  end loop;
end $$;

drop policy if exists profiles_read_active on public.profiles;
create policy profiles_read_active on public.profiles
for select to authenticated
using (public.is_active_user() and (active = true or public.is_supervisor()));

drop policy if exists groups_read_accessible on public.groups;
create policy groups_read_accessible on public.groups
for select to authenticated
using (public.can_access_group(id));

drop policy if exists groups_create_staff on public.groups;
create policy groups_create_staff on public.groups
for insert to authenticated
with check (
  public.is_staff() and (teacher_id = auth.uid() or public.is_supervisor())
);

drop policy if exists groups_update_manager on public.groups;
create policy groups_update_manager on public.groups
for update to authenticated
using (public.can_manage_group(id))
with check (public.can_manage_group(id));

drop policy if exists groups_delete_manager on public.groups;
create policy groups_delete_manager on public.groups
for delete to authenticated
using (public.can_manage_group(id));

drop policy if exists members_read_group on public.group_members;
create policy members_read_group on public.group_members
for select to authenticated
using (public.can_access_group(group_id) or public.can_manage_group(group_id));

drop policy if exists members_add_manager on public.group_members;
create policy members_add_manager on public.group_members
for insert to authenticated
with check (public.can_manage_group(group_id));

drop policy if exists members_remove_manager on public.group_members;
create policy members_remove_manager on public.group_members
for delete to authenticated
using (public.can_manage_group(group_id));

drop policy if exists materials_read_group on public.materials;
create policy materials_read_group on public.materials
for select to authenticated
using (public.can_access_group(group_id));

drop policy if exists materials_create_staff on public.materials;
create policy materials_create_staff on public.materials
for insert to authenticated
with check (
  public.is_staff() and author_id = auth.uid() and public.can_manage_group(group_id)
);

drop policy if exists materials_update_author on public.materials;
create policy materials_update_author on public.materials
for update to authenticated
using (public.is_supervisor() or (author_id = auth.uid() and public.can_manage_group(group_id)))
with check (public.is_supervisor() or (author_id = auth.uid() and public.can_manage_group(group_id)));

drop policy if exists materials_delete_author on public.materials;
create policy materials_delete_author on public.materials
for delete to authenticated
using (public.is_supervisor() or (author_id = auth.uid() and public.can_manage_group(group_id)));

drop policy if exists grades_read_authorized on public.grades;
create policy grades_read_authorized on public.grades
for select to authenticated
using (
  public.is_active_user() and (
    student_id = auth.uid()
    or public.is_supervisor()
    or teacher_id = auth.uid()
    or (group_id is not null and public.can_manage_group(group_id))
  )
);

drop policy if exists grades_create_staff on public.grades;
create policy grades_create_staff on public.grades
for insert to authenticated
with check (
  public.is_staff()
  and teacher_id = auth.uid()
  and group_id is not null
  and public.can_manage_group(group_id)
  and exists (
    select 1 from public.group_members
    where group_id = grades.group_id and user_id = grades.student_id
  )
);

drop policy if exists grades_update_teacher on public.grades;
create policy grades_update_teacher on public.grades
for update to authenticated
using (public.is_supervisor() or teacher_id = auth.uid())
with check (public.is_supervisor() or teacher_id = auth.uid());

drop policy if exists grades_delete_teacher on public.grades;
create policy grades_delete_teacher on public.grades
for delete to authenticated
using (public.is_supervisor() or teacher_id = auth.uid());

drop policy if exists messages_read_group on public.messages;
create policy messages_read_group on public.messages
for select to authenticated
using (public.can_access_group(group_id));

drop policy if exists messages_create_member on public.messages;
create policy messages_create_member on public.messages
for insert to authenticated
with check (
  sender_id = auth.uid() and public.can_access_group(group_id)
);

drop policy if exists messages_delete_authorized on public.messages;
create policy messages_delete_authorized on public.messages
for delete to authenticated
using (
  sender_id = auth.uid() or public.can_manage_group(group_id)
);

grant usage on schema public to authenticated;
grant select on public.profiles to authenticated;
grant select, insert, update, delete on public.groups to authenticated;
grant select, insert, delete on public.group_members to authenticated;
grant select, insert, update, delete on public.materials to authenticated;
grant select, insert, update, delete on public.grades to authenticated;
grant select, insert, delete on public.messages to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

-- Verificación final. Si aparece una fila con schema_version = 2.0, terminó bien.
select '2.0' as schema_version, now() as installed_at;
