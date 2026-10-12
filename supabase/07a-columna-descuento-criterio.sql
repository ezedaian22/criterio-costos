-- PARTE 1 de 2 — la columna nueva.
-- Correr esta primero, despues la parte 2.
-- No toca ningun articulo: solo agrega un campo de configuracion.

ALTER TABLE costos.config
  ADD COLUMN IF NOT EXISTS descuento_criterio numeric DEFAULT 20;

UPDATE costos.config SET descuento_criterio = 20 WHERE descuento_criterio IS NULL;

COMMENT ON COLUMN costos.config.descuento_criterio IS
  'Porcentaje que se descuenta del PRECIO DE VENTA para obtener el precio Criterio. A diferencia de G. Reguera y Balbi, que se aplican sobre el costo, este sale del precio de venta final.';

-- Comprobacion: tiene que mostrar 20 en las dos temporadas
SELECT t.nombre, c.descuento_sucati, c.descuento_criterio
  FROM costos.config c
  JOIN costos.temporadas t ON t.id = c.temporada_id
 ORDER BY t.nombre;
