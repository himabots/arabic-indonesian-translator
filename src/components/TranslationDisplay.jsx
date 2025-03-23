import React, { useRef, useEffect } from 'react';
import './TranslationDisplay.css';

const TranslationDisplay = ({ translations }) => {
  const messagesEndRef = useRef(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
  }, [translations]);
  
  return (
    <div className="translation-display">
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
