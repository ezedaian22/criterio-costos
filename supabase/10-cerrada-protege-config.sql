-- ----------------------------------------------------------------------------
--  10 · La temporada cerrada también protege su configuración
--
--  El candado del 01 cubría artículos, precios de insumos y composición, pero
--  no costos.config. Y de la config (corte y márgenes) salen TODOS los precios
--  de la temporada: cambiar el corte de una temporada cerrada reescribía su
--  registro histórico entero sin que nada lo frenara.
--
--  Solo se agrega 'config' a la lista de tablas que traen temporada_id.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION costos.bloquear_si_cerrada()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  fila record; v_temporada uuid; v_cerrada boolean; v_nombre text;
BEGIN
  IF TG_OP = 'DELETE' THEN fila := OLD; ELSE fila := NEW; END IF;
  IF TG_TABLE_NAME IN ('articulos','precios_tela','precios_avios','precios_perchas','config') THEN
    v_temporada := fila.temporada_id;
  ELSE
    SELECT a.temporada_id INTO v_temporada FROM costos.articulos a WHERE a.id = fila.articulo_id;
  END IF;
  SELECT t.cerrada, t.nombre INTO v_cerrada, v_nombre FROM costos.temporadas t WHERE t.id = v_temporada;
  IF v_cerrada THEN
    RAISE EXCEPTION 'La temporada "%" está cerrada: no se pueden hacer cambios. Reabrila desde Configuración si necesitás editarla.', v_nombre
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN fila;
END $$;

DROP TRIGGER IF EXISTS tg_bloqueo_cerrada ON costos.config;
CREATE TRIGGER tg_bloqueo_cerrada BEFORE INSERT OR UPDATE OR DELETE ON costos.config
  FOR EACH ROW EXECUTE FUNCTION costos.bloquear_si_cerrada();

-- Para deshacer:  DROP TRIGGER IF EXISTS tg_bloqueo_cerrada ON costos.config;
