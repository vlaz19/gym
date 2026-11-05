// =====================================================================
// db.js — Guarda y lee los datos en el propio móvil (IndexedDB)
// =====================================================================
// IndexedDB es una base de datos que trae el navegador. Aquí tenemos dos "cajones":
//   - "datos": rutina, ejercicios, entrenos, peso corporal... (clave -> valor)
//   - "fotos": cada foto por separado, porque ocupan mucho más

const DB = (() => {
  let conexion = null;

  // Abre la base de datos (solo una vez) y crea los cajones la primera vez
  function abrir() {
    if (!conexion) {
      conexion = new Promise((resolve, reject) => {
        const peticion = indexedDB.open('gym-app', 1);
        peticion.onupgradeneeded = () => {
          const db = peticion.result;
          db.createObjectStore('datos');
          db.createObjectStore('fotos', { keyPath: 'id' });
        };
        peticion.onsuccess = () => resolve(peticion.result);
        peticion.onerror = () => reject(peticion.error);
      });
    }
    return conexion;
  }

  // Hace una operación sobre un cajón y espera a que termine
  async function operar(cajon, modo, accion) {
    const db = await abrir();
    return new Promise((resolve, reject) => {
      const transaccion = db.transaction(cajon, modo);
      const peticion = accion(transaccion.objectStore(cajon));
      transaccion.oncomplete = () => resolve(peticion.result);
      transaccion.onerror = () => reject(transaccion.error);
      transaccion.onabort = () => reject(transaccion.error);
    });
  }

  return {
    leer:         (clave)        => operar('datos', 'readonly',  (c) => c.get(clave)),
    escribir:     (clave, valor) => operar('datos', 'readwrite', (c) => c.put(valor, clave)),
    fotos:        ()             => operar('fotos', 'readonly',  (c) => c.getAll()),
    guardarFoto:  (foto)         => operar('fotos', 'readwrite', (c) => c.put(foto)),
    borrarFoto:   (id)           => operar('fotos', 'readwrite', (c) => c.delete(id)),
    borrarFotos:  ()             => operar('fotos', 'readwrite', (c) => c.clear()),
  };
})();
