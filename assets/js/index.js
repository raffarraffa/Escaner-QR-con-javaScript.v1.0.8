const video = document.createElement("video");
const canvasElement = document.getElementById("qr-canvas");
const canvas = canvasElement.getContext("2d", { willReadFrequently: true });
const btnScanQR = document.getElementById("btn-scan-qr");

let scanning = false;
let animationFrameId = null;
let scanTimeoutId = null;
let videoStream = null;
let cameras = [];
let currentCameraId = null;

let parametroP = null;
let datosDecodificados = null;

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

const mostrarError = (mensaje) => {
  Swal.fire({
    title: 'Error',
    text: mensaje,
    icon: 'error'
  });
};

const encenderCamara = async () => {
  try {
    detenerProcesos();
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      videoStream = null;
    }

    const constraints = {
      video: {
        facingMode: "environment",
        width: { ideal: 1280 },
        height: { ideal: 720 }
      }
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    videoStream = stream;

    video.srcObject = stream;
    video.setAttribute("playsinline", "true");

    await new Promise((resolve, reject) => {
      video.onloadedmetadata = () => {
        resolve();
      };
      video.onerror = reject;
      setTimeout(() => reject(new Error('Timeout video')), 5000);
    });

    await video.play();

    scanning = true;
    canvasElement.hidden = false;
    if (btnScanQR) btnScanQR.hidden = true;

    iniciarEscaneo();

  } catch (error) {
    console.error("Error al acceder a la cámara:", error);

    try {
      const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true });

      videoStream = fallbackStream;
      scanning = true;
      canvasElement.hidden = false;
      if (btnScanQR) btnScanQR.hidden = true;
      video.srcObject = fallbackStream;
      await video.play();
      iniciarEscaneo();

    } catch (fallbackError) {
      mostrarError("No se pudo acceder a la cámara: " + fallbackError.message);
    }
  }
};

const tick = () => {
  if (!scanning || video.readyState !== video.HAVE_ENOUGH_DATA) {
    animationFrameId = requestAnimationFrame(tick);
    return;
  }

  canvasElement.width = video.videoWidth;
  canvasElement.height = video.videoHeight;

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
  tick();
  scan();

  setTimeout(() => {
    if (scanning) {
      cerrarCamara();
    }
  }, SCAN_CONFIG.maxScanTime);
};

const cerrarCamara = () => {
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
};

qrcode.callback = (respuesta) => {
  if (respuesta && scanning) {
    scanning = false;

    if (respuesta.includes('https://www.arca.gob.ar/fe/qr/') ||
      respuesta.includes('https://fe.arca.gob.ar/qr/') ||
      respuesta.includes('https://www.afip.gob.ar/fe/qr/')) {
      try {
        const url = new URL(respuesta);
        parametroP = url.searchParams.get('p');

        if (parametroP) {
          datosDecodificados = JSON.parse(atob(parametroP));

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
        Swal.fire('Error', 'QR inválido: ' + error.message, 'error');
      }
    } else {
      Swal.fire('Error', 'El código QR no es reconocido', 'error');
    }

    cerrarCamara();
  }
};

const inicializarEventos = () => {
  if (btnScanQR) {
    btnScanQR.addEventListener('click', encenderCamara);
  }
};

window.addEventListener('load', () => {
  setTimeout(() => {
    inicializarEventos();
  }, 1000);
});

window.addEventListener('beforeunload', cerrarCamara);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    detenerProcesos();
  } else if (!canvasElement.hidden && videoStream) {
    iniciarEscaneo();
  }
});

window.encenderCamara = encenderCamara;
window.cerrarCamara = cerrarCamara;

window.verDataQr = () => {
  if (datosDecodificados) {
    alert(`Factura: ${datosDecodificados.ptoVta.toString().padStart(5, '0')} - ${datosDecodificados.nroCmp.toString().padStart(8, '0')}\nMonto: ${datosDecodificados.importe}`);
  } else {
    alert("No se encontró parámetro p");
  }
};