-- SaludAvisa: limpieza y reconstruccion minima de Auth + Familia
-- Ejecuta en Supabase SQL Editor sobre el proyecto correcto.

begin;

create extension if not exists pgcrypto;

-- ============================================================
-- 1) PERFIL BASICO PARA EVITAR FALLOS EN ALTA DE USUARIO
-- ============================================================

create table if not exists public.perfiles (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text,
  email text,
  avatar_emoji text not null default '👵',
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.preferencias_notificacion (
  usuario_id uuid primary key references auth.users(id) on delete cascade,
  recordatorios_medicacion boolean not null default true,
  recordatorios_citas boolean not null default true,
  sonido_activado boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create or replace function public._touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists trg_perfiles_updated_at on public.perfiles;
create trigger trg_perfiles_updated_at
before update on public.perfiles
for each row execute function public._touch_updated_at();

drop trigger if exists trg_preferencias_notificacion_updated_at on public.preferencias_notificacion;
create trigger trg_preferencias_notificacion_updated_at
before update on public.preferencias_notificacion
for each row execute function public._touch_updated_at();

create or replace function public.gestionar_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfiles (usuario_id, nombre_completo, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', ''),
    new.email
  )
  on conflict (usuario_id) do update
    set nombre_completo = excluded.nombre_completo,
        email = excluded.email,
        actualizado_en = now();

  insert into public.preferencias_notificacion (usuario_id)
  values (new.id)
  on conflict (usuario_id) do nothing;

  return new;
end;
$$;

-- Elimina triggers antiguos y deja uno unico
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'on_auth_user_created') THEN
    DROP TRIGGER on_auth_user_created ON auth.users;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'al_crear_usuario_auth') THEN
    DROP TRIGGER al_crear_usuario_auth ON auth.users;
  END IF;
END $$;

create trigger al_crear_usuario_auth
after insert on auth.users
for each row execute function public.gestionar_nuevo_usuario();

-- ============================================================
-- 2) LIMPIEZA DE OBJETOS ANTIGUOS DE FAMILIA
-- ============================================================

-- Funciones legacy (si existen)
drop function if exists public.api_crear_grupo_familiar(uuid, text, text);
drop function if exists public.api_crear_invitacion_familiar(uuid, text, text, text);
drop function if exists public.api_aceptar_invitacion_familiar(uuid, uuid, text);
drop function if exists public.api_cambiar_rol_miembro_familiar(uuid, text, text, text);
drop function if exists public.api_expulsar_miembro_familiar(uuid, text, text);

-- Tablas legacy (si existen)
drop table if exists public.invitaciones_familia cascade;
drop table if exists public.miembros_familia cascade;
drop table if exists public.grupos_familiares cascade;

-- ============================================================
-- 3) MODELO NUEVO DE FAMILIA
-- ============================================================

create table public.grupos_familiares (
  id uuid primary key default gen_random_uuid(),
  propietario_id uuid not null unique references auth.users(id) on delete cascade,
  propietario_email text not null,
  hash_contrasena_familiar text not null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table public.miembros_familia (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos_familiares(id) on delete cascade,
  usuario_id uuid references auth.users(id) on delete set null,
  email text not null,
  rol text not null check (rol in ('cliente', 'familiar_cuidador')),
  estado text not null default 'invitado' check (estado in ('invitado', 'activo')),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (grupo_id, email)
);

create table public.invitaciones_familia (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid not null references public.grupos_familiares(id) on delete cascade,
  email_invitado text not null,
  rol_sugerido text not null check (rol_sugerido in ('cliente', 'familiar_cuidador')),
  token uuid not null unique default gen_random_uuid(),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'revocada', 'expirada')),
  expira_en timestamptz not null default (now() + interval '7 days'),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists idx_miembros_familia_grupo on public.miembros_familia(grupo_id);
create index if not exists idx_miembros_familia_email on public.miembros_familia(email);
create index if not exists idx_invitaciones_familia_token on public.invitaciones_familia(token);

drop trigger if exists trg_grupos_familiares_updated_at on public.grupos_familiares;
create trigger trg_grupos_familiares_updated_at
before update on public.grupos_familiares
for each row execute function public._touch_updated_at();

drop trigger if exists trg_miembros_familia_updated_at on public.miembros_familia;
create trigger trg_miembros_familia_updated_at
before update on public.miembros_familia
for each row execute function public._touch_updated_at();

drop trigger if exists trg_invitaciones_familia_updated_at on public.invitaciones_familia;
create trigger trg_invitaciones_familia_updated_at
before update on public.invitaciones_familia
for each row execute function public._touch_updated_at();

-- ============================================================
-- 4) RLS
-- ============================================================

alter table public.perfiles enable row level security;
alter table public.preferencias_notificacion enable row level security;
alter table public.grupos_familiares enable row level security;
alter table public.miembros_familia enable row level security;
alter table public.invitaciones_familia enable row level security;

drop policy if exists perfiles_select_own on public.perfiles;
create policy perfiles_select_own on public.perfiles
for select using (auth.uid() = usuario_id);

drop policy if exists perfiles_insert_own on public.perfiles;
create policy perfiles_insert_own on public.perfiles
for insert with check (auth.uid() = usuario_id);

drop policy if exists perfiles_update_own on public.perfiles;
create policy perfiles_update_own on public.perfiles
for update using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

drop policy if exists preferencias_notificacion_select_own on public.preferencias_notificacion;
create policy preferencias_notificacion_select_own on public.preferencias_notificacion
for select using (auth.uid() = usuario_id);

drop policy if exists preferencias_notificacion_insert_own on public.preferencias_notificacion;
create policy preferencias_notificacion_insert_own on public.preferencias_notificacion
for insert with check (auth.uid() = usuario_id);

drop policy if exists preferencias_notificacion_update_own on public.preferencias_notificacion;
create policy preferencias_notificacion_update_own on public.preferencias_notificacion
for update using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

drop policy if exists grupos_familiares_select_policy on public.grupos_familiares;
create policy grupos_familiares_select_policy
on public.grupos_familiares
for select
using (
  propietario_id = auth.uid()
  or exists (
    select 1
    from public.miembros_familia mf
    where mf.grupo_id = grupos_familiares.id
      and mf.usuario_id = auth.uid()
      and mf.estado = 'activo'
  )
);

drop policy if exists miembros_familia_select_policy on public.miembros_familia;
create policy miembros_familia_select_policy
on public.miembros_familia
for select
using (
  usuario_id = auth.uid()
  or exists (
    select 1 from public.grupos_familiares gf
    where gf.id = miembros_familia.grupo_id and gf.propietario_id = auth.uid()
  )
);

drop policy if exists invitaciones_familia_select_policy on public.invitaciones_familia;
create policy invitaciones_familia_select_policy
on public.invitaciones_familia
for select
using (
  exists (
    select 1 from public.grupos_familiares gf
    where gf.id = invitaciones_familia.grupo_id and gf.propietario_id = auth.uid()
  )
);

-- ============================================================
-- 5) RPC PARA FAMILIA
-- ============================================================

create or replace function public.api_crear_grupo_familiar(
  p_owner_id uuid,
  p_owner_email text,
  p_contrasena_familiar text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if length(trim(p_contrasena_familiar)) < 4 then
    raise exception 'Contrasena familiar demasiado corta';
  end if;

  insert into public.grupos_familiares (propietario_id, propietario_email, hash_contrasena_familiar)
  values (p_owner_id, lower(trim(p_owner_email)), crypt(p_contrasena_familiar, gen_salt('bf')))
  on conflict (propietario_id)
  do update set
    propietario_email = excluded.propietario_email,
    hash_contrasena_familiar = excluded.hash_contrasena_familiar,
    actualizado_en = now()
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.api_crear_invitacion_familiar(
  p_owner_id uuid,
  p_email_invitado text,
  p_rol text,
  p_contrasena_familiar text
)
returns table(token uuid, grupo_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo public.grupos_familiares%rowtype;
  v_token uuid;
  v_clientes integer;
  v_email text;
begin
  v_email := lower(trim(p_email_invitado));

  if p_rol not in ('cliente', 'familiar_cuidador') then
    raise exception 'Rol invalido';
  end if;

  select * into v_grupo
  from public.grupos_familiares
  where propietario_id = p_owner_id;

  if not found then
    raise exception 'No existe grupo para el propietario';
  end if;

  if v_grupo.hash_contrasena_familiar <> crypt(p_contrasena_familiar, v_grupo.hash_contrasena_familiar) then
    raise exception 'Contrasena familiar incorrecta';
  end if;

  if v_grupo.propietario_email = v_email then
    raise exception 'No puedes invitar tu propio correo';
  end if;

  if p_rol = 'cliente' then
    select count(*)::integer into v_clientes
    from public.miembros_familia
    where grupo_id = v_grupo.id
      and rol = 'cliente'
      and estado in ('invitado', 'activo');

    if v_clientes >= 2 then
      raise exception 'Limite de 2 clientes alcanzado';
    end if;
  end if;

  insert into public.miembros_familia (grupo_id, email, rol, estado)
  values (v_grupo.id, v_email, p_rol, 'invitado')
  on conflict (grupo_id, email)
  do update set
    rol = excluded.rol,
    estado = 'invitado',
    actualizado_en = now();

  insert into public.invitaciones_familia (grupo_id, email_invitado, rol_sugerido, estado)
  values (v_grupo.id, v_email, p_rol, 'pendiente')
  returning invitaciones_familia.token into v_token;

  return query select v_token, v_grupo.id;
end;
$$;

create or replace function public.api_aceptar_invitacion_familiar(
  p_token uuid,
  p_user_id uuid,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_inv public.invitaciones_familia%rowtype;
  v_email text;
begin
  v_email := lower(trim(p_email));

  select * into v_inv
  from public.invitaciones_familia
  where token = p_token
    and estado = 'pendiente';

  if not found then
    raise exception 'Invitacion invalida o ya usada';
  end if;

  if v_inv.expira_en < now() then
    update public.invitaciones_familia
      set estado = 'expirada'
    where id = v_inv.id;
    raise exception 'Invitacion expirada';
  end if;

  if lower(v_inv.email_invitado) <> v_email then
    raise exception 'El correo no coincide con la invitacion';
  end if;

  update public.miembros_familia
    set usuario_id = p_user_id,
        estado = 'activo',
        actualizado_en = now()
  where grupo_id = v_inv.grupo_id
    and email = v_email;

  update public.invitaciones_familia
    set estado = 'aceptada',
        actualizado_en = now()
  where id = v_inv.id;

  return v_inv.grupo_id;
end;
$$;

create or replace function public.api_cambiar_rol_miembro_familiar(
  p_owner_id uuid,
  p_email_miembro text,
  p_nuevo_rol text,
  p_contrasena_familiar text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo public.grupos_familiares%rowtype;
  v_clientes integer;
  v_email text;
begin
  v_email := lower(trim(p_email_miembro));

  if p_nuevo_rol not in ('cliente', 'familiar_cuidador') then
    raise exception 'Rol invalido';
  end if;

  select * into v_grupo
  from public.grupos_familiares
  where propietario_id = p_owner_id;

  if not found then
    raise exception 'No existe grupo para el propietario';
  end if;

  if v_grupo.hash_contrasena_familiar <> crypt(p_contrasena_familiar, v_grupo.hash_contrasena_familiar) then
    raise exception 'Contrasena familiar incorrecta';
  end if;

  update public.miembros_familia
    set rol = p_nuevo_rol,
        actualizado_en = now()
  where grupo_id = v_grupo.id
    and email = v_email;

  if not found then
    raise exception 'Miembro no encontrado';
  end if;

  select count(*)::integer into v_clientes
  from public.miembros_familia
  where grupo_id = v_grupo.id
    and rol = 'cliente'
    and estado in ('invitado', 'activo');

  if v_clientes > 2 then
    raise exception 'No puedes superar 2 clientes';
  end if;
end;
$$;

create or replace function public.api_expulsar_miembro_familiar(
  p_owner_id uuid,
  p_email_miembro text,
  p_contrasena_familiar text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_grupo public.grupos_familiares%rowtype;
  v_email text;
begin
  v_email := lower(trim(p_email_miembro));

  select * into v_grupo
  from public.grupos_familiares
  where propietario_id = p_owner_id;

  if not found then
    raise exception 'No existe grupo para el propietario';
  end if;

  if v_grupo.hash_contrasena_familiar <> crypt(p_contrasena_familiar, v_grupo.hash_contrasena_familiar) then
    raise exception 'Contrasena familiar incorrecta';
  end if;

  delete from public.miembros_familia
  where grupo_id = v_grupo.id
    and email = v_email;

  update public.invitaciones_familia
    set estado = 'revocada',
        actualizado_en = now()
  where grupo_id = v_grupo.id
    and email_invitado = v_email
    and estado = 'pendiente';
end;
$$;

-- ============================================================
-- 6) GRANTS
-- ============================================================

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.perfiles to authenticated;
grant select, insert, update, delete on public.preferencias_notificacion to authenticated;
grant select, insert, update, delete on public.grupos_familiares to authenticated;
grant select, insert, update, delete on public.miembros_familia to authenticated;
grant select, insert, update, delete on public.invitaciones_familia to authenticated;

grant execute on function public.api_crear_grupo_familiar(uuid, text, text) to authenticated;
grant execute on function public.api_crear_invitacion_familiar(uuid, text, text, text) to authenticated;
grant execute on function public.api_aceptar_invitacion_familiar(uuid, uuid, text) to authenticated;
grant execute on function public.api_cambiar_rol_miembro_familiar(uuid, text, text, text) to authenticated;
grant execute on function public.api_expulsar_miembro_familiar(uuid, text, text) to authenticated;

commit;

-- Fuerza a PostgREST a recargar schema para RPC nuevas
notify pgrst, 'reload schema';
