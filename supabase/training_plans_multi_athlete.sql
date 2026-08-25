-- Selección múltiple de atletas al cargar un plan PDF (mismo cambio que ya
-- se hizo en weekly_plans para "Plan semanal"). Correr una sola vez en el
-- SQL editor de Supabase.

alter table training_plans
  add column if not exists athlete_ids uuid[];

-- Migra las filas viejas (un solo atleta en athlete_id) al nuevo formato de array.
update training_plans
  set athlete_ids = array[athlete_id]
  where target = 'individual' and athlete_id is not null and athlete_ids is null;

-- La columna "athlete_id" queda sin usar de acá en adelante (se puede borrar
-- más adelante con `alter table training_plans drop column athlete_id;` una
-- vez confirmado que no hace falta).
