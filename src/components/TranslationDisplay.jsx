import React, { useRef, useEffect } from 'react';
import './TranslationDisplay.css';

const TranslationDisplay = ({ translations }) => {
  const messagesEndRef = useRef(null);
  
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  useEffect(() => {
    scrollToBottom();
    // Add a console log to see what translations are being rendered
    console.log("Rendering translations:", translations);
  }, [translations]);
  
  if (translations.length === 0) {
    return <div className="translation-display empty" ref={messagesEndRef}></div>;
  }
  
  return (
    <div className="translation-display">
      {translations.map((translation, index) => (
        <div 
          key={translation.id} 
          className={`message-container ${index === 0 ? 'first-message' : ''}`}
          style={{border: index === 0 ? '1px solid red' : 'none'}} // Debug styling
        >
          <div className="message">
            <p>{translation.text || "No text available"}</p>
            <span className="timestamp">{translation.timestamp}</span>
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default TranslationDisplay;


/*import React, { useRef, useEffect } from 'react';
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

export default TranslationDisplay;*/
