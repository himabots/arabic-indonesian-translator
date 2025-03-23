import React from 'react';
import { FaMicrophone, FaStop } from 'react-icons/fa';
import './RecordButton.css';

const RecordButton = ({ isRecording, isProcessing, onClick, label }) => {
  return (
    <button 
      className={`record-button ${isRecording ? 'stop-recording' : 'start-recording'} ${isProcessing ? 'processing' : ''}`}
      onClick={onClick}
      disabled={isProcessing}
      aria-label={isRecording ? 'Stop recording' : 'Start recording'}
    >
      {isRecording ? (
        <>
          <FaStop /> {label || 'Stop Recording'}
        </>
      ) : (
        <>
          <FaMicrophone /> {label || 'Start Recording'}
        </>
      )}
    </button>
  );
};

export default RecordButton;
