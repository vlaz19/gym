// =====================================================================
// progreso.js — Pantalla "Progreso": evolución por ejercicio e historial
// =====================================================================

let apartadoProgreso = 'ejercicios';
let ejercicioProgreso = null; // id del ejercicio seleccionado
let poleaProgreso = null;     // polea seleccionada (en ejercicios de polea)
const SIN_POLEA = 'Sin indicar';

function pintarProgreso(vista) {
  rellenar(vista, 
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
    .sort(porNombre);

  if (!conDatos.length) {
    return h('p', { class: 'vacio' }, 'Cuando guardes tu primer entreno, aquí verás tu evolución.');
  }
  if (!conDatos.some((e) => e.id === ejercicioProgreso)) ejercicioProgreso = conDatos[0].id;
  const ej = buscarEjercicio(ejercicioProgreso);

  // En MP apuntas el peso de un lado: aquí se muestra el total cargado (×2)
  const factor = ej.mp ? 2 : 1;

  // Cada vez que hiciste este ejercicio, con su peso máximo y la polea usada
  const todas = sesionesOrdenadas().flatMap((s) => {
    const e = s.ejercicios.find((x) => x.ejercicioId === ej.id);
    if (!e) return [];
    const series = e.series.map((x) => ({ ...x, peso: x.peso * factor }));
    return [{
      fecha: s.fecha,
      polea: e.polea || SIN_POLEA,
      series,
      maximo: Math.max(...series.map((x) => x.peso)),
    }];
  });

  // En ejercicios de polea, cada polea tiene su propio progreso
  const opcionesPolea = [...new Set(todas.map((x) => x.polea))]
    .sort((a, b) => (POLEAS.indexOf(a) + 1 || 99) - (POLEAS.indexOf(b) + 1 || 99));
  const usaPoleas = opcionesPolea.some((p) => p !== SIN_POLEA);
  if (usaPoleas && !opcionesPolea.includes(poleaProgreso)) poleaProgreso = opcionesPolea[0];
  const historial = usaPoleas ? todas.filter((x) => x.polea === poleaProgreso) : todas;
  const poleaActual = usaPoleas && POLEAS.includes(poleaProgreso) ? poleaProgreso : undefined;

  const record = Math.max(...historial.map((x) => x.maximo));
  const mejora = historial.at(-1).maximo - historial[0].maximo;

  const selector = h('select', { 'aria-label': 'Ejercicio' },
    conDatos.map((e) => h('option', { value: e.id, selected: e.id === ej.id }, e.nombre)));
  selector.addEventListener('change', () => { ejercicioProgreso = selector.value; repintar(); });

  return h('div', {},
    selector,
    usaPoleas && h('div', { style: 'margin-top: 12px' },
      segmentos(opcionesPolea.map((p) => [p, p]), poleaProgreso, (p) => { poleaProgreso = p; repintar(); })),
    ej.mp && h('p', { class: 'nota' }, 'Ejercicio en MP: se muestra el peso total cargado (el doble del peso por lado que apuntas).'),
    h('div', { class: 'cifras' },
      cifra(ej.mp ? 'Peso actual (total)' : 'Peso actual', `${formatearNumero(pesoActual(ej, poleaActual) * factor)} kg`),
      cifra('Récord', `${formatearNumero(record)} kg`),
      cifra('Mejora', `${conSigno(mejora)} kg`),
      cifra('Sesiones', historial.length)),
    h('h2', {}, 'Peso máximo por sesión'),
    h('div', { class: 'grafica', html: graficaLinea(historial.map((x) => ({ fecha: x.fecha, valor: x.maximo }))) }),
    h('h2', {}, 'Historial (kg × repes)'),
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
          h('div', { class: 'titulo' }, s.nombreDia || 'Entreno'),
          h('div', { class: 'detalle' }, formatearFecha(s.fecha, { weekday: 'long', day: 'numeric', month: 'long' }))),
        h('div', { class: 'detalle fecha' }, `${s.ejercicios.length} ejercicio${s.ejercicios.length === 1 ? '' : 's'}`)),
      h('div', { class: 'contenido-desplegable' },
        s.ejercicios.map((e) =>
          h('div', {},
            h('div', { class: 'titulo' }, e.nombre, e.polea && h('span', { class: 'etiqueta suave' }, e.polea)),
            h('div', { class: 'detalle' }, resumenSeries(e.series)))),
        h('button', { class: 'boton peligro pequeno', onclick: () => borrarSesion(s) }, 'Borrar este entreno')))));
}

async function borrarSesion(sesion) {
  if (!confirm('¿Borrar este entreno? No se puede deshacer.')) return;
  estado.sesiones = estado.sesiones.filter((s) => s.id !== sesion.id);
  await guardar('sesiones');
  repintar();
}
