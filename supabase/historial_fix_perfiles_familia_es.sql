-- Historial de fixes (perfiles + familia + visibilidad cuidador)
-- Objetivo: dejar trazabilidad de cambios SQL aplicados para nombres/foto y grupo familiar.
-- Seguro: no elimina datos de negocio; solo agrega columna, repara referencias y ajusta policies.

begin;

-- ============================================================
-- A) PERFILES: columna de foto y policy de lectura familiar
-- ============================================================

alter table public.perfiles
add column if not exists avatar_url text;

alter table public.perfiles enable row level security;

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
      and mf_me.estado = 'activo'
      and mf_target.estado = 'activo'
      and (
        mf_me.usuario_id = auth.uid()
        or lower(mf_me.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      )
  )
  or exists (
    select 1
    from public.solicitudes_union_familiar s
    where s.estado = 'aceptada'
      and (
        (s.solicitante_usuario_id = auth.uid() and lower(s.cliente_email) = lower(perfiles.email))
        or (lower(s.solicitante_email) = lower(coalesce(auth.jwt() ->> 'email', '')) and lower(s.cliente_email) = lower(perfiles.email))
        or (lower(s.solicitante_email) = lower(perfiles.email) and lower(s.cliente_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
      )
  )
);

-- ============================================================
-- B) REPARACION DE MIEMBROS_FAMILIA PARA CUIDADOR
-- ============================================================

alter table public.grupos_familiares enable row level security;
alter table public.miembros_familia enable row level security;
alter table public.solicitudes_union_familiar enable row level security;

-- Rellenar usuario_id faltantes en miembros (match por email)
update public.miembros_familia mf
set usuario_id = u.id,
    actualizado_en = now()
from auth.users u
where mf.usuario_id is null
  and lower(mf.email) = lower(u.email);

-- Re-sincronizar miembro activo desde solicitudes aceptadas
insert into public.miembros_familia (grupo_id, usuario_id, email, rol, estado)
select
  gf.id as grupo_id,
  u.id as usuario_id,
  lower(s.solicitante_email) as email,
  'familiar_cuidador' as rol,
  'activo' as estado
from public.solicitudes_union_familiar s
join public.grupos_familiares gf
  on lower(gf.propietario_email) = lower(s.cliente_email)
left join auth.users u
  on lower(u.email) = lower(s.solicitante_email)
where s.estado = 'aceptada'
on conflict (grupo_id, email)
do update
set usuario_id = coalesce(excluded.usuario_id, public.miembros_familia.usuario_id),
    rol = 'familiar_cuidador',
    estado = 'activo',
    actualizado_en = now();

-- Policies de lectura robustas (uid o email autenticado)
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
    select 1
    from public.grupos_familiares gf
    where gf.id = miembros_familia.grupo_id
      and gf.propietario_id = auth.uid()
  )
);

-- Solicitudes visibles por uid o email de solicitante
-- (evita casos antiguos donde solicitante_usuario_id no coincide)
drop policy if exists solicitudes_union_solicitante_select on public.solicitudes_union_familiar;
create policy solicitudes_union_solicitante_select
on public.solicitudes_union_familiar
for select
to authenticated
using (
  solicitante_usuario_id = auth.uid()
  or lower(solicitante_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- ============================================================
-- C) BACKFILL NO DESTRUCTIVO DE PERFILES
-- ============================================================

update public.perfiles p
set
  nombre_completo = coalesce(nullif(p.nombre_completo, ''), nullif(u.raw_user_meta_data->>'name', ''), p.nombre_completo),
  email = coalesce(nullif(p.email, ''), u.email, p.email),
  actualizado_en = now()
from auth.users u
where u.id = p.usuario_id;

commit;

notify pgrst, 'reload schema';
