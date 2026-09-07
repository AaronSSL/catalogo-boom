// ============================================================
//  CONFIGURACIÓN — vamPyro Catálogo
//  Edita aquí si cambian las credenciales o nombres de tablas.
// ============================================================
window.VAMPYRO_CONFIG = {
  SUPABASE_URL: "https://dzmcwwgybfeqniwxcrlo.supabase.co",
  SUPABASE_ANON_KEY:
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6bWN3d2d5YmZlcW5pd3hjcmxvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MTg5MjYsImV4cCI6MjA5NTQ5NDkyNn0.30RlGDYL2iP_OKScMLatg4SNJXzxwVktlCOlyGuppk8",

  // Nombres de tablas / bucket (cambia solo si difieren en tu base)
  TABLE_PRODUCTOS: "productos",
  TABLE_CATEGORIAS: "categorias",
  TABLE_IMAGENES: "imagenes",
  BUCKET: "product-imgs",

  // Marca
  EMPRESA: "vamPyro",
  MONEDA: "S/ ", // símbolo para precios (Soles)

  // Categorías que NO se muestran (ni en filtros ni en el grid)
  CATEGORIAS_OCULTAS: ["Chisperos y flamas", "Consolas y accesorios"],
};
