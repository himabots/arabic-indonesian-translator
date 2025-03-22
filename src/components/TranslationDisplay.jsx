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
      <div className="translation-content">
        {translations.length === 0 ? (
          <p className="no-translations">Translations will appear here...</p>
        ) : (
          translations.map((entry, index) => (
            <React.Fragment key={entry.id}>
              {/* Add a separator if this is marked as a session end and not the last item */}
              {index > 0 && translations[index-1].isSessionEnd && (
                <div className="session-separator">
                  <hr />
                </div>
              )}
              <div 
                className={`translation-entry ${entry.final ? 'final' : 'interim'}`}
              >
                <div className="translation-time">{entry.timestamp}</div>
                <div className="translation-text">{entry.text}</div>
              </div>
            </React.Fragment>
          ))
        )}
      </div>
    </div>
  );
}

export default TranslationDisplay;
