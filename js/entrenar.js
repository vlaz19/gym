// =====================================================================
// entrenar.js — Pantalla "Entrenar": registrar la sesión de hoy
// =====================================================================

function pintarEntrenar(vista) {
  if (estado.borrador) pintarSesionEnCurso(vista);
  else pintarEleccionDia(vista);
}

// ---------- 1) Elegir qué día se entrena ----------

// El día que "toca": el siguiente al último entrenado (saltando días vacíos)
function diaSugerido() {
  const ultima = sesionesOrdenadas().at(-1);
  const inicio = ultima ? ultima.dia + 1 : 0;
  for (let k = 0; k < NUM_DIAS; k++) {
    const d = (inicio + k) % NUM_DIAS;
    if (estado.dias[d].length) return d;
  }
  return -1;
}

function pintarEleccionDia(vista) {
  const sugerido = diaSugerido();

  vista.replaceChildren(
    h('h1', {}, 'Entrenar'),
    h('p', { class: 'subtitulo' }, '¿Qué día toca hoy?'),
    avisoCopia(),
    h('div', { class: 'lista' }, estado.dias.map((ids, i) => {
      const nombres = ids.map((id) => buscarEjercicio(id)?.nombre).filter(Boolean);
      const ultima = sesionesOrdenadas().filter((s) => s.dia === i).at(-1);
      return h('button', {
        class: 'fila' + (i === sugerido ? ' sugerida' : ''),
        disabled: nombres.length === 0,
        onclick: () => empezarSesion(i),
      },
        h('div', {},
          h('div', { class: 'titulo' }, `Día ${i + 1}`, i === sugerido && h('span', { class: 'etiqueta' }, 'Toca')),
          h('div', { class: 'detalle recortar' }, nombres.length ? nombres.join(' · ') : 'Sin ejercicios: añádelos en Rutina')),
        h('div', { class: 'detalle' }, ultima ? formatearFecha(ultima.fecha, { day: 'numeric', month: 'short' }) : ''));
    })),
  );
}

async function empezarSesion(dia) {
  const ejercicios = estado.dias[dia].map(buscarEjercicio).filter(Boolean);
  estado.borrador = {
    dia,
    fecha: hoyISO(),
    ejercicios: ejercicios.map((ej) => ({
      ejercicioId: ej.id,
      nombre: ej.nombre,
      // Se preparan las series del objetivo con el peso actual ya puesto
      series: Array.from({ length: ej.series || 3 }, () => ({ peso: numATexto(ej.peso), reps: '' })),
    })),
  };
  await guardar('borrador');
  repintar();
  window.scrollTo(0, 0);
}

// ---------- 2) Entreno en curso ----------

function guardarBorrador() {
  guardar('borrador').catch(console.error);
}

function pintarSesionEnCurso(vista) {
  const b = estado.borrador;
  const fecha = h('input', { type: 'date', value: b.fecha });
  fecha.addEventListener('change', () => { b.fecha = fecha.value || hoyISO(); guardarBorrador(); });

  vista.replaceChildren(
    h('h1', {}, `Día ${b.dia + 1}`),
    campo('Fecha', fecha),
    h('h2', {}, 'Ejercicios'),
    h('div', { class: 'lista' }, b.ejercicios.map(tarjetaEjercicioSesion)),
    h('div', { class: 'acciones' },
      h('button', { class: 'boton', onclick: terminarSesion }, 'Terminar y guardar'),
      h('button', { class: 'boton peligro', onclick: descartarSesion }, 'Descartar entreno')),
  );
}

function tarjetaEjercicioSesion(item) {
  const ej = buscarEjercicio(item.ejercicioId);
  const anterior = ultimaVezDe(item.ejercicioId);
  const contenedor = h('div', { class: 'series' });

  function pintarSeries() {
    contenedor.replaceChildren(
      h('div', { class: 'serie titulos' }, h('span'), h('span', {}, 'Kg'), h('span', {}, 'Reps'), h('span')),
      ...item.series.map((serie, i) => filaSerie(item, serie, i, anterior?.series[i], ej, pintarSeries)));
  }
  pintarSeries();

  return h('div', { class: 'tarjeta ejercicio-sesion' },
    h('div', { class: 'cabecera' },
      h('div', { class: 'titulo' }, item.nombre),
      ej && h('div', { class: 'detalle' }, describirObjetivo(ej))),
    anterior && h('div', { class: 'detalle' }, 'Última vez: ' + resumenSeries(anterior.series)),
    contenedor,
    h('button', {
      class: 'boton fantasma pequeno',
      onclick: () => {
        const ultima = item.series.at(-1);
        item.series.push({ peso: ultima?.peso ?? numATexto(ej?.peso), reps: '' });
        guardarBorrador();
        pintarSeries();
      },
    }, '+ Serie'));
}

function filaSerie(item, serie, i, serieAnterior, ej, alCambiar) {
  const peso = h('input', {
    type: 'text', inputmode: 'decimal', value: serie.peso,
    placeholder: 'kg', 'aria-label': `Kg de la serie ${i + 1}`,
  });
  const reps = h('input', {
    type: 'text', inputmode: 'numeric', pattern: '[0-9]*', value: serie.reps,
    placeholder: serieAnterior ? String(serieAnterior.reps) : (ej?.reps || 'reps'),
    'aria-label': `Repeticiones de la serie ${i + 1}`,
  });

  // Cada cambio se guarda al instante en el borrador
  peso.addEventListener('input', () => { serie.peso = peso.value; guardarBorrador(); });
  reps.addEventListener('input', () => { serie.reps = reps.value; guardarBorrador(); });

  return h('div', { class: 'serie' },
    h('span', { class: 'num' }, i + 1),
    peso,
    reps,
    h('button', {
      class: 'boton-icono', 'aria-label': `Quitar serie ${i + 1}`, html: ICONOS.cerrar,
      onclick: () => { item.series.splice(i, 1); guardarBorrador(); alCambiar(); },
    }));
}

// ---------- 3) Terminar o descartar ----------

async function terminarSesion() {
  const b = estado.borrador;

  // Solo cuentan las series con repeticiones apuntadas
  const ejercicios = b.ejercicios
    .map((item) => ({
      ejercicioId: item.ejercicioId,
      nombre: item.nombre,
      series: item.series
        .map((s) => ({ peso: leerNumero(s.peso) ?? 0, reps: parseInt(s.reps, 10) }))
        .filter((s) => s.reps > 0),
    }))
    .filter((e) => e.series.length > 0);

  if (!ejercicios.length) {
    avisar('Apunta las repeticiones de al menos una serie');
    return;
  }

  estado.sesiones.push({ id: crearId(), dia: b.dia, fecha: b.fecha, creada: Date.now(), ejercicios });

  // Si hoy has levantado más que tu peso actual, el peso actual sube
  const subidas = [];
  for (const e of ejercicios) {
    const ej = buscarEjercicio(e.ejercicioId);
    const maximo = Math.max(...e.series.map((s) => s.peso));
    if (ej && maximo > (ej.peso ?? 0)) {
      ej.peso = maximo;
      subidas.push(`${ej.nombre} ${formatearNumero(maximo)} kg`);
    }
  }

  estado.borrador = null;
  await guardar('sesiones', 'ejercicios', 'borrador');
  avisar(subidas.length ? `¡Guardado! Nuevo peso: ${subidas.join(', ')} 💪` : '¡Entreno guardado! 💪');
  repintar();
  window.scrollTo(0, 0);
}

async function descartarSesion() {
  if (!confirm('¿Descartar este entreno? Se perderá lo que has apuntado.')) return;
  estado.borrador = null;
  await guardar('borrador');
  repintar();
}
