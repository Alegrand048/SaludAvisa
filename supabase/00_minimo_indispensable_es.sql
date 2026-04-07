-- SaludAvisa: esquema minimo indispensable para produccion simple
-- Objetivo: mantener solo persistencia y seguridad de datos compartidos.

create extension if not exists pgcrypto;

-- Perfiles basicos
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

-- Medicacion propia
create table if not exists public.medicamentos_usuario (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null,
  dosis text not null,
  stock integer not null default 0,
  tipo_caja text,
  horarios jsonb not null default '[]'::jsonb,
  etiqueta_frecuencia text not null,
  fecha_fin_tratamiento date,
  color text not null default 'from-blue-100 to-blue-50',
  emoji text not null default '💊',
  activa boolean not null default true,
  ultima_toma_en timestamptz,
  dias_semana text[] not null default '{}'::text[],
  duracion_dias integer,
  fecha_inicio date,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Medicacion compartida cuidador -> cliente
create table if not exists public.medicamentos_familia_compartidos (
  id uuid primary key default gen_random_uuid(),
  creador_usuario_id uuid not null references auth.users(id) on delete cascade,
  cliente_email text not null,
  nombre text not null,
  dosis text not null,
  stock integer not null default 0,
  tipo_caja text,
  horarios jsonb not null default '[]'::jsonb,
  etiqueta_frecuencia text not null,
  fecha_fin_tratamiento date,
  color text not null default 'from-blue-100 to-blue-50',
  emoji text not null default '💊',
  activa boolean not null default true,
  ultima_toma_en timestamptz,
  dias_semana text[] not null default '{}'::text[],
  duracion_dias integer,
  fecha_inicio date,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Citas compartidas cuidador -> cliente
create table if not exists public.citas_familia_compartidas (
  id uuid primary key default gen_random_uuid(),
  creador_usuario_id uuid not null references auth.users(id) on delete cascade,
  cliente_email text not null,
  especialidad text not null,
  fecha_hora timestamptz not null,
  ubicacion text not null,
  medico text not null,
  emoji text not null default '🩺',
  color text not null default 'from-green-100 to-green-50',
  activa boolean not null default true,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

-- Grupo familiar y solicitudes
create table if not exists public.grupos_familiares (
  id uuid primary key default gen_random_uuid(),
  propietario_id uuid not null unique references auth.users(id) on delete cascade,
  propietario_email text not null,
  hash_contrasena_familiar text not null,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now()
);

create table if not exists public.miembros_familia (
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

create table if not exists public.invitaciones_familia (
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

-- RLS minima
alter table public.perfiles enable row level security;
alter table public.preferencias_notificacion enable row level security;
alter table public.medicamentos_usuario enable row level security;
alter table public.medicamentos_familia_compartidos enable row level security;
alter table public.citas_familia_compartidas enable row level security;
alter table public.grupos_familiares enable row level security;
alter table public.miembros_familia enable row level security;
alter table public.solicitudes_union_familiar enable row level security;
alter table public.invitaciones_familia enable row level security;

-- Politicas por usuario
drop policy if exists perfiles_select_own on public.perfiles;
create policy perfiles_select_own on public.perfiles for select using (auth.uid() = usuario_id);
drop policy if exists perfiles_insert_own on public.perfiles;
create policy perfiles_insert_own on public.perfiles for insert with check (auth.uid() = usuario_id);
drop policy if exists perfiles_update_own on public.perfiles;
create policy perfiles_update_own on public.perfiles for update using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

drop policy if exists preferencias_notificacion_select_own on public.preferencias_notificacion;
create policy preferencias_notificacion_select_own on public.preferencias_notificacion for select using (auth.uid() = usuario_id);
drop policy if exists preferencias_notificacion_insert_own on public.preferencias_notificacion;
create policy preferencias_notificacion_insert_own on public.preferencias_notificacion for insert with check (auth.uid() = usuario_id);
drop policy if exists preferencias_notificacion_update_own on public.preferencias_notificacion;
create policy preferencias_notificacion_update_own on public.preferencias_notificacion for update using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);

drop policy if exists medicamentos_usuario_select_own on public.medicamentos_usuario;
create policy medicamentos_usuario_select_own on public.medicamentos_usuario for select using (auth.uid() = usuario_id);
drop policy if exists medicamentos_usuario_insert_own on public.medicamentos_usuario;
create policy medicamentos_usuario_insert_own on public.medicamentos_usuario for insert with check (auth.uid() = usuario_id);
drop policy if exists medicamentos_usuario_update_own on public.medicamentos_usuario;
create policy medicamentos_usuario_update_own on public.medicamentos_usuario for update using (auth.uid() = usuario_id) with check (auth.uid() = usuario_id);
drop policy if exists medicamentos_usuario_delete_own on public.medicamentos_usuario;
create policy medicamentos_usuario_delete_own on public.medicamentos_usuario for delete using (auth.uid() = usuario_id);

drop policy if exists med_compartidos_creador_full on public.medicamentos_familia_compartidos;
create policy med_compartidos_creador_full on public.medicamentos_familia_compartidos for all to authenticated using (creador_usuario_id = auth.uid()) with check (creador_usuario_id = auth.uid());
drop policy if exists med_compartidos_cliente_select on public.medicamentos_familia_compartidos;
create policy med_compartidos_cliente_select on public.medicamentos_familia_compartidos for select to authenticated using (lower(cliente_email) = lower(coalesce(auth.jwt() ->> 'email', '')));
drop policy if exists med_compartidos_cliente_update_toma on public.medicamentos_familia_compartidos;
create policy med_compartidos_cliente_update_toma on public.medicamentos_familia_compartidos for update to authenticated using (lower(cliente_email) = lower(coalesce(auth.jwt() ->> 'email', ''))) with check (lower(cliente_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists citas_compartidas_creador_full on public.citas_familia_compartidas;
create policy citas_compartidas_creador_full on public.citas_familia_compartidas for all to authenticated using (creador_usuario_id = auth.uid()) with check (creador_usuario_id = auth.uid());
drop policy if exists citas_compartidas_cliente_select on public.citas_familia_compartidas;
create policy citas_compartidas_cliente_select on public.citas_familia_compartidas for select to authenticated using (lower(cliente_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

grant select, insert, update, delete on public.medicamentos_familia_compartidos to authenticated;
grant select, insert, update, delete on public.citas_familia_compartidas to authenticated;

notify pgrst, 'reload schema';
