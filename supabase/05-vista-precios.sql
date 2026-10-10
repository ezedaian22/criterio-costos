-- ============================================================================
--  Criterio Costos — el precio de venta, consultable desde otras apps
--
--  EL PROBLEMA
--  El precio de venta no está guardado en ninguna columna: la app de costos lo
--  calcula al mostrarlo (costo × margen, redondeado a $500) y lo escribe recién
--  al exportar la planilla. Entonces la app del local busca un precio, encuentra
--  precio_venta_manual casi vacío —son 13 de 534, y esa columna es solo la
--  EXCEPCIÓN para precios que se apartan de la fórmula— y concluye que no hay
--  precios cargados.
--
--  LA SOLUCIÓN
--  Una vista que hace la misma cuenta que la app. No guarda nada ni copia nada:
--  resuelve en el momento de la consulta. Si cambia un costo o un margen, la
--  próxima consulta ya devuelve el precio nuevo, sin sincronizar nada.
--
--  Esto evita la alternativa mala: llenar precio_venta_manual para los 534 desde
--  las planillas. Eso congelaría todos los precios —dejarían de seguir a los
--  costos, que es el motivo de existir de la app— y además sería circular,
--  porque esas planillas salieron de acá.
--
--  A DIFERENCIA de costos.costo_articulo, esta vista SÍ distingue temporada.
--  Aquella tiene 525 filas para 534 artículos: colapsa los 9 códigos que existen
--  en las dos y devuelve siempre el de Invierno. Para el 1335 informa $11.906
--  (Invierno) aunque se esté vendiendo el de Verano, que cuesta $10.890.
-- ============================================================================

CREATE OR REPLACE VIEW costos.precio_articulo AS
WITH base AS (
  SELECT a.id,
         a.temporada_id,
         a.codigo,
         a.descripcion,
         a.categoria,
         a.precio_venta_manual,
         -- Mismo cálculo que calcPrecios() en la app
         COALESCE((SELECT sum(x.cantidad * p.precio)
                     FROM costos.articulo_telas x
                     JOIN costos.precios_tela p ON p.id = x.precio_tela_id
                    WHERE x.articulo_id = a.id), 0)
       + COALESCE((SELECT sum(x.cantidad * p.precio)
                     FROM costos.articulo_avios x
                     JOIN costos.precios_avios p ON p.id = x.precio_avio_id
                    WHERE x.articulo_id = a.id), 0)
       + COALESCE((SELECT sum(x.cantidad * p.precio)
                     FROM costos.articulo_percha x
                     JOIN costos.precios_perchas p ON p.id = x.precio_percha_id
                    WHERE x.articulo_id = a.id), 0)
       + COALESCE(c.precio_corte, 0)
       + COALESCE(a.confeccion, 0)                                   AS costo,
         COALESCE(c.margen_propio, c.margen_greguera, 100)::numeric  AS margen,
         COALESCE(c.margen_greguera, 100)::numeric                   AS margen_greguera,
         COALESCE(c.margen_balbi, 50)::numeric                       AS margen_balbi,
         COALESCE(c.descuento_sucati, 15)::numeric                   AS descuento_sucati
    FROM costos.articulos a
    LEFT JOIN costos.config c ON c.temporada_id = a.temporada_id
),
conPrecio AS (
  SELECT b.*,
         -- round(x/500)*500 — el mismo redondeo a múltiplos de $500 de la app
         (round(b.costo * (1 + b.margen / 100.0) / 500) * 500) AS precio_calculado
    FROM base b
)
SELECT t.nombre                                   AS temporada,
       t.activa                                   AS temporada_activa,
       t.cerrada                                  AS temporada_cerrada,
       p.codigo,
       p.descripcion,
       p.categoria,
       round(p.costo)                             AS costo,
       p.precio_calculado                         AS precio_por_formula,
       -- El que vale: el puesto a mano si existe, si no el de la fórmula
       COALESCE(p.precio_venta_manual, p.precio_calculado)  AS precio_venta,
       (p.precio_venta_manual IS NOT NULL)        AS es_a_mano,
       round(p.costo * (1 + p.margen_greguera / 100.0))                                AS precio_greguera,
       round(p.costo * (1 + p.margen_balbi / 100.0))                                   AS precio_balbi,
       round(p.costo * (1 + p.margen_greguera / 100.0) * (1 - p.descuento_sucati / 100.0)) AS precio_sucati,
       p.temporada_id,
       p.id                                       AS articulo_id
  FROM conPrecio p
  JOIN costos.temporadas t ON t.id = p.temporada_id;

COMMENT ON VIEW costos.precio_articulo IS
  'Precio de venta por articulo y temporada, calculado al momento de consultar. precio_venta es el que vale: el puesto a mano si existe, si no el de la formula. No guarda nada: si cambia un costo o un margen, la proxima consulta ya devuelve el valor nuevo.';

GRANT SELECT ON costos.precio_articulo TO anon, authenticated;


-- ----------------------------------------------------------------------------
--  Espejo en public, para que la app del local la lea igual que catalogo_costos
-- ----------------------------------------------------------------------------

CREATE OR REPLACE VIEW public.catalogo_precios AS
SELECT * FROM costos.precio_articulo;

GRANT SELECT ON public.catalogo_precios TO anon, authenticated;


-- ============================================================================
--  COMPROBACIÓN — los números tienen que dar esto
-- ============================================================================

SELECT temporada, codigo, costo, precio_por_formula, precio_venta, es_a_mano
  FROM costos.precio_articulo
 WHERE codigo IN ('747','1335','2310','913')
 ORDER BY codigo, temporada;

--  Esperado:
--    1335  Invierno   costo 11906   formula 21500   venta 25000   a mano = true
--    1335  Verano     costo 10890   formula 19500   venta 25000   a mano = true
--    2310  Invierno   costo  6440   formula 11500   venta 13000   a mano = true
--    747   Invierno   costo 13790   formula 25000   venta 25000   a mano = false
--    747   Verano     costo 13710   formula 24500   venta 24500   a mano = false
--    913   Verano     costo   570   formula  1000   venta  1000   a mano = false

SELECT count(*) AS filas_de_la_vista,
       (SELECT count(*) FROM costos.articulos) AS articulos_totales
  FROM costos.precio_articulo;
--  Las dos tienen que dar 534: una fila por articulo y temporada, sin colapsar.
