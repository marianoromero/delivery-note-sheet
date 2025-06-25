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

  const startCamera = useCallback(async () => {
    try {
      setError('');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        }
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setIsCameraActive(true);
      }
    } catch (err) {
      setError('Error al acceder a la cámara. Verifica los permisos.');
      console.error('Camera error:', err);
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
      setIsCameraActive(false);
    }
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

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0);

      const imageData = canvas.toDataURL('image/jpeg', 0.8);

      const { data: { text } } = await Tesseract.recognize(
        canvas,
        'spa',
        {
          logger: m => console.log(m)
        }
      );

      if (text.trim()) {
        onScanComplete(text.trim(), imageData);
        stopCamera();
      } else {
        setError('No se detectó texto. Intenta de nuevo.');
      }
    } catch (err) {
      setError('Error al procesar la imagen. Intenta de nuevo.');
      console.error('OCR error:', err);
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
            📷 Activar Cámara
          </button>
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
                Enfoca el documento dentro del marco
              </p>
            </div>
          </div>

          <div className="camera-controls">
            <button 
              className="control-btn stop-btn"
              onClick={stopCamera}
            >
              ❌ Cerrar
            </button>
            <button 
              className={`control-btn scan-btn ${isScanning ? 'scanning' : ''}`}
              onClick={captureAndScan}
              disabled={isScanning}
            >
              {isScanning ? '⏳ Escaneando...' : '📱 Escanear'}
            </button>
          </div>
        </div>
      )}

      {error && (
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