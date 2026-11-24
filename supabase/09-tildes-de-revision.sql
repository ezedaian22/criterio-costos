-- ----------------------------------------------------------------------------
--  09 · El tilde de "ya lo revisé" para la confección y el corte
--
--  Las telas, los avíos y las perchas ya tenían su tilde (precios_*.actualizado):
--  al clonar una temporada quedan en pendiente, al editar el precio se tildan
--  solas, y la pantalla muestra ⏳ o ✓. La confección y el corte no lo tenían,
--  así que al empezar una temporada no había forma de saber cuáles ya se
--  recotizaron y cuáles faltan averiguar.
--
--  El default es TRUE a propósito: las temporadas que ya existen quedan
--  tildadas, porque su trabajo ya está hecho y no son tarea pendiente. La que
--  nace de un clonado se marca en FALSE desde la aplicación, que es cuando
--  empieza el trabajo de recotizar.
-- ----------------------------------------------------------------------------

ALTER TABLE costos.articulos
  ADD COLUMN IF NOT EXISTS confeccion_actualizada boolean NOT NULL DEFAULT true;

ALTER TABLE costos.config
  ADD COLUMN IF NOT EXISTS corte_actualizado boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN costos.articulos.confeccion_actualizada IS
  'false = la confección viene de la temporada anterior y falta recotizarla.';

COMMENT ON COLUMN costos.config.corte_actualizado IS
  'false = el precio de corte viene de la temporada anterior y falta recotizarlo.';


-- ----------------------------------------------------------------------------
--  Para deshacer, si hiciera falta:
--
--  ALTER TABLE costos.articulos DROP COLUMN IF EXISTS confeccion_actualizada;
--  ALTER TABLE costos.config    DROP COLUMN IF EXISTS corte_actualizado;
-- ----------------------------------------------------------------------------
