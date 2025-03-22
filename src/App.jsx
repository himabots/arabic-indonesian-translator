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
  const [lastPauseTime, setLastPauseTime] = useState(0);
  
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioDataRef = useRef(new Uint8Array(0));
  const animationFrameRef = useRef(null);
  const audioChunksRef = useRef([]);
  const silenceTimerRef = useRef(null);
  const lastAudioLevelRef = useRef(0);
  const speechStartTimeRef = useRef(0);
  const processingRef = useRef(false);
  
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
    setLastPauseTime(0);
    
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
    analyser.fftSize = 512; // Higher value for better frequency resolution
    analyserRef.current = analyser;
    
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    
    audioDataRef.current = new Uint8Array(analyser.frequencyBinCount);
    
    // Start monitoring audio levels
    startAudioMonitoring();
    
    // Create media recorder with specific MIME type and bitrate
    const options = { 
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: 128000 // 128 kbps for better quality
    };
    
    const mediaRecorder = new MediaRecorder(stream, options);
    mediaRecorderRef.current = mediaRecorder;
    
    // Handle audio data
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };
    
    // Start media recorder with smaller chunks for more granular data
    mediaRecorder.start(500); // 500ms chunks for better responsiveness
    setIsRecording(true);
    
    // Reset the silence detection
    lastAudioLevelRef.current = 0;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
    }
  };
  
  const startAudioMonitoring = () => {
    // Speech detection parameters
    const NOISE_THRESHOLD = 10; // Lower threshold to detect more subtle speech
    const SPEECH_PAUSE_DURATION = 800; // 800ms of silence to consider it a pause
    const MIN_SPEECH_DURATION = 2000; // Minimum 2 seconds of speech to process
    
    let isSpeaking = false;
    let pauseStartTime = 0;
    let consecutiveLowVolumes = 0;
    
    const updateAudioLevel = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(audioDataRef.current);
      
      // Calculate RMS (Root Mean Square) for better volume representation
      let sumSquares = 0;
      for (let i = 0; i < audioDataRef.current.length; i++) {
        sumSquares += Math.pow(audioDataRef.current[i], 2);
      }
      const rms = Math.sqrt(sumSquares / audioDataRef.current.length);
      
      // Scale to 0-100 for UI
      const scaledLevel = Math.min(100, Math.max(0, rms * 100 / 128));
      setAudioLevel(scaledLevel);
      
      // Speech detection logic with improved pause detection
      if (scaledLevel > NOISE_THRESHOLD) {
        // Reset pause counter when we detect sound
        consecutiveLowVolumes = 0;
        
        if (!isSpeaking) {
          console.log('Speech started');
          isSpeaking = true;
          speechStartTimeRef.current = Date.now();
        }
        
        // Clear any silence timer
        if (silenceTimerRef.current) {
          clearTimeout(silenceTimerRef.current);
          silenceTimerRef.current = null;
        }
      } else {
        // Count consecutive low volumes for more stable pause detection
        consecutiveLowVolumes++;
        
        // If we have enough consecutive low readings and we were speaking
        if (consecutiveLowVolumes > 10 && isSpeaking) { // About 160ms of consecutive low volume
          if (pauseStartTime === 0) {
            pauseStartTime = Date.now();
          }
          
          // If pause is long enough, consider it a real pause
          const pauseDuration = Date.now() - pauseStartTime;
          
          if (pauseDuration >= SPEECH_PAUSE_DURATION) {
            const speechDuration = Date.now() - speechStartTimeRef.current;
            
            // Only process if the speech segment was long enough and we're not already processing
            if (speechDuration >= MIN_SPEECH_DURATION && !processingRef.current) {
              console.log(`Speech ended after ${speechDuration}ms with ${pauseDuration}ms pause`);
              
              // Process the audio if we have enough chunks
              if (audioChunksRef.current.length > 0) {
                processSpeechSegment();
              }
              
              isSpeaking = false;
              pauseStartTime = 0;
            }
          }
        }
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
      processSpeechSegment(true); // true indicates final processing
    }
    
    // Reset audio level
    setAudioLevel(0);
    setIsRecording(false);
  };
  
  const processSpeechSegment = async (isFinal = false) => {
    // Set processing flag to prevent multiple simultaneous processing
    if (processingRef.current && !isFinal) return;
    
    processingRef.current = true;
    setIsProcessing(true);
    
    try {
      // Make a copy of the current chunks and then clear the array for new data
      const chunksToProcess = [...audioChunksRef.current];
      audioChunksRef.current = [];
      
      // Combine all audio chunks into a single blob with proper MIME type
      const audioBlob = new Blob(chunksToProcess, { type: 'audio/webm;codecs=opus' });
      
      // Only process if we have enough data (at least 15KB for a good quality segment)
      if (audioBlob.size > 15000 || isFinal) {
        console.log('Processing audio segment of size:', audioBlob.size, 'bytes');
        
        // Pause between processing segments to avoid overwhelming the API
        const now = Date.now();
        const timeSinceLastPause = now - lastPauseTime;
        if (timeSinceLastPause < 1000 && !isFinal) {
          // If less than 1 second since last processing, wait a bit
          await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastPause));
        }
        
        const result = await translateAudioChunk(audioBlob);
        setLastPauseTime(Date.now());
        
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
      processingRef.current = false;
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
            Recording... (translation will appear after speech pauses)
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
