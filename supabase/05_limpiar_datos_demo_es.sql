-- Limpia datos demo heredados de medicacion y citas (si quedaron en Supabase)
-- Ejecutar una vez en SQL Editor.

begin;

-- Medicacion: elimina posibles semillas por id/nombre.
delete from public.medicamentos_usuario
where id::text in ('1', '2', '3')
   or lower(nombre) like '%paracetamol%'
   or lower(nombre) like '%aspirina%'
   or lower(nombre) like '%omeprazol%';

delete from public.medicamentos_familia_compartidos
where id::text in ('1', '2', '3')
   or lower(nombre) like '%paracetamol%'
   or lower(nombre) like '%aspirina%'
   or lower(nombre) like '%omeprazol%';

-- Citas compartidas: elimina posibles semillas por especialidad.
delete from public.citas_familia_compartidas
where id::text in ('1', '2', '3')
   or lower(especialidad) in ('cardiologia', 'oftalmologia', 'traumatologia');

commit;

notify pgrst, 'reload schema';
