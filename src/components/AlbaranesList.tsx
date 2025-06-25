import React, { useState, useEffect } from 'react';
import { albaranService, Albaran } from '../services/albaranService';
import './AlbaranesList.css';

interface AlbaranesListProps {
  onBack: () => void;
}

const AlbaranesList: React.FC<AlbaranesListProps> = ({ onBack }) => {
  const [albaranes, setAlbaranes] = useState<Albaran[]>([]);
  const [selectedAlbaran, setSelectedAlbaran] = useState<Albaran | null>(null);
  const [stats, setStats] = useState<any>({});

  useEffect(() => {
    loadAlbaranes();
  }, []);

  const loadAlbaranes = () => {
    const data = albaranService.getAllAlbaranes();
    const statsData = albaranService.getStats();
    setAlbaranes(data);
    setStats(statsData);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este albarán?')) {
      albaranService.deleteAlbaran(id);
      loadAlbaranes();
      if (selectedAlbaran && selectedAlbaran.id === id) {
        setSelectedAlbaran(null);
      }
    }
  };

  const handleExport = () => {
    const data = albaranService.exportAlbaranes();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `albaranes_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleClearAll = () => {
    if (window.confirm('¿Estás seguro de que quieres eliminar TODOS los albaranes? Esta acción no se puede deshacer.')) {
      albaranService.clearAllAlbaranes();
      loadAlbaranes();
      setSelectedAlbaran(null);
    }
  };

  if (selectedAlbaran) {
    return (
      <div className="albaran-detail">
        <div className="detail-header">
          <button className="back-btn" onClick={() => setSelectedAlbaran(null)}>
            ← Volver
          </button>
          <h2>Detalle del Albarán</h2>
          <button 
            className="delete-btn"
            onClick={() => handleDelete(selectedAlbaran.id)}
          >
            🗑️
          </button>
        </div>

        <div className="detail-content">
          <div className="detail-info">
            <div className="info-row">
              <span className="label">Fecha:</span>
              <span className="value">{selectedAlbaran.date}</span>
            </div>
            
            {selectedAlbaran.processedData?.supplier && (
              <div className="info-row">
                <span className="label">Proveedor:</span>
                <span className="value">{selectedAlbaran.processedData.supplier}</span>
              </div>
            )}
            
            {selectedAlbaran.processedData?.documentNumber && (
              <div className="info-row">
                <span className="label">Número:</span>
                <span className="value">{selectedAlbaran.processedData.documentNumber}</span>
              </div>
            )}
            
            {selectedAlbaran.processedData?.amount && (
              <div className="info-row">
                <span className="label">Importe:</span>
                <span className="value amount">{selectedAlbaran.processedData.amount}€</span>
              </div>
            )}
          </div>

          {selectedAlbaran.imageData && (
            <div className="image-section">
              <h3>Imagen Escaneada</h3>
              <img 
                src={selectedAlbaran.imageData} 
                alt="Albarán escaneado"
                className="scanned-image"
              />
            </div>
          )}

          <div className="text-section">
            <h3>Texto Extraído</h3>
            <div className="extracted-text">
              {selectedAlbaran.text.split('\n').map((line, index) => (
                <div key={index} className="text-line">
                  {line.trim() || '\u00A0'}
                </div>
              ))}
            </div>
          </div>

          {selectedAlbaran.processedData?.items && (
            <div className="items-section">
              <h3>Elementos Detectados</h3>
              <div className="items-list">
                {selectedAlbaran.processedData.items.map((item, index) => (
                  <div key={index} className="item">
                    {item}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="albaranes-list">
      <div className="list-header">
        <button className="back-btn" onClick={onBack}>
          ← Escanear
        </button>
        <h1>Albaranes</h1>
        <div className="header-actions">
          {albaranes.length > 0 && (
            <>
              <button className="action-btn export-btn" onClick={handleExport}>
                💾
              </button>
              <button className="action-btn clear-btn" onClick={handleClearAll}>
                🗑️
              </button>
            </>
          )}
        </div>
      </div>

      <div className="stats-section">
        <div className="stat-card">
          <div className="stat-number">{stats.total || 0}</div>
          <div className="stat-label">Total</div>
        </div>
        <div className="stat-card">
          <div className="stat-number">{stats.thisMonth || 0}</div>
          <div className="stat-label">Este mes</div>
        </div>
      </div>

      <div className="albaranes-container">
        {albaranes.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <h3>No hay albaranes</h3>
            <p>Escanea tu primer albarán para comenzar</p>
          </div>
        ) : (
          <div className="albaranes-grid">
            {albaranes.map((albaran) => (
              <div 
                key={albaran.id} 
                className="albaran-card"
                onClick={() => setSelectedAlbaran(albaran)}
              >
                <div className="card-header">
                  <div className="card-date">{albaran.date}</div>
                  <button 
                    className="card-delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(albaran.id);
                    }}
                  >
                    ✕
                  </button>
                </div>
                
                <div className="card-content">
                  {albaran.processedData?.supplier && (
                    <div className="card-supplier">
                      <strong>{albaran.processedData.supplier}</strong>
                    </div>
                  )}
                  
                  <div className="card-preview">
                    {albaran.text.substring(0, 100)}
                    {albaran.text.length > 100 && '...'}
                  </div>
                  
                  <div className="card-footer">
                    {albaran.processedData?.documentNumber && (
                      <span className="doc-number">
                        #{albaran.processedData.documentNumber}
                      </span>
                    )}
                    {albaran.processedData?.amount && (
                      <span className="amount">
                        {albaran.processedData.amount}€
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AlbaranesList;