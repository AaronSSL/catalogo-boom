// ============================================================
//  BOOM Pyro · Catálogo — lógica principal
// ============================================================
const CFG = window.BOOM_CONFIG;
const sb = window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY);

// Estado global (compartido con pdf.js)
const STATE = {
  productos: [],     // [{codigo, nombre, medidas, precio, categoria_id, _img, _cat}]
  categorias: [],    // [{id, nombre}]
  filtered: [],
  activeCat: "all",
  query: "",
};
window.STATE = STATE;
window.SB = sb;

// ---------- Utilidades ----------
const $ = (sel) => document.querySelector(sel);
const grid = $("#grid");
const statusEl = $("#status");
const emptyEl = $("#empty");
const countEl = $("#count");

function publicImageUrl(storagePath) {
  if (!storagePath) return null;
  if (/^https?:\/\//i.test(storagePath)) return storagePath; // ya es URL completa
  const clean = String(storagePath).replace(/^\/+/, "");
  const parts = clean.split("/").map(encodeURIComponent).join("/");
  return `${CFG.SUPABASE_URL}/storage/v1/object/public/${CFG.BUCKET}/${parts}`;
}
window.publicImageUrl = publicImageUrl;

function fmtPrecio(p) {
  if (p === null || p === undefined || p === "") return "";
  const n = Number(p);
  if (Number.isNaN(n)) return String(p);
  return CFG.MONEDA + n.toLocaleString("es-PE", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}
window.fmtPrecio = fmtPrecio;

function norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

// ---------- Carga de datos ----------
async function cargarCategorias() {
  const { data, error } = await sb.from(CFG.TABLE_CATEGORIAS).select("*");
  if (error) {
    console.warn("No se pudieron cargar categorías:", error.message);
    return [];
  }
  // detecta el campo nombre de categoría
  return (data || [])
    .map((c) => ({
      id: c.id ?? c.categoria_id ?? c.codigo,
      nombre: c.nombre ?? c.name ?? c.titulo ?? c.descripcion ?? `Categoría ${c.id}`,
      orden: c.orden ?? 999,
    }))
    .sort((a, b) => a.orden - b.orden);
}

async function cargarProductosEmbebido() {
  // Intenta join automático vía relaciones (FK) de PostgREST
  const { data, error } = await sb
    .from(CFG.TABLE_PRODUCTOS)
    .select(
      `codigo, nombre, medidas, precio, packing, categoria_id, activo,
       ${CFG.TABLE_IMAGENES}(storage_path, orden),
       ${CFG.TABLE_CATEGORIAS}(nombre)`
    )
    .order("categoria_id", { ascending: true })
    .order("codigo", { ascending: true });
  if (error) throw error;
  // incluimos también los inactivos: se muestran sombreados como "Agotado"
  return data || [];
}

async function cargarProductosFallback(categorias) {
  // Carga por separado y une en cliente (si el join embebido falla)
  const [{ data: prods, error: e1 }, { data: imgs, error: e2 }] = await Promise.all([
    sb.from(CFG.TABLE_PRODUCTOS).select("*"),
    sb.from(CFG.TABLE_IMAGENES).select("*"),
  ]);
  if (e1) throw e1;
  if (e2) console.warn("No se pudieron cargar imágenes:", e2.message);

  const catById = new Map(categorias.map((c) => [String(c.id), c.nombre]));

  // Detecta la columna FK en imagenes que apunta al producto
  const imgRows = imgs || [];
  let fkCol = null;
  if (imgRows.length) {
    const keys = Object.keys(imgRows[0]);
    const candidatos = ["producto_id", "product_id", "productos_id", "id_producto",
                         "producto_codigo", "codigo_producto", "codigo"];
    fkCol = candidatos.find((k) => keys.includes(k)) || null;
  }

  // Mapa de imágenes por valor de FK
  const imgByKey = new Map();
  if (fkCol) {
    for (const im of imgRows) {
      const k = String(im[fkCol]);
      if (!imgByKey.has(k)) imgByKey.set(k, im.storage_path);
    }
  }

  return (prods || []).map((p) => {
    const keyId = String(p.id ?? "");
    const keyCod = String(p.codigo ?? "");
    const storage = imgByKey.get(keyId) ?? imgByKey.get(keyCod) ?? null;
    return {
      ...p,
      [CFG.TABLE_IMAGENES]: storage ? [{ storage_path: storage }] : [],
      [CFG.TABLE_CATEGORIAS]: { nombre: catById.get(String(p.categoria_id)) },
    };
  });
}

function normalizarProductos(raw, categorias) {
  const catById = new Map(categorias.map((c) => [String(c.id), c.nombre]));
  return raw.map((p) => {
    const imgs = p[CFG.TABLE_IMAGENES];
    let storage = null;
    if (Array.isArray(imgs) && imgs.length) {
      const sorted = [...imgs].sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
      storage = sorted[0].storage_path;
    } else if (imgs && imgs.storage_path) {
      storage = imgs.storage_path;
    }

    const catObj = p[CFG.TABLE_CATEGORIAS];
    const catNombre =
      (catObj && (Array.isArray(catObj) ? catObj[0]?.nombre : catObj.nombre)) ||
      catById.get(String(p.categoria_id)) ||
      "Sin categoría";

    return {
      codigo: p.codigo ?? "",
      nombre: p.nombre ?? "(sin nombre)",
      medidas: p.medidas ?? "",
      precio: p.precio,
      packing: p.packing ?? "",
      categoria_id: p.categoria_id,
      _agotado: p.activo === false,
      _img: publicImageUrl(storage),
      _cat: catNombre,
    };
  });
}

async function init() {
  $("#year").textContent = new Date().getFullYear();

  try {
    STATE.categorias = await cargarCategorias();

    let raw;
    try {
      raw = await cargarProductosEmbebido();
    } catch (err) {
      console.warn("Join embebido falló, usando fallback:", err.message);
      raw = await cargarProductosFallback(STATE.categorias);
    }

    STATE.productos = normalizarProductos(raw, STATE.categorias);

    // Si no había tabla categorias, derívalas de los productos
    if (!STATE.categorias.length) {
      const set = new Map();
      STATE.productos.forEach((p) => set.set(String(p.categoria_id), p._cat));
      STATE.categorias = [...set.entries()].map(([id, nombre]) => ({ id, nombre }));
    }

    // Oculta categorías configuradas (filtros + productos)
    const ocultas = new Set((CFG.CATEGORIAS_OCULTAS || []).map(norm));
    if (ocultas.size) {
      STATE.categorias = STATE.categorias.filter((c) => !ocultas.has(norm(c.nombre)));
      STATE.productos = STATE.productos.filter((p) => !ocultas.has(norm(p._cat)));
    }

    statusEl.classList.add("hidden");
    renderFiltros();
    aplicar();
  } catch (err) {
    console.error(err);
    statusEl.innerHTML =
      `⚠️ Error al cargar el catálogo:<br><small>${err.message || err}</small>`;
  }
}

// ---------- Filtros / búsqueda ----------
function renderFiltros() {
  const cont = $("#filters");
  cont.innerHTML = "";
  const mk = (id, label) => {
    const b = document.createElement("button");
    b.className = "chip" + (STATE.activeCat === id ? " active" : "");
    b.textContent = label;
    b.dataset.cat = id;
    b.addEventListener("click", () => {
      STATE.activeCat = id;
      [...cont.children].forEach((c) => c.classList.toggle("active", c.dataset.cat === id));
      aplicar();
    });
    return b;
  };
  cont.appendChild(mk("all", "Todas"));
  // STATE.categorias ya viene ordenado por el campo `orden`
  STATE.categorias
    .filter((c) => c.nombre)
    .forEach((c) => cont.appendChild(mk(String(c.id), c.nombre)));
}

function aplicar() {
  const q = norm(STATE.query);
  STATE.filtered = STATE.productos.filter((p) => {
    const okCat = STATE.activeCat === "all" || String(p.categoria_id) === STATE.activeCat;
    const okQ = !q || norm(p.nombre).includes(q) || norm(p.codigo).includes(q);
    return okCat && okQ;
  });
  render();
}

function render() {
  grid.innerHTML = "";
  countEl.textContent = `${STATE.filtered.length} de ${STATE.productos.length} productos`;
  emptyEl.classList.toggle("hidden", STATE.filtered.length !== 0);

  const frag = document.createDocumentFragment();
  for (const p of STATE.filtered) {
    const card = document.createElement("article");
    card.className = "card" + (p._agotado ? " agotado" : "");

    const imgHtml = p._img
      ? `<img src="${p._img}" alt="${escapeAttr(p.nombre)}" loading="lazy"
             onerror="this.parentElement.innerHTML='<div class=\\'noimg\\'>Sin imagen</div>'">`
      : `<div class="noimg">Sin imagen</div>`;

    card.innerHTML = `
      <div class="card-img">
        ${p._cat ? `<span class="badge-cat">${escapeHtml(p._cat)}</span>` : ""}
        ${p._agotado ? `<span class="badge-agotado">Agotado</span>` : ""}
        ${imgHtml}
      </div>
      <div class="card-body">
        ${p.codigo ? `<span class="card-code">${escapeHtml(p.codigo)}</span>` : ""}
        <h3 class="card-name">${escapeHtml(p.nombre)}</h3>
        ${p.medidas ? `<span class="card-medidas">${escapeHtml(p.medidas)}</span>` : ""}
        ${p.precio != null && p.precio !== "" ? `<span class="card-price">${fmtPrecio(p.precio)}</span>` : ""}
        ${p.packing != null && p.packing !== "" ? `<span class="card-packing">Packing: ${escapeHtml(p.packing)}</span>` : ""}
      </div>`;
    frag.appendChild(card);
  }
  grid.appendChild(frag);
}

function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function escapeAttr(s) { return escapeHtml(s).replace(/\n/g, " "); }

// ---------- Eventos ----------
let searchTimer;
$("#search").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  const v = e.target.value;
  searchTimer = setTimeout(() => {
    STATE.query = v;
    aplicar();
  }, 150);
});

// Arranque
init();
