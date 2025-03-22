import React, { useState, useRef, useEffect } from 'react';
import hark from 'hark';
import RecordButton from './components/RecordButton';
import TranslationDisplay from './components/TranslationDisplay';
import { translateAudioChunk } from './api/translateAudio';
import './App.css';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [translation, setTranslation] = useState('');
  const [originalText, setOriginalText] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const speechEventsRef = useRef(null);
  const audioChunksRef = useRef([]);
  const isSpeakingRef = useRef(false);
  
  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (speechEventsRef.current) {
        speechEventsRef.current.stop();
      }
    };
  }, []);
  
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      stopRecording();
    } else {
      try {
        await startRecording();
      } catch (error) {
        console.error('Error starting recording:', error);
        alert('Please allow microphone access to use this app.');
      }
    }
  };
  
  const startRecording = async () => {
    // Reset states
    setTranslation('');
    setOriginalText('');
    
    // Get audio stream
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: { 
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } 
    });
    
    streamRef.current = stream;
    
    // Set up voice activity detection
    const speechEvents = hark(stream, {
      threshold: -65,     // Sensitivity (-80 to -20, lower is more sensitive)
      interval: 100       // How often to check for speech in ms
    });
    
    speechEventsRef.current = speechEvents;
    
    // Configure speech detection events
    speechEvents.on('speaking', () => {
      console.log('Speech started');
      isSpeakingRef.current = true;
      audioChunksRef.current = []; // Reset chunks for new speech segment
    });
    
    speechEvents.on('stopped_speaking', async () => {
      console.log('Speech ended');
      isSpeakingRef.current = false;
      
      // Only process if we have audio chunks
      if (audioChunksRef.current.length > 0) {
        await processAudioSegment();
      }
    });
    
    // Track volume level for UI feedback
    speechEvents.on('volume_change', (volume) => {
      // Convert to a 0-100 scale for easier use in UI
      const level = Math.min(100, Math.max(0, (volume + 100) * 1.8));
      setAudioLevel(level);
    });
    
    // Create media recorder
    const options = { mimeType: 'audio/webm;codecs=opus' };
    const mediaRecorder = new MediaRecorder(stream, options);
    mediaRecorderRef.current = mediaRecorder;
    
    // Handle audio data
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };
    
    // Start media recorder and update state
    mediaRecorder.start(100); // Collect audio in 100ms chunks
    setIsRecording(true);
  };
  
  const stopRecording = () => {
    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop speech events
    if (speechEventsRef.current) {
      speechEventsRef.current.stop();
    }
    
    // Stop all tracks in the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Process any remaining audio
    if (audioChunksRef.current.length > 0) {
      processAudioSegment();
    }
    
    // Reset audio level
    setAudioLevel(0);
    setIsRecording(false);
  };
  
  const processAudioSegment = async () => {
    setIsProcessing(true);
    
    try {
      // Combine all audio chunks into a single blob
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
      
      // Only process if we have enough data
      if (audioBlob.size > 1000) { // Minimum size threshold to avoid empty audio
        const result = await translateAudioChunk(audioBlob);
        
        if (result) {
          // Append to existing translation with a space
          setTranslation(prev => {
            const separator = prev ? ' ' : '';
            return prev + separator + result;
          });
        }
      }
    } catch (error) {
      console.error('Error processing audio segment:', error);
    } finally {
      audioChunksRef.current = []; // Clear chunks after processing
      setIsProcessing(false);
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
        
        {isRecording && (
          <div className="audio-level-indicator">
            <div className="audio-level-bar">
              <div 
                className="audio-level-fill"
                style={{ width: `${audioLevel}%` }}
              ></div>
            </div>
          </div>
        )}
        
        <RecordButton 
          isRecording={isRecording} 
          isProcessing={isProcessing}
          onClick={toggleRecording} 
        />
        
        {isRecording && (
          <div className="recording-indicator">
            Recording... (tap Stop when finished)
          </div>
        )}
        
        {isProcessing && (
          <div className="processing-indicator">
            Processing translation...
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
