import React, { useState, useEffect } from 'react';
import { supabaseAlbaranService } from '../services/supabaseAlbaranService';
import { AlbaranWithItems } from '../types/albaran';
import './AlbaranesList.css';

interface AlbaranesListProps {
  onBack: () => void;
}

const AlbaranesList: React.FC<AlbaranesListProps> = ({ onBack }) => {
  const [albaranes, setAlbaranes] = useState<AlbaranWithItems[]>([]);
  const [selectedAlbaran, setSelectedAlbaran] = useState<AlbaranWithItems | null>(null);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAlbaranes();
  }, []);

  const loadAlbaranes = async () => {
    try {
      setLoading(true);
      const data = await supabaseAlbaranService.getAllAlbaranes();
      const statsData = await supabaseAlbaranService.getStats();
      setAlbaranes(data);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading albaranes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este albarán?')) {
      try {
        await supabaseAlbaranService.deleteAlbaran(id);
        loadAlbaranes();
        if (selectedAlbaran && selectedAlbaran.id === id) {
          setSelectedAlbaran(null);
        }
      } catch (error) {
        console.error('Error deleting albaran:', error);
        alert('Error al eliminar el albarán');
      }
    }
  };

  const handleExport = () => {
    const data = JSON.stringify(albaranes, null, 2);
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
      // Note: This would need to be implemented in the service
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
              <span className="value">{new Date(selectedAlbaran.created_at).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
              })}</span>
            </div>
            
            {selectedAlbaran.supplier && (
              <div className="info-row">
                <span className="label">Proveedor:</span>
                <span className="value">{selectedAlbaran.supplier}</span>
              </div>
            )}
            
            {selectedAlbaran.document_number && (
              <div className="info-row">
                <span className="label">Número:</span>
                <span className="value">{selectedAlbaran.document_number}</span>
              </div>
            )}

            {selectedAlbaran.document_date && (
              <div className="info-row">
                <span className="label">Fecha doc.:</span>
                <span className="value">{selectedAlbaran.document_date}</span>
              </div>
            )}

            {selectedAlbaran.tax_id && (
              <div className="info-row">
                <span className="label">CIF/NIF:</span>
                <span className="value">{selectedAlbaran.tax_id}</span>
              </div>
            )}
            
            {selectedAlbaran.total_amount && (
              <div className="info-row">
                <span className="label">Importe:</span>
                <span className="value amount">{selectedAlbaran.total_amount} {selectedAlbaran.currency || 'EUR'}</span>
              </div>
            )}
          </div>

          {selectedAlbaran.image_url && (
            <div className="image-section">
              <h3>Imagen Escaneada</h3>
              <img 
                src={selectedAlbaran.image_url} 
                alt="Albarán escaneado"
                className="scanned-image"
              />
            </div>
          )}

          {selectedAlbaran.raw_text && (
            <div className="text-section">
              <h3>Texto Extraído</h3>
              <div className="extracted-text">
                {selectedAlbaran.raw_text.split('\n').map((line: string, index: number) => (
                  <div key={index} className="text-line">
                    {line.trim() || '\u00A0'}
                  </div>
                ))}
              </div>
            </div>
          )}

          {selectedAlbaran.albaran_items && selectedAlbaran.albaran_items.length > 0 && (
            <div className="items-section">
              <h3>Elementos Detectados</h3>
              <div className="items-list">
                {selectedAlbaran.albaran_items.map((item, index) => (
                  <div key={index} className="item">
                    <div className="item-description">{item.description}</div>
                    {item.quantity && <div className="item-quantity">Cantidad: {item.quantity}</div>}
                    {item.unit_price && <div className="item-price">Precio: {item.unit_price}€</div>}
                    {item.total_price && <div className="item-total">Total: {item.total_price}€</div>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="albaranes-list">
        <div className="list-header">
          <button className="back-btn" onClick={onBack}>
            ← Escanear
          </button>
          <h1>Albaranes</h1>
        </div>
        <div className="loading-container">
          <div className="loading-spinner">Cargando albaranes...</div>
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
                  <div className="card-date">{new Date(albaran.created_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}</div>
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
                  {albaran.supplier && (
                    <div className="card-supplier">
                      <strong>{albaran.supplier}</strong>
                    </div>
                  )}
                  
                  <div className="card-preview">
                    {albaran.raw_text ? albaran.raw_text.substring(0, 100) : 'Procesando...'}
                    {albaran.raw_text && albaran.raw_text.length > 100 && '...'}
                  </div>
                  
                  <div className="card-footer">
                    {albaran.document_number && (
                      <span className="doc-number">
                        #{albaran.document_number}
                      </span>
                    )}
                    {albaran.total_amount && (
                      <span className="amount">
                        {albaran.total_amount} {albaran.currency || 'EUR'}
                      </span>
                    )}
                    <span className={`status status-${albaran.status}`}>
                      {albaran.status === 'pending' ? 'Pendiente' : 
                       albaran.status === 'processing' ? 'Procesando' :
                       albaran.status === 'completed' ? 'Completado' : 'Error'}
                    </span>
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