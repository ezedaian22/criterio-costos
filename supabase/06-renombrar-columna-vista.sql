-- ============================================================================
--  Criterio Costos — renombrar "temporada_activa" en la vista de precios
--
--  POR QUÉ
--  El nombre se lee como "la temporada que se está vendiendo", y significa otra
--  cosa: la que se está PRODUCIENDO. Hoy coinciden —se fabrica y se vende
--  verano— pero en abril se separan: se va a estar produciendo invierno
--  mientras el local todavía vende verano. Con el nombre viejo, cualquiera que
--  filtre por ahí se lleva la temporada equivocada.
--
--  Correr entero. No toca ningún dato: solo rehace la definición de la vista.
--
--  AVISO para el chat de la app del local: la columna pasa a llamarse
--  "temporada_en_produccion". Si la estaba leyendo con el nombre viejo, hay que
--  actualizarla ahí. (El criterio de no filtrar por ese campo sigue siendo el
--  correcto: solo dice qué se fabrica, no qué se vende.)
-- ============================================================================

DROP VIEW IF EXISTS public.catalogo_precios;
DROP VIEW IF EXISTS costos.precio_articulo;

CREATE VIEW costos.precio_articulo AS
WITH base AS (
  SELECT a.id,
         a.temporada_id,
         a.codigo,
         a.descripcion,
         a.categoria,
         a.precio_venta_manual,
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
         (round(b.costo * (1 + b.margen / 100.0) / 500) * 500) AS precio_calculado
    FROM base b
)
SELECT t.nombre                                   AS temporada,
       -- Antes se llamaba "temporada_activa" y se leía como "la que se vende".
       t.activa                                   AS temporada_en_produccion,
       t.cerrada                                  AS temporada_cerrada,
       p.codigo,
       p.descripcion,
       p.categoria,
       round(p.costo)                             AS costo,
       p.precio_calculado                         AS precio_por_formula,
       COALESCE(p.precio_venta_manual, p.precio_calculado)  AS precio_venta,
       (p.precio_venta_manual IS NOT NULL)        AS es_a_mano,
       round(p.costo * (1 + p.margen_greguera / 100.0))                                   AS precio_greguera,
       round(p.costo * (1 + p.margen_balbi / 100.0))                                      AS precio_balbi,
       round(p.costo * (1 + p.margen_greguera / 100.0) * (1 - p.descuento_sucati / 100.0)) AS precio_sucati,
       p.temporada_id,
       p.id                                       AS articulo_id
  FROM conPrecio p
  JOIN costos.temporadas t ON t.id = p.temporada_id;

COMMENT ON VIEW costos.precio_articulo IS
  'Precio de venta por articulo y temporada, calculado al momento de consultar. precio_venta es el que vale: el puesto a mano si existe, si no el de la formula. temporada_en_produccion dice que se esta FABRICANDO, no que se esta vendiendo: no sirve para filtrar lo que esta en el local.';

GRANT SELECT ON costos.precio_articulo TO anon, authenticated;

CREATE VIEW public.catalogo_precios AS SELECT * FROM costos.precio_articulo;
GRANT SELECT ON public.catalogo_precios TO anon, authenticated;


-- ============================================================================
--  COMPROBACIÓN
-- ============================================================================
SELECT temporada, temporada_en_produccion, count(*) AS articulos
  FROM costos.precio_articulo
 GROUP BY 1, 2
 ORDER BY 1;
--  Esperado: Invierno 2026 / false / 207   ·   Verano 2026 / true / 327
