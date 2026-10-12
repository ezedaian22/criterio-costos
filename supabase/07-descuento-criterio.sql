-- ============================================================================
--  Criterio Costos — el descuento de "Criterio" pasa a ser configurable
--
--  Hasta ahora el 20% estaba fijo en el código. Con esto queda como los demás
--  márgenes: se edita desde Configuración, por temporada.
--
--  Además se agrega el precio Criterio a la vista, para que el buscador de la
--  app y la app del local lo reciban ya calculado, sin repetir la cuenta.
--
--  Correr entero. Los artículos no se tocan: solo se agrega una columna de
--  configuración y se rehace la vista.
-- ============================================================================

-- ----------------------------------------------------------------------------
--  1) La columna, con el 20% que estaba fijo como valor de arranque
-- ----------------------------------------------------------------------------

ALTER TABLE costos.config
  ADD COLUMN IF NOT EXISTS descuento_criterio numeric DEFAULT 20;

UPDATE costos.config SET descuento_criterio = 20 WHERE descuento_criterio IS NULL;

COMMENT ON COLUMN costos.config.descuento_criterio IS
  'Porcentaje que se le descuenta al PRECIO DE VENTA para obtener el precio Criterio. A diferencia de los margenes de G. Reguera y Balbi, que se aplican sobre el costo, este sale del precio de venta final (el puesto a mano si existe).';


-- ----------------------------------------------------------------------------
--  2) La vista suma precio_criterio
-- ----------------------------------------------------------------------------

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
       + COALESCE(a.confeccion, 0)                                    AS costo,
         COALESCE(c.margen_propio, c.margen_greguera, 100)::numeric   AS margen,
         COALESCE(c.margen_greguera, 100)::numeric                    AS margen_greguera,
         COALESCE(c.margen_balbi, 50)::numeric                        AS margen_balbi,
         COALESCE(c.descuento_sucati, 15)::numeric                    AS descuento_sucati,
         COALESCE(c.descuento_criterio, 20)::numeric                  AS descuento_criterio
    FROM costos.articulos a
    LEFT JOIN costos.config c ON c.temporada_id = a.temporada_id
),
conPrecio AS (
  SELECT b.*,
         (round(b.costo * (1 + b.margen / 100.0) / 500) * 500) AS precio_calculado
    FROM base b
),
conFinal AS (
  SELECT p.*,
         COALESCE(p.precio_venta_manual, p.precio_calculado) AS precio_final
    FROM conPrecio p
)
SELECT t.nombre                                   AS temporada,
       t.activa                                   AS temporada_en_produccion,
       t.cerrada                                  AS temporada_cerrada,
       f.codigo,
       f.descripcion,
       f.categoria,
       round(f.costo)                             AS costo,
       f.precio_calculado                         AS precio_por_formula,
       f.precio_final                             AS precio_venta,
       (f.precio_venta_manual IS NOT NULL)        AS es_a_mano,
       -- Criterio sale del PRECIO DE VENTA, no del costo, y se redondea al
       -- multiplo de $500 mas cercano.
       (round(f.precio_final * (1 - f.descuento_criterio / 100.0) / 500) * 500) AS precio_criterio,
       round(f.costo * (1 + f.margen_greguera / 100.0))                                   AS precio_greguera,
       round(f.costo * (1 + f.margen_balbi / 100.0))                                      AS precio_balbi,
       round(f.costo * (1 + f.margen_greguera / 100.0) * (1 - f.descuento_sucati / 100.0)) AS precio_sucati,
       f.temporada_id,
       f.id                                       AS articulo_id
  FROM conFinal f
  JOIN costos.temporadas t ON t.id = f.temporada_id;

COMMENT ON VIEW costos.precio_articulo IS
  'Precio de venta por articulo y temporada, calculado al momento de consultar. precio_venta es el que vale: el puesto a mano si existe, si no el de la formula. precio_criterio sale del precio de venta (no del costo). temporada_en_produccion dice que se esta FABRICANDO, no que se esta vendiendo.';

GRANT SELECT ON costos.precio_articulo TO anon, authenticated;

CREATE VIEW public.catalogo_precios AS SELECT * FROM costos.precio_articulo;
GRANT SELECT ON public.catalogo_precios TO anon, authenticated;


-- ============================================================================
--  COMPROBACIÓN
-- ============================================================================
SELECT codigo, temporada, precio_venta, es_a_mano, precio_criterio
  FROM costos.precio_articulo
 WHERE codigo IN ('1335','747','2310')
 ORDER BY codigo, temporada;

--  Esperado:
--    1335  Invierno  25000  true   20000
--    1335  Verano    25000  true   20000
--    2310  Invierno  13000  true   10500
--    747   Invierno  25000  false  20000
--    747   Verano    24500  false  19500
