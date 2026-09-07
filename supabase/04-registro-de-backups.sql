-- ============================================================================
--  Criterio Costos — registro de backups
--
--  Una fila por cada vez que corre el backup automático. Sirve para que la
--  aplicación pueda mostrar arriba de todo cuándo fue el último backup bueno,
--  sin que nadie tenga que abrir carpetas ni acordarse de revisar nada.
--
--  Misma estructura que talleres.backups_log, que ya está en uso.
--  Correr entero, una sola vez. No toca ningún dato existente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS costos.backups_log (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  ok         boolean     NOT NULL,
  detalle    text
);

-- La app solo pide la última fila: este índice hace esa consulta instantánea.
CREATE INDEX IF NOT EXISTS ix_backups_log_fecha
  ON costos.backups_log (created_at DESC);

COMMENT ON TABLE costos.backups_log IS
  'Una fila por corrida del backup automatico (criterio-costos-respaldo\backup.mjs). La app lee la ultima para mostrar el cartel de "ultimo backup".';


-- ----------------------------------------------------------------------------
--  Permisos
--
--  Hoy la aplicación entra sin sesión, así que el rol anon necesita escribir
--  (lo hace el script de backup) y leer (lo hace el cartel de la app).
--  Cuando se corra 03-cerrar-acceso.sql, esta tabla queda incluida y el acceso
--  pasa a exigir sesión, igual que las demás.
-- ----------------------------------------------------------------------------

GRANT SELECT, INSERT ON costos.backups_log TO anon, authenticated;


-- ----------------------------------------------------------------------------
--  Comprobación
-- ----------------------------------------------------------------------------

SELECT 'costos.backups_log creada' AS estado,
       (SELECT count(*) FROM costos.backups_log) AS filas_por_ahora;
