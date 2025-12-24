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