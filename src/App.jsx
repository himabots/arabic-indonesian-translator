import React, { useState, useRef, useEffect } from 'react';
import RecordButton from './components/RecordButton';
import TranslationDisplay from './components/TranslationDisplay';
import { translateAudioChunk } from './api/translateAudio';
import './App.css';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [translation, setTranslation] = useState('');
  const [audioLevel, setAudioLevel] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioDataRef = useRef(new Uint8Array(0));
  const animationFrameRef = useRef(null);
  const audioChunksRef = useRef([]);
  const silenceTimerRef = useRef(null);
  const lastAudioLevelRef = useRef(0);
  
  // Clean up resources when component unmounts
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
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
    
    // Get audio stream
    const stream = await navigator.mediaDevices.getUserMedia({ 
      audio: { 
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      } 
    });
    
    streamRef.current = stream;
    
    // Set up audio context for volume detection
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    audioContextRef.current = audioContext;
    
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyserRef.current = analyser;
    
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    
    audioDataRef.current = new Uint8Array(analyser.frequencyBinCount);
    
    // Start monitoring audio levels
    startAudioMonitoring();
    
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
    mediaRecorder.start(1000); // Collect audio in 1s chunks
    setIsRecording(true);
    
    // Reset the silence detection
    lastAudioLevelRef.current = 0;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
  };
  
  const startAudioMonitoring = () => {
    // Variable to track accumulated speech time
    let speechDuration = 0;
    const MIN_SPEECH_DURATION = 5000; // Minimum 5 seconds of speech before processing
    
    const updateAudioLevel = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(audioDataRef.current);
      
      // Calculate average volume level
      let sum = 0;
      for (let i = 0; i < audioDataRef.current.length; i++) {
        sum += audioDataRef.current[i];
      }
      const avg = sum / audioDataRef.current.length;
      
      // Scale to 0-100 for UI
      const scaledLevel = Math.min(100, Math.max(0, avg * 100 / 256));
      setAudioLevel(scaledLevel);
      
      // Detect significant audio for speech segments
      const THRESHOLD = 15; // Adjust based on testing
      
      if (scaledLevel > THRESHOLD) {
        // Speech detected
        if (lastAudioLevelRef.current <= THRESHOLD) {
          console.log('Speech started');
          speechDuration = 0; // Reset duration for new speech
        } else {
          speechDuration += 16; // Approximately 16ms between animation frames
        }
        
        // Reset silence timer if it exists
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      } else if (lastAudioLevelRef.current > THRESHOLD) {
        // Speech just ended
        // Only process if we had sufficient speech duration
        if (speechDuration >= MIN_SPEECH_DURATION) {
          silenceTimerRef.current = setTimeout(() => {
            console.log('Speech ended (silence detected) after', speechDuration, 'ms');
            if (audioChunksRef.current.length > 0) {
              processAudioSegment();
            }
          }, 1000); // Wait 1 second of silence before processing
        } else {
          console.log('Speech too short, ignoring', speechDuration, 'ms');
          audioChunksRef.current = []; // Clear too-short audio segments
        }
        
        speechDuration = 0;
      }
      
      lastAudioLevelRef.current = scaledLevel;
      
      // Continue monitoring if still recording
      if (isRecording) {
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      }
    };
    
    // Start the monitoring loop
    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  };
  
  const stopRecording = () => {
    // Stop media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Stop audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    
    // Clear silence timer
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
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
      
      // Only process if we have enough data (at least 10KB)
      if (audioBlob.size > 10000) {
        console.log('Processing audio segment of size:', audioBlob.size, 'bytes');
        const result = await translateAudioChunk(audioBlob);
        
        if (result) {
          // Append to existing translation with a space
          setTranslation(prev => {
            const separator = prev ? ' ' : '';
            return prev + separator + result;
          });
        }
      } else {
        console.log('Audio segment too small, skipping:', audioBlob.size, 'bytes');
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
