-- PARTE 2 de 2 — la vista contempla el Criterio puesto a mano.
-- Correr DESPUES de la parte 1.
--
-- Igual que la vez pasada: CREATE OR REPLACE, no DROP, porque la app del local
-- tiene public.catalogo_publico montada encima. Las columnas que ya existian
-- quedan con el mismo nombre y en el mismo orden; las nuevas van al final.
--
-- precio_criterio cambia de significado: antes era siempre el calculado, ahora
-- es el que vale (el puesto a mano si existe). El calculado pasa a estar en
-- precio_criterio_por_formula.

CREATE OR REPLACE VIEW costos.precio_articulo AS
WITH base AS (
  SELECT a.id, a.temporada_id, a.codigo, a.descripcion, a.categoria,
         a.precio_venta_manual, a.precio_criterio_manual,
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
  SELECT f.*,
         COALESCE(f.precio_venta_manual, f.precio_calculado) AS precio_final
    FROM f
),
h AS (
  SELECT g.*,
         (round(g.precio_final * (1 - g.dc / 100.0) / 500) * 500) AS criterio_formula
    FROM g
)
SELECT t.nombre                            AS temporada,
       t.activa                            AS temporada_en_produccion,
       t.cerrada                           AS temporada_cerrada,
       h.codigo,
       h.descripcion,
       h.categoria,
       round(h.costo)                      AS costo,
       h.precio_calculado                  AS precio_por_formula,
       h.precio_final                      AS precio_venta,
       (h.precio_venta_manual IS NOT NULL) AS es_a_mano,
       round(h.costo * (1 + h.mg / 100.0)) AS precio_greguera,
       round(h.costo * (1 + h.mb / 100.0)) AS precio_balbi,
       round(h.costo * (1 + h.mg / 100.0) * (1 - h.ds / 100.0)) AS precio_sucati,
       h.temporada_id,
       h.id                                AS articulo_id,
       -- el que vale: el puesto a mano si existe, si no el de la formula
       COALESCE(h.precio_criterio_manual, h.criterio_formula) AS precio_criterio,
       -- nuevas, al final
       h.criterio_formula                        AS precio_criterio_por_formula,
       (h.precio_criterio_manual IS NOT NULL)    AS es_criterio_a_mano
  FROM h JOIN costos.temporadas t ON t.id = h.temporada_id;


CREATE OR REPLACE VIEW public.catalogo_precios AS
SELECT temporada, temporada_en_produccion, temporada_cerrada, codigo, descripcion,
       categoria, costo, precio_por_formula, precio_venta, es_a_mano,
       precio_greguera, precio_balbi, precio_sucati, temporada_id, articulo_id,
       precio_criterio, precio_criterio_por_formula, es_criterio_a_mano
  FROM costos.precio_articulo;


-- ============================================================================
--  COMPROBACION — todavia nadie puso un Criterio a mano, asi que
--  precio_criterio y precio_criterio_por_formula tienen que dar IGUALES
--  y es_criterio_a_mano tiene que ser false en los 534.
-- ============================================================================
SELECT count(*)                                                   AS articulos,
       count(*) FILTER (WHERE es_criterio_a_mano)                 AS con_criterio_a_mano,
       count(*) FILTER (WHERE precio_criterio <> precio_criterio_por_formula) AS deberia_ser_cero
  FROM costos.precio_articulo;
