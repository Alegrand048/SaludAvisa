-- SaludAvisa: sincronizar grupo familiar con datos vivos de Supabase
-- Objetivo:
-- 1) Que cliente/familiar vean grupo SOLO si existe en grupos_familiares + miembros_familia.
-- 2) Reparar casos donde existe solicitud aceptada pero falta miembro activo.
-- 3) Reforzar RLS para lectura por uid o email autenticado.
--
-- Seguro: no borra tablas ni filas historicas.

begin;

-- ============================================================
-- A) DIAGNOSTICO RAPIDO (opcional: descomenta para revisar)
-- ============================================================
-- select id, propietario_id, propietario_email, creado_en
-- from public.grupos_familiares
-- order by creado_en desc
-- limit 50;
--
-- select grupo_id, usuario_id, email, rol, estado, creado_en, actualizado_en
-- from public.miembros_familia
-- order by actualizado_en desc nulls last, creado_en desc
-- limit 100;
--
-- select id, solicitante_usuario_id, solicitante_email, cliente_email, estado, actualizado_en
-- from public.solicitudes_union_familiar
-- order by actualizado_en desc
-- limit 100;

-- ============================================================
-- B) BACKFILL DE MEMBRESIA
-- ============================================================

-- 1) Enlazar usuario_id por email cuando falte en miembros_familia.
update public.miembros_familia mf
set usuario_id = u.id,
    actualizado_en = now()
from auth.users u
where mf.usuario_id is null
  and lower(mf.email) = lower(u.email);

-- 2) Para solicitudes aceptadas, asegurar fila de miembro activo del familiar.
insert into public.miembros_familia (grupo_id, usuario_id, email, rol, estado)
select
  src.grupo_id,
  src.usuario_id,
  src.email,
  'familiar_cuidador' as rol,
  'activo' as estado
from (
  select distinct on (gf.id, lower(s.solicitante_email))
    gf.id as grupo_id,
    u_familiar.id as usuario_id,
    lower(s.solicitante_email) as email
  from public.solicitudes_union_familiar s
  join public.grupos_familiares gf
    on lower(gf.propietario_email) = lower(s.cliente_email)
  left join auth.users u_familiar
    on lower(u_familiar.email) = lower(s.solicitante_email)
  where s.estado = 'aceptada'
  order by gf.id, lower(s.solicitante_email), s.actualizado_en desc, s.creado_en desc
) src
on conflict (grupo_id, email)
do update
set usuario_id = coalesce(excluded.usuario_id, public.miembros_familia.usuario_id),
    rol = 'familiar_cuidador',
    estado = 'activo',
    actualizado_en = now();

-- 3) (Opcional funcional) asegurar que el cliente propietario aparezca como miembro activo.
insert into public.miembros_familia (grupo_id, usuario_id, email, rol, estado)
select
  gf.id,
  gf.propietario_id,
  lower(gf.propietario_email),
  'cliente',
  'activo'
from public.grupos_familiares gf
on conflict (grupo_id, email)
do update
set usuario_id = coalesce(excluded.usuario_id, public.miembros_familia.usuario_id),
    rol = 'cliente',
    estado = 'activo',
    actualizado_en = now();

-- ============================================================
-- C) RLS ROBUSTA PARA LECTURA DE GRUPO
-- ============================================================

alter table public.grupos_familiares enable row level security;
alter table public.miembros_familia enable row level security;
alter table public.solicitudes_union_familiar enable row level security;

drop policy if exists grupos_familiares_select_policy on public.grupos_familiares;
create policy grupos_familiares_select_policy
on public.grupos_familiares
for select
to authenticated
using (
  propietario_id = auth.uid()
  or lower(propietario_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or exists (
    select 1
    from public.miembros_familia mf
    where mf.grupo_id = grupos_familiares.id
      and mf.estado = 'activo'
      and (
        mf.usuario_id = auth.uid()
        or lower(mf.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

drop policy if exists miembros_familia_select_policy on public.miembros_familia;
create policy miembros_familia_select_policy
on public.miembros_familia
for select
to authenticated
using (
  usuario_id = auth.uid()
  or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or exists (
    select 1
    from public.grupos_familiares gf
    where gf.id = miembros_familia.grupo_id
      and (
        gf.propietario_id = auth.uid()
        or lower(gf.propietario_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

drop policy if exists solicitudes_union_solicitante_select on public.solicitudes_union_familiar;
create policy solicitudes_union_solicitante_select
on public.solicitudes_union_familiar
for select
to authenticated
using (
  solicitante_usuario_id = auth.uid()
  or lower(solicitante_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

commit;

notify pgrst, 'reload schema';
