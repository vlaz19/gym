// =====================================================================
// rutina.js — Pantalla "Rutina": días de entreno y banco de ejercicios
// =====================================================================

let apartadoRutina = 'dias'; // 'dias' o 'banco'
let diaAbierto = null;       // id del día que se está viendo (null = lista de días)

function pintarRutina(vista) {
  const dia = diaAbierto && buscarDia(diaAbierto);
  if (dia) {
    pintarDia(vista, dia);
    return;
  }
  diaAbierto = null;
  rellenar(vista, 
    h('h1', {}, 'Rutina'),
    segmentos([['dias', 'Días'], ['banco', 'Banco de ejercicios']], apartadoRutina,
      (valor) => { apartadoRutina = valor; repintar(); }),
    apartadoRutina === 'dias' ? listaDias() : bancoEjercicios(),
  );
}

// ---------- Lista de días ----------

function listaDias() {
  return h('div', {},
    estado.dias.length
      ? h('div', { class: 'lista' }, estado.dias.map((dia) => {
          const nombres = dia.ejercicios.map(buscarEjercicio).filter(Boolean).map((e) => e.nombre);
          return h('button', { class: 'fila', onclick: () => abrirDia(dia) },
            h('div', {},
              h('div', { class: 'titulo' }, dia.nombre),
              h('div', { class: 'detalle' }, nombres.length ? nombres.join(' · ') : 'Sin ejercicios')),
            h('span', { class: 'flecha', html: ICONOS.flecha }));
        }))
      : h('p', { class: 'vacio' }, 'Aún no tienes días de entreno.'),
    h('div', { class: 'acciones' },
      h('button', { class: 'boton fantasma', onclick: () => editarDia(null) }, '+ Añadir día')),
  );
}

function abrirDia(dia) {
  diaAbierto = dia.id;
  repintar();
  irArriba();
}

// ---------- Un día concreto ----------

function pintarDia(vista, dia) {
  const ejercicios = dia.ejercicios.map(buscarEjercicio).filter(Boolean);
  rellenar(vista, 
    h('button', { class: 'volver', onclick: () => { diaAbierto = null; repintar(); } }, '‹ Rutina'),
    h('div', { class: 'cabecera-vista' },
      h('h1', {}, dia.nombre),
      h('button', { class: 'boton secundario pequeno', onclick: () => editarDia(dia) }, 'Editar día')),
    ejercicios.length
      ? h('div', { class: 'lista' }, ejercicios.map((ej) => filaEjercicio(ej, () => editarEjercicio(ej, dia))))
      : h('p', { class: 'vacio' }, 'Este día aún no tiene ejercicios.'),
    h('div', { class: 'acciones' },
      h('button', { class: 'boton fantasma', onclick: () => anadirAlDia(dia) }, '+ Añadir ejercicio')),
  );
}

function filaEjercicio(ej, alTocar) {
  return h('button', { class: 'fila', onclick: alTocar },
    h('div', {},
      h('div', { class: 'titulo' }, ej.nombre, etiquetasEjercicio(ej)),
      h('div', { class: 'detalle' }, describirObjetivo(ej))),
    h('div', { class: 'valor' }, describirPeso(ej)));
}

// Crear (dia = null) o editar un día: nombre, orden y borrar
function editarDia(dia) {
  const esNuevo = !dia;
  const nombre = h('input', { type: 'text', value: dia?.nombre, placeholder: 'Ej.: Pecho espalda', autocapitalize: 'sentences' });
  const posicion = esNuevo ? -1 : estado.dias.indexOf(dia);

  abrirHoja(esNuevo ? 'Nuevo día' : 'Editar día',
    h('div', { class: 'campos' }, campo('Nombre', nombre)),
    h('div', { class: 'acciones' },
      h('button', { class: 'boton', onclick: guardarDia }, 'Guardar'),
      !esNuevo && estado.dias.length > 1 && h('div', { class: 'acciones-fila' },
        h('button', { class: 'boton secundario pequeno', disabled: posicion === 0, onclick: () => moverDia(-1) }, '↑ Subir'),
        h('button', { class: 'boton secundario pequeno', disabled: posicion === estado.dias.length - 1, onclick: () => moverDia(1) }, '↓ Bajar')),
      !esNuevo && h('button', { class: 'boton peligro', onclick: borrarDia }, 'Borrar día')),
  );

  async function guardarDia() {
    const texto = nombre.value.trim();
    if (!texto) { nombre.focus(); return; }
    if (esNuevo) {
      const nuevo = { id: crearId(), nombre: texto, ejercicios: [] };
      estado.dias.push(nuevo);
      diaAbierto = nuevo.id;
    } else {
      dia.nombre = texto;
      // Los entrenos pasados de este día también muestran el nombre nuevo
      estado.sesiones.forEach((s) => { if (s.diaId === dia.id) s.nombreDia = texto; });
    }
    await guardar('dias', 'sesiones');
    cerrarHoja();
    repintar();
  }

  async function moverDia(direccion) {
    const i = estado.dias.indexOf(dia);
    const j = i + direccion;
    [estado.dias[i], estado.dias[j]] = [estado.dias[j], estado.dias[i]];
    await guardar('dias');
    cerrarHoja();
    repintar();
  }

  async function borrarDia() {
    if (!confirm(`¿Borrar "${dia.nombre}"? Sus ejercicios siguen en el banco y tus entrenos pasados se conservan.`)) return;
    estado.dias = estado.dias.filter((d) => d.id !== dia.id);
    diaAbierto = null;
    await guardar('dias');
    cerrarHoja();
    repintar();
  }
}

// Añadir a un día ejercicios del banco (o crear uno nuevo)
function anadirAlDia(dia) {
  const lista = h('div', { class: 'lista' });

  function pintarLista() {
    const disponibles = estado.ejercicios.filter((e) => !dia.ejercicios.includes(e.id)).sort(porNombre);
    rellenar(lista, ...(disponibles.length
      ? disponibles.map((ej) => h('button', {
          class: 'fila compacta',
          onclick: async () => {
            dia.ejercicios.push(ej.id);
            await guardar('dias');
            avisar(`${ej.nombre} añadido`);
            pintarLista();
            repintar();
          },
        },
          h('div', {},
            h('div', { class: 'titulo' }, ej.nombre),
            h('div', { class: 'detalle' }, describirObjetivo(ej))),
          h('span', { class: 'flecha', html: ICONOS.mas })))
      : [h('p', { class: 'nota' }, estado.ejercicios.length
          ? 'Todos los ejercicios del banco ya están en este día.'
          : 'Tu banco de ejercicios está vacío: crea el primero.')]));
  }
  pintarLista();

  abrirHoja(`Añadir a ${dia.nombre}`,
    h('button', { class: 'boton', onclick: () => editarEjercicio(null, dia) }, '+ Crear ejercicio nuevo'),
    h('h2', {}, 'Desde el banco de ejercicios'),
    lista,
  );
}

// ---------- Banco de ejercicios ----------

function bancoEjercicios() {
  const ejercicios = [...estado.ejercicios].sort(porNombre);
  return h('div', {},
    ejercicios.length
      ? h('div', { class: 'lista' }, ejercicios.map((ej) => {
          const dias = estado.dias.filter((d) => d.ejercicios.includes(ej.id)).map((d) => d.nombre);
          return h('button', { class: 'fila', onclick: () => editarEjercicio(ej) },
            h('div', {},
              h('div', { class: 'titulo' }, ej.nombre, etiquetasEjercicio(ej)),
              h('div', { class: 'detalle' }, dias.length ? dias.join(' · ') : 'No está en ningún día')),
            h('div', { class: 'valor' }, describirPeso(ej)));
        }))
      : h('p', { class: 'vacio' }, 'Tu banco está vacío. Los ejercicios que crees aparecerán aquí.'),
    h('div', { class: 'acciones' },
      h('button', { class: 'boton fantasma', onclick: () => editarEjercicio(null) }, '+ Nuevo ejercicio')),
  );
}

// ---------- Ficha de un ejercicio ----------
// ej = null para crear uno nuevo. dia = día desde el que se edita (o null si es desde el banco).
function editarEjercicio(ej, dia = null) {
  const esNuevo = !ej;
  const base = ej ?? { series: POR_DEFECTO.series, reps: POR_DEFECTO.reps, descanso: POR_DEFECTO.descanso, polea: false };

  const nombre = h('input', { type: 'text', value: base.nombre, placeholder: 'Ej.: Press banca', autocomplete: 'off', autocapitalize: 'sentences' });
  const peso = h('input', { type: 'text', inputmode: 'decimal', value: numATexto(base.peso), placeholder: '0' });
  const pesosPolea = Object.fromEntries(POLEAS.map((p) => [p,
    h('input', { type: 'text', inputmode: 'decimal', value: ej ? numATexto(pesoActual(ej, p)) : '', placeholder: '0' })]));
  const series = h('input', { type: 'text', inputmode: 'numeric', value: base.series, placeholder: String(POR_DEFECTO.series) });
  const reps = h('input', { type: 'text', value: base.reps, placeholder: POR_DEFECTO.reps });
  const descanso = h('select', {},
    DESCANSOS.map((s) => h('option', { value: s, selected: s === (base.descanso ?? 0) }, formatearDescanso(s))));
  const esPolea = h('input', { type: 'checkbox', class: 'interruptor', checked: !!base.polea });
  const esMp = h('input', { type: 'checkbox', class: 'interruptor', checked: !!base.mp });

  // Los campos de peso cambian según sea o no de polea
  const camposPeso = h('div');
  function pintarCamposPeso() {
    rellenar(camposPeso, esPolea.checked
      ? h('div', { class: 'campos-fila' }, POLEAS.map((p) => campo(`Peso ${p} (kg)`, pesosPolea[p])))
      : campo(esMp.checked ? 'Peso actual por lado (kg)' : 'Peso actual (kg)', peso));
  }
  esPolea.addEventListener('change', () => {
    if (esPolea.checked) {
      POLEAS.forEach((p) => { if (!pesosPolea[p].value) pesosPolea[p].value = peso.value; });
    } else if (!peso.value) {
      peso.value = pesosPolea[POLEAS[0]].value;
    }
    pintarCamposPeso();
  });
  esMp.addEventListener('change', pintarCamposPeso);
  pintarCamposPeso();

  const enDias = ej ? estado.dias.filter((d) => d.ejercicios.includes(ej.id)) : [];
  const listaDia = dia?.ejercicios ?? [];
  const posicion = ej ? listaDia.indexOf(ej.id) : -1;

  abrirHoja(esNuevo ? 'Nuevo ejercicio' : 'Editar ejercicio',
    h('div', { class: 'campos' },
      campo('Nombre', nombre),
      h('label', { class: 'campo-interruptor' }, h('span', {}, 'Es en polea'), esPolea),
      h('label', { class: 'campo-interruptor' },
        h('span', {}, 'Es en MP', h('small', { class: 'detalle bloque' }, 'Apuntas el peso de un lado; en Progreso se ve el total (×2)')),
        esMp),
      camposPeso,
      h('div', { class: 'campos-fila' }, campo('Series', series), campo('Repes', reps)),
      campo('Descanso entre series', descanso)),
    enDias.length > 1 && h('p', { class: 'nota' },
      `Está en: ${enDias.map((d) => d.nombre).join(', ')}. Los cambios se aplican en todos.`),
    h('div', { class: 'acciones' },
      h('button', { class: 'boton', onclick: guardarCambios }, 'Guardar'),
      dia && !esNuevo && listaDia.length > 1 && h('div', { class: 'acciones-fila' },
        h('button', { class: 'boton secundario pequeno', disabled: posicion === 0, onclick: () => mover(-1) }, '↑ Subir'),
        h('button', { class: 'boton secundario pequeno', disabled: posicion === listaDia.length - 1, onclick: () => mover(1) }, '↓ Bajar')),
      dia && !esNuevo && h('button', { class: 'boton peligro', onclick: quitarDelDia }, `Quitar de ${dia.nombre}`),
      !dia && !esNuevo && h('button', { class: 'boton peligro', onclick: eliminarDelBanco }, 'Eliminar del banco')),
  );

  async function guardarCambios() {
    const texto = nombre.value.trim();
    if (!texto) { nombre.focus(); return; }
    const repetido = estado.ejercicios.find((e) => e.id !== ej?.id && e.nombre.toLowerCase() === texto.toLowerCase());
    if (repetido) {
      avisar('Ya hay un ejercicio con ese nombre en el banco');
      return;
    }

    const destino = ej ?? { id: crearId() };
    Object.assign(destino, {
      nombre: texto,
      polea: esPolea.checked,
      mp: esMp.checked,
      series: parseInt(series.value, 10) || null,
      reps: reps.value.trim(),
      descanso: Number(descanso.value) || 0,
    });
    if (esPolea.checked) {
      destino.pesos = Object.fromEntries(POLEAS.map((p) => [p, leerNumero(pesosPolea[p].value) ?? 0]));
    } else {
      destino.peso = leerNumero(peso.value) ?? 0;
    }

    if (esNuevo) {
      estado.ejercicios.push(destino);
      if (dia) dia.ejercicios.push(destino.id);
    }
    await guardar('ejercicios', 'dias');
    cerrarHoja();
    repintar();
  }

  async function mover(direccion) {
    const i = listaDia.indexOf(ej.id);
    const j = i + direccion;
    [listaDia[i], listaDia[j]] = [listaDia[j], listaDia[i]];
    await guardar('dias');
    cerrarHoja();
    repintar();
  }

  async function quitarDelDia() {
    if (!confirm(`¿Quitar "${ej.nombre}" de ${dia.nombre}? Sigue en el banco y su historial se conserva.`)) return;
    dia.ejercicios = dia.ejercicios.filter((id) => id !== ej.id);
    await guardar('dias');
    cerrarHoja();
    repintar();
  }

  async function eliminarDelBanco() {
    if (!confirm(`¿Eliminar "${ej.nombre}" del banco? Se quitará de todos los días. Tus entrenos pasados se conservan en el historial.`)) return;
    estado.ejercicios = estado.ejercicios.filter((e) => e.id !== ej.id);
    estado.dias.forEach((d) => { d.ejercicios = d.ejercicios.filter((id) => id !== ej.id); });
    await guardar('ejercicios', 'dias');
    cerrarHoja();
    repintar();
  }
}
