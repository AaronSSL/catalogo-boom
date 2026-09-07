// ============================================================
//  vamPyro · Catálogo — exportación a PDF (jsPDF)
//  Genera un PDF tipo catálogo: portada + secciones por
//  categoría + grid de tarjetas con imagen, código, nombre,
//  medidas y precio.
// ============================================================
(function () {
  const { jsPDF } = window.jspdf;
  const CFG = window.VAMPYRO_CONFIG;

  const overlay = document.getElementById("pdf-overlay");
  const msgEl = document.getElementById("pdf-msg");
  const barEl = document.getElementById("pdf-bar");
  const btn = document.getElementById("btn-pdf");

  // Paleta (RGB)
  const RED = [255, 59, 48];
  const GOLD = [255, 176, 32];
  const DARK = [28, 24, 40];
  const GREY = [120, 120, 130];
  const LINE = [210, 210, 218];

  // Logo de marca (usado en encabezado y portada)
  const LOGO_URL = "logoVampyro-header.png";

  function setProgress(done, total, label) {
    const pct = total ? Math.round((done / total) * 100) : 0;
    barEl.style.width = pct + "%";
    msgEl.textContent = label || `Procesando imágenes… ${done}/${total}`;
  }

  // Carga una imagen y la convierte a dataURL JPEG (vía canvas).
  // Devuelve { dataURL, w, h } o null si falla.
  function loadImage(url) {
    return new Promise((resolve) => {
      if (!url) return resolve(null);
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          // limita resolución para mantener el PDF ligero
          const max = 700;
          let { naturalWidth: w, naturalHeight: h } = img;
          if (Math.max(w, h) > max) {
            const r = max / Math.max(w, h);
            w = Math.round(w * r);
            h = Math.round(h * r);
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, w, h);
          ctx.drawImage(img, 0, 0, w, h);
          const dataURL = canvas.toDataURL("image/jpeg", 0.82);
          resolve({ dataURL, w, h });
        } catch (e) {
          console.warn("Imagen con CORS bloqueado:", url);
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  // Carga el logo preservando su transparencia (PNG, sin relleno blanco)
  function loadLogo(url) {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          canvas.getContext("2d").drawImage(img, 0, 0);
          resolve({ dataURL: canvas.toDataURL("image/png"), w: canvas.width, h: canvas.height });
        } catch (e) {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  }

  // Precarga con concurrencia limitada
  async function precargar(productos) {
    const cache = new Map();
    const urls = [...new Set(productos.map((p) => p._img).filter(Boolean))];
    let done = 0;
    const CONC = 6;
    let idx = 0;
    async function worker() {
      while (idx < urls.length) {
        const u = urls[idx++];
        cache.set(u, await loadImage(u));
        done++;
        setProgress(done, urls.length);
      }
    }
    await Promise.all(Array.from({ length: Math.min(CONC, urls.length) }, worker));
    return cache;
  }

  // -------- Generación del documento --------
  async function generar() {
    // El PDF SIEMPRE incluye todo el catálogo, sin importar la categoría
    // o búsqueda que esté seleccionada en pantalla.
    const productos = window.STATE.productos.slice();

    if (!productos.length) {
      alert("No hay productos para exportar.");
      return;
    }

    btn.disabled = true;
    overlay.classList.remove("hidden");
    setProgress(0, 1, "Preparando imágenes…");

    let cache;
    try {
      cache = await precargar(productos);
    } catch (e) {
      cache = new Map();
    }

    let logo = null;
    try {
      logo = await loadLogo(LOGO_URL);
    } catch (e) {
      logo = null;
    }

    setProgress(1, 1, "Construyendo PDF…");
    await new Promise((r) => setTimeout(r, 50)); // deja pintar el overlay

    const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
    const PW = doc.internal.pageSize.getWidth();   // 210
    const PH = doc.internal.pageSize.getHeight();   // 297
    const M = 12;                                   // margen
    const HEADER_H = 22;                            // banda superior por página
    const TOP = HEADER_H + 6;                        // y inicial de contenido
    const BOTTOM = PH - 10;

    // grid
    const COLS = 3;
    const GAP = 6;
    const cardW = (PW - 2 * M - (COLS - 1) * GAP) / COLS;
    const imgH = 40;
    const cardH = imgH + 26;
    const colX = (c) => M + c * (cardW + GAP);

    let pageNo = 0;
    let y = TOP;
    let col = 0;

    function drawPageHeader() {
      doc.setFillColor(...DARK);
      doc.rect(0, 0, PW, HEADER_H, "F");
      // doble filete (oro + rojo) — acabado de importadora
      doc.setFillColor(...GOLD);
      doc.rect(0, HEADER_H, PW, 0.6, "F");
      doc.setFillColor(...RED);
      doc.rect(0, HEADER_H + 0.6, PW, 1.2, "F");

      // Marca
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("vam", M, 9.5);
      doc.setTextColor(...GOLD);
      doc.text("Pyro", M + doc.getTextWidth("vam ") + 1, 9.5);
      doc.setTextColor(185, 185, 195);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7);
      doc.text("IMPORTADORA DE PIROTECNIA", M, 14.5);

      // Logo (lado derecho)
      if (logo && logo.dataURL) {
        const lh = HEADER_H - 6;
        const lw = lh * (logo.w / logo.h);
        try {
          doc.addImage(logo.dataURL, "PNG", PW - M - lw, 3, lw, lh);
        } catch (e) { /* ignora si falla */ }
      }
    }

    function newPage() {
      doc.addPage();
      pageNo++;
      drawPageHeader();
      y = TOP;
      col = 0;
    }

    // ---- Portada ----
    function portada() {
      doc.setFillColor(13, 11, 20);
      doc.rect(0, 0, PW, PH, "F");
      // chispas decorativas
      doc.setFillColor(...GOLD);
      for (let i = 0; i < 40; i++) {
        const rx = Math.random() * PW;
        const ry = Math.random() * PH;
        const rr = Math.random() * 0.9 + 0.2;
        doc.circle(rx, ry, rr, "F");
      }
      // Etiqueta superior — importadora
      doc.setTextColor(...GOLD);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text("IMPORTADORA  DE  PIROTECNIA", PW / 2, 44, { align: "center" });

      doc.setFillColor(...RED);
      doc.rect(0, PH / 2 - 62, PW, 0.8, "F");

      // Logo central (incluye el nombre de marca); si no carga, usa texto de respaldo
      if (logo && logo.dataURL) {
        const lw = 90;
        const lh = lw * (logo.h / logo.w);
        doc.addImage(logo.dataURL, "PNG", (PW - lw) / 2, PH / 2 - 58, lw, lh);
      } else {
        doc.setTextColor(255, 255, 255);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(54);
        doc.text("vam", PW / 2, PH / 2 - 8, { align: "center" });
        doc.setTextColor(...GOLD);
        doc.setFontSize(54);
        doc.text("Pyro", PW / 2, PH / 2 + 18, { align: "center" });
      }

      doc.setFillColor(...RED);
      doc.rect(0, PH / 2 + 44, PW, 0.8, "F");
      doc.setTextColor(200, 200, 210);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(14);
      doc.text("CATÁLOGO DE PRODUCTOS PIROTÉCNICOS", PW / 2, PH / 2 + 56, { align: "center" });

      doc.setFontSize(10);
      doc.setTextColor(150, 150, 160);
      doc.setFont("helvetica", "normal");
      const fecha = new Date().toLocaleDateString("es-PE", { year: "numeric", month: "long", day: "numeric" });
      doc.text(`${productos.length} productos · ${fecha}`, PW / 2, PH / 2 + 70, { align: "center" });
    }

    function categoryBand(nombre, indice, count) {
      // si no estamos al inicio de una fila, baja a la siguiente
      if (col !== 0) {
        col = 0;
        y += cardH + GAP;
      }
      const bandH = 9;
      if (y + bandH + cardH > BOTTOM) newPage();

      // Registra dónde empieza la categoría (para los hipervínculos del índice)
      if (indice) {
        indice.push({
          nombre: String(nombre),
          count: count || 0,
          page: doc.internal.getNumberOfPages(),
          top: Math.max(0, y - 6),
        });
      }

      doc.setFillColor(...RED);
      doc.rect(M, y, PW - 2 * M, bandH, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(String(nombre).toUpperCase(), M + 3, y + 6.3);
      y += bandH + 4;
    }

    // Página de índice: lista de categorías con hipervínculo interno.
    // Se dibuja al final, cuando ya conocemos la página de cada categoría.
    function drawIndice(pageNo, items) {
      doc.setPage(pageNo);
      let iy = TOP + 6;

      doc.setTextColor(...DARK);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("Índice de categorías", M, iy);
      doc.setDrawColor(...RED);
      doc.setLineWidth(0.8);
      doc.line(M, iy + 3, M + 62, iy + 3);
      doc.setLineWidth(0.2);
      iy += 11;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...GREY);
      doc.text("Haz clic en una categoría para saltar a su sección.", M, iy);
      iy += 9;

      const rowH = 9.5;
      items.forEach((it, i) => {
        if (iy + rowH > BOTTOM) return; // salvaguarda (no debería ocurrir en A4)
        const top = iy - 6;

        // fondo alterno
        if (i % 2 === 0) {
          doc.setFillColor(246, 246, 249);
          doc.rect(M, top, PW - 2 * M, rowH, "F");
        }
        // viñeta
        doc.setFillColor(...RED);
        doc.circle(M + 3, iy - 1.6, 1.1, "F");

        // nombre (texto con hipervínculo)
        doc.setTextColor(...DARK);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.textWithLink(it.nombre.toUpperCase(), M + 8, iy, {
          pageNumber: it.page,
          top: it.top,
        });

        // conteo de productos
        doc.setTextColor(...GREY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.5);
        doc.text(
          `${it.count} producto${it.count === 1 ? "" : "s"}`,
          PW - M - 18,
          iy,
          { align: "right" }
        );

        // indicador de página
        doc.setTextColor(...RED);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text(`pág. ${it.page - pageNo}`, PW - M, iy, { align: "right" });

        // toda la fila es clickeable
        doc.link(M, top, PW - 2 * M, rowH, {
          pageNumber: it.page,
          top: it.top,
        });

        iy += rowH + 1.5;
      });
    }

    function drawCard(p) {
      if (col === 0 && y + cardH > BOTTOM) newPage();
      const x = colX(col);

      // marco
      doc.setDrawColor(...LINE);
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(x, y, cardW, cardH, 2, 2, "FD");

      // imagen
      const box = { x: x + 2, y: y + 2, w: cardW - 4, h: imgH };
      const im = p._img ? cache.get(p._img) : null;
      if (im && im.dataURL) {
        const r = Math.min(box.w / im.w, box.h / im.h);
        const dw = im.w * r;
        const dh = im.h * r;
        const dx = box.x + (box.w - dw) / 2;
        const dy = box.y + (box.h - dh) / 2;
        try {
          doc.addImage(im.dataURL, "JPEG", dx, dy, dw, dh);
        } catch (e) { /* ignora imagen corrupta */ }
      } else {
        doc.setFillColor(245, 245, 248);
        doc.rect(box.x, box.y, box.w, box.h, "F");
        doc.setTextColor(...GREY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.text("Sin imagen", box.x + box.w / 2, box.y + box.h / 2, { align: "center" });
      }

      // texto
      let ty = y + imgH + 6;
      if (p.codigo) {
        doc.setTextColor(...RED);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.text(String(p.codigo), x + 3, ty);
      }
      ty += 4;
      doc.setTextColor(40, 40, 50);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      const nameLines = doc.splitTextToSize(String(p.nombre || ""), cardW - 6).slice(0, 2);
      doc.text(nameLines, x + 3, ty);
      ty += nameLines.length * 3.6 + 0.5;

      if (p.medidas) {
        doc.setTextColor(...GREY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7.5);
        const md = doc.splitTextToSize(String(p.medidas), cardW - 6).slice(0, 1);
        doc.text(md, x + 3, ty);
        ty += 3.4;
      }

      if (p.packing != null && p.packing !== "") {
        doc.setTextColor(...GREY);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        const pk = doc.splitTextToSize(`Packing: ${p.packing}`, cardW - 6).slice(0, 1);
        doc.text(pk, x + 3, ty);
      }

      if (p._agotado) {
        doc.setTextColor(...GREY);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.text("AGOTADO", x + 3, y + cardH - 3);
      }

      if (p.precio != null && p.precio !== "") {
        doc.setTextColor(...RED);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(window.fmtPrecio(p.precio), x + cardW - 3, y + cardH - 3, { align: "right" });
      }

      // avanza cursor
      col++;
      if (col >= COLS) {
        col = 0;
        y += cardH + GAP;
      }
    }

    // ---- Construcción ----
    portada();

    // Reserva la página de índice (se rellena al final, cuando ya
    // conocemos en qué página empieza cada categoría).
    doc.addPage();
    drawPageHeader();
    const indexPageNo = doc.internal.getNumberOfPages();

    // agrupa por categoría conservando el orden de STATE.categorias
    const orden = new Map(window.STATE.categorias.map((c, i) => [String(c.id), i]));
    const grupos = new Map();
    for (const p of productos) {
      const k = String(p.categoria_id);
      if (!grupos.has(k)) grupos.set(k, { nombre: p._cat, items: [] });
      grupos.get(k).items.push(p);
    }
    const gruposOrd = [...grupos.entries()].sort(
      (a, b) => (orden.get(a[0]) ?? 999) - (orden.get(b[0]) ?? 999)
    );

    const indice = []; // { nombre, count, page, top }
    newPage(); // primera página de contenido
    for (const [, g] of gruposOrd) {
      categoryBand(g.nombre || "Sin categoría", indice, g.items.length);
      for (const p of g.items) drawCard(p);
    }

    // Rellena la página de índice con los hipervínculos a cada categoría
    drawIndice(indexPageNo, indice);

    // ---- Pies de página con numeración ----
    const total = doc.internal.getNumberOfPages();
    const totalContenido = total - indexPageNo;
    for (let i = indexPageNo; i <= total; i++) {
      doc.setPage(i);
      doc.setTextColor(...GREY);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("vamPyro · Importadora", M, PH - 4);
      if (i === indexPageNo) {
        doc.text("Índice", PW - M, PH - 4, { align: "right" });
      } else {
        doc.text(`Página ${i - indexPageNo} de ${totalContenido}`, PW - M, PH - 4, { align: "right" });
      }
    }

    const fecha = new Date().toISOString().slice(0, 10);
    doc.save(`Catalogo_vamPyro_${fecha}.pdf`);

    overlay.classList.add("hidden");
    btn.disabled = false;
    barEl.style.width = "0%";
  }

  btn.addEventListener("click", () => {
    generar().catch((err) => {
      console.error(err);
      alert("Ocurrió un error al generar el PDF: " + (err.message || err));
      overlay.classList.add("hidden");
      btn.disabled = false;
    });
  });
})();
