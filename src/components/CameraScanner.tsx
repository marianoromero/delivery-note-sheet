import React, { useRef, useState, useCallback } from 'react';
import { supabaseAlbaranService } from '../services/supabaseAlbaranService';
import './CameraScanner.css';

interface CameraScannerProps {
  onScanComplete: (albaranId: string, imageUrl: string) => void;
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
      console.log('videoRef.current en startCamera:', videoRef.current);
      
      // Primero activar la cámara para que el video element se renderice
      setIsCameraActive(true);
      console.log('Estado isCameraActive actualizado a true');
      
      // Esperar un tick para que React renderice el video element
      await new Promise(resolve => setTimeout(resolve, 100));
      console.log('videoRef.current después del timeout:', videoRef.current);
      
      // Primero verificar si el navegador soporta getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Tu navegador no soporta acceso a la cámara');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          aspectRatio: { ideal: 16/9 }
        }
      });

      console.log('Stream obtenido:', stream);

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        console.log('Stream asignado al video element');
        
        // Configurar el evento para cuando el video esté listo
        videoRef.current.onloadedmetadata = () => {
          console.log('Video metadata cargada');
        };
        
        // Reproducir el video
        videoRef.current.play().then(() => {
          console.log('Video play() exitoso');
        }).catch((playError) => {
          console.log('Error en play():', playError);
        });
      } else {
        console.error('videoRef.current sigue siendo null después del timeout!');
        setError('Error: No se pudo acceder al elemento de video');
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

      // Convertir canvas a blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', 0.8);
      });

      console.log('Procesando imagen con IDP...');
      
      // Process the image through the new Supabase architecture
      const { albaran, processingResult } = await supabaseAlbaranService.processNewAlbaran(
        blob,
        `albaran_${Date.now()}.jpg`
      );

      console.log('Procesamiento completado:', processingResult);

      if (processingResult.success) {
        onScanComplete(albaran.id, albaran.image_url);
        stopCamera();
      } else {
        setError(`Error en el procesamiento: ${processingResult.error || 'Error desconocido'}`);
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
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                background: '#000'
              }}
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
{isScanning ? 'PROCESANDO...' : 'CAPTURAR'}
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