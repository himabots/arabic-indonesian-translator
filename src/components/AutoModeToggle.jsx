import React from 'react';
import './AutoModeToggle.css';

const AutoModeToggle = ({ enabled, onChange, disabled, label }) => {
  return (
    <div className="auto-mode-toggle-container">
      <label className="toggle-switch">
        <input 
          type="checkbox" 
          checked={enabled} 
          onChange={onChange} 
          disabled={disabled}
        />
        <span className="toggle-slider"></span>
      </label>
      <span className="toggle-label">{label}</span>
    </div>
  );
};

export default AutoModeToggle;
