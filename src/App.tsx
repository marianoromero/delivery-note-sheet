import React, { useState } from 'react';
import './App.css';
import CameraScanner from './components/CameraScanner';
import AlbaranesList from './components/AlbaranesList';
import BottomNavigation from './components/BottomNavigation';
import InstallPrompt from './components/InstallPrompt';
import { albaranService } from './services/albaranService';

type Page = 'camera' | 'albaranes';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('camera');

  const handleScanComplete = (text: string, imageData: string) => {
    const albaran = albaranService.saveAlbaran(text, imageData);
    console.log('Albarán guardado:', albaran);
    
    // Mostrar notificación usando Service Worker si está disponible
    const showNotification = async () => {
      try {
        if ('serviceWorker' in navigator && 'Notification' in window) {
          const registration = await navigator.serviceWorker.ready;
          if (Notification.permission === 'granted') {
            await registration.showNotification('Albarán escaneado', {
              body: `Nuevo albarán guardado: ${albaran.processedData?.supplier || 'Sin proveedor'}`,
              icon: '/logo192.png',
              badge: '/logo192.png',
              tag: 'albaran-scan',
              renotify: true
            });
          }
        } else if ('Notification' in window && Notification.permission === 'granted') {
          // Fallback para navegadores sin Service Worker
          new Notification('Albarán escaneado', {
            body: `Nuevo albarán guardado: ${albaran.processedData?.supplier || 'Sin proveedor'}`,
            icon: '/logo192.png'
          });
        }
      } catch (error) {
        console.log('Error al mostrar notificación:', error);
        // Fallback silencioso - no mostrar notificación si hay error
      }
    };
    
    showNotification();
    
    // Opcional: cambiar a la página de albaranes después de escanear
    // setCurrentPage('albaranes');
  };

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
  };

  // Solicitar permisos de notificación al cargar
  React.useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  return (
    <div className="App">
      {currentPage === 'camera' && (
        <CameraScanner onScanComplete={handleScanComplete} />
      )}
      
      {currentPage === 'albaranes' && (
        <AlbaranesList onBack={() => setCurrentPage('camera')} />
      )}
      
      <BottomNavigation 
        currentPage={currentPage} 
        onNavigate={handleNavigate} 
      />
      
      <InstallPrompt />
    </div>
  );
}

export default App;
