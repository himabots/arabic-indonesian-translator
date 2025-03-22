import React from 'react';
import './TranslationDisplay.css';

const TranslationDisplay = ({ translations }) => {
  // Automatically scroll to bottom when new translations are added
  const containerRef = React.useRef(null);
  
  React.useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [translations]);
  
  return (
    <div className="translation-container" ref={containerRef}>
      <div className="translation-header">Translations (Bahasa Indonesia)</div>
      <div className="translation-content">
        {translations.length === 0 ? (
          <p className="no-translations">Translations will appear here...</p>
        ) : (
          translations.map(entry => (
            <div 
              key={entry.id} 
              className={`translation-entry ${entry.final ? 'final' : 'interim'}`}
            >
              <div className="translation-time">{entry.timestamp}</div>
              <div className="translation-text">{entry.text}</div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TranslationDisplay;
