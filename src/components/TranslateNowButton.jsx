import React from 'react';
import './TranslateNowButton.css';

const TranslateNowButton = ({ onClick, disabled }) => {
  return (
    <button 
      className={`translate-now-button ${disabled ? 'disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
    >
      Translate Now
    </button>
  );
};

export default TranslateNowButton;
