import React from 'react';
import './TranslationDisplay.css';

const TranslationDisplay = ({ text }) => {
  return (
    <div className="translation-container">
      <div className="translation-header">Indonesian Translation</div>
      <div className="translation-content">
        {text || 'Translation will appear here...'}
      </div>
    </div>
  );
};

export default TranslationDisplay;
