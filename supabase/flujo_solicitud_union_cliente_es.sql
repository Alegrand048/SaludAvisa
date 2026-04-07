-- Flujo nuevo: familiar/cuidador solicita unirse al cliente, cliente acepta.
-- Ademas corrige error "gen_salt does not exist" eliminando dependencia de crypt/gen_salt.

begin;

-- ============================================================
-- 1) HASH DE CONTRASENA FAMILIAR SIN gen_salt/crypt
-- ============================================================

create or replace function public.hash_contrasena_familiar(p_plain text)
returns text
language sql
immutable
as $$
  select md5('saludavisa-fam::' || coalesce(trim(p_plain), ''));
$$;

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
  v_hash text;
begin
  if length(trim(p_contrasena_familiar)) < 4 then
    raise exception 'Contrasena familiar demasiado corta';
  end if;

  v_hash := public.hash_contrasena_familiar(p_contrasena_familiar);

  insert into public.grupos_familiares (propietario_id, propietario_email, hash_contrasena_familiar)
  values (p_owner_id, lower(trim(p_owner_email)), v_hash)
  on conflict (propietario_id)
  do update set
    propietario_email = excluded.propietario_email,
    hash_contrasena_familiar = excluded.hash_contrasena_familiar,
    actualizado_en = now()
  returning id into v_id;

  return v_id;
end;
$$;

-- ============================================================
-- 2) NORMALIZACION DE ROLES LEGACY
-- ============================================================

update public.miembros_familia
set rol = 'familiar_cuidador'
where rol = 'cuidador_familiar';

update public.invitaciones_familia
set rol_sugerido = 'familiar_cuidador'
where rol_sugerido = 'cuidador_familiar';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_miembros_familia_rol'
      AND conrelid = 'public.miembros_familia'::regclass
  ) THEN
    ALTER TABLE public.miembros_familia DROP CONSTRAINT ck_miembros_familia_rol;
  END IF;

  ALTER TABLE public.miembros_familia
    ADD CONSTRAINT ck_miembros_familia_rol
    CHECK (rol in ('cliente', 'familiar_cuidador'));
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ck_invitaciones_familia_rol_sugerido'
      AND conrelid = 'public.invitaciones_familia'::regclass
  ) THEN
    ALTER TABLE public.invitaciones_familia DROP CONSTRAINT ck_invitaciones_familia_rol_sugerido;
  END IF;

  ALTER TABLE public.invitaciones_familia
    ADD CONSTRAINT ck_invitaciones_familia_rol_sugerido
    CHECK (rol_sugerido in ('cliente', 'familiar_cuidador'));
END $$;

-- ============================================================
-- 3) SOLICITUDES DE UNION (NUEVO FLUJO)
-- ============================================================

create table if not exists public.solicitudes_union_familiar (
  id uuid primary key default gen_random_uuid(),
  solicitante_usuario_id uuid not null references auth.users(id) on delete cascade,
  solicitante_email text not null,
  solicitante_nombre text not null,
  cliente_email text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente', 'aceptada', 'rechazada')),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create index if not exists idx_solicitudes_union_cliente_email
  on public.solicitudes_union_familiar(cliente_email);

create index if not exists idx_solicitudes_union_solicitante
  on public.solicitudes_union_familiar(solicitante_usuario_id);

create or replace function public._touch_solicitud_union_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.actualizado_en = now();
  return new;
end;
$$;

drop trigger if exists trg_solicitud_union_updated_at on public.solicitudes_union_familiar;
create trigger trg_solicitud_union_updated_at
before update on public.solicitudes_union_familiar
for each row execute function public._touch_solicitud_union_updated_at();

alter table public.solicitudes_union_familiar enable row level security;

drop policy if exists solicitudes_union_solicitante_insert on public.solicitudes_union_familiar;
create policy solicitudes_union_solicitante_insert
on public.solicitudes_union_familiar
for insert
to authenticated
with check (solicitante_usuario_id = auth.uid());

drop policy if exists solicitudes_union_solicitante_select on public.solicitudes_union_familiar;
create policy solicitudes_union_solicitante_select
on public.solicitudes_union_familiar
for select
to authenticated
using (solicitante_usuario_id = auth.uid());

drop policy if exists solicitudes_union_cliente_select on public.solicitudes_union_familiar;
create policy solicitudes_union_cliente_select
on public.solicitudes_union_familiar
for select
to authenticated
using (lower(cliente_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists solicitudes_union_cliente_update on public.solicitudes_union_familiar;
create policy solicitudes_union_cliente_update
on public.solicitudes_union_familiar
for update
to authenticated
using (lower(cliente_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
with check (lower(cliente_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- El cliente puede leer invitaciones pendientes por email (clave para auto-vincular)
drop policy if exists invitaciones_familia_select_policy on public.invitaciones_familia;
create policy invitaciones_familia_select_policy
on public.invitaciones_familia
for select
to authenticated
using (
  exists (
    select 1
    from public.grupos_familiares gf
    where gf.id = invitaciones_familia.grupo_id
      and gf.propietario_id = auth.uid()
  )
  or lower(email_invitado) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- RPC: aceptar solicitud de union
create or replace function public.api_aceptar_solicitud_union_familiar(
  p_cliente_id uuid,
  p_cliente_email text,
  p_solicitud_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_solicitud public.solicitudes_union_familiar%rowtype;
  v_grupo_id uuid;
  v_cliente_email text;
begin
  v_cliente_email := lower(trim(p_cliente_email));

  select * into v_solicitud
  from public.solicitudes_union_familiar
  where id = p_solicitud_id
    and estado = 'pendiente';

  if not found then
    raise exception 'Solicitud no encontrada o ya procesada';
  end if;

  if lower(v_solicitud.cliente_email) <> v_cliente_email then
    raise exception 'La solicitud no corresponde a este cliente';
  end if;

  insert into public.grupos_familiares (propietario_id, propietario_email, hash_contrasena_familiar)
  values (
    p_cliente_id,
    v_cliente_email,
    public.hash_contrasena_familiar('0000')
  )
  on conflict (propietario_id)
  do update set propietario_email = excluded.propietario_email
  returning id into v_grupo_id;

  insert into public.miembros_familia (grupo_id, usuario_id, email, rol, estado)
  values (
    v_grupo_id,
    v_solicitud.solicitante_usuario_id,
    lower(v_solicitud.solicitante_email),
    'familiar_cuidador',
    'activo'
  )
  on conflict (grupo_id, email)
  do update set
    usuario_id = excluded.usuario_id,
    rol = 'familiar_cuidador',
    estado = 'activo',
    actualizado_en = now();

  update public.solicitudes_union_familiar
  set estado = 'aceptada',
      actualizado_en = now()
  where id = p_solicitud_id;

  return v_grupo_id;
end;
$$;

grant select, insert, update on public.solicitudes_union_familiar to authenticated;
grant execute on function public.api_aceptar_solicitud_union_familiar(uuid, text, uuid) to authenticated;
grant execute on function public.api_crear_grupo_familiar(uuid, text, text) to authenticated;

commit;

notify pgrst, 'reload schema';
