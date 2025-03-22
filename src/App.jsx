import React, { useState, useRef, useEffect } from 'react';
import RecordButton from './components/RecordButton';
import TranslateNowButton from './components/TranslateNowButton';
import TranslationDisplay from './components/TranslationDisplay';
import AutoModeToggle from './components/AutoModeToggle';
import { translateAudioChunk } from './api/translateAudio';
import './App.css';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [translations, setTranslations] = useState([]); // Array of translation entries
  const [audioLevel, setAudioLevel] = useState(0);
  const [finalMode, setFinalMode] = useState(false);
  const [autoMode, setAutoMode] = useState(false); // Auto mode toggle state
  
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioDataRef = useRef(new Uint8Array(0));
  const animationFrameRef = useRef(null);
  const audioChunksRef = useRef([]);  // Store all chunks during recording
  const allAudioChunksRef = useRef([]); // For final complete processing
  const processingRef = useRef(false);
  const translationIntervalRef = useRef(null);
  const autoModeIntervalRef = useRef(null);
  const lastChunkTimestampRef = useRef([]); // Track timestamps for each chunk
  const lastProcessedIndexRef = useRef(0); // Last processed chunk index
  
  // Auto-translation interval in milliseconds
  const AUTO_TRANSLATION_INTERVAL = 15000; // 15 seconds
  const AUTO_MODE_CYCLE_INTERVAL = 15000; // 15 seconds for auto mode cycle
  
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
      if (translationIntervalRef.current) {
        clearInterval(translationIntervalRef.current);
      }
      if (autoModeIntervalRef.current) {
        clearInterval(autoModeIntervalRef.current);
      }
    };
  }, []);

  // Effect to handle Auto Mode changes
  useEffect(() => {
    // Clear any existing auto mode interval
    if (autoModeIntervalRef.current) {
      clearInterval(autoModeIntervalRef.current);
      autoModeIntervalRef.current = null;
    }
    
    // If auto mode is enabled and we're recording, set up the cycle
    if (autoMode && isRecording) {
      startAutoModeCycle();
    }
  }, [autoMode, isRecording]);
  
  const startAutoModeCycle = () => {
    // Initial cycle starts after the interval
    autoModeIntervalRef.current = setTimeout(async () => {
      if (isRecording && autoMode) {
        // Only proceed if we're still recording and in auto mode
        await cycleRecording();
        
        // Set up recurring interval
        autoModeIntervalRef.current = setInterval(async () => {
          if (isRecording && autoMode) {
            await cycleRecording();
          } else {
            // Clear interval if not recording or auto mode disabled
            clearInterval(autoModeIntervalRef.current);
            autoModeIntervalRef.current = null;
          }
        }, AUTO_MODE_CYCLE_INTERVAL);
      }
    }, AUTO_MODE_CYCLE_INTERVAL);
  };
  
  const cycleRecording = async () => {
    console.log('Auto mode cycle: stopping recording');
    
    // Process the current recording
    await processCycleRecording();
    
    // Wait a short moment before restarting
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Restart recording if still in auto mode
    if (autoMode) {
      console.log('Auto mode cycle: restarting recording');
      await restartRecording();
    }
  };
  
  const processCycleRecording = async () => {
    // Stop the media recorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    
    // Process the audio recorded so far
    if (allAudioChunksRef.current.length > 0) {
      setIsProcessing(true);
      
      try {
        // Combine all audio chunks into a single blob
        const audioBlob = new Blob(allAudioChunksRef.current, { type: 'audio/webm;codecs=opus' });
        
        console.log('Processing auto cycle recording of size:', audioBlob.size, 'bytes');
        
        const result = await translateAudioChunk(audioBlob).catch(error => {
          console.error('Error in cycle translateAudioChunk:', error);
          return '';
        });
        
        if (result) {
          console.log('Cycle translation received:', result);
          
          // Add translation with timestamp
          const timestamp = new Date().toLocaleTimeString();
          setTranslations(prev => [
            ...prev, 
            { 
              id: Date.now(), 
              text: result, 
              timestamp,
              final: true,
              isSessionEnd: false // Not a full stop, just a cycle
            }
          ]);
        } else {
          console.log('No cycle translation result received');
        }
      } catch (error) {
        console.error('Error processing cycle recording:', error);
      } finally {
        setIsProcessing(false);
      }
    }
  };
  
  const restartRecording = async () => {
    // Reset recording session variables but keep the stream
    audioChunksRef.current = [];
    allAudioChunksRef.current = [];
    lastChunkTimestampRef.current = [];
    lastProcessedIndexRef.current = 0;
    
    // Create new media recorder with the existing stream
    if (streamRef.current) {
      try {
        // Check for supported MIME types (important for mobile)
        let options;
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          options = { 
            mimeType: 'audio/webm;codecs=opus',
            audioBitsPerSecond: 128000 
          };
        } else if (MediaRecorder.isTypeSupported('audio/webm')) {
          options = { 
            mimeType: 'audio/webm',
            audioBitsPerSecond: 128000 
          };
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          options = { 
            mimeType: 'audio/mp4',
            audioBitsPerSecond: 128000 
          };
        } else {
          // Use default options
          options = {};
        }
        
        // Create media recorder with selected options
        const mediaRecorder = new MediaRecorder(streamRef.current, options);
        mediaRecorderRef.current = mediaRecorder;
        
        // Handle audio data
        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            // Store the timestamp with each chunk
            const timestamp = Date.now();
            audioChunksRef.current.push(event.data);
            allAudioChunksRef.current.push(event.data);
            lastChunkTimestampRef.current.push(timestamp);
          }
        };
        
        // Start media recorder
        mediaRecorder.start(500);
      } catch (error) {
        console.error('Error restarting media recorder:', error);
      }
    }
  };

  const requestMicrophonePermission = async () => {
    try {
      // Try to get access directly (most browsers will prompt if needed)
      console.log('Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // If we get here, permission was granted
      // Stop the stream right away since we're just checking permissions
      stream.getTracks().forEach(track => track.stop());
      console.log('Microphone permission granted');
      return true;
    } catch (error) {
      console.error('Error requesting microphone permission:', error);
      return false;
    }
  };
  
  const toggleRecording = async () => {
    if (isRecording) {
      // Stop recording
      stopRecording();
    } else {
      try {
        // First, check/request microphone permission
        const hasPermission = await requestMicrophonePermission();
        
        if (!hasPermission) {
          // Show a more helpful error message for mobile users
          const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
          if (isMobile) {
            alert('Microphone access is required but was denied. On mobile, you may need to:\n\n' +
                  '1. Check your browser settings\n' +
                  '2. Make sure the site has permission to use your microphone\n' +
                  '3. Try reloading the page and allow access when prompted');
          } else {
            alert('Please allow microphone access to use this app.');
          }
          return;
        }
        
        // Now start the recording
        await startRecording();
      } catch (error) {
        console.error('Error in toggleRecording:', error);
        
        // More detailed error message
        const errorMessage = error.name === 'NotAllowedError' ? 
          'Microphone access was denied. Please allow microphone access and try again.' :
          'Error starting recording. Please make sure your device has a working microphone.';
        
        alert(errorMessage);
      }
    }
  };
  
  const startRecording = async () => {
    // Reset recording session variables but DON'T clear translations history
    setFinalMode(false);
    audioChunksRef.current = [];
    allAudioChunksRef.current = [];
    lastChunkTimestampRef.current = [];
    lastProcessedIndexRef.current = 0;
    
    try {
      // Get audio stream with explicit constraints for better mobile compatibility
      const constraints = { 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          // Some mobile browsers work better with these explicit values
          sampleRate: 44100,
          channelCount: 1
        } 
      };
      
      console.log('Requesting audio stream with constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      // Log available audio tracks to verify we have audio
      const audioTracks = stream.getAudioTracks();
      console.log(`Got ${audioTracks.length} audio tracks:`, audioTracks.map(t => t.label));
      
      // Setup audio context and analyzer with error handling
      try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = audioContext;
        
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyserRef.current = analyser;
        
        const source = audioContext.createMediaStreamSource(stream);
        source.connect(analyser);
        
        audioDataRef.current = new Uint8Array(analyser.frequencyBinCount);
        
        // Start monitoring audio levels
        startAudioMonitoring();
      } catch (audioContextError) {
        console.error('Error setting up audio context:', audioContextError);
        // Continue anyway, as we can still record even if visualization fails
      }
      
      // Check for supported MIME types (important for mobile)
      let options;
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        options = { 
          mimeType: 'audio/webm;codecs=opus',
          audioBitsPerSecond: 128000 
        };
        console.log('Using audio/webm;codecs=opus');
      } else if (MediaRecorder.isTypeSupported('audio/webm')) {
        options = { 
          mimeType: 'audio/webm',
          audioBitsPerSecond: 128000 
        };
        console.log('Using audio/webm');
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        options = { 
          mimeType: 'audio/mp4',
          audioBitsPerSecond: 128000 
        };
        console.log('Using audio/mp4');
      } else {
        // Use default options
        options = {};
        console.log('Using default MediaRecorder options');
      }
      
      // Create media recorder with selected options
      console.log('Creating MediaRecorder with options:', options);
      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      
      // Handle audio data
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          // Store the timestamp with each chunk
          const timestamp = Date.now();
          audioChunksRef.current.push(event.data);
          allAudioChunksRef.current.push(event.data);
          lastChunkTimestampRef.current.push(timestamp);
          
          console.log(`Audio chunk received: ${event.data.size} bytes, timestamp: ${timestamp}`);
        }
      };
      
      // Start media recorder
      mediaRecorder.start(500);
      console.log('MediaRecorder started');
      setIsRecording(true);
      
      // Set up auto mode cycle if enabled
      if (autoMode) {
        startAutoModeCycle();
      }
      
    } catch (error) {
      console.error('Error in startRecording:', error);
      throw error; // Re-throw to be handled by toggleRecording
    }
  };
  
  const startAudioMonitoring = () => {
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
      
      // Continue monitoring if still recording
      if (isRecording) {
        animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
      }
    };
    
    // Start the monitoring loop
    animationFrameRef.current = requestAnimationFrame(updateAudioLevel);
  };
  
  const stopRecording = () => {
    // Stop auto mode interval
    if (autoModeIntervalRef.current) {
      clearInterval(autoModeIntervalRef.current);
      autoModeIntervalRef.current = null;
    }
    
    // Stop auto-translation interval
    if (translationIntervalRef.current) {
      clearInterval(translationIntervalRef.current);
      translationIntervalRef.current = null;
    }
    
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
    
    // Stop all tracks in the stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    // Process the complete recording using allAudioChunksRef
    if (allAudioChunksRef.current.length > 0) {
      setFinalMode(true);
      processFinalRecording();
    }
    
    // Reset audio level
    setAudioLevel(0);
    setIsRecording(false);
  };
  
  const processCurrentAudio = async () => {
    // Don't process if already processing or no audio
    if (processingRef.current || audioChunksRef.current.length === 0) return;
    
    processingRef.current = true;
    setIsProcessing(true);
    
    try {
      // Combine audio chunks into a single blob
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm;codecs=opus' });
      
      console.log('Processing current audio of size:', audioBlob.size, 'bytes');
      
      const translationResult = await translateAudioChunk(audioBlob).catch(error => {
        console.error('Error in translateAudioChunk:', error);
        return '';
      });
      
      if (translationResult) {
        console.log('Translation received:', translationResult);
        
        // Add new translation to the history with timestamp
        const timestamp = new Date().toLocaleTimeString();
        setTranslations(prev => [
          ...prev, 
          { 
            id: Date.now(), 
            text: translationResult, 
            timestamp,
            interim: true 
          }
        ]);
      } else {
        console.log('No translation result received');
      }
    } catch (error) {
      console.error('Error processing audio segment:', error);
    } finally {
      processingRef.current = false;
      setIsProcessing(false);
    }
  };
  
  const processFinalRecording = async () => {
    setIsProcessing(true);
    
    try {
      // Combine all audio chunks into a single blob
      const audioBlob = new Blob(allAudioChunksRef.current, { type: 'audio/webm;codecs=opus' });
      
      console.log('Processing final recording of size:', audioBlob.size, 'bytes');
      
      const result = await translateAudioChunk(audioBlob).catch(error => {
        console.error('Error in final translateAudioChunk:', error);
        return '';
      });
      
      if (result) {
        console.log('Final translation received:', result);
        
        // Add final translation with timestamp
        const timestamp = new Date().toLocaleTimeString();
        setTranslations(prev => [
          ...prev, 
          { 
            id: Date.now(), 
            text: result, 
            timestamp,
            final: true,
            isSessionEnd: true // Mark this as a session end for visual separation
          }
        ]);
      } else {
        console.log('No final translation result received');
      }
    } catch (error) {
      console.error('Error processing final recording:', error);
    } finally {
      setIsProcessing(false);
    }
  };
  
  // Clear all translations
  const handleClearTranslations = () => {
    setTranslations([]);
  };
  
  // Handle manual translation button click
  const handleTranslateNowClick = () => {
    if (isRecording && !processingRef.current && audioChunksRef.current.length > 0) {
      processCurrentAudio();
    }
  };
  
  // Handle auto mode toggle
  const handleAutoModeToggle = () => {
    setAutoMode(!autoMode);
  };
  
  return (
    <div className="app-container">
      <header>
        <h1>Arabic to Indonesian Translator</h1>
        <p>Start recording to translate Arabic speech to Bahasa Indonesia</p>
      </header>
      
      <main>
        <div className="translations-header">
          <h2>Translations</h2>
          {translations.length > 0 && (
            <button 
              className="clear-button" 
              onClick={handleClearTranslations}
              aria-label="Clear all translations"
            >
              Clear All
            </button>
          )}
        </div>
        <TranslationDisplay translations={translations} />
        
        <div className="controls-container">
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
          
          <div className="buttons-row">
            <RecordButton 
              isRecording={isRecording} 
              isProcessing={isProcessing}
              onClick={toggleRecording} 
            />
            
            {isRecording && !autoMode && (
              <TranslateNowButton 
                onClick={handleTranslateNowClick}
                disabled={isProcessing || audioChunksRef.current.length === 0}
              />
            )}
          </div>
          
          <AutoModeToggle 
            enabled={autoMode}
            onChange={handleAutoModeToggle}
            disabled={isProcessing}
          />
          
          {isRecording && (
            <div className="recording-indicator">
              <span className="recording-dot"></span>
              Recording... <br />
              <span className="recording-help">
                {autoMode 
                  ? "Auto mode: Translating every 5 seconds" 
                  : "For best results, stop recording after each segment to see translation"}
              </span>
            </div>
          )}
          
          {isProcessing && (
            <div className="processing-indicator">
              {finalMode ? 
                "Processing final translation..." : 
                "Processing translation..."}
            </div>
          )}
        </div>
      </main>
      
      <footer>
        <p>© Zafar Labs {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

export default App;
