// =====================================================================
// temporizador.js — Cuenta atrás de descanso entre series
// =====================================================================
// Se guarda la HORA a la que termina el descanso (no los segundos que faltan),
// así sigue siendo correcta aunque bloquees el móvil o la app se cierre.

let intervaloTemporizador = null;
let sonido = null; // "AudioContext": permite generar el pitido sin archivos de audio

// iOS solo deja sonar audio si se prepara justo después de que toques algo
function prepararSonido() {
  try {
    // Avisos cortos: en principio baja un momento tu música en vez de cortarla
    if (navigator.audioSession) navigator.audioSession.type = 'transient';
    sonido ??= new (window.AudioContext || window.webkitAudioContext)();
    if (sonido.state === 'suspended') sonido.resume();
  } catch (error) {
    console.error(error);
  }
}

// Tres pitidos cortos
function pitar() {
  if (!sonido) return;
  try {
    sonido.resume();
    [0, 0.25, 0.5].forEach((retraso) => {
      const oscilador = sonido.createOscillator();
      const volumen = sonido.createGain();
      oscilador.frequency.value = 880;
      oscilador.connect(volumen);
      volumen.connect(sonido.destination);
      const inicio = sonido.currentTime + retraso;
      volumen.gain.setValueAtTime(0.0001, inicio);
      volumen.gain.exponentialRampToValueAtTime(0.5, inicio + 0.02);
      volumen.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.18);
      oscilador.start(inicio);
      oscilador.stop(inicio + 0.2);
    });
  } catch (error) {
    console.error(error);
  }
}

function iniciarTemporizador(segundos, nombre) {
  if (!estado.borrador || !segundos) return;
  prepararSonido();
  estado.borrador.temporizador = { fin: Date.now() + segundos * 1000, nombre, avisado: false };
  guardar('borrador');
  pintarTemporizador();
}

function sumarTiempo(segundos) {
  const t = estado.borrador?.temporizador;
  if (!t) return;
  t.fin = Math.max(Date.now(), t.fin) + segundos * 1000;
  t.avisado = false;
  guardar('borrador');
  pintarTemporizador();
}

function pararTemporizador() {
  if (estado.borrador) {
    estado.borrador.temporizador = null;
    guardar('borrador');
  }
  pintarTemporizador();
}

// Dibuja (o esconde) la cuenta atrás flotante
function pintarTemporizador() {
  const caja = document.getElementById('temporizador');
  const t = estado.borrador?.temporizador;
  clearInterval(intervaloTemporizador);
  document.body.classList.toggle('con-temporizador', !!t);

  if (!t) {
    caja.hidden = true;
    rellenar(caja);
    return;
  }

  const etiqueta = h('span', { class: 'detalle' });
  const tiempo = h('span', { class: 'tiempo' });
  caja.hidden = false;
  rellenar(caja, 
    h('div', { class: 'textos' }, etiqueta, tiempo),
    h('button', { class: 'boton secundario pequeno', onclick: () => sumarTiempo(15) }, '+15 s'),
    h('button', { class: 'boton-icono', 'aria-label': 'Cerrar temporizador', html: ICONOS.cerrar, onclick: pararTemporizador }),
  );

  function actualizar() {
    const restante = Math.ceil((t.fin - Date.now()) / 1000);
    if (restante > 0) {
      caja.classList.remove('terminado');
      etiqueta.textContent = `Descanso · ${t.nombre}`;
      tiempo.textContent = mmss(restante);
      return;
    }
    caja.classList.add('terminado');
    etiqueta.textContent = '¡A por la siguiente serie!';
    tiempo.textContent = '0:00';
    clearInterval(intervaloTemporizador);
    if (!t.avisado) {
      t.avisado = true;
      guardar('borrador');
      if (Date.now() - t.fin < 5000) pitar(); // solo si acaba de terminar (no al volver a la app mucho después)
    }
  }

  actualizar();
  if (Date.now() < t.fin) intervaloTemporizador = setInterval(actualizar, 250);
}

// Al volver a la app (tras bloquear el móvil, por ejemplo), se recalcula
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) pintarTemporizador();
});
