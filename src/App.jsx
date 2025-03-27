import React, { useState, useRef, useEffect } from 'react';
import RecordButton from './components/RecordButton';
import TranslateNowButton from './components/TranslateNowButton';
import TranslationDisplay from './components/TranslationDisplay';
import AutoModeToggle from './components/AutoModeToggle';
import { translateAudioChunk } from './api/translateAudio';
import './App.css';
import { Analytics } from '@vercel/analytics/react';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [translations, setTranslations] = useState([]);
  const [audioLevel, setAudioLevel] = useState(0);
  const [autoMode, setAutoMode] = useState(false);
  const [micPermissionGranted, setMicPermissionGranted] = useState(false);
  const [showInitialScreen, setShowInitialScreen] = useState(true);
  
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioDataRef = useRef(new Uint8Array(0));
  const animationFrameRef = useRef(null);
  const audioChunksRef = useRef([]);
  const allAudioChunksRef = useRef([]);
  const processingRef = useRef(false);
  const translationIntervalRef = useRef(null);
  const autoModeIntervalRef = useRef(null);
  
  const AUTO_MODE_CYCLE_INTERVAL = 15000; // 15 seconds
  
  // Cleanup effect
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
      if (translationIntervalRef.current) {
        clearInterval(translationIntervalRef.current);
      }
      if (autoModeIntervalRef.current) {
        clearInterval(autoModeIntervalRef.current);
      }
    };
  }, []);

  // Auto mode effect
  useEffect(() => {
    if (autoModeIntervalRef.current) {
      clearInterval(autoModeIntervalRef.current);
      autoModeIntervalRef.current = null;
    }
    
    if (autoMode && isRecording) {
      startAutoModeCycle();
    }
  }, [autoMode, isRecording]);
  
  const startAutoModeCycle = () => {
    autoModeIntervalRef.current = setTimeout(async () => {
      if (isRecording && autoMode) {
        await cycleRecording();
        
        autoModeIntervalRef.current = setInterval(async () => {
          if (isRecording && autoMode) {
            await cycleRecording();
          } else {
            clearInterval(autoModeIntervalRef.current);
            autoModeIntervalRef.current = null;
          }
        }, AUTO_MODE_CYCLE_INTERVAL);
      }
    }, AUTO_MODE_CYCLE_INTERVAL);
  };
  
  const cycleRecording = async () => {
    await processCycleRecording();
    
    await new Promise(resolve => setTimeout(resolve, 300));
    
    if (autoMode && isRecording) {
      await restartRecording();
    }
  };
  
  const processCycleRecording = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    if (allAudioChunksRef.current.length > 0) {
      setIsProcessing(true);
      
      try {
        const audioBlob = new Blob(allAudioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        
        const result = await translateAudioChunk(audioBlob).catch(error => {
          console.error('Error in cycle translateAudioChunk:', error);
          return '';
        });
      
        if (result) {
          const timestamp = new Date().toLocaleTimeString();
          setTranslations(prev => [
            ...prev, 
            { 
              id: Date.now(), 
              text: result, 
              timestamp,
              final: true,
              isSessionEnd: false
            }
          ]);
        }
      } catch (error) {
        console.error('Error processing cycle recording:', error);
      } finally {
        setIsProcessing(false);
      }
    }
  };
  
  const restartRecording = async () => {
    audioChunksRef.current = [];
    allAudioChunksRef.current = [];
    
    if (streamRef.current) {
      try {
        let options;
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { 
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 128000 
          };
        } else {
          options = {};
        }
        
        const mediaRecorder = new MediaRecorder(streamRef.current, options);
        mediaRecorderRef.current = mediaRecorder;
        
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data);
            allAudioChunksRef.current.push(event.data);
          }
        };
        
        mediaRecorder.start(500);
      } catch (error) {
        console.error('Error restarting media recorder:', error);
      }
    }
  };
  
  const requestMicrophonePermission = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(track => track.stop());
      setMicPermissionGranted(true);
      return true;
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      return false;
    }
  };
  
  const toggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      try {
        const hasPermission = await requestMicrophonePermission();
        
        if (!hasPermission) {
          alert('Please allow microphone access to use this app.');
          return;
        }
        
        // If we have translations but we're starting a new recording session
        if (translations.length > 0) {
          // We're already in the translation view, just start recording
          await startRecording();
        } else {
          // First time starting, switch from initial to translation view
          setShowInitialScreen(false);
          await startRecording();
        }
      } catch (error) {
        console.error('Error in toggleRecording:', error);
        alert('Error starting recording. Please check microphone access.');
      }
    }
  };
  
  const startRecording = async () => {
    audioChunksRef.current = [];
    allAudioChunksRef.current = [];
    
    try {
      const constraints = { 
        audio: { 
          echoCancellation: false,  // Turn off echo cancellation for ambient sound
          noiseSuppression: false,  // Turn off noise suppression to capture distant speech
          autoGainControl: true,    // Keep auto gain control to boost quiet sounds
          channelCount: 1,          // Mono audio is better for speech recognition
          sampleRate: 16000         // Match Whisper's preferred sample rate
        } 
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = audioContext;
        
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyserRef.current = analyser;
        
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        
        audioDataRef.current = new Uint8Array(analyser.frequencyBinCount);
        
        startAudioMonitoring();
      } catch (audioContextError) {
        console.error('Error setting up audio context:', audioContextError);
      }
      
      let options;
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { 
          mimeType: 'audio/webm;codecs=opus',
          audioBitsPerSecond: 128000 
        };
      } else {
        options = {};
      }
      
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
          allAudioChunksRef.current.push(event.data);
        }
      };
      
      mediaRecorder.start(500);
      
      setIsRecording(true);
      
      if (autoMode) {
        startAutoModeCycle();
      }
      
    } catch (error) {
      console.error('Error in startRecording:', error);
      throw error;
    }
  };
  
  const startAudioMonitoring = () => {
    const updateAudioLevel = () => {
      if (!analyserRef.current) return;
      
      analyserRef.current.getByteFrequencyData(audioDataRef.current);
      
      let sumSquares = 0;
      for (let i = 0; i < audioDataRef.current.length; i++) {
        sumSquares += Math.pow(audioDataRef.current[i], 2);
      }
      const rms = Math.sqrt(sumSquares / audioDataRef.current.length);
      
      const scaledLevel = Math.min(100, Math.max(0, rms * 100 / 128));
      setAudioLevel(scaledLevel);
      
      if (isRecording) {
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      }
    };
    
    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  };
  
  const stopRecording = () => {
    if (autoModeIntervalRef.current) {
      clearInterval(autoModeIntervalRef.current);
      autoModeIntervalRef.current = null;
    }
    
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }
    
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    if (allAudioChunksRef.current.length > 0) {
      processFinalRecording();
    }
    
    setIsRecording(false);
    setAudioLevel(0);
  };
  
  const processFinalRecording = async () => {
    setIsProcessing(true);
    
    try {
      const audioBlob = new Blob(allAudioChunksRef.current, { type: 'audio/webm;codecs=opus' });
      
      const result = await translateAudioChunk(audioBlob).catch(error => {
        console.error('Error in final translateAudioChunk:', error);
        return '';
      });
      
      if (result) {
        const timestamp = new Date().toLocaleTimeString();
        setTranslations(prev => [
          ...prev, 
          { 
            id: Date.now(), 
            text: result, 
            timestamp,
            final: true,
            isSessionEnd: true
          }
        ]);
      }
    } catch (error) {
      console.error('Error processing final recording:', error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  const handleTranslateNowClick = async () => {
    if (isRecording && !isProcessing) {
      // First stop the current recorder to finalize the chunk
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      // Small delay to ensure the data is available
      await new Promise(resolve => setTimeout(resolve, 100));
    
      // Only process if we have audio to process
      if (allAudioChunksRef.current.length > 0) {
        // Process the current audio
        setIsProcessing(true);
      
        try {
          const audioBlob = new Blob(allAudioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        
          const result = await translateAudioChunk(audioBlob).catch(error => {
            console.error('Error in translateAudioChunk:', error);
            return '';
          });
        
          if (result) {
            const timestamp = new Date().toLocaleTimeString();
            setTranslations(prev => [
              ...prev, 
              { 
                id: Date.now(), 
                text: result, 
                timestamp,
                final: true,
                isSessionEnd: false
              }
            ]);
          }
        } catch (error) {
          console.error('Error processing recording:', error);
        } finally {
          setIsProcessing(false);
        }
      }
    
      // Restart the recorder but don't clear accumulated audio
      // This keeps continuous recording but ensures clean chunk boundaries
      if (streamRef.current) {
        try {
          let options;
          if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
            options = { 
              mimeType: 'audio/webm;codecs=opus',
              audioBitsPerSecond: 64000 
            };
          } else {
            options = {};
          }
        
          const mediaRecorder = new MediaRecorder(streamRef.current, options);
          mediaRecorderRef.current = mediaRecorder;
        
          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              audioChunksRef.current.push(event.data);
              allAudioChunksRef.current.push(event.data);
            }
          };
        
          mediaRecorder.start(500);
        } catch (error) {
          console.error('Error restarting media recorder:', error);
        }
      }
    }
  };
  
  const handleTranslateNowClick = async () => {
    if (isRecording && !isProcessing) {
      // We remove the check for audioChunks.length to ensure button is always clickable
      await cycleRecording();
    
      if (!autoMode) {
        await restartRecording();
      }
    }
  };
  
  const handleClearTranslations = () => {
    setTranslations([]);
    // Only go back to initial screen if we have no translations
    // This way, Clear All just clears translations but stays on the translation screen
  };
  
  const handleAutoModeToggle = () => {
    setAutoMode(!autoMode);
  };
  
  return (
    <div className="app-container">
      {showInitialScreen && translations.length === 0 ? (
        <div className="initial-screen">
          <div className="initial-content">
            <div className="initial-header">
              <h1>Fahim</h1>
              <p>Seek to Understand</p>
            </div>
            <div className="language-selector">
              <select disabled>
                <option value="indonesian">Indonesian</option>
              </select>
            </div>

            <button 
              className="start-understanding-button"
              onClick={toggleRecording}
            >
              Start Understanding
            </button>
            
            <div className="initial-footer">
              <p>© Zafar Labs {new Date().getFullYear()}</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="recording-screen">
          <div className="fixed-header">
            <div className="app-branding">
              <div className="logo-container">
                <svg className="logo-icon" width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="16" cy="16" r="16" fill="#2563eb"/>
                  <path d="M10 16H22M22 16L17 11M22 16L17 21" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                <h1>Fahim</h1>
              </div>
              <p>Seek to Understand</p>
            </div>
            
            <div className="translations-header">
              <h2>Translations</h2>
              <button 
                className="clear-button" 
                onClick={handleClearTranslations}
                aria-label="Clear all translations"
              >
                Clear All
              </button>
            </div>
          </div>
          
          <div className="translations-container">
            <TranslationDisplay translations={translations} />
          </div>
          
          <div className="fixed-footer">
            <div className="bottom-controls">
              <div className="buttons-row">
                <RecordButton 
                  isRecording={isRecording}
                  isProcessing={isProcessing}
                  onClick={toggleRecording}
                  label={isRecording ? "Stop Understanding" : "Start Understanding"}
                />
                
                {!autoMode && (
                  <TranslateNowButton 
                    onClick={handleTranslateNowClick}
                    disabled={isProcessing || !isRecording}
                  />
                )}
              </div>
              
              <div className="bottom-controls-row">
                <AutoModeToggle 
                  enabled={autoMode}
                  onChange={handleAutoModeToggle}
                  disabled={isProcessing || !isRecording}
                  label="Smart Pause Detection (Experimental)"
                />
                
                {isRecording && (
                  <div className="listening-indicator">
                    <span className="listening-dot"></span>
                  </div>
                )}
              </div>
            </div>
            
            <footer>
              <p>© Zafar Labs {new Date().getFullYear()}</p>
            </footer>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
