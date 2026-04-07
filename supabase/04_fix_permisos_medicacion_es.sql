-- Ejecutar este script si Guardar/Borrar en Medicacion falla por permisos
-- con errores tipo: permission denied for table medicamentos_usuario.

begin;

alter table if exists public.medicamentos_usuario enable row level security;
alter table if exists public.medicamentos_familia_compartidos enable row level security;

drop policy if exists medicamentos_usuario_select_own on public.medicamentos_usuario;
create policy medicamentos_usuario_select_own
on public.medicamentos_usuario
for select
to authenticated
using (auth.uid() = usuario_id);

drop policy if exists medicamentos_usuario_insert_own on public.medicamentos_usuario;
create policy medicamentos_usuario_insert_own
on public.medicamentos_usuario
for insert
to authenticated
with check (auth.uid() = usuario_id);

drop policy if exists medicamentos_usuario_update_own on public.medicamentos_usuario;
create policy medicamentos_usuario_update_own
on public.medicamentos_usuario
for update
to authenticated
using (auth.uid() = usuario_id)
with check (auth.uid() = usuario_id);

drop policy if exists medicamentos_usuario_delete_own on public.medicamentos_usuario;
create policy medicamentos_usuario_delete_own
on public.medicamentos_usuario
for delete
to authenticated
using (auth.uid() = usuario_id);

drop policy if exists med_compartidos_creador_full on public.medicamentos_familia_compartidos;
create policy med_compartidos_creador_full
on public.medicamentos_familia_compartidos
for all
to authenticated
using (creador_usuario_id = auth.uid())
with check (creador_usuario_id = auth.uid());

drop policy if exists med_compartidos_cliente_select on public.medicamentos_familia_compartidos;
create policy med_compartidos_cliente_select
on public.medicamentos_familia_compartidos
for select
to authenticated
using (lower(cliente_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

drop policy if exists med_compartidos_cliente_update_toma on public.medicamentos_familia_compartidos;
create policy med_compartidos_cliente_update_toma
on public.medicamentos_familia_compartidos
for update
to authenticated
using (lower(cliente_email) = lower(coalesce(auth.jwt() ->> 'email', '')))
with check (lower(cliente_email) = lower(coalesce(auth.jwt() ->> 'email', '')));

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.medicamentos_usuario to authenticated;
grant select, insert, update, delete on public.medicamentos_familia_compartidos to authenticated;

commit;

notify pgrst, 'reload schema';
