-- Diagnostico + fix para rol cuidador/familiar
-- Ejecutar completo en SQL Editor. Incluye consultas de comprobacion y reparacion no destructiva.

begin;

-- ============================================================
-- 1) DIAGNOSTICO RAPIDO (solo lectura)
-- ============================================================
-- Ver ultimas solicitudes
-- select id, solicitante_email, cliente_email, estado, creado_en, actualizado_en
-- from public.solicitudes_union_familiar
-- order by actualizado_en desc
-- limit 30;

-- Ver miembros de familia recientes
-- select grupo_id, email, usuario_id, rol, estado, creado_en, actualizado_en
-- from public.miembros_familia
-- order by actualizado_en desc nulls last, creado_en desc
-- limit 50;

-- Ver grupos existentes
-- select id, propietario_id, propietario_email, creado_en
-- from public.grupos_familiares
-- order by creado_en desc
-- limit 20;

-- ============================================================
-- 2) REPARAR ENLACES DE CUIDADOR POR EMAIL/UID
-- ============================================================

-- Rellenar usuario_id faltante en miembros a partir de auth.users.email
update public.miembros_familia mf
set usuario_id = u.id,
    actualizado_en = now()
from auth.users u
where mf.usuario_id is null
  and lower(mf.email) = lower(u.email);

-- Asegurar grupo para solicitudes aceptadas (si no existe)
insert into public.grupos_familiares (propietario_id, propietario_email, hash_contrasena_familiar)
select distinct
  u_cliente.id as propietario_id,
  lower(s.cliente_email) as propietario_email,
  md5('saludavisa-fam::0000') as hash_contrasena_familiar
from public.solicitudes_union_familiar s
join auth.users u_cliente on lower(u_cliente.email) = lower(s.cliente_email)
left join public.grupos_familiares gf on gf.propietario_id = u_cliente.id
where s.estado = 'aceptada'
  and gf.id is null;

-- Asegurar miembro cuidador activo por solicitud aceptada
insert into public.miembros_familia (grupo_id, usuario_id, email, rol, estado)
select
  gf.id as grupo_id,
  u_cuidador.id as usuario_id,
  lower(s.solicitante_email) as email,
  'familiar_cuidador' as rol,
  'activo' as estado
from public.solicitudes_union_familiar s
join public.grupos_familiares gf
  on lower(gf.propietario_email) = lower(s.cliente_email)
left join auth.users u_cuidador
  on lower(u_cuidador.email) = lower(s.solicitante_email)
where s.estado = 'aceptada'
on conflict (grupo_id, email)
do update
set usuario_id = coalesce(excluded.usuario_id, public.miembros_familia.usuario_id),
    rol = 'familiar_cuidador',
    estado = 'activo',
    actualizado_en = now();

-- ============================================================
-- 3) POLICIES ROBUSTAS (uid + email)
-- ============================================================

alter table public.grupos_familiares enable row level security;
alter table public.miembros_familia enable row level security;
alter table public.solicitudes_union_familiar enable row level security;
alter table public.perfiles enable row level security;

drop policy if exists grupos_familiares_select_policy on public.grupos_familiares;
create policy grupos_familiares_select_policy
on public.grupos_familiares
for select
to authenticated
using (
  propietario_id = auth.uid()
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
    select 1 from public.grupos_familiares gf
    where gf.id = miembros_familia.grupo_id
      and gf.propietario_id = auth.uid()
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

drop policy if exists perfiles_select_own on public.perfiles;
create policy perfiles_select_own
on public.perfiles
for select
to authenticated
using (
  auth.uid() = usuario_id
  or exists (
    select 1
    from public.miembros_familia mf_target
    join public.miembros_familia mf_me
      on mf_me.grupo_id = mf_target.grupo_id
    where lower(mf_target.email) = lower(perfiles.email)
      and mf_target.estado = 'activo'
      and mf_me.estado = 'activo'
      and (
        mf_me.usuario_id = auth.uid()
        or lower(mf_me.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
);

-- Columna avatar_url por si faltaba
alter table public.perfiles
add column if not exists avatar_url text;

commit;

notify pgrst, 'reload schema';
