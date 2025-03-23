import React, { useRef, useEffect } from 'react';
import './TranslationDisplay.css';

const TranslationDisplay = ({ translations }) => {
  // Reference to the messages container for auto-scrolling
  const messagesContainerRef = useRef(null);
  
  // Auto-scroll to bottom when new translations are added
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [translations]);
  
  return (
    <div className="messages-container" ref={messagesContainerRef}>
      {translations.length === 0 ? (
        <div className="empty-messages">
          <p>Translations will appear here</p>
        </div>
      ) : (
        <div className="messages-list">
          {translations.map((message) => (
            <div 
              key={message.id} 
              className={`message-bubble ${message.final ? 'final' : 'interim'}`}
            >
              <div className="message-timestamp">{message.timestamp}</div>
              <div className="message-text">{message.text}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default TranslationDisplay;
