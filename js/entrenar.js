// =====================================================================
// entrenar.js — Pantalla "Entrenar": registrar la sesión de hoy
// =====================================================================

function pintarEntrenar(vista) {
  if (estado.borrador) pintarSesionEnCurso(vista);
  else pintarEleccionDia(vista);
}

// ---------- 1) Elegir qué día se entrena ----------

// El día que "toca": el siguiente al último entrenado (saltando días sin ejercicios)
function diaSugerido() {
  const ultima = sesionesOrdenadas().at(-1);
  const i = ultima ? estado.dias.findIndex((d) => d.id === ultima.diaId) : -1;
  for (let k = 1; k <= estado.dias.length; k++) {
    const dia = estado.dias[(i + k) % estado.dias.length];
    if (dia.ejercicios.length) return dia.id;
  }
  return null;
}

function pintarEleccionDia(vista) {
  const sugerido = diaSugerido();

  rellenar(vista, 
    h('h1', {}, 'Entrenar'),
    h('p', { class: 'subtitulo' }, '¿Qué día toca hoy?'),
    avisoCopia(),
    estado.dias.length
      ? h('div', { class: 'lista' }, estado.dias.map((dia) => {
          const nombres = dia.ejercicios.map(buscarEjercicio).filter(Boolean).map((e) => e.nombre);
          const ultima = sesionesOrdenadas().filter((s) => s.diaId === dia.id).at(-1);
          return h('button', {
            class: 'fila' + (dia.id === sugerido ? ' sugerida' : ''),
            disabled: nombres.length === 0,
            onclick: () => empezarSesion(dia),
          },
            h('div', {},
              h('div', { class: 'titulo' }, dia.nombre, dia.id === sugerido && h('span', { class: 'etiqueta' }, 'Toca')),
              h('div', { class: 'detalle' }, nombres.length ? nombres.join(' · ') : 'Sin ejercicios: añádelos en Rutina')),
            ultima && h('div', { class: 'detalle fecha' }, formatearFecha(ultima.fecha, { day: 'numeric', month: 'short' })));
        }))
      : h('p', { class: 'vacio' }, 'Crea tus días de entreno en la pestaña Rutina.'),
  );
}

async function empezarSesion(dia) {
  estado.borrador = {
    diaId: dia.id,
    nombreDia: dia.nombre,
    fecha: hoyISO(),
    temporizador: null,
    ejercicios: dia.ejercicios.map(buscarEjercicio).filter(Boolean).map((ej) => {
      // En poleas, se empieza con la última polea que usaste en este ejercicio
      const polea = ej.polea ? (ultimaVezDe(ej.id)?.polea ?? POLEAS[0]) : null;
      return {
        ejercicioId: ej.id,
        nombre: ej.nombre,
        polea,
        // Se preparan las series del objetivo con el peso actual ya puesto
        series: Array.from({ length: ej.series || POR_DEFECTO.series },
          () => ({ peso: numATexto(pesoActual(ej, polea)), reps: '' })),
      };
    }),
  };
  await guardar('borrador');
  repintar();
  irArriba();
}

// ---------- 2) Entreno en curso ----------

function guardarBorrador() {
  guardar('borrador').catch(console.error);
}

function pintarSesionEnCurso(vista) {
  const b = estado.borrador;
  const fecha = h('input', { type: 'date', value: b.fecha });
  fecha.addEventListener('change', () => { b.fecha = fecha.value || hoyISO(); guardarBorrador(); });

  rellenar(vista, 
    h('h1', {}, b.nombreDia),
    campo('Fecha', fecha),
    h('h2', {}, 'Ejercicios'),
    h('div', { class: 'lista' }, b.ejercicios.map(tarjetaEjercicioSesion)),
    h('div', { class: 'acciones' },
      h('button', { class: 'boton', onclick: terminarSesion }, 'Terminar y guardar'),
      h('button', { class: 'boton peligro', onclick: descartarSesion }, 'Descartar entreno')),
  );
}

function tarjetaEjercicioSesion(item) {
  const tarjeta = h('div', { class: 'tarjeta ejercicio-sesion' });

  function pintar() {
    const ej = buscarEjercicio(item.ejercicioId);
    const anterior = ultimaVezDe(item.ejercicioId, item.polea || undefined);
    rellenar(tarjeta, 
      h('div', { class: 'cabecera' },
        h('div', { class: 'titulo' }, item.nombre, ej && etiquetasEjercicio(ej)),
        ej && h('div', { class: 'detalle' }, describirObjetivo(ej))),
      item.polea && segmentos(POLEAS.map((p) => [p, p]), item.polea, cambiarPolea),
      anterior && h('div', { class: 'detalle' }, 'Última vez: ' + resumenSeries(anterior.series)),
      h('div', { class: 'series' },
        h('div', { class: 'serie titulos' }, h('span'), h('span', {}, ej?.mp ? 'Kg/lado' : 'Kg'), h('span', {}, 'Repes'), h('span'), h('span')),
        ...item.series.map((serie, i) => filaSerie(item, serie, i, anterior?.series[i], ej, pintar))),
      h('button', {
        class: 'boton fantasma pequeno',
        onclick: () => {
          const ultima = item.series.at(-1);
          item.series.push({ peso: ultima?.peso ?? numATexto(pesoActual(ej, item.polea)), reps: '' });
          guardarBorrador();
          pintar();
        },
      }, '+ Serie'),
    );
  }

  // Al cambiar de polea, las series aún sin hacer cogen el peso de la polea elegida
  function cambiarPolea(polea) {
    const ej = buscarEjercicio(item.ejercicioId);
    const pesoAntes = numATexto(pesoActual(ej, item.polea));
    const pesoNuevo = numATexto(pesoActual(ej, polea));
    item.polea = polea;
    for (const serie of item.series) {
      if (!serie.reps && (serie.peso === pesoAntes || serie.peso === '')) serie.peso = pesoNuevo;
    }
    guardarBorrador();
    pintar();
  }

  pintar();
  return tarjeta;
}

function filaSerie(item, serie, i, serieAnterior, ej, alCambiar) {
  const peso = h('input', {
    type: 'text', inputmode: 'decimal', value: serie.peso,
    placeholder: 'kg', 'aria-label': `Kg de la serie ${i + 1}`,
  });
  const reps = h('input', {
    type: 'text', inputmode: 'numeric', pattern: '[0-9]*', value: serie.reps,
    placeholder: serieAnterior ? String(serieAnterior.reps) : (ej?.reps || 'repes'),
    'aria-label': `Repes de la serie ${i + 1}`,
  });

  // Botón de descanso: aparece cuando apuntas las repes de la serie
  const segundos = ej?.descanso || 0;
  const botonDescanso = segundos
    ? h('button', {
        class: 'boton-icono descanso' + (serie.reps ? ' listo' : ''),
        'aria-label': `Iniciar descanso de ${mmss(segundos)}`,
        html: ICONOS.reloj,
        onclick: () => iniciarTemporizador(segundos, item.nombre),
      })
    : h('span');

  // Cada cambio se guarda al instante en el borrador
  peso.addEventListener('input', () => { serie.peso = peso.value; guardarBorrador(); });
  reps.addEventListener('input', () => {
    serie.reps = reps.value;
    botonDescanso.classList.toggle('listo', reps.value.trim() !== '');
    guardarBorrador();
  });

  return h('div', { class: 'serie' },
    h('span', { class: 'num' }, i + 1),
    peso,
    reps,
    botonDescanso,
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
      ...(item.polea ? { polea: item.polea } : {}),
      series: item.series
        .map((s) => ({ peso: leerNumero(s.peso) ?? 0, reps: parseInt(s.reps, 10) }))
        .filter((s) => s.reps > 0),
    }))
    .filter((e) => e.series.length > 0);

  if (!ejercicios.length) {
    avisar('Apunta las repes de al menos una serie');
    return;
  }

  estado.sesiones.push({
    id: crearId(), diaId: b.diaId, nombreDia: b.nombreDia, fecha: b.fecha, creada: Date.now(), ejercicios,
  });

  // Si hoy has levantado más que tu peso actual, el peso actual sube (en poleas, el de esa polea)
  const subidas = [];
  for (const e of ejercicios) {
    const ej = buscarEjercicio(e.ejercicioId);
    const maximo = Math.max(...e.series.map((s) => s.peso));
    if (!ej || maximo <= pesoActual(ej, e.polea)) continue;
    if (ej.polea && e.polea) ej.pesos = { ...ej.pesos, [e.polea]: maximo };
    else ej.peso = maximo;
    subidas.push(`${ej.nombre}${e.polea ? ` (${e.polea})` : ''} ${formatearNumero(maximo)} kg`);
  }

  estado.borrador = null;
  await guardar('sesiones', 'ejercicios', 'borrador');
  pintarTemporizador();
  avisar(subidas.length ? `¡Guardado! Nuevo peso: ${subidas.join(', ')} 💪` : '¡Entreno guardado! 💪');
  repintar();
  irArriba();
}

async function descartarSesion() {
  if (!confirm('¿Descartar este entreno? Se perderá lo que has apuntado.')) return;
  estado.borrador = null;
  await guardar('borrador');
  pintarTemporizador();
  repintar();
}
