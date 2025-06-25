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
    
    // Mostrar notificación
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('Albarán escaneado', {
        body: `Nuevo albarán guardado: ${albaran.processedData?.supplier || 'Sin proveedor'}`,
        icon: '/logo192.png'
      });
    }
    
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
