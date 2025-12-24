/**  le cuesta captuerar imegenes **/

// Variables globales
const video = document.createElement("video");
const canvasElement = document.getElementById("qr-canvas");
const canvas = canvasElement.getContext("2d", {
  willReadFrequently: true
});
const divResultado = document.getElementById("resultado");
const btnScanQR = document.getElementById("btn-scan-qr");

// Estado de la aplicación
let scanning = false;
let animationFrameId = null;
let scanTimeoutId = null;

// Optimizar: Pre-cache de elementos DOM
const audioElement = document.getElementById('audioScaner');

//resultados escaneo
let parametroP = null;
let datosDecodificados = null;
// Configuración reutilizable
const SCAN_CONFIG = {
  scanInterval: 100, // Reducido para mejor performance
  maxScanTime: 30000, // 30 segundos máximo
  videoConstraints: {
    video: {
      facingMode: "environment",
      // width: { ideal: 1280 },
      // height: { ideal: 720 }
    }
  }
};

const encenderCamara = async () => {
  try {
    detenerProcesos();

    // OBTENER TODOS LOS DISPOSITIVOS DISPONIBLES
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(device => device.kind === 'videoinput');
    
    console.log('Cámaras disponibles:', videoDevices);

    let constraints;

    // SI HAY MÚLTIPLES CÁMARAS, USAR ESTRATEGIA MEJORADA
    if (videoDevices.length > 1) {
      // BUSCAR CÁMARA TRASERA PRINCIPAL
      const rearCamera = videoDevices.find(device => 
        device.label.toLowerCase().includes('back') ||
        device.label.toLowerCase().includes('rear') ||
        device.label.toLowerCase().includes('environment')
      );

      if (rearCamera) {
        constraints = {
          video: {
            deviceId: { exact: rearCamera.deviceId },
            width: { ideal: 3840, max: 4096 },
            height: { ideal: 2160, max: 2160 },
            frameRate: { ideal: 60 },
            aspectRatio: { ideal: 16/9 }
          }
        };
      } else {
        // FALLBACK A ALTA RESOLUCIÓN
        constraints = {
          video: {
            width: { ideal: 3840 },
            height: { ideal: 2160 },
            frameRate: { ideal: 60 },
            aspectRatio: { ideal: 16/9 }
          }
        };
      }
    } else {
      // UNA SOLA CÁMARA - MÁXIMA CALIDAD
      constraints = {
        video: {
          width: { ideal: 3840 },
          height: { ideal: 2160 },
          frameRate: { ideal: 60 },
          aspectRatio: { ideal: 16/9 }
        }
      };
    }

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    
    // VERIFICAR CALIDAD OBTENIDA
    const videoTrack = stream.getVideoTracks()[0];
    const settings = videoTrack.getSettings();
    console.log('Resolución obtenida:', settings.width + 'x' + settings.height);
    console.log('Frame rate:', settings.frameRate);

    scanning = true;
    canvasElement.hidden = false;
    btnScanQR.hidden = true;

    video.setAttribute("playsinline", "true");
    video.srcObject = stream;

    await video.play();
    iniciarEscaneo();

  } catch (error) {
    console.error("Error al acceder a la cámara:", error);
    
    // FALLBACK A RESOLUCIÓN MÁS BAJA
    try {
      const fallbackStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        }
      });
      
      scanning = true;
      canvasElement.hidden = false;
      btnScanQR.hidden = true;
      video.srcObject = fallbackStream;
      await video.play();
      iniciarEscaneo();
      
    } catch (fallbackError) {
      mostrarError("No se pudo acceder a ninguna cámara: " + fallbackError.message);
    }
  }
};
// Función optimizada para encender cámara
const encenderCamara2 = async () => {
  try {
    // Limpiar cualquier proceso anterior
    detenerProcesos();

    const stream = await navigator.mediaDevices.getUserMedia(SCAN_CONFIG.videoConstraints);

    scanning = true;
    canvasElement.hidden = false;
    // Aplicar estilos con JS
    // canvasElement.style.width = '320px';
    // canvasElement.style.height = '180px';

    // (opcional) Ajustar el tamaño real del lienzo para evitar distorsión
    // canvasElement.width = 320;
    // canvasElement.height = 180;
    btnScanQR.hidden = true;

    // Configurar video optimizado
    video.setAttribute("playsinline", "true");
    video.srcObject = stream;

    // Esperar a que el video esté listo
    await video.play();

    // Iniciar procesos
    iniciarEscaneo();

  } catch (error) {
    console.error("Error al acceder a la cámara:", error);
    mostrarError("No se pudo acceder a la cámara");
  }
};

const resultadoToDiv = (result) => {
  // divResultado.innerHTML += `<p>Factura: ${datosDecodificados.ptoVta.toString().padStart(5, '0')} - ${datosDecodificados.nroCmp.toString().padStart(8, '0')}      Monto: ${datosDecodificados.importe}</p>`;

}

// Función optimizada para el renderizado
const tick = () => {
  if (!scanning || video.readyState !== video.HAVE_ENOUGH_DATA) {
    animationFrameId = requestAnimationFrame(tick);
    return;
  }

  // Usar dimensiones del video directamente
  canvasElement.width = video.videoWidth;
  canvasElement.height = video.videoHeight;

  // Las clases de Bootstrap (mx-auto d-block) se encargarán del centrado
  // y img-fluid hará que sea responsive
  canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);

  if (scanning) {
    animationFrameId = requestAnimationFrame(tick);
  }
};
const tick2 = () => {
  if (!scanning || video.readyState !== video.HAVE_ENOUGH_DATA) {
    animationFrameId = requestAnimationFrame(tick);
    return;
  }

  // Optimizar: Solo redibujar si es necesario
  canvasElement.height = video.videoHeight;
  canvasElement.width = video.videoWidth;

  canvas.drawImage(video, 0, 0, canvasElement.width, canvasElement.height);

  if (scanning) {
    animationFrameId = requestAnimationFrame(tick);
  }
};

// Función de escaneo optimizada
const scan = () => {
  if (!scanning) return;

  try {
    qrcode.decode();
  } catch (e) {
    // Usar setTimeout en lugar de recursión inmediata
    scanTimeoutId = setTimeout(scan, SCAN_CONFIG.scanInterval);
  }
};

// Iniciar todos los procesos de escaneo
const iniciarEscaneo = () => {
  tick();
  scan();

  // Timeout de seguridad para detener escaneo automático
  setTimeout(() => {
    if (scanning) {
      console.warn("Escaneo automático detenido por timeout");
      cerrarCamara();
    }
  }, SCAN_CONFIG.maxScanTime);
};

// Función mejorada para cerrar cámara
const cerrarCamara = () => {
  scanning = false;

  // Limpiar todos los procesos
  detenerProcesos();

  // Detener stream de video
  if (video.srcObject) {
    const tracks = video.srcObject.getTracks();
    tracks.forEach(track => track.stop());
    video.srcObject = null;
  }

  canvasElement.hidden = true;
  btnScanQR.hidden = false;
  if (btnScanQR) btnScanQR.hidden = false;
};

// Limpiar todos los procesos activos
const detenerProcesos = () => {
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

// Función optimizada para activar sonido
const activarSonido = () => {
  if (audioElement) {
    audioElement.play().catch(e => {
      console.warn("No se pudo reproducir sonido:", e);
    });
  }
};

// Callback optimizado para resultados QR

qrcode.callback = (respuesta) => {
  if (respuesta && scanning) {
    scanning = false;

    // Verificar dominio ARCA
    if (respuesta.includes('https://www.arca.gob.ar/fe/qr/') ||
      respuesta.includes('https://fe.arca.gob.ar/qr/') ||
      respuesta.includes('https://www.afip.gob.ar/fe/qr/')) {
      try {
        const url = new URL(respuesta);
        parametroP = url.searchParams.get('p');

        if (parametroP) {
          // Decodificar base64
          datosDecodificados = null;
          datosDecodificados = JSON.parse(atob(parametroP));
          resultadoToDiv(datosDecodificados);
          Swal.fire({
            title: 'QR Válido',
            html: `
              <div style="background: #f5f5f5; padding: 5px; border-radius: 5px; text-align:left;">
              <!--p>Version: ${JSON.stringify(datosDecodificados)}</p-->
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
        Swal.fire('Error', 'QR inválido: ' + error.message, 'error');
      }
    } else {
      Swal.fire('Error', 'El QR no es de ARCA', 'error');
    }
    // activarSonido();
    cerrarCamara();
  }
};

/*
qrcode.callback = (respuesta) => {
  if (respuesta && scanning) {
    // Detener escaneo inmediatamente al encontrar código
    scanning = false;
    alert(respuesta);
    // Mostrar resultado
    Swal.fire({
      title: 'Código QR escaneado',
      text: respuesta,
      icon: 'success'
    });
 
    activarSonido();
    cerrarCamara();
  }
};
*/

// Función para mostrar errores
const mostrarError = (mensaje) => {
  Swal.fire({
    title: 'Error',
    text: mensaje,
    icon: 'error'
  });
};

// Event listeners optimizados
const inicializarEventos = () => {
  if (btnScanQR) {
    btnScanQR.addEventListener('click', encenderCamara);
  }

  // Prevenir múltiples cargas
  window.removeEventListener('load', inicializarEventos);
};

// Carga optimizada
window.addEventListener('load', () => {
  // Usar requestIdleCallback para carga no crítica
  if ('requestIdleCallback' in window) {
    requestIdleCallback(() => {
      inicializarEventos();
      encenderCamara();
    });
  } else {
    // Fallback para navegadores que no soportan requestIdleCallback
    setTimeout(() => {
      inicializarEventos();
      encenderCamara();
    }, 100);
  }
});

// Limpieza cuando la página se descarga
window.addEventListener('beforeunload', () => {
  detenerProcesos();
  cerrarCamara();
});

// Pausar escaneo cuando la página no es visible
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    detenerProcesos();
  } else if (!canvasElement.hidden) {
    iniciarEscaneo();
  }
});

// Exportar funciones para uso externo si es necesario
window.QRScanner = {
  encenderCamara,
  cerrarCamara,
  detenerProcesos
};

const verDataQr = () => {
  if (datosDecodificados) {
    alert(
      `
      Factura: ${datosDecodificados.ptoVta.toString().padStart(5, '0')} - ${datosDecodificados.nroCmp.toString().padStart(8, '0')}
      Monto: ${datosDecodificados.importe}`
    );
  }
  else {
    alert("No se encontró parámetro p");
  }

};
