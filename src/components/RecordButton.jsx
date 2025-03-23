import React from 'react';
import './RecordButton.css';

const RecordButton = ({ isRecording, isProcessing, onClick, label }) => {
  const buttonClass = isRecording 
    ? 'record-button stop' 
    : 'record-button start';
  
  return (
    <button 
      className={buttonClass}
      onClick={onClick}
      disabled={isProcessing}
    >
      <span className="record-icon">
        {isRecording ? 
          <span className="stop-icon"></span> : 
          <span className="mic-icon"></span>
        }
      </span>
      <span className="record-label">{label}</span>
    </button>
  );
};

export default RecordButton;
