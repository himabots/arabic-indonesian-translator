import React from 'react';
import { FaMicrophone, FaStop } from 'react-icons/fa';
import './RecordButton.css';

const RecordButton = ({ isRecording, isProcessing, onClick }) => {
  return (
    <button 
      className={`record-button ${isRecording ? 'recording' : ''} ${isProcessing ? 'processing' : ''}`}
      onClick={onClick}
      disabled={isProcessing}
    >
      {isRecording ? (
        <>
          <FaStop /> Stop Recording
        </>
      ) : (
        <>
          <FaMicrophone /> Start Recording
        </>
      )}
    </button>
  );
};

export default RecordButton;
