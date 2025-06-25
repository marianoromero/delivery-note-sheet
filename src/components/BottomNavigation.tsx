import React from 'react';
import './BottomNavigation.css';

interface BottomNavigationProps {
  currentPage: 'camera' | 'albaranes';
  onNavigate: (page: 'camera' | 'albaranes') => void;
}

const BottomNavigation: React.FC<BottomNavigationProps> = ({ currentPage, onNavigate }) => {
  return (
    <div className="bottom-navigation">
      <button 
        className={`nav-button ${currentPage === 'camera' ? 'active' : ''}`}
        onClick={() => onNavigate('camera')}
      >
        <div className="nav-icon">📷</div>
        <div className="nav-label">Escanear</div>
      </button>
      
      <button 
        className={`nav-button ${currentPage === 'albaranes' ? 'active' : ''}`}
        onClick={() => onNavigate('albaranes')}
      >
        <div className="nav-icon">📋</div>
        <div className="nav-label">Albaranes</div>
      </button>
    </div>
  );
};

export default BottomNavigation;