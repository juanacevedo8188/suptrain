-- Setup para "Mis planes": subida directa de PDF (sin IA), viewer con pdf.js.
-- Correr esto una sola vez en el SQL editor de Supabase (Dashboard → SQL Editor → New query).

-- 1) Columnas nuevas en training_plans para guardar el PDF subido.
--    (la columna "weeks", si existía, queda sin usar — se puede borrar más
--    adelante con `alter table training_plans drop column weeks;` una vez
--    confirmado que no hace falta.)
alter table training_plans
  add column if not exists file_url text,
  add column if not exists file_path text;

-- 2) Bucket público para los PDFs de planes.
--    Público = cualquiera con el link puede verlo (sin login). Es lo mismo
--    nivel de exposición que ya tiene, por ejemplo, el avatar de un usuario.
--    Si preferís que solo alumnos logueados puedan verlo, avisame y lo
--    armamos con URLs firmadas en vez de bucket público.
insert into storage.buckets (id, name, public)
values ('plan-pdfs', 'plan-pdfs', true)
on conflict (id) do nothing;

-- 3) Políticas de storage: cualquier usuario logueado (coach o alumno) puede
--    subir/editar/borrar en este bucket. El botón de "Cargar plan" ya está
--    oculto para alumnos en la interfaz, así que en la práctica solo el
--    coach lo usa — esto es consistente con cómo están armadas hoy el resto
--    de las tablas de la app (el control de rol coach/atleta se hace en el
--    frontend, no en RLS).
create policy if not exists "plan-pdfs authenticated insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'plan-pdfs');

create policy if not exists "plan-pdfs authenticated update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'plan-pdfs');

create policy if not exists "plan-pdfs authenticated delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'plan-pdfs');

-- La lectura pública de un bucket "public" la sirve Supabase directo por
-- /storage/v1/object/public/plan-pdfs/... sin pasar por RLS, así que no
-- hace falta una policy de select para que el visor funcione.
