// =====================================================================
// app.js — Estado de la app, utilidades comunes y navegación
// =====================================================================

const NUM_DIAS = 5;

// ===== Estado: la copia en memoria de todos tus datos =====
function estadoInicial() {
  return {
    ejercicios: [],   // catálogo: { id, nombre, peso, series, reps }
    dias: Array.from({ length: NUM_DIAS }, () => []), // ids de los ejercicios de cada día
    sesiones: [],     // entrenos terminados: { id, dia, fecha, creada, ejercicios: [...] }
    pesoCorporal: [], // { id, fecha, kg }
    borrador: null,   // entreno en curso (se guarda mientras entrenas)
    ultimaCopia: null, // momento (en ms) de la última copia de seguridad
  };
}

const estado = estadoInicial();

// Lee del móvil todo lo guardado
async function cargarEstado() {
  for (const clave of Object.keys(estado)) {
    const valor = await DB.leer(clave);
    if (valor !== undefined) estado[clave] = valor;
  }
}

// Guarda en el móvil las partes del estado indicadas, p. ej. guardar('ejercicios', 'dias')
function guardar(...claves) {
  return Promise.all(claves.map((clave) => DB.escribir(clave, estado[clave])));
}

// ===== Utilidades =====
function crearId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

// Fecha de hoy en formato AAAA-MM-DD (en tu zona horaria)
function hoyISO() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function aFecha(iso) {
  return new Date(iso + 'T12:00:00');
}

function formatearFecha(iso, opciones = { day: 'numeric', month: 'short', year: 'numeric' }) {
  return aFecha(iso).toLocaleDateString('es-ES', opciones);
}

// Convierte lo que escribes ("62,5" o "62.5") en un número
function leerNumero(texto) {
  const n = parseFloat(String(texto ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// 62.5 -> "62,5" (para mostrar)
function formatearNumero(n) {
  return n == null ? '–' : n.toLocaleString('es-ES', { maximumFractionDigits: 2 });
}

// 62.5 -> "62,5" (para poner dentro de un campo de texto)
function numATexto(n) {
  return n == null || n === '' ? '' : String(n).replace('.', ',');
}

function conSigno(n) {
  if (n > 0) return '+' + formatearNumero(n);
  if (n < 0) return '−' + formatearNumero(-n);
  return '0';
}

function buscarEjercicio(id) {
  return estado.ejercicios.find((e) => e.id === id);
}

function describirObjetivo(ej) {
  if (!ej.series && !ej.reps) return 'Sin series definidas';
  return `${ej.series || '–'} series × ${ej.reps || '–'} reps`;
}

// [{peso: 60, reps: 10}, ...] -> "60×10 · 60×8"
function resumenSeries(series) {
  return series.map((s) => `${formatearNumero(s.peso)}×${s.reps}`).join(' · ');
}

// Entrenos ordenados del más antiguo al más reciente
function sesionesOrdenadas() {
  return [...estado.sesiones].sort((a, b) => a.fecha.localeCompare(b.fecha) || a.creada - b.creada);
}

// Lo que hiciste la última vez en un ejercicio (o undefined si nunca)
function ultimaVezDe(ejercicioId) {
  return sesionesOrdenadas()
    .reverse()
    .map((s) => s.ejercicios.find((e) => e.ejercicioId === ejercicioId))
    .find(Boolean);
}

// ===== Recordatorio de copia de seguridad =====
const DIAS_RECORDATORIO_COPIA = 14;

// Días desde la última copia (o desde el primer entreno, si nunca has hecho una)
function diasSinCopia() {
  if (!estado.sesiones.length) return 0;
  const referencia = estado.ultimaCopia ?? Math.min(...estado.sesiones.map((s) => s.creada));
  return Math.floor((Date.now() - referencia) / 864e5);
}

// Aviso que aparece si toca hacer copia (o nada si no toca)
function avisoCopia() {
  const dias = diasSinCopia();
  if (dias < DIAS_RECORDATORIO_COPIA) return null;
  return h('div', { class: 'recordatorio' },
    h('div', {},
      h('div', { class: 'titulo' }, 'Haz una copia de seguridad'),
      h('div', { class: 'detalle' }, estado.ultimaCopia
        ? `Tu última copia es de hace ${dias} días.`
        : 'Aún no has guardado ninguna copia de tus datos.')),
    h('button', { class: 'boton pequeno', onclick: exportarCopia }, 'Hacer copia'));
}

// ===== Crear elementos de la página =====
// h('button', { class: 'boton', onclick: fn }, 'Guardar')  ->  <button class="boton">Guardar</button>
function h(etiqueta, props = {}, ...hijos) {
  const nodo = document.createElement(etiqueta);
  for (const [clave, valor] of Object.entries(props)) {
    if (valor == null || valor === false) continue;
    if (clave.startsWith('on')) nodo.addEventListener(clave.slice(2), valor);
    else if (clave === 'class') nodo.className = valor;
    else if (clave === 'html') nodo.innerHTML = valor; // solo para iconos y gráficas propias
    else nodo.setAttribute(clave, valor === true ? '' : valor);
  }
  for (const hijo of hijos.flat(Infinity)) {
    if (hijo != null && hijo !== false) nodo.append(hijo);
  }
  return nodo;
}

function campo(etiqueta, control) {
  return h('label', { class: 'campo' }, h('span', {}, etiqueta), control);
}

function cifra(etiqueta, valor) {
  return h('div', { class: 'cifra' }, h('b', {}, valor), h('span', {}, etiqueta));
}

// Selector de opciones: segmentos([['a', 'Opción A'], ['b', 'Opción B']], 'a', alCambiar)
function segmentos(opciones, activo, alCambiar) {
  return h('div', { class: 'segmentos' },
    opciones.map(([valor, texto]) =>
      h('button', { class: valor === activo ? 'activo' : null, onclick: () => alCambiar(valor) }, texto)));
}

const ICONOS = {
  cerrar: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  papelera: '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>',
};

// ===== Gráfica de línea (dibujada a mano en SVG, sin librerías) =====
// puntos: [{ fecha: '2026-11-04', valor: 60 }, ...]
function graficaLinea(puntos) {
  if (puntos.length < 2) {
    return '<p class="grafica-vacia">Con dos o más registros aparecerá aquí la gráfica.</p>';
  }
  const ancho = 340, alto = 180;
  const m = { izq: 38, der: 12, arr: 12, aba: 26 }; // márgenes

  const tiempos = puntos.map((p) => aFecha(p.fecha).getTime());
  const valores = puntos.map((p) => p.valor);
  let tMin = Math.min(...tiempos), tMax = Math.max(...tiempos);
  if (tMin === tMax) { tMin -= 864e5; tMax += 864e5; }
  let vMin = Math.min(...valores), vMax = Math.max(...valores);
  const holgura = (vMax - vMin) * 0.15 || 1;
  vMin -= holgura; vMax += holgura;

  const x = (t) => m.izq + ((t - tMin) / (tMax - tMin)) * (ancho - m.izq - m.der);
  const y = (v) => m.arr + (1 - (v - vMin) / (vMax - vMin)) * (alto - m.arr - m.aba);
  const coords = puntos.map((p, i) => [x(tiempos[i]).toFixed(1), y(p.valor).toFixed(1)]);

  const linea = coords.map(([cx, cy], i) => `${i ? 'L' : 'M'}${cx},${cy}`).join('');
  const base = alto - m.aba;
  const area = `${linea}L${coords.at(-1)[0]},${base}L${coords[0][0]},${base}Z`;

  const guias = [0, 0.5, 1].map((f) => {
    const v = vMin + (vMax - vMin) * f;
    const gy = y(v).toFixed(1);
    return `<line class="guia" x1="${m.izq}" x2="${ancho - m.der}" y1="${gy}" y2="${gy}"/>` +
           `<text x="${m.izq - 6}" y="${+gy + 3.5}" text-anchor="end">${formatearNumero(Math.round(v * 10) / 10)}</text>`;
  }).join('');

  const corta = { day: 'numeric', month: 'short' };
  const fechas =
    `<text x="${m.izq}" y="${alto - 6}">${formatearFecha(puntos[0].fecha, corta)}</text>` +
    `<text x="${ancho - m.der}" y="${alto - 6}" text-anchor="end">${formatearFecha(puntos.at(-1).fecha, corta)}</text>`;

  const circulos = puntos.length <= 40
    ? coords.map(([cx, cy]) => `<circle cx="${cx}" cy="${cy}" r="3"/>`).join('')
    : '';

  return `<svg viewBox="0 0 ${ancho} ${alto}" role="img" aria-label="Gráfica de evolución">
    <defs><linearGradient id="relleno" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" style="stop-color: var(--acento); stop-opacity: 0.22"/>
      <stop offset="1" style="stop-color: var(--acento); stop-opacity: 0"/>
    </linearGradient></defs>
    ${guias}<path d="${area}" fill="url(#relleno)"/><path class="linea" d="${linea}"/>${circulos}${fechas}
  </svg>`;
}

// ===== Ventana emergente =====
const hoja = document.getElementById('hoja');

function abrirHoja(titulo, ...contenido) {
  hoja.replaceChildren(
    h('div', { class: 'hoja-cabecera' },
      h('h3', {}, titulo),
      h('button', { class: 'boton-icono', 'aria-label': 'Cerrar', html: ICONOS.cerrar, onclick: cerrarHoja })),
    ...contenido);
  hoja.showModal();
}

function cerrarHoja() {
  hoja.close();
}

// Tocar fuera de la ventana la cierra
hoja.addEventListener('click', (evento) => {
  const r = hoja.getBoundingClientRect();
  const fuera = evento.clientX < r.left || evento.clientX > r.right ||
                evento.clientY < r.top || evento.clientY > r.bottom;
  if (fuera) cerrarHoja();
});

// ===== Avisos cortos =====
let temporizadorAviso;
function avisar(texto) {
  const aviso = document.getElementById('aviso');
  aviso.textContent = texto;
  aviso.classList.add('visible');
  clearTimeout(temporizadorAviso);
  temporizadorAviso = setTimeout(() => aviso.classList.remove('visible'), 3200);
}

// ===== Navegación entre pestañas =====
let vistaActual = 'rutina';

function pintores() {
  return { rutina: pintarRutina, entrenar: pintarEntrenar, progreso: pintarProgreso, personal: pintarPersonal };
}

function mostrarVista(nombre) {
  vistaActual = nombre;
  for (const id of Object.keys(pintores())) {
    document.getElementById('vista-' + id).hidden = id !== nombre;
  }
  document.querySelectorAll('.barra button').forEach((b) => {
    b.classList.toggle('activo', b.dataset.vista === nombre);
  });
  repintar();
  window.scrollTo(0, 0);
}

// Vuelve a dibujar la pantalla actual (tras guardar algo)
function repintar() {
  pintores()[vistaActual](document.getElementById('vista-' + vistaActual));
}

// ===== Arranque =====
async function iniciar() {
  try {
    await cargarEstado();
  } catch (error) {
    console.error(error);
    avisar('No se pudieron cargar tus datos');
  }

  // Pide al navegador que no borre los datos de la app
  navigator.storage?.persist?.();

  document.querySelectorAll('.barra button').forEach((b) => {
    b.addEventListener('click', () => mostrarVista(b.dataset.vista));
  });

  // Si dejaste un entreno a medias, vuelve directamente a él
  mostrarVista(estado.borrador ? 'entrenar' : 'rutina');

  // Permite que la app funcione sin internet (ver sw.js)
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch(console.error);
  }
}

document.addEventListener('DOMContentLoaded', iniciar);
