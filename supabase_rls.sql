-- ============================================================
--  BOOM Pyro · Seguridad Supabase (Row Level Security)
--  Ejecuta este script en:  Supabase → SQL Editor → New query
--
--  Objetivo: el catálogo es PÚBLICO pero SOLO DE LECTURA.
--  Cualquiera con la anon key (que va en el frontend) podrá
--  LEER productos/categorías/imágenes, pero NUNCA escribir,
--  modificar ni borrar. Las escrituras quedan reservadas para
--  el rol service_role (tu panel/dashboard), que ignora RLS.
-- ============================================================

-- 1) Activa RLS en las tablas del catálogo
ALTER TABLE public.productos  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.imagenes   ENABLE ROW LEVEL SECURITY;

-- 2) Limpia políticas previas con el mismo nombre (idempotente)
DROP POLICY IF EXISTS "lectura_publica_productos"  ON public.productos;
DROP POLICY IF EXISTS "lectura_publica_categorias" ON public.categorias;
DROP POLICY IF EXISTS "lectura_publica_imagenes"   ON public.imagenes;

-- 3) Solo SELECT para anon (visitantes) y authenticated.
--    Al NO crear políticas de INSERT/UPDATE/DELETE, esas
--    operaciones quedan denegadas por defecto bajo RLS.
CREATE POLICY "lectura_publica_productos"
  ON public.productos  FOR SELECT  TO anon, authenticated  USING (true);

CREATE POLICY "lectura_publica_categorias"
  ON public.categorias FOR SELECT  TO anon, authenticated  USING (true);

CREATE POLICY "lectura_publica_imagenes"
  ON public.imagenes   FOR SELECT  TO anon, authenticated  USING (true);

-- ============================================================
-- 4) Storage: imágenes de producto (bucket: product-imgs)
--    El frontend usa la URL pública del bucket, así que el
--    bucket debe ser PÚBLICO de solo lectura.
-- ============================================================

-- 4a) Marca el bucket como público (equivale al toggle "Public" del dashboard)
UPDATE storage.buckets SET public = true WHERE id = 'product-imgs';

-- 4b) Política de lectura pública de los objetos de ese bucket
DROP POLICY IF EXISTS "lectura_publica_product_imgs" ON storage.objects;
CREATE POLICY "lectura_publica_product_imgs"
  ON storage.objects FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'product-imgs');

-- ============================================================
-- Verificación rápida (opcional): debe devolver rowsecurity = true
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname IN ('productos','categorias','imagenes');
-- ============================================================
