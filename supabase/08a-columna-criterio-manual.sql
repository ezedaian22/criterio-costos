-- PARTE 1 de 2 — la columna para el precio Criterio puesto a mano.
-- Correr esta primero, despues la parte 2.
-- No toca ningun articulo: la columna arranca vacia en los 534, que es lo que
-- significa "este Criterio lo calcula la formula".

ALTER TABLE costos.articulos
  ADD COLUMN IF NOT EXISTS precio_criterio_manual numeric;

COMMENT ON COLUMN costos.articulos.precio_criterio_manual IS
  'Precio Criterio escrito a mano. Si esta vacio, el Criterio sale de la formula (precio de venta menos el descuento de la temporada). Mismo criterio que precio_venta_manual.';

-- Comprobacion: tiene que dar 534 articulos y 0 con criterio a mano
SELECT count(*) AS articulos,
       count(precio_criterio_manual) AS con_criterio_a_mano
  FROM costos.articulos;
