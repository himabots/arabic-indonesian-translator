import React from 'react';
import './AutoModeToggle.css';

const AutoModeToggle = ({ enabled, onChange, disabled }) => {
  return (
    <div className="auto-mode-container">
      <label className="auto-mode-toggle">
        <input 
          type="checkbox"
          checked={enabled}
          onChange={onChange}
          disabled={disabled}
        />
        <span className="toggle-slider"></span>
        <span className="toggle-label">Auto Mode (5-second cycles)</span>
      </label>
    </div>
  );
};

export default AutoModeToggle;
