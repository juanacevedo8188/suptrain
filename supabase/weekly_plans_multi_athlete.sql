-- Selección múltiple de atletas en "Plan semanal": dos alumnos con el mismo
-- mesociclo ahora comparten un único plan en vez de tener que cargarlo dos
-- veces. Correr una sola vez en el SQL editor de Supabase.

alter table weekly_plans
  add column if not exists athlete_ids uuid[];

-- Migra las filas viejas (un solo atleta en athlete_id) al nuevo formato de array.
update weekly_plans
  set athlete_ids = array[athlete_id]
  where target = 'individual' and athlete_id is not null and athlete_ids is null;

-- La columna "athlete_id" queda sin usar de acá en adelante (se puede borrar
-- más adelante con `alter table weekly_plans drop column athlete_id;` una
-- vez confirmado que no hace falta).
