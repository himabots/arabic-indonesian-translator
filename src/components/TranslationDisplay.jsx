import React, { useRef, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import './TranslationDisplay.css';

const TranslationDisplay = ({ translations }) => {
  const messagesEndRef = useRef(null);
  const [key, setKey] = useState(0);
  
  useEffect(() => {
    // Force a complete re-render when translations change
    setKey(prev => prev + 1);
    
    // Scroll to bottom after a slight delay
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, [translations]);
  
  return (
    <div className="translation-display" key={key}>
      {translations.map((translation) => (
        <div key={translation.id} className="message-container">
          <div className="message">
            <p>{translation.text}</p>
            <span className="timestamp">{translation.timestamp}</span>
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default TranslationDisplay;
