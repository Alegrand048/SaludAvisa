-- Fix: el cuidador no ve el cliente en Grupo familiar
-- Seguro: no elimina datos; solo repara relaciones y políticas de lectura.

begin;

-- 1) Rellenar usuario_id en miembros_familia cuando falte (match por email)
update public.miembros_familia mf
set usuario_id = u.id,
    actualizado_en = now()
from auth.users u
where mf.usuario_id is null
  and lower(mf.email) = lower(u.email);

-- 2) Asegurar fila de miembro activo para solicitudes aceptadas
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

-- 3) Políticas: permitir lectura de grupo/miembros también por email autenticado
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

-- 4) Políticas: solicitudes visibles también por solicitante_email
-- (útil cuando solicitante_usuario_id quedó desfasado en datos antiguos)
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
