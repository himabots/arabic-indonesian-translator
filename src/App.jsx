import React, { useState, useRef } from 'react';
import RecordButton from './components/RecordButton';
import TranslationDisplay from './components/TranslationDisplay';
import { processAudioChunk } from './api/translateAudio';
import './App.css';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [translation, setTranslation] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    } else {
      try {
        // Start recording
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        audioChunksRef.current = [];
        
        mediaRecorder.ondataavailable = handleAudioData;
        mediaRecorder.onstop = handleAudioStop;
        mediaRecorder.start(3000); // Process in 3-second chunks
        setIsRecording(true);
      } catch (error) {
        console.error('Error accessing microphone:', error);
        alert('Please allow microphone access to use this app.');
      }
    }
  };
  
  const handleAudioData = async (event) => {
    if (event.data.size > 0) {
      audioChunksRef.current.push(event.data);
      await handleAudioChunk(event.data);
    }
  };
  
  const handleAudioStop = async () => {
    // Process any remaining audio
    if (audioChunksRef.current.length > 0) {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      await handleAudioChunk(audioBlob);
      audioChunksRef.current = [];
    }
  };
  
  const handleAudioChunk = async (audioChunk) => {
    try {
      const translationResult = await processAudioChunk(audioChunk);
      if (translationResult) {
        setTranslation(prev => prev + ' ' + translationResult);
      }
    } catch (error) {
      console.error('Translation error:', error);
    }
  };
  
  return (
    <div className="app-container">
      <header>
        <h1>Arabic to Indonesian Translator</h1>
        <p>Start recording to translate Arabic speech to Bahasa Indonesia</p>
      </header>
      
      <main>
        <TranslationDisplay text={translation} />
        <RecordButton isRecording={isRecording} onClick={toggleRecording} />
        
        {isRecording && (
          <div className="recording-indicator">
            Recording... (tap Stop when finished)
          </div>
        )}
      </main>
      
      <footer>
        <p>© Zafar Labs {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

export default App;
