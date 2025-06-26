import React, { useRef, useState, useCallback } from 'react';
import Tesseract from 'tesseract.js';
import './CameraScanner.css';

interface CameraScannerProps {
  onScanComplete: (text: string, imageData: string) => void;
}


const CameraScanner: React.FC<CameraScannerProps> = ({ onScanComplete }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [error, setError] = useState<string>('');

  console.log('CameraScanner render - isCameraActive:', isCameraActive);

  const startCamera = useCallback(async () => {
    try {
      setError('');
      console.log('Iniciando cámara...');
      
      // Primero verificar si el navegador soporta getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador no soporta acceso a la cámara');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });

      console.log('Stream obtenido:', stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        
        // Configurar el evento para cuando el video esté listo
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata cargada, activando cámara');
          setIsCameraActive(true);
        };
        
        // Reproducir el video
        try {
          await videoRef.current.play();
          console.log('Video iniciado correctamente');
        } catch (playError) {
          console.log('Error al reproducir video:', playError);
          // Aún así, activar la cámara
          setIsCameraActive(true);
        }
      }
    } catch (err: any) {
      console.error('Error al acceder a la cámara:', err);
      setError(`Error al acceder a la cámara: ${err.message}`);
    }
  }, []);

  const stopCamera = useCallback(() => {
    console.log('Deteniendo cámara...');
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => {
        console.log('Deteniendo track:', track);
        track.stop();
      });
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  }, []);

  const captureAndScan = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || isScanning) return;

    setIsScanning(true);
    setError('');

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');

      if (!context) {
        throw new Error('No se pudo obtener el contexto del canvas');
      }

      // Configurar el canvas con el tamaño del video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      if (canvas.width === 0 || canvas.height === 0) {
        throw new Error('El video no tiene dimensiones válidas');
      }

      // Dibujar el frame actual del video en el canvas
      context.drawImage(video, 0, 0);

      // Obtener la imagen como data URL
      const imageData = canvas.toDataURL('image/jpeg', 0.8);

      console.log('Iniciando OCR...');
      const { data: { text } } = await Tesseract.recognize(
        canvas,
        'spa',
        {
          logger: m => console.log('OCR:', m)
        }
      );

      console.log('Texto extraído:', text);

      if (text.trim()) {
        onScanComplete(text.trim(), imageData);
        stopCamera();
      } else {
        setError('No se detectó texto. Intenta de nuevo con mejor iluminación.');
      }
    } catch (err: any) {
      console.error('Error al procesar la imagen:', err);
      setError(`Error al procesar la imagen: ${err.message}`);
    } finally {
      setIsScanning(false);
    }
  }, [isScanning, onScanComplete, stopCamera]);

  return (
    <div className="camera-scanner">
      <div style={{ 
        position: 'absolute', 
        top: '10px', 
        left: '10px', 
        background: 'rgba(0,0,0,0.7)', 
        color: 'white', 
        padding: '5px', 
        fontSize: '12px',
        zIndex: 9999
      }}>
        Debug: {isCameraActive ? 'Cámara Activa' : 'Cámara Inactiva'}
      </div>

      {!isCameraActive ? (
        <div className="camera-start">
          <div className="scan-icon">📄</div>
          <h2>Escanear Albarán</h2>
          <p>Usa la cámara para escanear documentos automáticamente con OCR</p>
          <button 
            className="start-camera-btn"
            onClick={startCamera}
          >
            SCAN
          </button>
          {error && (
            <div style={{ 
              color: 'red', 
              marginTop: '10px', 
              padding: '10px', 
              background: 'rgba(255,0,0,0.1)',
              borderRadius: '5px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}
        </div>
      ) : (
        <div className="camera-active">
          <div className="camera-container">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="camera-video"
            />
            <div className="scan-overlay">
              <div className="scan-frame"></div>
              <p className="scan-instruction">
                Enfoca el documento con texto y pulsa CAPTURAR TEXTO
              </p>
            </div>
          </div>

          <div className="camera-controls">
            <button 
              className="control-btn stop-btn"
              onClick={stopCamera}
            >
              Cerrar
            </button>
            <button 
              className={`control-btn scan-btn ${isScanning ? 'scanning' : ''}`}
              onClick={captureAndScan}
              disabled={isScanning}
            >
              {isScanning ? 'Procesando...' : 'CAPTURAR TEXTO'}
            </button>
          </div>
        </div>
      )}

      {error && isCameraActive && (
        <div className="error-message">
          <p>{error}</p>
          <button onClick={() => setError('')}>✕</button>
        </div>
      )}

      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  );
};

export default CameraScanner;