// =====================================================================
// rutina.js — Pantalla "Rutina": ejercicios planificados de Día 1 a Día 5
// =====================================================================

let diaRutina = 0; // día que se está viendo (0 = Día 1)

function pintarRutina(vista) {
  const ejercicios = estado.dias[diaRutina].map(buscarEjercicio).filter(Boolean);
  const opcionesDias = estado.dias.map((_, i) => [i, `Día ${i + 1}`]);

  vista.replaceChildren(
    h('h1', {}, 'Rutina'),
    segmentos(opcionesDias, diaRutina, (i) => { diaRutina = i; repintar(); }),
    ejercicios.length
      ? h('div', { class: 'lista' }, ejercicios.map(filaEjercicioRutina))
      : h('p', { class: 'vacio' }, `Aún no hay ejercicios en el Día ${diaRutina + 1}.`),
    h('div', { class: 'acciones' },
      h('button', { class: 'boton fantasma', onclick: () => editarEjercicio(null) }, '+ Añadir ejercicio')),
  );
}

function filaEjercicioRutina(ej) {
  return h('button', { class: 'fila', onclick: () => editarEjercicio(ej) },
    h('div', {},
      h('div', { class: 'titulo' }, ej.nombre),
      h('div', { class: 'detalle' }, describirObjetivo(ej))),
    h('div', { class: 'valor' }, `${formatearNumero(ej.peso)} kg`));
}

// Busca un ejercicio del catálogo por su nombre (sin importar mayúsculas)
function ejercicioPorNombre(nombre) {
  const buscado = nombre.trim().toLowerCase();
  return estado.ejercicios.find((e) => e.nombre.toLowerCase() === buscado);
}

// Abre la ventana para crear (ej = null) o editar un ejercicio
function editarEjercicio(ej) {
  const esNuevo = !ej;
  const listaDia = estado.dias[diaRutina];

  const nombre = h('input', {
    type: 'text', value: ej?.nombre, placeholder: 'Ej.: Press banca',
    list: 'catalogo', autocomplete: 'off', autocapitalize: 'sentences',
  });
  const peso = h('input', { type: 'text', inputmode: 'decimal', value: numATexto(ej?.peso), placeholder: '0' });
  const series = h('input', { type: 'text', inputmode: 'numeric', value: ej?.series, placeholder: '3' });
  const reps = h('input', { type: 'text', value: ej?.reps, placeholder: '8-12' });

  // Sugerencias: ejercicios que ya existen y no están en este día
  const catalogo = h('datalist', { id: 'catalogo' },
    estado.ejercicios
      .filter((e) => !listaDia.includes(e.id))
      .map((e) => h('option', { value: e.nombre })));

  // Si eliges un ejercicio que ya existía, se rellenan sus datos
  if (esNuevo) {
    nombre.addEventListener('change', () => {
      const existente = ejercicioPorNombre(nombre.value);
      if (!existente) return;
      peso.value = numATexto(existente.peso);
      series.value = existente.series ?? '';
      reps.value = existente.reps ?? '';
    });
  }

  const enOtrosDias = !esNuevo && estado.dias.filter((d) => d.includes(ej.id)).length > 1;
  const posicion = esNuevo ? -1 : listaDia.indexOf(ej.id);

  abrirHoja(esNuevo ? `Nuevo ejercicio · Día ${diaRutina + 1}` : 'Editar ejercicio',
    h('div', { class: 'campos' },
      campo('Nombre', nombre),
      catalogo,
      campo('Peso actual (kg)', peso),
      h('div', { class: 'campos-fila' }, campo('Series', series), campo('Repeticiones', reps))),
    enOtrosDias && h('p', { class: 'nota' }, 'Este ejercicio está también en otros días: los cambios se aplican en todos.'),
    h('div', { class: 'acciones' },
      h('button', { class: 'boton', onclick: guardarCambios }, 'Guardar'),
      !esNuevo && listaDia.length > 1 && h('div', { class: 'acciones-fila' },
        h('button', { class: 'boton secundario pequeno', disabled: posicion === 0, onclick: () => mover(-1) }, '↑ Subir'),
        h('button', { class: 'boton secundario pequeno', disabled: posicion === listaDia.length - 1, onclick: () => mover(1) }, '↓ Bajar')),
      !esNuevo && h('button', { class: 'boton peligro', onclick: quitarDelDia }, `Quitar del Día ${diaRutina + 1}`)),
  );

  async function guardarCambios() {
    const datos = {
      nombre: nombre.value.trim(),
      peso: leerNumero(peso.value) ?? 0,
      series: parseInt(series.value, 10) || null,
      reps: reps.value.trim(),
    };
    if (!datos.nombre) { nombre.focus(); return; }

    let destino = ej;
    if (esNuevo) {
      destino = ejercicioPorNombre(datos.nombre);
      if (destino && listaDia.includes(destino.id)) {
        avisar('Ese ejercicio ya está en este día');
        return;
      }
      if (!destino) {
        destino = { id: crearId() };
        estado.ejercicios.push(destino);
      }
      listaDia.push(destino.id);
    }
    Object.assign(destino, datos);
    await guardar('ejercicios', 'dias');
    cerrarHoja();
    repintar();
  }

  async function mover(direccion) {
    const i = listaDia.indexOf(ej.id);
    const j = i + direccion;
    if (j < 0 || j >= listaDia.length) return;
    [listaDia[i], listaDia[j]] = [listaDia[j], listaDia[i]];
    await guardar('dias');
    cerrarHoja();
    repintar();
  }

  async function quitarDelDia() {
    if (!confirm(`¿Quitar "${ej.nombre}" del Día ${diaRutina + 1}? Su historial se conserva.`)) return;
    estado.dias[diaRutina] = listaDia.filter((id) => id !== ej.id);
    await guardar('dias');
    cerrarHoja();
    repintar();
  }
}
