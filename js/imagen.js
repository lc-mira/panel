/**
 * imagen.js — IMAGEN VERTICAL (1080×1920) PARA ESTADOS Y REDES
 * ============================================================
 * Dibuja la ficha en un <canvas> con el mismo lenguaje visual de la página y
 * devuelve un PNG. Recibe el MISMO objeto "vista" que usa la página
 * (js/ficha.js → construirVista), que solo contiene datos públicos.
 *
 * Diseño pensado para historias (WhatsApp, Instagram, Facebook):
 *  - La foto ocupa el borde superior: ahí la historia pone su barra de perfil.
 *  - Lo importante queda entre y≈250 y y≈1700 (zonas seguras).
 *  - El pie de marca va por encima de la barra de "Responder".
 *
 * (Migrado de lc-mira/ficha: ahora vive en el panel.)
 *
 * La foto se pide a /foto de la ficha (ficha.miraleads.pro, que responde con CORS abierto)
 * para que el canvas no quede "contaminado" y se pueda exportar. Si /foto no responde, la imagen
 * se genera igual, con un recuadro "Sin foto".
 */

'use strict';

window.FichaImagen = (function () {

  const W = 1080, H = 1920;
  const M = 48;                 // margen lateral
  const G = 26;                 // espacio entre bloques
  const FUENTE = "Poppins, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

  /* =============================================================
   * Utilidades de dibujo
   * ============================================================= */
  function ruta(ctx, x, y, w, h, r) {
    const [tl, tr, br, bl] = Array.isArray(r) ? r : [r, r, r, r];
    ctx.beginPath();
    ctx.moveTo(x + tl, y);
    ctx.lineTo(x + w - tr, y);     ctx.arcTo(x + w, y, x + w, y + tr, tr);
    ctx.lineTo(x + w, y + h - br); ctx.arcTo(x + w, y + h, x + w - br, y + h, br);
    ctx.lineTo(x + bl, y + h);     ctx.arcTo(x, y + h, x, y + h - bl, bl);
    ctx.lineTo(x, y + tl);         ctx.arcTo(x, y, x + tl, y, tl);
    ctx.closePath();
  }

  function conSombra(ctx, color, blur, dy, dibujar) {
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = blur; ctx.shadowOffsetY = dy;
    dibujar();
    ctx.restore();
  }

  function fijarFuente(ctx, size, peso, tracking) {
    ctx.font = peso + ' ' + size + 'px ' + FUENTE;
    if ('letterSpacing' in ctx) ctx.letterSpacing = (tracking || 0) + 'px';
  }

  function medir(ctx, t, size, peso, tracking) {
    fijarFuente(ctx, size, peso, tracking);
    const w = ctx.measureText(t).width;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    return w;
  }

  function texto(ctx, t, x, y, o) {
    fijarFuente(ctx, o.size, o.peso || 400, o.tracking);
    ctx.fillStyle = o.color;
    ctx.textAlign = o.align || 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(t, x, y);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  }

  function envolver(ctx, t, size, peso, tracking, maxW) {
    const lineas = []; let actual = '';
    t.split(/\s+/).forEach(p => {
      const prueba = actual ? actual + ' ' + p : p;
      if (!actual || medir(ctx, prueba, size, peso, tracking) <= maxW) actual = prueba;
      else { lineas.push(actual); actual = p; }
    });
    if (actual) lineas.push(actual);
    return lineas;
  }

  function cargarImagen(src) {
    return new Promise((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error('imagen no cargó'));
      i.src = src;
    });
  }

  /** Intenta una dirección: primero con fetch (CORS) y, si falla, como <img crossOrigin>. */
  async function cargarUna(url) {
    try {
      const r = await fetch(url);
      if (r.ok) {
        const u = URL.createObjectURL(await r.blob());
        try { return await cargarImagen(u); } finally { URL.revokeObjectURL(u); }
      }
    } catch (e) { /* prueba el otro método */ }
    try {
      return await new Promise((ok, mal) => {
        const i = new Image();
        i.crossOrigin = 'anonymous';
        i.onload = () => ok(i);
        i.onerror = () => mal(new Error('sin CORS'));
        i.src = url;
      });
    } catch (e) { return null; }
  }

  /** Acepta una dirección o una lista en orden de preferencia; devuelve la primera que cargue. */
  async function cargarFoto(urls) {
    const lista = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
    for (const u of lista) {
      const img = await cargarUna(u);
      if (img && img.width > 1) return img;
    }
    return null;
  }

  async function cargarIcono(svg) {
    return cargarImagen('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg));
  }

  function cubrir(ctx, img, x, y, w, h) {
    const k = Math.max(w / img.width, h / img.height);
    const dw = img.width * k, dh = img.height * k;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  function rellenoAcento(ctx, c, x, y, w, h) {
    const g = ctx.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, c.oscuro); g.addColorStop(.55, c.acento); g.addColorStop(1, c.claro);
    return g;
  }

  function lineaFirma(ctx, c, cx, y, w) {
    const g = ctx.createLinearGradient(cx - w / 2, 0, cx + w / 2, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.22, c.claro);
    g.addColorStop(.5, c.acento); g.addColorStop(.78, c.claro); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ruta(ctx, cx - w / 2, y, w, 4, 2); ctx.fill();
  }

  /** Marca "ojo" (mismo símbolo del pie de la página). */
  function dibujarOjo(ctx, c, cx, cy, r) {
    ctx.save();
    ctx.strokeStyle = c.acento; ctx.fillStyle = c.acento; ctx.lineWidth = r * .22;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, r * .4, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /* =============================================================
   * Generación
   * @param {Object} v  vista pública (titulo, proyecto, ubicacion, precios, tarjetas, detalles, noDisponible)
   * @param {Object} o  { fotoUrls (lista en orden de preferencia) o fotoUrl, colores:{acento,oscuro,claro,suave}, dominio, iconoSvg(nombre,color) }
   * @returns {Promise<Blob>} PNG
   * ============================================================= */
  async function generarClasico(v, o) {
    const c = o.colores;

    // Tipografía: esperar a que Poppins esté lista (si no, se usa la del sistema).
    try {
      await Promise.all([400, 500, 600, 700].map(p => document.fonts.load(p + ' 32px Poppins')));
    } catch (e) { /* sigue con la fuente de respaldo */ }

    const foto = ('foto' in o) ? o.foto : await cargarFoto(o.fotoUrls || o.fotoUrl);

    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');

    /* ---------- Medidas (de arriba hacia abajo, la foto absorbe lo que sobre) ---------- */
    const cardW = W - M * 2;

    // Título: hasta 2 líneas; baja el tamaño si no cabe.
    const titulo = (v.titulo || 'Inmueble').toUpperCase();
    let tSize = 54, tLineas = [];
    for (const s of [54, 48, 42, 36]) {
      tSize = s; tLineas = envolver(ctx, titulo, s, 600, s * .07, cardW - 130);
      if (tLineas.length <= 2) break;
    }
    const tLinea = Math.round(tSize * 1.28);
    // Posiciones dentro de la tarjeta del título (relativas a su borde superior).
    const base1   = 52 + Math.round(tSize * .95);                 // primera línea del título
    const baseUlt = base1 + (tLineas.length - 1) * tLinea;        // última línea del título
    const lineaY  = baseUlt + 28;                                  // línea degradada
    let cursor = lineaY + 4;
    const proyecY = v.proyecto  ? (cursor += 52) : 0;              // baseline del nombre del proyecto
    const ubicY   = v.ubicacion ? (cursor += (v.proyecto ? 50 : 52)) : 0;
    const tituloH = cursor + 46;
    const SOLAPE = 70;

    const precioH = 176;

    const tarjetas = v.tarjetas.slice(0, 3);
    const statsH = tarjetas.length ? 176 : 0;

    // Píldoras con lo demás (datos + forma de pago) y, después, hasta 4 comodidades.
    // Se acomodan de izquierda a derecha con salto de línea, máximo 2 filas.
    const textosPildora = v.tarjetas.slice(3).map(t => t.pildora)
      .concat(v.detalles.filter(d => !d.com).map(d => d.texto))
      .concat(v.detalles.filter(d => d.com).slice(0, 4).map(d => d.texto)).filter(Boolean);
    const pildoras = [];
    let usado = 0, fila = 0;
    textosPildora.forEach(t => {
      const w = medir(ctx, t, 28, 500, 0) + 60;
      if (usado && usado + 14 + w > cardW) { fila++; usado = 0; }
      if (fila > 2) return;
      pildoras.push({ t, w, fila, x: usado ? usado + 14 : 0 });
      usado = (usado ? usado + 14 : 0) + w;
    });
    const filas = pildoras.length ? pildoras[pildoras.length - 1].fila + 1 : 0;
    const pildorasH = filas ? filas * 64 + (filas - 1) * 12 : 0;

    const pieH = 120;
    const apilado = (tituloH - SOLAPE) + G + precioH + (statsH ? G + statsH : 0) + (pildorasH ? G + pildorasH : 0) + G;
    const FOOTER_Y = 1780;
    let fotoH = FOOTER_Y - apilado;
    fotoH = Math.max(620, Math.min(1160, fotoH));
    const pieY = fotoH + apilado;

    /* ---------- Fondo ---------- */
    const fondo = ctx.createLinearGradient(0, 0, 0, H);
    fondo.addColorStop(0, '#f6f8fa'); fondo.addColorStop(1, '#e6ebf0');
    ctx.fillStyle = fondo; ctx.fillRect(0, 0, W, H);
    [[W + 40, 1100, 520, c.suave], [-80, 1500, 560, 'rgba(240,200,130,.18)']].forEach(([x, y, r, col]) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, col); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    });

    /* ---------- Foto a sangre, con esquinas inferiores redondeadas ---------- */
    ctx.save();
    ruta(ctx, 0, 0, W, fotoH, [0, 0, 76, 76]); ctx.clip();
    if (foto) {
      cubrir(ctx, foto, 0, 0, W, fotoH);
    } else {
      ctx.fillStyle = '#d6dce3'; ctx.fillRect(0, 0, W, fotoH);
      texto(ctx, 'Sin foto', W / 2, fotoH / 2, { size: 40, color: '#98a1ae', align: 'center' });
    }
    const velo = ctx.createLinearGradient(0, 0, 0, 260);   // ayuda a leer la barra de la historia
    velo.addColorStop(0, 'rgba(10,14,18,.30)'); velo.addColorStop(1, 'rgba(10,14,18,0)');
    ctx.fillStyle = velo; ctx.fillRect(0, 0, W, 260);
    ctx.restore();

    if (v.noDisponible) {
      const t = v.noDisponible;
      const w = medir(ctx, t, 30, 600, 1) + 56;
      ctx.fillStyle = '#b4232a'; ruta(ctx, M, 290, w, 58, 29); ctx.fill();
      texto(ctx, t, M + 28, 330, { size: 30, peso: 600, color: '#fff', tracking: 1 });
    }

    /* ---------- Tarjeta del título (flota sobre el borde de la foto) ---------- */
    let y = fotoH - SOLAPE;
    conSombra(ctx, 'rgba(24,36,48,.20)', 50, 18, () => {
      ctx.fillStyle = '#fff'; ruta(ctx, M, y, cardW, tituloH, 52); ctx.fill();
    });
    tLineas.forEach((l, i) => {
      texto(ctx, l, W / 2, y + base1 + i * tLinea, { size: tSize, peso: 600, color: '#38404c', align: 'center', tracking: tSize * .07 });
    });
    lineaFirma(ctx, c, W / 2, y + lineaY, 240);
    if (v.proyecto) {
      const pr = v.proyecto.length > 40 ? v.proyecto.slice(0, 39) + '…' : v.proyecto;
      texto(ctx, pr, W / 2, y + proyecY, { size: 34, peso: 600, color: '#1d232c', align: 'center' });
    }
    if (v.ubicacion) {
      const ub = v.ubicacion.length > 44 ? v.ubicacion.slice(0, 43) + '…' : v.ubicacion;
      const ancho = medir(ctx, ub, 32, 400, 0);
      const x0 = W / 2 - (ancho + 44) / 2;                         // pin + texto, centrados juntos
      try {
        const pin = await cargarIcono(o.iconoSvg('pin', '#98a1ae'));
        ctx.drawImage(pin, x0, y + ubicY - 29, 34, 34);
      } catch (e) { /* sin ícono */ }
      texto(ctx, ub, x0 + 44, y + ubicY, { size: 32, color: '#5f6877' });
    }
    y += tituloH + G;

    /* ---------- Precio ---------- */
    conSombra(ctx, 'rgba(11,68,59,.30)', 40, 16, () => {
      ctx.fillStyle = rellenoAcento(ctx, c, M, y, cardW, precioH); ruta(ctx, M, y, cardW, precioH, 46); ctx.fill();
    });
    const nP = v.precios.length;
    v.precios.forEach((p, i) => {
      const colW = cardW / nP;
      const cx = M + colW * i + 48;
      if (i > 0) { ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(M + colW * i, y + 36, 2, precioH - 72); }
      ctx.globalAlpha = .85;
      texto(ctx, p.etiqueta.toUpperCase(), cx, y + 58, { size: 24, peso: 500, color: '#fff', tracking: 3.4 });
      ctx.globalAlpha = 1;
      let size = nP > 1 ? 56 : 82;
      while (size > 34 && medir(ctx, p.valor, size, 700, -1) + (p.sufijo ? 90 : 0) > colW - 96) size -= 2;
      texto(ctx, p.valor, cx, y + 58 + 22 + size * .86, { size, peso: 700, color: '#fff', tracking: -1 });
      if (p.sufijo) {
        const vw = medir(ctx, p.valor, size, 700, -1);
        ctx.globalAlpha = .85;
        texto(ctx, p.sufijo, cx + vw + 8, y + 58 + 22 + size * .86, { size: Math.max(26, size * .38), peso: 500, color: '#fff' });
        ctx.globalAlpha = 1;
      }
    });
    y += precioH;

    /* ---------- Tres tarjetas de datos ---------- */
    if (statsH) {
      y += G;
      const n = tarjetas.length, gap = 24;
      const w = (cardW - gap * (n - 1)) / n;
      for (let i = 0; i < n; i++) {
        const t = tarjetas[i], x = M + i * (w + gap);
        conSombra(ctx, 'rgba(24,36,48,.12)', 34, 10, () => {
          ctx.fillStyle = '#fff'; ruta(ctx, x, y, w, statsH, 42); ctx.fill();
        });
        // círculo suave + ícono
        ctx.fillStyle = c.suave; ctx.beginPath(); ctx.arc(x + 28 + 31, y + 34 + 31, 31, 0, Math.PI * 2); ctx.fill();
        try {
          const ic = await cargarIcono(o.iconoSvg(t.icono, c.acento));
          ctx.drawImage(ic, x + 28 + 31 - 17, y + 34 + 31 - 17, 34, 34);
        } catch (e) { /* sin ícono */ }
        // etiqueta + valor a la derecha del círculo
        const tx = x + 28 + 62 + 18;
        texto(ctx, t.etiqueta, tx, y + 62, { size: 25, color: '#5f6877' });
        let size = 58;
        const unidad = t.unidad ? ' ' + t.unidad : '';
        while (size > 30 && medir(ctx, t.valor, size, 700, -1) + (unidad ? 40 : 0) > w - (tx - x) - 18) size -= 2;
        texto(ctx, t.valor, tx, y + 62 + 14 + size * .9, { size, peso: 700, color: '#1d232c', tracking: -1 });
        if (unidad) {
          const vw = medir(ctx, t.valor, size, 700, -1);
          texto(ctx, t.unidad, tx + vw + 6, y + 62 + 14 + size * .9, { size: 28, peso: 500, color: '#5f6877' });
        }
      }
      y += statsH;
    }

    /* ---------- Píldoras ---------- */
    if (pildorasH) {
      y += G;
      pildoras.forEach(p => {
        const py = y + p.fila * 76, px = M + p.x;
        ctx.fillStyle = c.suave; ruta(ctx, px, py, p.w, 64, 32); ctx.fill();
        texto(ctx, p.t, px + p.w / 2, py + 42, { size: 28, peso: 500, color: c.acento, align: 'center' });
      });
      y += pildorasH;
    }

    /* ---------- Pie de marca: banda hasta el borde inferior ---------- */
    const banda = ctx.createLinearGradient(0, pieY, 0, H);
    banda.addColorStop(0, '#eceff3'); banda.addColorStop(1, '#dfe4ea');
    ctx.fillStyle = banda; ctx.fillRect(0, pieY, W, H - pieY);
    ctx.fillStyle = '#dde2e8'; ctx.fillRect(0, pieY, W, 2);

    // Pie discreto: solo una línea pequeña y centrada, sin enlace.
    const t1 = 'Ficha creada con ', t2 = 'Mira Leads';
    const w1 = medir(ctx, t1, 22, 400, 0), w2 = medir(ctx, t2, 22, 600, 0);
    let x = (W - (30 + w1 + w2)) / 2;
    dibujarOjo(ctx, c, x + 10, pieY + 40, 10);
    x += 30;
    texto(ctx, t1, x, pieY + 48, { size: 22, peso: 400, color: '#7a8493' });
    texto(ctx, t2, x + w1, pieY + 48, { size: 22, peso: 600, color: '#7a8493' });

    return new Promise((ok, mal) => {
      canvas.toBlob(b => b ? ok(b) : mal(new Error('No se pudo crear la imagen')), 'image/png');
    });
  }

  /* =============================================================
   * DISEÑOS ADICIONALES
   *  - 'clasico'  : el original (foto arriba, tarjetas blancas)
   *  - 'foto'     : foto a pantalla completa con la información sobre un degradado oscuro
   *  - 'marca'    : fondo del color de marca, foto en arco y precio en una píldora blanca
   * Todos usan los mismos datos públicos (vista) y el mismo pie de marca.
   * ============================================================= */

  async function preparar(v, o) {
    try { await Promise.all([400, 500, 600, 700].map(p => document.fonts.load(p + ' 32px Poppins'))); } catch (e) { /* respaldo */ }
    const foto = ('foto' in o) ? o.foto : await cargarFoto(o.fotoUrls || o.fotoUrl);
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    return { c: o.colores, foto, canvas, ctx: canvas.getContext('2d') };
  }

  function aBlob(canvas) {
    return new Promise((ok, mal) => canvas.toBlob(b => b ? ok(b) : mal(new Error('No se pudo crear la imagen')), 'image/png'));
  }

  /** Reparte las píldoras en filas (máx. 2) como el diseño clásico. */
  function armarPildoras(ctx, v, maxW, size, padX, altura, gap) {
    const textos = v.tarjetas.slice(3).map(t => t.pildora)
      .concat(v.detalles.filter(d => !d.com).map(d => d.texto))
      .concat(v.detalles.filter(d => d.com).slice(0, 4).map(d => d.texto)).filter(Boolean);
    const lista = []; let usado = 0, fila = 0;
    textos.forEach(t => {
      const w = medir(ctx, t, size, 500, 0) + padX * 2;
      if (usado && usado + gap + w > maxW) { fila++; usado = 0; }
      if (fila > 1) return;
      lista.push({ t, w, fila, x: usado ? usado + gap : 0 });
      usado = (usado ? usado + gap : 0) + w;
    });
    const filas = lista.length ? lista[lista.length - 1].fila + 1 : 0;
    return { lista, filas, alto: filas ? filas * altura + (filas - 1) * 12 : 0, altura };
  }

  function etiquetaNoDisponible(ctx, v, y) {
    if (!v.noDisponible) return;
    const t = v.noDisponible, w = medir(ctx, t, 30, 600, 1) + 56;
    ctx.fillStyle = '#b4232a'; ruta(ctx, M, y, w, 58, 29); ctx.fill();
    texto(ctx, t, M + 28, y + 40, { size: 30, peso: 600, color: '#fff', tracking: 1 });
  }

  async function ubicacionConPin(ctx, o, ub, cx, y, colorPin, colorTexto, size) {
    const t = ub.length > 44 ? ub.slice(0, 43) + '…' : ub;
    const ancho = medir(ctx, t, size, 400, 0);
    const x0 = cx - (ancho + 44) / 2;
    try { const pin = await cargarIcono(o.iconoSvg('pin', colorPin)); ctx.drawImage(pin, x0, y - 29, 34, 34); } catch (e) { /* sin ícono */ }
    texto(ctx, t, x0 + 44, y, { size, color: colorTexto });
  }

  /** Precios en columnas. Devuelve la altura usada. */
  function dibujarPrecios(ctx, v, x, y, w, colorEtq, colorVal, alturaFija) {
    const n = v.precios.length;
    v.precios.forEach((p, i) => {
      const colW = w / n, cx = x + colW * i + colW / 2;
      ctx.globalAlpha = .85;
      texto(ctx, p.etiqueta.toUpperCase(), cx, y + 30, { size: 24, peso: 500, color: colorEtq, align: 'center', tracking: 3.4 });
      ctx.globalAlpha = 1;
      let size = n > 1 ? 58 : 88;
      while (size > 34 && medir(ctx, p.valor, size, 700, -1) + (p.sufijo ? 90 : 0) > colW - 40) size -= 2;
      const vw = medir(ctx, p.valor, size, 700, -1), sw = p.sufijo ? medir(ctx, p.sufijo, Math.max(26, size * .38), 500, 0) + 8 : 0;
      const x0 = cx - (vw + sw) / 2, yb = y + 30 + 20 + size * .86;
      texto(ctx, p.valor, x0, yb, { size, peso: 700, color: colorVal, tracking: -1 });
      if (p.sufijo) texto(ctx, p.sufijo, x0 + vw + 8, yb, { size: Math.max(26, size * .38), peso: 500, color: colorVal });
    });
    return alturaFija;
  }

  function pieMarca(ctx, c, y, colorTexto, colorOjo) {
    const t1 = 'Ficha creada con ', t2 = 'Mira Leads';
    const w1 = medir(ctx, t1, 22, 400, 0), w2 = medir(ctx, t2, 22, 600, 0);
    let x = (W - (30 + w1 + w2)) / 2;
    dibujarOjo(ctx, { acento: colorOjo }, x + 10, y - 8, 10);
    x += 30;
    texto(ctx, t1, x, y, { size: 22, peso: 400, color: colorTexto });
    texto(ctx, t2, x + w1, y, { size: 22, peso: 600, color: colorTexto });
  }

  /* ---------- Diseño "foto": pantalla completa ---------- */
  async function generarFoto(v, o) {
    const { c, foto, canvas, ctx } = await preparar(v, o);
    const cardW = W - M * 2;

    // Fondo: la foto a sangre (o un degradado de marca si no hay foto).
    if (foto) cubrir(ctx, foto, 0, 0, W, H);
    else {
      ctx.fillStyle = rellenoAcento(ctx, c, 0, 0, W, H); ctx.fillRect(0, 0, W, H);
      texto(ctx, 'Sin foto', W / 2, 700, { size: 40, color: 'rgba(255,255,255,.6)', align: 'center' });
    }
    const velo = ctx.createLinearGradient(0, 0, 0, 280);
    velo.addColorStop(0, 'rgba(8,12,16,.45)'); velo.addColorStop(1, 'rgba(8,12,16,0)');
    ctx.fillStyle = velo; ctx.fillRect(0, 0, W, 280);
    const sombra = ctx.createLinearGradient(0, 640, 0, H);
    sombra.addColorStop(0, 'rgba(8,12,16,0)'); sombra.addColorStop(.45, 'rgba(8,12,16,.74)'); sombra.addColorStop(1, 'rgba(8,12,16,.94)');
    ctx.fillStyle = sombra; ctx.fillRect(0, 640, W, H - 640);
    etiquetaNoDisponible(ctx, v, 290);

    // Medidas (de abajo hacia arriba).
    let tSize = 72, tLineas = [];
    for (const s of [72, 64, 56, 48]) { tSize = s; tLineas = envolver(ctx, v.titulo || 'Inmueble', s, 700, -.5, cardW); if (tLineas.length <= 2) break; }
    const tLinea = Math.round(tSize * 1.2);
    const pild = armarPildoras(ctx, v, cardW, 28, 28, 64, 14);
    const tarjetas = v.tarjetas.slice(0, 3);
    const statsH = tarjetas.length ? 170 : 0;
    const precioH = 170;
    const infoH = tLineas.length * tLinea + (v.proyecto ? 54 : 0) + (v.ubicacion ? 56 : 0);
    const total = infoH + 34 + precioH + (statsH ? 30 + statsH : 0) + (pild.alto ? 30 + pild.alto : 0);
    let y = 1790 - total;

    // Título, proyecto y ubicación.
    tLineas.forEach((l, i) => texto(ctx, l, M, y + tSize * .9 + i * tLinea, { size: tSize, peso: 700, color: '#fff', tracking: -.5 }));
    y += tLineas.length * tLinea;
    if (v.proyecto) {
      const pr = v.proyecto.length > 40 ? v.proyecto.slice(0, 39) + '…' : v.proyecto;
      texto(ctx, pr, M, y + 36, { size: 36, peso: 600, color: 'rgba(255,255,255,.92)' }); y += 54;
    }
    if (v.ubicacion) {
      const ub = v.ubicacion.length > 44 ? v.ubicacion.slice(0, 43) + '…' : v.ubicacion;
      try { const pin = await cargarIcono(o.iconoSvg('pin', '#ffffff')); ctx.drawImage(pin, M, y + 8, 34, 34); } catch (e) { /* sin ícono */ }
      texto(ctx, ub, M + 44, y + 36, { size: 32, color: 'rgba(255,255,255,.85)' }); y += 56;
    }
    y += 34;

    // Precio: línea de marca y valores grandes.
    ctx.fillStyle = rellenoAcento(ctx, c, M, y, 200, 6); ruta(ctx, M, y, 200, 6, 3); ctx.fill();
    ctx.save(); ctx.translate(0, 18);
    v.precios.forEach((p, i) => {
      const n = v.precios.length, colW = cardW / n, x0 = M + colW * i;
      ctx.globalAlpha = .8;
      texto(ctx, p.etiqueta.toUpperCase(), x0, y + 26, { size: 24, peso: 500, color: '#fff', tracking: 3.4 });
      ctx.globalAlpha = 1;
      let size = n > 1 ? 62 : 100;
      while (size > 34 && medir(ctx, p.valor, size, 700, -1) + (p.sufijo ? 90 : 0) > colW - 24) size -= 2;
      const yb = y + 26 + 18 + size * .86;
      texto(ctx, p.valor, x0, yb, { size, peso: 700, color: '#fff', tracking: -1 });
      if (p.sufijo) texto(ctx, p.sufijo, x0 + medir(ctx, p.valor, size, 700, -1) + 8, yb, { size: Math.max(26, size * .38), peso: 500, color: '#fff' });
    });
    ctx.restore();
    y += precioH;

    // Datos en una banda de vidrio.
    if (statsH) {
      y += 30;
      ctx.fillStyle = 'rgba(255,255,255,.14)'; ruta(ctx, M, y, cardW, statsH, 40); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 2; ruta(ctx, M, y, cardW, statsH, 40); ctx.stroke();
      const n = tarjetas.length, colW = cardW / n;
      for (let i = 0; i < n; i++) {
        const t = tarjetas[i], cx = M + colW * i + colW / 2;
        if (i > 0) { ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(M + colW * i, y + 30, 2, statsH - 60); }
        try { const ic = await cargarIcono(o.iconoSvg(t.icono, '#ffffff')); ctx.drawImage(ic, cx - 17, y + 22, 34, 34); } catch (e) { /* sin ícono */ }
        let size = 54;
        const unidad = t.unidad ? ' ' + t.unidad : '';
        while (size > 28 && medir(ctx, t.valor + unidad, size, 700, -1) > colW - 30) size -= 2;
        texto(ctx, t.valor + unidad, cx, y + 70 + size * .78, { size, peso: 700, color: '#fff', align: 'center', tracking: -1 });
        texto(ctx, t.etiqueta, cx, y + statsH - 24, { size: 24, color: 'rgba(255,255,255,.8)', align: 'center' });
      }
      y += statsH;
    }

    // Píldoras translúcidas.
    if (pild.alto) {
      y += 30;
      pild.lista.forEach(p => {
        const px = M + p.x, py = y + p.fila * (pild.altura + 12);
        ctx.fillStyle = 'rgba(255,255,255,.18)'; ruta(ctx, px, py, p.w, pild.altura, pild.altura / 2); ctx.fill();
        texto(ctx, p.t, px + p.w / 2, py + 42, { size: 28, peso: 500, color: '#fff', align: 'center' });
      });
    }
    pieMarca(ctx, c, 1856, 'rgba(255,255,255,.7)', '#ffffff');
    return aBlob(canvas);
  }

  /* ---------- Diseño "marca": color de marca, foto en arco, precio en píldora blanca ---------- */
  async function generarMarca(v, o) {
    const { c, foto, canvas, ctx } = await preparar(v, o);
    const cardW = W - M * 2;

    const fondo = ctx.createLinearGradient(0, 0, W * .35, H);
    fondo.addColorStop(0, c.acento); fondo.addColorStop(1, c.oscuro);
    ctx.fillStyle = fondo; ctx.fillRect(0, 0, W, H);
    [[W - 60, 220, 460], [60, 1500, 520]].forEach(([x, y, r]) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(255,255,255,.14)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    });

    // Medidas: la foto en arco absorbe el espacio sobrante.
    let tSize = 62, tLineas = [];
    for (const s of [62, 56, 50, 44]) { tSize = s; tLineas = envolver(ctx, v.titulo || 'Inmueble', s, 700, -.3, cardW - 40); if (tLineas.length <= 2) break; }
    const tLinea = Math.round(tSize * 1.22);
    const pild = armarPildoras(ctx, v, cardW, 27, 26, 60, 14);
    const tarjetas = v.tarjetas.slice(0, 3);
    const statsH = tarjetas.length ? 150 : 0;
    const precioH = 168;
    const tituloH = tLineas.length * tLinea + (v.proyecto ? 52 : 0) + (v.ubicacion ? 56 : 0);
    const apilado = 34 + tituloH + 30 + precioH + (statsH ? 30 + statsH : 0) + (pild.alto ? 28 + pild.alto : 0);
    const TOP = 190, FIN = 1790;
    const archH = Math.max(520, Math.min(900, FIN - TOP - apilado));
    const archW = 880, archX = (W - archW) / 2;

    // Marco blanco + foto en arco.
    ctx.save();
    conSombra(ctx, 'rgba(0,0,0,.30)', 50, 20, () => {
      ctx.fillStyle = '#fff'; ruta(ctx, archX - 12, TOP - 12, archW + 24, archH + 24, [archW / 2 + 12, archW / 2 + 12, 52, 52]); ctx.fill();
    });
    ruta(ctx, archX, TOP, archW, archH, [archW / 2, archW / 2, 42, 42]); ctx.clip();
    if (foto) cubrir(ctx, foto, archX, TOP, archW, archH);
    else { ctx.fillStyle = '#d6dce3'; ctx.fillRect(archX, TOP, archW, archH); texto(ctx, 'Sin foto', W / 2, TOP + archH / 2, { size: 40, color: '#98a1ae', align: 'center' }); }
    ctx.restore();
    etiquetaNoDisponible(ctx, v, 70);

    let y = TOP + archH + 34;
    tLineas.forEach((l, i) => texto(ctx, l, W / 2, y + tSize * .9 + i * tLinea, { size: tSize, peso: 700, color: '#fff', align: 'center', tracking: -.3 }));
    y += tLineas.length * tLinea;
    if (v.proyecto) {
      const pr = v.proyecto.length > 40 ? v.proyecto.slice(0, 39) + '…' : v.proyecto;
      texto(ctx, pr, W / 2, y + 34, { size: 34, peso: 600, color: 'rgba(255,255,255,.92)', align: 'center' }); y += 52;
    }
    if (v.ubicacion) { await ubicacionConPin(ctx, o, v.ubicacion, W / 2, y + 34, '#ffffff', 'rgba(255,255,255,.85)', 32); y += 56; }
    y += 30;

    // Precio en píldora blanca.
    conSombra(ctx, 'rgba(0,0,0,.25)', 40, 14, () => { ctx.fillStyle = '#fff'; ruta(ctx, M, y, cardW, precioH, precioH / 2); ctx.fill(); });
    if (v.precios.length > 1) { ctx.fillStyle = '#e3e8ee'; ctx.fillRect(W / 2 - 1, y + 36, 2, precioH - 72); }
    ctx.save(); ctx.translate(0, 16);
    const n0 = v.precios.length;
    v.precios.forEach((p, i) => {
      const colW = cardW / n0, cx = M + colW * i + colW / 2;
      texto(ctx, p.etiqueta.toUpperCase(), cx, y + 36, { size: 22, peso: 500, color: '#7a8493', align: 'center', tracking: 3 });
      let size = n0 > 1 ? 56 : 76;
      while (size > 32 && medir(ctx, p.valor, size, 700, -1) + (p.sufijo ? 90 : 0) > colW - 60) size -= 2;
      const vw = medir(ctx, p.valor, size, 700, -1), sw = p.sufijo ? medir(ctx, p.sufijo, Math.max(26, size * .38), 500, 0) + 8 : 0;
      const x0 = cx - (vw + sw) / 2, yb = y + 36 + 16 + size * .86;
      texto(ctx, p.valor, x0, yb, { size, peso: 700, color: c.oscuro, tracking: -1 });
      if (p.sufijo) texto(ctx, p.sufijo, x0 + vw + 8, yb, { size: Math.max(26, size * .38), peso: 500, color: c.acento });
    });
    ctx.restore();
    y += precioH;

    // Datos en fila con ícono dentro de un círculo.
    if (statsH) {
      y += 30;
      const n = tarjetas.length, colW = cardW / n;
      for (let i = 0; i < n; i++) {
        const t = tarjetas[i], cx = M + colW * i + colW / 2;
        if (i > 0) { ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(M + colW * i, y + 16, 2, statsH - 32); }
        ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx - colW * .28, y + statsH / 2, 33, 0, Math.PI * 2); ctx.stroke();
        try { const ic = await cargarIcono(o.iconoSvg(t.icono, '#ffffff')); ctx.drawImage(ic, cx - colW * .28 - 17, y + statsH / 2 - 17, 34, 34); } catch (e) { /* sin ícono */ }
        const tx = cx - colW * .28 + 48, unidad = t.unidad ? ' ' + t.unidad : '';
        let size = 48;
        while (size > 26 && medir(ctx, t.valor + unidad, size, 700, -1) > colW * .62) size -= 2;
        texto(ctx, t.valor + unidad, tx, y + statsH / 2 + 2, { size, peso: 700, color: '#fff', tracking: -1 });
        texto(ctx, t.etiqueta, tx, y + statsH / 2 + 34, { size: 24, color: 'rgba(255,255,255,.8)' });
      }
      y += statsH;
    }

    // Píldoras con borde.
    if (pild.alto) {
      y += 28;
      pild.lista.forEach(p => {
        const px = M + p.x, py = y + p.fila * (pild.altura + 12);
        ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 2.5; ruta(ctx, px, py, p.w, pild.altura, pild.altura / 2); ctx.stroke();
        texto(ctx, p.t, px + p.w / 2, py + 40, { size: 27, peso: 500, color: '#fff', align: 'center' });
      });
    }
    pieMarca(ctx, c, 1856, 'rgba(255,255,255,.7)', '#ffffff');
    return aBlob(canvas);
  }

  /** Diseños disponibles (el panel arma el selector con esta lista). */
  const DISENOS = [
    { id: 'clasico', nombre: 'Clásico' },
    { id: 'foto',    nombre: 'Foto completa' },
    { id: 'marca',   nombre: 'Color de marca' }
  ];

  function generar(v, o) {
    o = o || {};
    if (o.diseno === 'foto') return generarFoto(v, o);
    if (o.diseno === 'marca') return generarMarca(v, o);
    return generarClasico(v, o);
  }

  return { generar, cargarFoto, DISENOS };
})();
