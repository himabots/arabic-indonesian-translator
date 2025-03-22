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
  const [finalMode, setFinalMode] = useState(false);
  
  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioDataRef = useRef(new Uint8Array(0));
  const animationFrameRef = useRef(null);
  const audioChunksRef = useRef([]);
  const allAudioChunksRef = useRef([]); // Store all audio for final processing
  const silenceTimerRef = useRef(null);
  const lastAudioLevelRef = useRef(0);
  const speechStartTimeRef = useRef(0);
  const processingRef = useRef(false);
  const accumulatedBytesRef = useRef(0); // Track total size of accumulated audio
  const minChunkSizeBytes = 10000; // Minimum 10KB before processing (reduced from 20KB)
  
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
    setTranslation('');
    setLastPauseTime(0);
    setFinalMode(false);
    accumulatedBytesRef.current = 0;
    audioChunksRef.current = [];
    allAudioChunksRef.current = [];
    
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
          console.log(`Audio chunk received: ${event.data.size} bytes`);
          audioChunksRef.current.push(event.data);
          allAudioChunksRef.current.push(event.data);
          accumulatedBytesRef.current += event.data.size;
          console.log(`Total accumulated bytes: ${accumulatedBytesRef.current}`);
        }
      };
      
      // Start media recorder
      mediaRecorder.start(500);
      console.log('MediaRecorder started');
      setIsRecording(true);
      
      // Reset the silence detection
      lastAudioLevelRef.current = 0;
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
      }
    } catch (error) {
      console.error('Error in startRecording:', error);
      throw error; // Re-throw to be handled by toggleRecording
    }
  };
  
  const startAudioMonitoring = () => {
    // Speech detection parameters
    const NOISE_THRESHOLD = 10; // Lower threshold to detect more subtle speech
    const SPEECH_PAUSE_DURATION = 1000; // 1 second of silence to consider it a pause
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
            
            console.log(`Speech pause detected - Duration: ${speechDuration}ms, Accumulated bytes: ${accumulatedBytesRef.current}, Min required: ${minChunkSizeBytes}`);
            
            // Only process if the speech segment was long enough, we have enough audio data,
            // and we're not already processing
            if (speechDuration >= MIN_SPEECH_DURATION && 
                accumulatedBytesRef.current >= minChunkSizeBytes && 
                !processingRef.current) {
              console.log(`Will process speech segment - sufficient data collected`);
              
              // Process the audio if we have enough chunks
              if (audioChunksRef.current.length > 0) {
                processSpeechSegment();
              }
            } else {
              console.log(
                `Not processing yet - ` +
                `speech duration: ${speechDuration}ms (min: ${MIN_SPEECH_DURATION}ms), ` +
                `accumulated bytes: ${accumulatedBytesRef.current} (min: ${minChunkSizeBytes}), ` +
                `already processing: ${processingRef.current}`
              );
            }
            
            isSpeaking = false;
            pauseStartTime = 0;
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
    
    // Process the complete recording using allAudioChunksRef
    if (allAudioChunksRef.current.length > 0) {
      setFinalMode(true);
      processFinalRecording();
    }
    
    // Reset audio level
    setAudioLevel(0);
    setIsRecording(false);
  };
  
  const processSpeechSegment = async () => {
    // Set processing flag to prevent multiple simultaneous processing
    if (processingRef.current) return;
    
    processingRef.current = true;
    setIsProcessing(true);
    
    try {
      // Make a copy of the current chunks and then clear the array for new data
      const chunksToProcess = [...audioChunksRef.current];
      audioChunksRef.current = [];
      accumulatedBytesRef.current = 0; // Reset accumulated bytes count
      
      // Combine all audio chunks into a single blob with proper MIME type
      const audioBlob = new Blob(chunksToProcess, { type: 'audio/webm;codecs=opus' });
      
      console.log('Processing audio segment of size:', audioBlob.size, 'bytes');
      
      // Pause between processing segments to avoid overwhelming the API
      const now = Date.now();
      const timeSinceLastPause = now - lastPauseTime;
      if (timeSinceLastPause < 1000) {
        // If less than 1 second since last processing, wait a bit
        await new Promise(resolve => setTimeout(resolve, 1000 - timeSinceLastPause));
      }
      
      const result = await translateAudioChunk(audioBlob).catch(error => {
        console.error('Error in translateAudioChunk:', error);
        return '';
      });
      
      setLastPauseTime(Date.now());
      
      if (result) {
        console.log('Translation received:', result);
        // Append to existing translation with a space
        setTranslation(prev => {
          const separator = prev ? ' ' : '';
          return prev + separator + result;
        });
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
      
      // For final processing, clear translation first to show only the complete result
      setTranslation('');
      
      const result = await translateAudioChunk(audioBlob).catch(error => {
        console.error('Error in final translateAudioChunk:', error);
        return '';
      });
      
      if (result) {
        console.log('Final translation received:', result);
        setTranslation(result);
      } else {
        console.log('No final translation result received');
      }
    } catch (error) {
      console.error('Error processing final recording:', error);
    } finally {
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
            {accumulatedBytesRef.current < minChunkSizeBytes ? 
              "Recording... (Waiting for enough speech to process)" :
              "Recording... (Translation will appear after speech pauses)"}
          </div>
        )}
        
        {isProcessing && (
          <div className="processing-indicator">
            {finalMode ? 
              "Processing final translation..." : 
              "Processing translation..."}
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
