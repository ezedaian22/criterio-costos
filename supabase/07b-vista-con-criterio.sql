-- PARTE 2 de 2 — la vista suma precio_criterio.  (version corregida)
--
-- POR QUE CAMBIO respecto del intento anterior:
-- No se puede borrar la vista porque el chat de la app del local creo
-- public.catalogo_publico encima de public.catalogo_precios. Un DROP CASCADE
-- se la llevaria puesta y le romperia la app.
--
-- Solucion: CREATE OR REPLACE en vez de DROP + CREATE. Eso exige mantener las
-- columnas que ya existen con el mismo nombre, tipo y ORDEN, y agregar las
-- nuevas AL FINAL. Por eso precio_criterio va ultima y no al lado de los otros
-- precios. Asi catalogo_publico sigue funcionando sin tocarla.

CREATE OR REPLACE VIEW costos.precio_articulo AS
WITH base AS (
  SELECT a.id, a.temporada_id, a.codigo, a.descripcion, a.categoria,
         a.precio_venta_manual,
         COALESCE((SELECT sum(x.cantidad * p.precio) FROM costos.articulo_telas x
                    JOIN costos.precios_tela p ON p.id = x.precio_tela_id
                   WHERE x.articulo_id = a.id), 0)
       + COALESCE((SELECT sum(x.cantidad * p.precio) FROM costos.articulo_avios x
                    JOIN costos.precios_avios p ON p.id = x.precio_avio_id
                   WHERE x.articulo_id = a.id), 0)
       + COALESCE((SELECT sum(x.cantidad * p.precio) FROM costos.articulo_percha x
                    JOIN costos.precios_perchas p ON p.id = x.precio_percha_id
                   WHERE x.articulo_id = a.id), 0)
       + COALESCE(c.precio_corte, 0) + COALESCE(a.confeccion, 0)     AS costo,
         COALESCE(c.margen_propio, c.margen_greguera, 100)::numeric  AS margen,
         COALESCE(c.margen_greguera, 100)::numeric                   AS mg,
         COALESCE(c.margen_balbi, 50)::numeric                       AS mb,
         COALESCE(c.descuento_sucati, 15)::numeric                   AS ds,
         COALESCE(c.descuento_criterio, 20)::numeric                 AS dc
    FROM costos.articulos a
    LEFT JOIN costos.config c ON c.temporada_id = a.temporada_id
),
f AS (
  SELECT b.*, (round(b.costo * (1 + b.margen / 100.0) / 500) * 500) AS precio_calculado
    FROM base b
),
g AS (
  SELECT f.*, COALESCE(f.precio_venta_manual, f.precio_calculado) AS precio_final FROM f
)
-- El orden de estas columnas NO se puede cambiar: es el que ya tenia la vista.
SELECT t.nombre                            AS temporada,
       t.activa                            AS temporada_en_produccion,
       t.cerrada                           AS temporada_cerrada,
       g.codigo,
       g.descripcion,
       g.categoria,
       round(g.costo)                      AS costo,
       g.precio_calculado                  AS precio_por_formula,
       g.precio_final                      AS precio_venta,
       (g.precio_venta_manual IS NOT NULL) AS es_a_mano,
       round(g.costo * (1 + g.mg / 100.0)) AS precio_greguera,
       round(g.costo * (1 + g.mb / 100.0)) AS precio_balbi,
       round(g.costo * (1 + g.mg / 100.0) * (1 - g.ds / 100.0)) AS precio_sucati,
       g.temporada_id,
       g.id                                AS articulo_id,
       -- La nueva, al final: sale del PRECIO DE VENTA, no del costo.
       (round(g.precio_final * (1 - g.dc / 100.0) / 500) * 500) AS precio_criterio
  FROM g JOIN costos.temporadas t ON t.id = g.temporada_id;


-- public.catalogo_precios se creo con SELECT *, asi que quedo con las columnas
-- de ese momento: hay que reemplazarla listandolas para que incluya la nueva.
CREATE OR REPLACE VIEW public.catalogo_precios AS
SELECT temporada, temporada_en_produccion, temporada_cerrada, codigo, descripcion,
       categoria, costo, precio_por_formula, precio_venta, es_a_mano,
       precio_greguera, precio_balbi, precio_sucati, temporada_id, articulo_id,
       precio_criterio
  FROM costos.precio_articulo;


-- ============================================================================
--  COMPROBACION
-- ============================================================================
SELECT codigo, temporada, precio_venta, es_a_mano, precio_criterio
  FROM costos.precio_articulo
 WHERE codigo IN ('1335','747','2310')
 ORDER BY codigo, temporada;
-- Esperado: 1335 -> 25000 / true / 20000   ·   747 Verano -> 24500 / false / 19500
--           2310 -> 13000 / true / 10500
