// =====================================================================
// progreso.js — Pantalla "Progreso": evolución por ejercicio e historial
// =====================================================================

let apartadoProgreso = 'ejercicios';
let ejercicioProgreso = null; // id del ejercicio seleccionado

function pintarProgreso(vista) {
  vista.replaceChildren(
    h('h1', {}, 'Progreso'),
    segmentos([['ejercicios', 'Ejercicios'], ['sesiones', 'Sesiones']], apartadoProgreso,
      (valor) => { apartadoProgreso = valor; repintar(); }),
    apartadoProgreso === 'ejercicios' ? progresoEjercicios() : historialSesiones(),
  );
}

// ---------- Evolución de un ejercicio ----------

function progresoEjercicios() {
  const conDatos = estado.ejercicios
    .filter((ej) => estado.sesiones.some((s) => s.ejercicios.some((e) => e.ejercicioId === ej.id)))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  if (!conDatos.length) {
    return h('p', { class: 'vacio' }, 'Cuando guardes tu primer entreno, aquí verás tu evolución.');
  }
  if (!conDatos.some((e) => e.id === ejercicioProgreso)) ejercicioProgreso = conDatos[0].id;
  const ej = buscarEjercicio(ejercicioProgreso);

  // Cada vez que hiciste este ejercicio, con su peso máximo
  const historial = sesionesOrdenadas().flatMap((s) => {
    const e = s.ejercicios.find((x) => x.ejercicioId === ej.id);
    return e ? [{ fecha: s.fecha, series: e.series, maximo: Math.max(...e.series.map((x) => x.peso)) }] : [];
  });
  const record = Math.max(...historial.map((x) => x.maximo));
  const mejora = historial.at(-1).maximo - historial[0].maximo;

  const selector = h('select', { 'aria-label': 'Ejercicio' },
    conDatos.map((e) => h('option', { value: e.id, selected: e.id === ej.id }, e.nombre)));
  selector.addEventListener('change', () => { ejercicioProgreso = selector.value; repintar(); });

  return h('div', {},
    selector,
    h('div', { class: 'cifras' },
      cifra('Peso actual', `${formatearNumero(ej.peso)} kg`),
      cifra('Récord', `${formatearNumero(record)} kg`),
      cifra('Mejora', `${conSigno(mejora)} kg`),
      cifra('Sesiones', historial.length)),
    h('h2', {}, 'Peso máximo por sesión'),
    h('div', { class: 'grafica', html: graficaLinea(historial.map((x) => ({ fecha: x.fecha, valor: x.maximo }))) }),
    h('h2', {}, 'Historial (kg × reps)'),
    h('div', { class: 'lista' }, historial.slice().reverse().map((x) =>
      h('div', { class: 'fila' },
        h('div', {},
          h('div', { class: 'titulo' }, formatearFecha(x.fecha)),
          h('div', { class: 'detalle' }, resumenSeries(x.series))),
        h('div', { class: 'valor' }, `${formatearNumero(x.maximo)} kg`)))),
  );
}

// ---------- Historial de entrenos ----------

function historialSesiones() {
  const lista = sesionesOrdenadas().reverse();
  if (!lista.length) return h('p', { class: 'vacio' }, 'Todavía no has guardado ningún entreno.');

  return h('div', { class: 'lista' }, lista.map((s) =>
    h('details', { class: 'desplegable' },
      h('summary', { class: 'fila' },
        h('div', {},
          h('div', { class: 'titulo' }, `Día ${s.dia + 1}`),
          h('div', { class: 'detalle' }, formatearFecha(s.fecha, { weekday: 'long', day: 'numeric', month: 'long' }))),
        h('div', { class: 'detalle' }, `${s.ejercicios.length} ejercicio${s.ejercicios.length === 1 ? '' : 's'}`)),
      h('div', { class: 'contenido-desplegable' },
        s.ejercicios.map((e) =>
          h('div', {},
            h('div', { class: 'titulo' }, e.nombre),
            h('div', { class: 'detalle' }, resumenSeries(e.series)))),
        h('button', { class: 'boton peligro pequeno', onclick: () => borrarSesion(s) }, 'Borrar este entreno')))));
}

async function borrarSesion(sesion) {
  if (!confirm('¿Borrar este entreno? No se puede deshacer.')) return;
  estado.sesiones = estado.sesiones.filter((s) => s.id !== sesion.id);
  await guardar('sesiones');
  repintar();
}
