/**
 * vista.js — DATOS DE LA FICHA LISTOS PARA DIBUJAR (copiado de lc-mira/ficha → js/ficha.js)
 * ============================================================================================
 * El panel usa esto para armar la imagen de estados (js/imagen.js) y el mensaje de WhatsApp.
 * Es la MISMA lógica que usaba la ficha pública (precios, tarjetas, comodidades por palabras
 * clave, forma de pago), para que la imagen se vea igual que siempre.
 *
 * Diferencias con la ficha:
 *  - Recibe un inmueble del panel (S.inm.filas[i]); solo se leen los campos públicos.
 *  - El link del mensaje es el del inmueble en el CATÁLOGO del agente titular del panel.
 *
 * API:  FichaVista.construirVista(inm)        → vista pública para FichaImagen.generar
 *       FichaVista.colores(hex)               → {acento, oscuro, claro, suave}
 *       FichaVista.iconoSvg(nombre, color)    → SVG suelto para el canvas
 *       FichaVista.mensaje(inm, link)         → texto para WhatsApp (datos + link)
 */

'use strict';

window.FichaVista = (function () {

  function norm(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  }

  function aNumero(v) {
    const limpio = String(v || '').replace(/[^\d]/g, '');
    return limpio ? parseInt(limpio, 10) : 0;
  }

  function pesos(n) { return '$' + Number(n).toLocaleString('es-CO'); }

  /** Hay dato útil: no vacío y no "0". */
  function hayNum(v) { return !!v && !/^0+([.,]0+)?$/.test(String(v).trim()); }

  function esCasa(tipo) {
    const t = norm(tipo);
    return t === 'casa independiente' || t === 'casa en conjunto';
  }

  function esSi(v) { return ['si', 'true', '1', 'con ascensor'].includes(norm(v)); }

  function formaPago(credito) {
    const c = norm(credito);
    if (!c) return '';
    if (c === 'si') return 'Aplica crédito';
    if (c === 'no') return 'Solo contado';
    if (c.includes('subsidio')) return 'Aplica subsidio';
    return 'Forma de pago por revisar';
  }

  /** Singular/plural simple: plural(2,'baño') → "2 baños". */
  function plural(n, palabra) { return n + ' ' + palabra + (Number(n) === 1 ? '' : 's'); }

  /** Parqueadero en una línea: "Privado · 2 plazas". Devuelve '' si no tiene. */
  function parqueaderoTexto(inm) {
    const tipo = String(inm.parqueadero || '').trim();
    if (/^(0|no)/i.test(tipo)) return '';
    const n = aNumero(inm.plazas);
    if (/^\d+$/.test(tipo)) return plural(tipo, 'parqueadero');   // dato antiguo: solo un número
    const partes = [];
    if (tipo) partes.push(tipo);
    if (n > 0) partes.push(n + (n === 1 ? ' plaza' : ' plazas'));
    return partes.join(' · ');
  }

  /**
   * "Barrio, Ciudad" sin repetir la ciudad si el barrio ya la trae (ej. "Ciudad Córdoba, Cali")
   * y sin inventar una ciudad por defecto (hay inmuebles en Cali, Palmira, Jamundí…).
   * OJO: functions/_lib/inmueble.js (ubicacionTexto) usa la misma lógica.
   */
  function ubicacionTexto(inm) {
    const partes = [];
    if (inm.barrio) partes.push(inm.barrio);
    if (inm.ciudad && !norm(inm.barrio).includes(norm(inm.ciudad))) partes.push(inm.ciudad);
    return partes.join(', ');
  }

  function hexARgb(hex) {
    let h = String(hex || '').trim().replace('#', '');
    if (h.length === 3) h = h.split('').map(x => x + x).join('');
    if (!/^[0-9a-f]{6}$/i.test(h)) return null;
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
  }
  /** Mezcla "hex" con "con" (otro hex); pct = cuánto de "con" (0–1). */
  function mezclar(hex, con, pct) {
    const a = hexARgb(hex), b = hexARgb(con);
    return '#' + a.map((x, i) => Math.round(x * (1 - pct) + b[i] * pct).toString(16).padStart(2, '0')).join('');
  }
  const COLORES = { acento: '#0f5b4f', oscuro: '#0b443b', claro: '#578c84', suave: '#e7efed' };

  const IC_RUTAS = {
    web:     '<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z"/>',
    telefono:'<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
    area:    '<path d="M4 9V4h5"/><path d="M20 15v5h-5"/><path d="M4 4l6 6"/><path d="M20 20l-6-6"/>',
    cama:    '<path d="M3 18V6"/><path d="M3 14h18v4"/><path d="M21 14v-2a3 3 0 0 0-3-3h-7v5"/><circle cx="7" cy="11" r="1.6"/>',
    bano:    '<path d="M4 12h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-2z"/><path d="M6 12V6a2 2 0 0 1 3.5-1.3"/><path d="M7 19l-1 2M17 19l1 2"/>',
    carro:   '<path d="M5 16v-5l1.6-4a2 2 0 0 1 1.9-1.3h7a2 2 0 0 1 1.9 1.3L19 11v5"/><rect x="3.5" y="11" width="17" height="5.5" rx="1.5"/><path d="M6 16.5V19M18 16.5V19"/><circle cx="7.5" cy="13.7" r=".7"/><circle cx="16.5" cy="13.7" r=".7"/>',
    estrato: '<path d="M12 4l8 4-8 4-8-4 8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 16l8 4 8-4"/>',
    piso:    '<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M10.5 20.5v-3.5h3v3.5"/>',
    admin:   '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v10"/><path d="M14.7 9.4c-.5-.8-1.5-1.2-2.7-1.2-1.6 0-2.6.8-2.6 1.9 0 2.7 5.3 1.3 5.3 4 0 1.2-1.1 2-2.8 2-1.3 0-2.3-.5-2.9-1.3"/>',
    ascensor:'<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M12 3.5v17"/><path d="M8.5 10l1.5-2 1.5 2"/><path d="M12.5 14l1.5 2 1.5-2"/>',
    credito: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h4"/>',
    pin:     '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    piscina: '<path d="M8 4v10M15 4v10"/><path d="M8 7h7M8 10.5h7"/><path d="M3 17c1.5 0 1.5 1.2 3 1.2S7.5 17 9 17s1.5 1.2 3 1.2 1.5-1.2 3-1.2 1.5 1.2 3 1.2 1.5-1.2 3-1.2"/>',
    gimnasio: '<path d="M6.5 8v8M17.5 8v8M3.5 10v4M20.5 10v4M6.5 12h11"/>',
    bbq: '<path d="M4 11h16a8 8 0 0 1-16 0z"/><path d="M8 20l1.5-4M16 20l-1.5-4"/><path d="M9 3c-1 1.3 1 2 0 3.5M13 3c-1 1.3 1 2 0 3.5"/>',
    social: '<circle cx="8" cy="8" r="2.5"/><circle cx="16" cy="8" r="2.5"/><path d="M3.5 19c0-3 2-5 4.5-5s4.5 2 4.5 5"/><path d="M12 19c0-3 1.7-5 4-5s4.5 2 4.5 5"/>',
    juegos: '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5c3 3 3 14 0 17M3.5 12c3-3 14-3 17 0"/>',
    vigilancia: '<path d="M12 3l7 3v5c0 4.6-3 8-7 10-4-2-7-5.4-7-10V6l7-3z"/><path d="M9 12l2.2 2.2L15.5 10"/>',
    cerrado: '<rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5"/>',
    verde: '<circle cx="12" cy="9" r="5.5"/><path d="M12 14.5V21M9.5 21h5"/>',
    balcon: '<path d="M7 11V5h10v6"/><path d="M4 11h16"/><path d="M5 11v8M9.5 11v8M14.5 11v8M19 11v8"/><path d="M4 19h16"/>',
    terraza: '<path d="M3.5 12a8.5 8.5 0 0 1 17 0z"/><path d="M12 12v8"/><path d="M12 20h-2.5"/>',
    cocina: '<path d="M5 10h14v7a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-7z"/><path d="M3 10h18M9 6c-.8-1 .8-1.5 0-2.5M13 6c-.8-1 .8-1.5 0-2.5"/>',
    patio: '<path d="M12 21v-8"/><path d="M12 13c0-4 2.5-6 6-6 0 4-2 6-6 6z"/><path d="M12 15c0-3-2-5-5-5 0 3 1.8 5 5 5z"/>',
    vista: '<path d="M3 19l6-10 4 6 2.5-4L21 19H3z"/><circle cx="17" cy="6" r="1.6"/>',
    closet: '<rect x="5" y="3.5" width="14" height="17" rx="1.5"/><path d="M12 3.5v17M9.5 12v2M14.5 12v2"/>',
    estudio: '<path d="M4 5.5c3-1 5.5-.8 8 1 2.5-1.8 5-2 8-1v13c-3-1-5.5-.8-8 1-2.5-1.8-5-2-8-1v-13z"/><path d="M12 6.5v13"/>',
    gas: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5.3 1.5 1 2 1.8 2.3C11 8 11 5.5 12 3z"/>',
    deposito: '<path d="M3.5 8l8.5-4.5L20.5 8v8.5L12 21l-8.5-4.5V8z"/><path d="M3.5 8L12 12.5 20.5 8M12 12.5V21"/>',
    lavanderia: '<rect x="4.5" y="3.5" width="15" height="17" rx="2"/><circle cx="12" cy="13" r="4"/><path d="M8 7h.01M11 7h.01"/>',
    amoblado: '<path d="M5 11V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v3"/><path d="M3.5 11a1.5 1.5 0 0 1 3 0v3h11v-3a1.5 1.5 0 0 1 3 0v6h-17v-6z"/><path d="M6 17v2M18 17v2"/>',
    mascota: '<circle cx="7" cy="10" r="1.7"/><circle cx="11" cy="6.5" r="1.7"/><circle cx="15.5" cy="7" r="1.7"/><circle cx="18.5" cy="11" r="1.7"/><path d="M8 17c0-3 2-5 4-5s5 2 4.5 5c-.4 2-2 2-4.5 1-2.5 1-4.5 1-4-1z"/>',
  };

  /** SVG suelto con color fijo, para dibujarlo en el canvas de js/imagen.js. */
  function iconoSvg(nombre, color) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96" viewBox="0 0 24 24" fill="none" stroke="' + color
      + '" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">' + (IC_RUTAS[nombre] || '') + '</svg>';
  }

  const COMODIDADES = [
    ['piscina',    'Piscina',            /\b(piscina|pisc|zona humeda|turco|sauna)\b/],
    ['gimnasio',   'Gimnasio',           /\b(gimnasio|gym|zona de ejercicio)\b/],
    ['vigilancia', null,                 /\b(vigilancia|porteria|seguridad|celaduria|portero)\b/],
    ['balcon',     'Balcón',             /\bbalcon(es)?\b/],
    ['ascensor',   'Con ascensor',       /\b(ascensor(es)?|elevador)\b/],
    ['bbq',        'Zona BBQ',           /\b(bbq|b\.b\.q|asadero|zona de asados|parrilla)\b/],
    ['social',     'Salón social',       /\b(salon(es)? social(es)?|salon(es)? comunal(es)?|zona social)\b/],
    ['juegos',     'Zona infantil',      /\b(juegos infantiles|zona infantil|parque infantil|zona de juegos|ludoteca)\b/],
    ['terraza',    'Terraza',            /\bterraza(s)?\b/],
    ['cocina',     'Cocina integral',    /\bcocina (semi)?integral\b|\bcocina abierta\b/],
    ['vista',      'Buena vista',        /\b(vista|panoramic[oa])\b/],
    ['cerrado',    'Conjunto cerrado',   /\b(conjunto|unidad|urbanizacion) cerrad[oa]\b/],
    ['verde',      'Zonas verdes',       /\b(zonas? verdes?|jardines|parques?(?! infantil))\b/],
    ['patio',      'Patio',              /\bpatio\b(?! de ropas)/],
    ['closet',     'Closets',            /\b(closets?|vestier|armarios? empotrados?)\b/],
    ['estudio',    'Estudio',            /\b(cuarto|sala|zona) de estudio\b|\bestudio\b(?! de)/],
    ['gas',        'Gas natural',        /\bgas (natural|domiciliario)\b/],
    ['deposito',   'Depósito',           /\b(deposito|cuarto util)\b/],
    ['lavanderia', 'Zona de ropas',      /\b(lavanderia|zona de ropas|zona de lavado|patio de ropas)\b/],
    ['amoblado',   'Amoblado',           /\b(amoblad[oa]|amueblad[oa])\b/],
    ['mascota',    'Mascotas permitidas',/\b(mascotas|pet ?friendly)\b/],
  ];
  const NEGACION = /\b(sin|no tiene|no cuenta con|no hay|no incluye|carece de|no se permiten?|no permite|no acepta)\b/;

  /** Detecta comodidades en la descripción, ignorando las negadas ("sin piscina"). */
  function comodidadesDeTexto(texto) {
    const t = norm(texto || '');
    if (!t) return [];
    const out = [];
    COMODIDADES.forEach(([icono, etiqueta, re]) => {
      const g = new RegExp(re.source, 'g');
      let m, ok = false;
      while ((m = g.exec(t))) {
        // Solo se mira la frase corta anterior (hasta coma, punto, "con" o "pero").
        let previo = t.slice(Math.max(0, m.index - 40), m.index);
        previo = previo.split(/[.,;:\n]|\bcon\b|\bpero\b/).pop();
        if (!NEGACION.test(previo)) { ok = true; break; }
      }
      if (!ok) return;
      let texto2 = etiqueta;
      if (icono === 'vigilancia') texto2 = /(vigilancia|porteria|seguridad|celaduria)[^.,;]{0,20}(24|veinticuatro)/.test(t) ? 'Vigilancia 24 h' : 'Vigilancia';
      out.push({ icono, texto: texto2, com: true });
    });
    return out;
  }

  function construirVista(inm) {
    const precio = aNumero(inm.precio);
    const canon  = aNumero(inm.canon);
    const srv = norm(inm.servicio);
    const enVenta = srv.includes('venta'), enArr = srv.includes('arriendo');
    const cuando = enVenta && enArr ? ' en venta y arriendo' : enArr ? ' en arriendo' : enVenta ? ' en venta' : '';

    // Precios: venta, arriendo o ambos
    const precios = [];
    if (precio) precios.push({ etiqueta: canon ? 'Venta' : 'Precio de venta', valor: pesos(precio), sufijo: '' });
    if (canon)  precios.push({ etiqueta: precio ? 'Arriendo' : 'Canon de arriendo', valor: pesos(canon), sufijo: '/mes' });
    if (!precios.length) precios.push({ etiqueta: 'Precio', valor: 'Consultar', sufijo: '' });

    // Tarjetas de datos (la página las desliza; la imagen usa las 3 primeras)
    const tarjetas = [];
    const conPrivada = hayNum(inm.areaPrivada);   // solo se aclara "construida" si también hay área privada
    if (hayNum(inm.area))         tarjetas.push({ icono: 'area',  etiqueta: conPrivada ? 'Área construida' : 'Área', valor: inm.area, unidad: 'm²' });
    if (hayNum(inm.habitaciones)) tarjetas.push({ icono: 'cama',  etiqueta: 'Alcobas',  valor: inm.habitaciones });
    if (hayNum(inm.banos))        tarjetas.push({ icono: 'bano',  etiqueta: 'Baños',    valor: inm.banos });
    if (conPrivada)               tarjetas.push({ icono: 'area',  etiqueta: 'Área privada', valor: inm.areaPrivada, unidad: 'm²', pildora: 'Área privada ' + inm.areaPrivada + ' m²' });
    const parq = parqueaderoTexto(inm);
    if (parq) {
      const n = aNumero(inm.plazas);
      tarjetas.push({
        icono: 'carro', etiqueta: 'Parqueadero' + (n > 0 && /^(comunitario|privado)/i.test(inm.parqueadero) ? ' ' + String(inm.parqueadero).toLowerCase() : ''),
        valor: n > 0 ? String(n) : parq, unidad: n > 0 ? (n === 1 ? 'plaza' : 'plazas') : '',
        pildora: n > 0 ? plural(n, 'parqueadero') + (/^(comunitario|privado)/i.test(inm.parqueadero) ? ' ' + String(inm.parqueadero).toLowerCase() + (n === 1 ? '' : 's') : '')
                       : (/^\d+$/.test(inm.parqueadero) ? plural(inm.parqueadero, 'parqueadero') : 'Parqueadero ' + String(inm.parqueadero).toLowerCase()),
      });
    }
    if (hayNum(inm.estrato)) tarjetas.push({ icono: 'estrato', etiqueta: 'Estrato', valor: inm.estrato, pildora: 'Estrato ' + inm.estrato });
    if (hayNum(inm.piso)) {
      const casa = esCasa(inm.tipo);
      tarjetas.push({ icono: 'piso', etiqueta: casa ? 'Niveles' : 'Piso', valor: inm.piso, pildora: (casa ? 'Niveles: ' : 'Piso ') + inm.piso });
    }
    const admin = aNumero(inm.administracion);
    if (admin) tarjetas.push({ icono: 'admin', etiqueta: 'Administración', valor: pesos(admin), unidad: '/mes', pildora: 'Administración ' + pesos(admin) + '/mes' });

    // Detalles cualitativos (círculos con ícono)
    const detalles = [];
    const pago = formaPago(inm.credito);
    if (pago) detalles.push({ icono: 'credito', texto: pago });
    if (esSi(inm.ascensor)) detalles.push({ icono: 'ascensor', texto: 'Con ascensor' });
    // Comodidades que aparecen en la descripción (sin repetir lo que ya hay; máximo 8 en total)
    comodidadesDeTexto(inm.observaciones).forEach(c => {
      if (detalles.length < 8 && !detalles.some(d => d.icono === c.icono)) detalles.push(c);
    });

    return {
      titulo: (inm.tipo || 'Inmueble') + cuando,
      proyecto: inm.proyecto || '',
      ubicacion: ubicacionTexto(inm),
      precios, tarjetas, detalles,
      descripcion: inm.observaciones || '',
      noDisponible: inm.estado && !/disponible/i.test(inm.estado) ? inm.estado : '',
    };
  }

  /** Un solo color de acento; el resto se deriva (igual que la ficha). */
  function colores(hex) {
    const base = hexARgb(hex) ? hex : '#0f5b4f';
    return {
      acento: base,
      oscuro: mezclar(base, '#000000', .25),
      claro:  mezclar(base, '#ffffff', .30),
      suave:  mezclar(base, '#ffffff', .90),
    };
  }

  /**
   * Mensaje listo para pegar en WhatsApp. Solo usa datos públicos.
   * @param {Object} inm   inmueble del panel
   * @param {string} link  link al inmueble en el catálogo del agente
   */
  function mensaje(inm, link) {
    const precio = aNumero(inm.precio);
    const canon  = aNumero(inm.canon);
    const srv = norm(inm.servicio);
    const enVenta = srv.includes('venta'), enArr = srv.includes('arriendo');
    const cuando = enVenta && enArr ? ' en venta y arriendo' : enArr ? ' en arriendo' : enVenta ? ' en venta' : '';

    const lineas = [];
    if (precio) lineas.push('Precio de venta: ' + pesos(precio));
    if (canon)  lineas.push((precio ? 'Precio de arriendo: ' : 'Canon de arriendo: ') + pesos(canon) + '/mes');
    if (hayNum(inm.areaPrivada)) {
      if (hayNum(inm.area)) lineas.push('Área construida: ' + inm.area + ' m²');
      lineas.push('Área privada: ' + inm.areaPrivada + ' m²');
    } else if (hayNum(inm.area)) lineas.push(inm.area + ' m²');
    if (hayNum(inm.habitaciones)) lineas.push(plural(inm.habitaciones, 'alcoba'));
    if (hayNum(inm.banos))        lineas.push(plural(inm.banos, 'baño'));
    const parqTxt = parqueaderoTexto(inm);
    if (parqTxt) lineas.push('Parqueadero: ' + parqTxt);
    if (hayNum(inm.estrato)) lineas.push('Estrato: ' + inm.estrato);

    const donde = ubicacionTexto(inm);
    const titulo = (inm.tipo || 'Inmueble') + cuando + (donde ? ' · ' + donde : '');
    return '*' + titulo + '*\n'
      + lineas.map(l => '• ' + l).join('\n')
      + '\n• Más información y fotos:\n'
      + link;
  }

  return { construirVista, colores, iconoSvg, mensaje };
})();
