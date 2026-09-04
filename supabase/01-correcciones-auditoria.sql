-- ============================================================================
--  Criterio Costos — correcciones de la auditoría
--  Pegar en Supabase → SQL Editor y ejecutar de una sola vez.
--  Es seguro correrlo más de una vez: todo está escrito para no duplicar nada.
--  NO borra ni modifica ningún dato existente.
-- ============================================================================


-- ----------------------------------------------------------------------------
--  PUNTO 8 · Integridad: un código no se puede repetir DENTRO de una temporada
--
--  El mismo código SÍ puede existir en Invierno y en Verano a la vez.
--  Hoy hay 8 artículos así (34, 65, 747, 1612, 1824, 2173, 2200, 2296) y
--  siguen funcionando igual. Lo único que se impide es cargar dos veces el
--  mismo código dentro de la misma temporada, que siempre es un error de carga.
--
--  Se comparan en minúscula y sin espacios sobrantes, así "Bengalina" y
--  "bengalina " tampoco pueden convivir en la misma temporada.
-- ----------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS ux_articulos_temporada_codigo
  ON costos.articulos (temporada_id, lower(btrim(codigo)));

CREATE UNIQUE INDEX IF NOT EXISTS ux_precios_tela_temporada_nombre
  ON costos.precios_tela (temporada_id, lower(btrim(nombre)));

CREATE UNIQUE INDEX IF NOT EXISTS ux_precios_avios_temporada_nombre
  ON costos.precios_avios (temporada_id, lower(btrim(nombre)));

CREATE UNIQUE INDEX IF NOT EXISTS ux_precios_perchas_temporada_nombre
  ON costos.precios_perchas (temporada_id, lower(btrim(nombre)));

-- Índices de búsqueda: aceleran la carga de costos por temporada
CREATE INDEX IF NOT EXISTS ix_articulos_temporada    ON costos.articulos (temporada_id);
CREATE INDEX IF NOT EXISTS ix_articulo_telas_art     ON costos.articulo_telas (articulo_id);
CREATE INDEX IF NOT EXISTS ix_articulo_avios_art     ON costos.articulo_avios (articulo_id);
CREATE INDEX IF NOT EXISTS ix_articulo_percha_art    ON costos.articulo_percha (articulo_id);


-- ----------------------------------------------------------------------------
--  PUNTO 8b · Borrado en cascada
--
--  Hoy borrar un artículo son 4 borrados sueltos desde la app. Si alguno falla
--  quedan filas huérfanas. Con esto, borrar el artículo limpia su composición
--  automáticamente y de forma atómica: o se borra todo, o no se borra nada.
-- ----------------------------------------------------------------------------

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT con.conname, con.conrelid::regclass::text AS tabla
      FROM pg_constraint con
      JOIN pg_class     rel ON rel.oid = con.conrelid
      JOIN pg_namespace ns  ON ns.oid  = rel.relnamespace
     WHERE ns.nspname = 'costos'
       AND con.contype = 'f'
       AND con.confrelid = 'costos.articulos'::regclass
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tabla, r.conname);
  END LOOP;
END $$;

ALTER TABLE costos.articulo_telas
  ADD CONSTRAINT fk_articulo_telas_articulo
  FOREIGN KEY (articulo_id) REFERENCES costos.articulos(id) ON DELETE CASCADE;

ALTER TABLE costos.articulo_avios
  ADD CONSTRAINT fk_articulo_avios_articulo
  FOREIGN KEY (articulo_id) REFERENCES costos.articulos(id) ON DELETE CASCADE;

ALTER TABLE costos.articulo_percha
  ADD CONSTRAINT fk_articulo_percha_articulo
  FOREIGN KEY (articulo_id) REFERENCES costos.articulos(id) ON DELETE CASCADE;


-- ----------------------------------------------------------------------------
--  PUNTO 11 · El "último código usado" pasa a vivir en la base
--
--  Hoy está en el navegador: cada máquina ve un número distinto y se pierde
--  al cambiar de equipo. Con esta columna es uno solo para todos.
-- ----------------------------------------------------------------------------

ALTER TABLE costos.temporadas
  ADD COLUMN IF NOT EXISTS ultimo_codigo integer;

-- Lo inicializa con el código más alto que ya existe en cada temporada
UPDATE costos.temporadas t
   SET ultimo_codigo = sub.maximo
  FROM (
        SELECT temporada_id, MAX((NULLIF(regexp_replace(codigo,'\D','','g'),''))::bigint) AS maximo
          FROM costos.articulos
         WHERE codigo ~ '\d'
         GROUP BY temporada_id
       ) sub
 WHERE t.id = sub.temporada_id
   AND t.ultimo_codigo IS NULL;


-- ----------------------------------------------------------------------------
--  REGLA DEL "ÚLTIMO ACTUALIZADO"
--
--  Hoy las tablas de precios no guardan cuándo se tocó cada valor: solo la
--  fecha en que se creó la fila al clonar la temporada. Por eso no se puede
--  saber cuál precio es el más reciente.
--
--  Esta columna se llena sola cada vez que alguien cambia un precio. De acá en
--  adelante, "el último actualizado" pasa a ser un dato consultable.
-- ----------------------------------------------------------------------------

ALTER TABLE costos.precios_tela    ADD COLUMN IF NOT EXISTS actualizado_en timestamptz;
ALTER TABLE costos.precios_avios   ADD COLUMN IF NOT EXISTS actualizado_en timestamptz;
ALTER TABLE costos.precios_perchas ADD COLUMN IF NOT EXISTS actualizado_en timestamptz;
ALTER TABLE costos.articulos       ADD COLUMN IF NOT EXISTS actualizado_en timestamptz;

CREATE OR REPLACE FUNCTION costos.marcar_actualizado()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS tg_tela_actualizado    ON costos.precios_tela;
DROP TRIGGER IF EXISTS tg_avios_actualizado   ON costos.precios_avios;
DROP TRIGGER IF EXISTS tg_perchas_actualizado ON costos.precios_perchas;
DROP TRIGGER IF EXISTS tg_articulos_actualizado ON costos.articulos;

CREATE TRIGGER tg_tela_actualizado    BEFORE INSERT OR UPDATE ON costos.precios_tela
  FOR EACH ROW EXECUTE FUNCTION costos.marcar_actualizado();
CREATE TRIGGER tg_avios_actualizado   BEFORE INSERT OR UPDATE ON costos.precios_avios
  FOR EACH ROW EXECUTE FUNCTION costos.marcar_actualizado();
CREATE TRIGGER tg_perchas_actualizado BEFORE INSERT OR UPDATE ON costos.precios_perchas
  FOR EACH ROW EXECUTE FUNCTION costos.marcar_actualizado();
CREATE TRIGGER tg_articulos_actualizado BEFORE INSERT OR UPDATE ON costos.articulos
  FOR EACH ROW EXECUTE FUNCTION costos.marcar_actualizado();


-- ----------------------------------------------------------------------------
--  PUNTO 5 · La temporada cerrada bloquea TODO, de verdad
--
--  Hoy el cartel dice "solo lectura" pero solo frena los precios de insumos:
--  los artículos se siguen editando y borrando. Esta protección vive en la
--  base, así que vale aunque alguien entre por fuera de la aplicación.
--
--  Para volver a editar, hay que reabrir la temporada desde Configuración.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION costos.bloquear_si_cerrada()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  fila        record;
  v_temporada uuid;
  v_cerrada   boolean;
  v_nombre    text;
BEGIN
  -- En un DELETE la fila viene en OLD; en INSERT/UPDATE viene en NEW.
  IF TG_OP = 'DELETE' THEN fila := OLD; ELSE fila := NEW; END IF;

  -- Saca la temporada de la fila, según de qué tabla venga
  IF TG_TABLE_NAME IN ('articulos','precios_tela','precios_avios','precios_perchas') THEN
    v_temporada := fila.temporada_id;
  ELSE
    SELECT a.temporada_id INTO v_temporada
      FROM costos.articulos a
     WHERE a.id = fila.articulo_id;
  END IF;

  SELECT t.cerrada, t.nombre INTO v_cerrada, v_nombre
    FROM costos.temporadas t WHERE t.id = v_temporada;

  IF v_cerrada THEN
    RAISE EXCEPTION 'La temporada "%" está cerrada: no se pueden hacer cambios. Reabrila desde Configuración si necesitás editarla.', v_nombre
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN fila;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['articulos','precios_tela','precios_avios','precios_perchas',
                           'articulo_telas','articulo_avios','articulo_percha']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS tg_bloqueo_cerrada ON costos.%I', t);
    EXECUTE format(
      'CREATE TRIGGER tg_bloqueo_cerrada BEFORE INSERT OR UPDATE OR DELETE ON costos.%I
         FOR EACH ROW EXECUTE FUNCTION costos.bloquear_si_cerrada()', t);
  END LOOP;
END $$;


-- ----------------------------------------------------------------------------
--  PUNTO 10 · Aumento masivo de confección en una sola operación
--
--  Hoy la app manda un pedido por artículo (207 pedidos sueltos) y no revisa
--  ninguno: si algunos fallan, igual dice "✅ 207 actualizados".
--  Esto lo hace en una sola orden y devuelve cuántos cambió realmente.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION costos.aumentar_confeccion(p_temporada uuid, p_pct numeric)
RETURNS integer LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  UPDATE costos.articulos
     SET confeccion = round(confeccion * (1 + p_pct / 100.0))
   WHERE temporada_id = p_temporada
     AND confeccion IS NOT NULL
     AND confeccion > 0;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

GRANT EXECUTE ON FUNCTION costos.aumentar_confeccion(uuid, numeric) TO anon, authenticated;


-- ============================================================================
--  COMPROBACIÓN — debería devolver todo en cero y sin errores
-- ============================================================================
SELECT 'codigos duplicados en una misma temporada' AS control,
       count(*) AS deberia_ser_cero
  FROM (SELECT temporada_id, lower(btrim(codigo))
          FROM costos.articulos GROUP BY 1,2 HAVING count(*) > 1) x
UNION ALL
SELECT 'filas de composicion huerfanas',
       (SELECT count(*) FROM costos.articulo_telas  t LEFT JOIN costos.articulos a ON a.id=t.articulo_id WHERE a.id IS NULL)
     + (SELECT count(*) FROM costos.articulo_avios  t LEFT JOIN costos.articulos a ON a.id=t.articulo_id WHERE a.id IS NULL)
     + (SELECT count(*) FROM costos.articulo_percha t LEFT JOIN costos.articulos a ON a.id=t.articulo_id WHERE a.id IS NULL);
