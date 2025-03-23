import React from 'react';
import { FaSync } from 'react-icons/fa';
import './TranslateNowButton.css';

const TranslateNowButton = ({ onClick, disabled }) => {
  return (
    <button 
      className={`translate-now-button ${disabled ? 'disabled' : ''}`}
      onClick={onClick}
      disabled={disabled}
      aria-label="Translate Now"
    >
      <FaSync className={disabled ? '' : 'spin-hover'} /> Translate Now
    </button>
  );
};

export default TranslateNowButton;
