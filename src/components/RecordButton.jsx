import React from 'react';
import { FaMicrophone, FaStop } from 'react-icons/fa';
import './RecordButton.css';

const RecordButton = ({ isRecording, onClick }) => {
  return (
    <button 
      className={`record-button ${isRecording ? 'recording' : ''}`}
      onClick={onClick}
    >
      {isRecording ? (
        <>
          <FaStop /> Stop
        </>
      ) : (
        <>
          <FaMicrophone /> Start Translation
        </>
      )}
    </button>
  );
};

export default RecordButton;
