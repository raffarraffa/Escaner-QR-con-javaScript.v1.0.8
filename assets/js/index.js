// ========== DEBUG INICIAL ==========
console.log('Cargado correctamente');
debugLog('index.js inicializado');

// ========== VARIABLES GLOBALES ==========
const video = document.createElement("video");
const canvasElement = document.getElementById("qr-canvas");
const canvas = canvasElement.getContext("2d", { willReadFrequently: true });
const btnScanQR = document.getElementById("btn-scan-qr");

// Estado de la aplicación
let scanning = false;
let animationFrameId = null;
let scanTimeoutId = null;
let videoStream = null;
let cameras = [];
let currentCameraId = null;

// Resultados escaneo
let parametroP = null;
let datosDecodificados = null;

// ========== CONFIGURACIÓN ==========
const SCAN_CONFIG = {
  scanInterval: 100,
  maxScanTime: 30000,
  cameraConfigs: {
    default: {
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 }
      }
    },
    basic: {
      video: true
    }
  }
};

// ========== FUNCIONES BÁSICAS ==========
const detenerProcesos = () => {
  debugLog('Deteniendo procesos...');
  scanning = false;

  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (scanTimeoutId) {
    clearTimeout(scanTimeoutId);
    scanTimeoutId = null;
  }
};

const mostrarError = (mensaje) => {
  debugLog('ERROR: ' + mensaje);
  Swal.fire({
    title: 'Error',
    text: mensaje,
    icon: 'error'
  });
};

// ========== FUNCIÓN PRINCIPAL ENCENDER CÁMARA ==========
const encenderCamara = async () => {
  debugLog('🔴 Botón ESCANEAR QR clickeado');

  try {
    // 1. LIMPIAR ESTADO ANTERIOR
    detenerProcesos();
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      videoStream = null;
    }

    // 2. CONFIGURACIÓN MÍNIMA Y SEGURA
    const constraints = {
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    debugLog('🎯 Solicitando cámara con constraints...');

    // 3. OBTENER CÁMARA
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoStream = stream;

    debugLog('✅ Cámara obtenida exitosamente');

    // 4. CONFIGURAR VIDEO
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");

    // Esperar a que el video esté listo
    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => {
        debugLog('📹 Video metadata cargada');
        resolve();
      };
      video.onerror = reject;
      setTimeout(() => reject(new Error('Timeout video')), 5000);
    });

    await video.play();
    debugLog('🎥 Video reproduciéndose');

    // 5. CONFIGURAR INTERFAZ
    scanning = true;
    canvasElement.hidden = false;
    if (btnScanQR) btnScanQR.hidden = true;

    debugLog('🔄 Iniciando escaneo...');

    // 6. INICIAR PROCESOS DE ESCANEO
    iniciarEscaneo();

  } catch (error) {
    debugLog('❌ Error: ' + error.message);
    console.error("Error al acceder a la cámara:", error);

    // INTENTO DE FALLBACK
    try {
      debugLog('🔄 Intentando fallback básico...');
      const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });

      videoStream = fallbackStream;
      scanning = true;
      canvasElement.hidden = false;
      if (btnScanQR) btnScanQR.hidden = true;
      video.srcObject = fallbackStream;
      await video.play();
      iniciarEscaneo();
      debugLog('✅ Fallback exitoso');

    } catch (fallbackError) {
      debugLog('💥 Fallback falló: ' + fallbackError.message);
      mostrarError("No se pudo acceder a la cámara: " + fallbackError.message);
    }
  }
};

// ========== FUNCIONES DE ESCANEO ==========
const tick = () => {
  if (!scanning || video.readyState !== video.HAVE_ENOUGH_DATA) {
    animationFrameId = requestAnimationFrame(tick);
    return;
  }

  // Configurar canvas con dimensiones del video
  canvasElement.width = video.videoWidth;
  canvasElement.height = video.videoHeight;

  // Dibujar video en canvas
  canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);

  if (scanning) {
    animationFrameId = requestAnimationFrame(tick);
  }
};

const scan = () => {
  if (!scanning) return;

  try {
    qrcode.decode();
  } catch (e) {
    scanTimeoutId = setTimeout(scan, SCAN_CONFIG.scanInterval);
  }
};

const iniciarEscaneo = () => {
  debugLog('🔍 Iniciando procesos de escaneo');
  tick();
  scan();

  // Timeout de seguridad
  setTimeout(() => {
    if (scanning) {
      debugLog('⏰ Timeout de escaneo alcanzado');
      cerrarCamara();
    }
  }, SCAN_CONFIG.maxScanTime);
};

// ========== CERRAR CÁMARA ==========
const cerrarCamara = () => {
  debugLog('🔴 Cerrando cámara...');
  scanning = false;
  detenerProcesos();

  if (videoStream) {
    videoStream.getTracks().forEach(track => track.stop());
    videoStream = null;
  }

  if (video.srcObject) {
    video.srcObject = null;
  }

  canvasElement.hidden = true;
  if (btnScanQR) btnScanQR.hidden = false;

  debugLog('✅ Cámara cerrada');
};

// ========== CALLBACK QR ==========
qrcode.callback = (respuesta) => {
  debugLog('📨 QR detectado: ' + (respuesta ? respuesta.substring(0, 50) + '...' : 'null'));

  if (respuesta && scanning) {
    scanning = false;

    // Verificar dominio de factura
    if (respuesta.includes('https://www.arca.gob.ar/fe/qr/') ||
      respuesta.includes('https://fe.arca.gob.ar/qr/') ||
      respuesta.includes('https://www.afip.gob.ar/fe/qr/')) {
      try {
        const url = new URL(respuesta);
        parametroP = url.searchParams.get('p');

        if (parametroP) {
          datosDecodificados = JSON.parse(atob(parametroP));
          debugLog('✅ QR válido decodificado');

          Swal.fire({
            title: 'QR Válido',
            html: `
              <div style="background: #f5f5f5; padding: 5px; border-radius: 5px; text-align:left;">
                <p>Factura: ${datosDecodificados.ptoVta.toString().padStart(5, '0')} - ${datosDecodificados.nroCmp.toString().padStart(8, '0')}</p>
                <p>CAE: ${datosDecodificados.codAut}</p>
                <p>Fecha: ${datosDecodificados.fecha}</p>
                <p>Cuit: ${datosDecodificados.cuit}</p>
                <p>Monto: $ ${datosDecodificados.importe}</p>
              </div>
            `,
            icon: 'success'
          });
        } else {
          throw new Error('No se encontró parámetro p');
        }
      } catch (error) {
        debugLog('❌ Error decodificando QR: ' + error.message);
        Swal.fire('Error', 'QR inválido: ' + error.message, 'error');
      }
    } else {
      debugLog('❌ QR no reconocido');
      Swal.fire('Error', 'El código QR no es reconocido', 'error');
    }

    cerrarCamara();
  }
};

// ========== INICIALIZACIÓN ==========
const inicializarEventos = () => {
  debugLog('🔧 Inicializando eventos...');

  if (btnScanQR) {
    btnScanQR.addEventListener('click', encenderCamara);
    debugLog('✅ Evento click asignado a btnScanQR');
  } else {
    debugLog('❌ btnScanQR no encontrado');
  }
};

// CARGA DE LA PÁGINA
window.addEventListener('load', () => {
  debugLog('📄 Página completamente cargada');

  setTimeout(() => {
    inicializarEventos();
    debugLog('🏁 Inicialización completada');
  }, 1000);
});

// LIMPIEZA
window.addEventListener('beforeunload', cerrarCamara);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    detenerProcesos();
  } else if (!canvasElement.hidden && videoStream) {
    iniciarEscaneo();
  }
});

// ========== FUNCIONES GLOBALES ==========
window.encenderCamara = encenderCamara;
window.cerrarCamara = cerrarCamara;

window.verDataQr = () => {
  if (datosDecodificados) {
    alert(`Factura: ${datosDecodificados.ptoVta.toString().padStart(5, '0')} - ${datosDecodificados.nroCmp.toString().padStart(8, '0')}\nMonto: ${datosDecodificados.importe}`);
  } else {
    alert("No se encontró parámetro p");
  }
};

debugLog('✅ index.js completamente cargado');