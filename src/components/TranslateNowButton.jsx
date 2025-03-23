import React from 'react';
import './TranslateNowButton.css';

const TranslateNowButton = ({ onClick, disabled }) => {
  return (
    <button 
      className="translate-now-button"
      onClick={onClick}
      disabled={disabled}
      aria-label="Translate Now"
    >
      <span className="translate-icon"></span>
      <span className="translate-label">Translate Now</span>
    </button>
  );
};

export default TranslateNowButton;
