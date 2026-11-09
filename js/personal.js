// =====================================================================
// personal.js — Pantalla "Personal": peso corporal, fotos y copias
// =====================================================================

let fotosCargadas = null; // las fotos se leen del móvil la primera vez que entras

async function pintarPersonal(vista) {
  if (!fotosCargadas) {
    try { fotosCargadas = await DB.fotos(); } catch { fotosCargadas = []; }
  }
  if (vistaActual !== 'personal') return; // cambiaste de pestaña mientras cargaba

  vista.replaceChildren(
    h('h1', {}, 'Personal'),
    seccionPesoCorporal(),
    seccionFotos(),
    seccionCopia(),
    diagnosticoPantalla(), // TEMPORAL: quitar cuando se arregle el hueco inferior
  );
}

// TEMPORAL: medidas de la pantalla para investigar el hueco bajo la barra de pestañas
function diagnosticoPantalla() {
  const sonda = h('div', {
    style: 'position: fixed; top: 0; left: 0; visibility: hidden; ' +
           'padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom)',
  });
  document.body.append(sonda);
  const estilo = getComputedStyle(sonda);
  const zonaSegura = `${estilo.paddingTop} / ${estilo.paddingBottom}`;
  sonda.remove();

  const barra = document.querySelector('.barra').getBoundingClientRect();
  const datos = [
    `pantalla: ${screen.width}×${screen.height}`,
    `innerHeight: ${window.innerHeight}`,
    `clientHeight: ${document.documentElement.clientHeight}`,
    `visualViewport: ${Math.round(window.visualViewport?.height ?? 0)}`,
    `zona segura arriba/abajo: ${zonaSegura}`,
    `hueco inferior medido: ${getComputedStyle(document.documentElement).getPropertyValue('--hueco-inferior').trim()}`,
    `barra: top ${Math.round(barra.top)}, bottom ${Math.round(barra.bottom)}`,
    `instalada: ${navigator.standalone === true ? 'sí' : 'no'}`,
  ];
  return h('div', {},
    h('h2', {}, 'Diagnóstico (temporal)'),
    h('pre', { class: 'nota', style: 'white-space: pre-wrap; font-size: 0.8rem' }, datos.join('\n')));
}

// ---------- Peso corporal ----------

function seccionPesoCorporal() {
  const registros = [...estado.pesoCorporal].sort((a, b) => a.fecha.localeCompare(b.fecha));

  const fecha = h('input', { type: 'date', value: hoyISO(), 'aria-label': 'Fecha' });
  const kg = h('input', { type: 'text', inputmode: 'decimal', placeholder: 'kg', 'aria-label': 'Peso en kg' });

  async function anadir() {
    const valor = leerNumero(kg.value);
    if (!valor || valor <= 0) { kg.focus(); return; }
    estado.pesoCorporal.push({ id: crearId(), fecha: fecha.value || hoyISO(), kg: valor });
    await guardar('pesoCorporal');
    avisar('Peso guardado');
    repintar();
  }

  async function borrar(registro) {
    if (!confirm(`¿Borrar el registro de ${formatearNumero(registro.kg)} kg?`)) return;
    estado.pesoCorporal = estado.pesoCorporal.filter((r) => r.id !== registro.id);
    await guardar('pesoCorporal');
    repintar();
  }

  return h('div', {},
    h('h2', {}, 'Peso corporal'),
    h('div', { class: 'fila-formulario' }, fecha, kg, h('button', { class: 'boton', onclick: anadir }, 'Añadir')),
    registros.length > 0 && h('div', { class: 'cifras' },
      cifra('Actual', `${formatearNumero(registros.at(-1).kg)} kg`),
      cifra('Cambio total', `${conSigno(Math.round((registros.at(-1).kg - registros[0].kg) * 10) / 10)} kg`)),
    registros.length > 0 && h('div', { class: 'grafica', style: 'margin-top: 8px', html: graficaLinea(registros.map((r) => ({ fecha: r.fecha, valor: r.kg }))) }),
    registros.length > 0 && h('details', { class: 'desplegable', style: 'margin-top: 8px' },
      h('summary', { class: 'fila' }, h('div', { class: 'titulo' }, 'Historial'), h('div', { class: 'detalle' }, `${registros.length} registros`)),
      h('div', { class: 'contenido-desplegable' },
        registros.slice().reverse().map((r) =>
          h('div', { class: 'fila', style: 'padding: 0; min-height: 44px' },
            h('div', {}, formatearFecha(r.fecha)),
            h('div', { style: 'display: flex; align-items: center; gap: 4px' },
              h('span', { class: 'valor' }, `${formatearNumero(r.kg)} kg`),
              h('button', { class: 'boton-icono', 'aria-label': 'Borrar registro', html: ICONOS.papelera, onclick: () => borrar(r) })))))),
  );
}

// ---------- Fotos de estado ----------

function seccionFotos() {
  const fotos = [...fotosCargadas].sort((a, b) => b.fecha.localeCompare(a.fecha));

  const selectorArchivo = h('input', { type: 'file', accept: 'image/*', hidden: true });
  selectorArchivo.addEventListener('change', async () => {
    const archivo = selectorArchivo.files[0];
    if (!archivo) return;
    try {
      const foto = { id: crearId(), fecha: hoyISO(), datos: await reducirImagen(archivo) };
      await DB.guardarFoto(foto);
      fotosCargadas.push(foto);
      avisar('Foto guardada');
      repintar();
    } catch (error) {
      console.error(error);
      avisar('No se pudo guardar la foto');
    }
  });

  return h('div', {},
    h('h2', {}, 'Fotos de estado'),
    fotos.length > 0 && h('div', { class: 'galeria' }, fotos.map((f) =>
      h('button', { onclick: () => verFoto(f), 'aria-label': `Foto del ${formatearFecha(f.fecha)}` },
        h('img', { src: f.datos, alt: '', loading: 'lazy' }),
        h('span', {}, formatearFecha(f.fecha, { day: 'numeric', month: 'short', year: '2-digit' }))))),
    selectorArchivo,
    h('button', { class: 'boton fantasma', onclick: () => selectorArchivo.click() }, '+ Añadir foto'),
  );
}

// Reduce la foto (lado mayor de 1440 px, JPEG) para que ocupe poco
async function reducirImagen(archivo, ladoMaximo = 1440, calidad = 0.82) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const escala = Math.min(1, ladoMaximo / Math.max(img.naturalWidth, img.naturalHeight));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(img.naturalWidth * escala);
    lienzo.height = Math.round(img.naturalHeight * escala);
    lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
    return lienzo.toDataURL('image/jpeg', calidad);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function verFoto(foto) {
  const fecha = h('input', { type: 'date', value: foto.fecha });
  fecha.addEventListener('change', async () => {
    foto.fecha = fecha.value || foto.fecha;
    await DB.guardarFoto(foto);
    repintar();
  });

  abrirHoja(formatearFecha(foto.fecha, { day: 'numeric', month: 'long', year: 'numeric' }),
    h('img', { class: 'foto-grande', src: foto.datos, alt: '' }),
    campo('Fecha', fecha),
    h('div', { class: 'acciones' },
      h('button', {
        class: 'boton peligro',
        onclick: async () => {
          if (!confirm('¿Borrar esta foto?')) return;
          await DB.borrarFoto(foto.id);
          fotosCargadas = fotosCargadas.filter((f) => f.id !== foto.id);
          cerrarHoja();
          repintar();
        },
      }, 'Borrar foto')),
  );
}

// ---------- Copia de seguridad ----------

function seccionCopia() {
  const selectorCopia = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
  selectorCopia.addEventListener('change', async () => {
    const archivo = selectorCopia.files[0];
    selectorCopia.value = '';
    if (archivo) await importarCopia(archivo);
  });

  return h('div', {},
    h('h2', {}, 'Copia de seguridad'),
    h('div', { class: 'acciones-fila' },
      h('button', { class: 'boton secundario', onclick: exportarCopia }, 'Exportar'),
      h('button', { class: 'boton secundario', onclick: () => selectorCopia.click() }, 'Restaurar')),
    selectorCopia,
    h('p', { class: 'nota' },
      'Última copia: ',
      h('b', {}, estado.ultimaCopia
        ? new Date(estado.ultimaCopia).toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' })
        : 'ninguna')),
    h('p', { class: 'nota' }, 'Tus datos se guardan solo en este iPhone. Guarda la copia en iCloud Drive (Compartir → Guardar en Archivos). Te avisaré si pasan 14 días sin hacer una.'),
  );
}

async function exportarCopia() {
  try {
    const copia = {
      app: 'gym',
      version: 1,
      exportada: new Date().toISOString(),
      datos: { ...estado },
      fotos: await DB.fotos(),
    };
    const archivo = new File([JSON.stringify(copia)], `gym-copia-${hoyISO()}.json`, { type: 'application/json' });

    // En iPhone se abre el menú "Compartir" (Guardar en Archivos, AirDrop...)
    if (navigator.canShare?.({ files: [archivo] })) {
      await navigator.share({ files: [archivo], title: 'Copia de seguridad Gym' });
    } else {
      // Si no se puede compartir, se descarga
      const enlace = h('a', { href: URL.createObjectURL(archivo), download: archivo.name });
      document.body.append(enlace);
      enlace.click();
      enlace.remove();
      setTimeout(() => URL.revokeObjectURL(enlace.href), 10000);
    }

    // Solo llega aquí si la copia se guardó (si cierras el menú sin elegir, salta al catch)
    estado.ultimaCopia = Date.now();
    await guardar('ultimaCopia');
    avisar('Copia de seguridad hecha ✓');
    repintar();
  } catch (error) {
    if (error.name !== 'AbortError') { // AbortError = cerraste el menú sin elegir nada
      console.error(error);
      avisar('No se pudo exportar la copia');
    }
  }
}

async function importarCopia(archivo) {
  let copia;
  try {
    copia = JSON.parse(await archivo.text());
    if (copia.app !== 'gym' || !copia.datos) throw new Error('Formato no válido');
  } catch {
    avisar('Ese archivo no es una copia de esta app');
    return;
  }
  if (!confirm('Esto sustituirá TODOS tus datos actuales por los de la copia. ¿Continuar?')) return;

  const inicial = estadoInicial();
  for (const clave of Object.keys(estado)) {
    estado[clave] = copia.datos[clave] ?? inicial[clave];
  }
  // La copia que acabas de restaurar cuenta como tu última copia
  estado.ultimaCopia = Date.parse(copia.exportada) || Date.now();
  await guardar(...Object.keys(estado));
  await DB.borrarFotos();
  for (const foto of copia.fotos || []) await DB.guardarFoto(foto);
  fotosCargadas = null;

  avisar('Copia restaurada');
  repintar();
}
