# vamPyro · Catálogo web

Catálogo estático (HTML + CSS + JS, **sin build, sin Next.js**) conectado a Supabase.

## Archivos
| Archivo | Descripción |
|--------|-------------|
| `index.html` | Estructura de la página |
| `styles.css` | Estilos (tema oscuro, grid responsive) |
| `config.js` | Credenciales Supabase y nombres de tablas/bucket |
| `app.js` | Carga de datos, grid, filtros y búsqueda |
| `pdf.js` | Botón "Exportar catálogo PDF" (jsPDF) |

Las librerías (`@supabase/supabase-js` y `jsPDF`) se cargan por CDN — necesitas conexión a internet.

## Cómo usarlo
**Opción rápida:** doble clic en `index.html`.

**Opción recomendada** (evita posibles bloqueos del navegador con `file://`), desde esta carpeta:

```powershell
# Si tienes Python:
python -m http.server 8080
# luego abre http://localhost:8080

# O con Node:
npx serve
```

## Desplegar gratis
Sube esta carpeta tal cual a **Netlify**, **Vercel** (como sitio estático) o **GitHub Pages**. No requiere configuración.

## Notas
- La *anon key* es pública por diseño; la seguridad depende de las políticas RLS de tu base.
- Solo se muestran productos con `activo = true`.
- El PDF agrupa los productos por categoría (respetando el campo `orden`) con portada y numeración.
- Si cambias nombres de tablas/columnas, edita `config.js`.
