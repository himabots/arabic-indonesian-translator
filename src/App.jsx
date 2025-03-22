import React, { useState, useRef, useEffect } from 'react';
import RecordButton from './components/RecordButton';
import TranslationDisplay from './components/TranslationDisplay';
import TranslateNowButton from './components/TranslateNowButton';
import { translateAudioChunk } from './api/translateAudio';
import './App.css';

function App() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [translations, setTranslations] = useState([]); // Array of translation entries
  const [audioLevel, setAudioLevel] = useState(0);
  const [finalMode, setFinalMode] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioDataRef = useRef(new Uint8Array(0));
  const animationFrameRef = useRef(null);
  const audioChunksRef = useRef([]);
  const allAudioChunksRef = useRef([]); // Store all audio for final processing
  const processingRef = useRef(false);
  const translationIntervalRef = useRef(null);
  const lastTranslationTimeRef = useRef(0);
  
  // Auto-translation interval in milliseconds
  const AUTO_TRANSLATION_INTERVAL = 5000; // 5 seconds
  
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
    };
  }, []);

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
    // Reset states
    setTranslations([]);
    setFinalMode(false);
    audioChunksRef.current = [];
    allAudioChunksRef.current = [];
    lastTranslationTimeRef.current = Date.now();
    
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
          audioChunksRef.current.push(event.data);
          allAudioChunksRef.current.push(event.data);
        }
      };
      
      // Start media recorder
      mediaRecorder.start(500);
      console.log('MediaRecorder started');
      setIsRecording(true);
      
      // Set up auto-translation interval
      translationIntervalRef.current = setInterval(() => {
        if (audioChunksRef.current.length > 0 && !processingRef.current) {
          console.log('Auto-translation triggered after 5 seconds');
          processCurrentAudio();
        }
      }, AUTO_TRANSLATION_INTERVAL);
      
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
      // Make a copy of the current chunks
      const chunksToProcess = [...audioChunksRef.current];
      
      // Clear the chunks array to collect new audio while processing
      audioChunksRef.current = [];
      
      // Combine audio chunks into a single blob
      const audioBlob = new Blob(chunksToProcess, { type: 'audio/webm;codecs=opus' });
      
      console.log('Processing interim audio segment of size:', audioBlob.size, 'bytes');
      
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
      
      lastTranslationTimeRef.current = Date.now();
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
            final: true 
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
  
  // Handle manual translation button click
  const handleTranslateNowClick = () => {
    if (isRecording && !processingRef.current && audioChunksRef.current.length > 0) {
      processCurrentAudio();
    }
  };
  
  return (
    <div className="app-container">
      <header>
        <h1>Arabic to Indonesian Translator</h1>
        <p>Start recording to translate Arabic speech to Bahasa Indonesia</p>
      </header>
      
      <main>
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
            
            {isRecording && (
              <TranslateNowButton 
                onClick={handleTranslateNowClick}
                disabled={isProcessing || audioChunksRef.current.length === 0}
              />
            )}
          </div>
          
          {isRecording && (
            <div className="recording-indicator">
              Recording... (Translations appear every 5 seconds)
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
