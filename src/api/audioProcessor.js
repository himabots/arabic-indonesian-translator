import { fetchFile, FFmpeg } from '@ffmpeg/ffmpeg';
import { toBlobURL } from '@ffmpeg/util';

// Create a singleton instance
let ffmpegInstance = null;
let isFFmpegLoaded = false;
let loadingPromise = null;

// Function to load FFmpeg
const loadFFmpeg = async () => {
  if (loadingPromise) return loadingPromise;
  
  loadingPromise = (async () => {
    try {
      if (ffmpegInstance) return;
      
      console.log('Loading FFmpeg WASM...');
      const ffmpeg = new FFmpeg();

      // Load FFmpeg WebAssembly modules
      const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.2/dist/umd';
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
      });
      
      console.log('FFmpeg loaded successfully');
      ffmpegInstance = ffmpeg;
      isFFmpegLoaded = true;
    } catch (error) {
      console.error('Error loading FFmpeg:', error);
      loadingPromise = null;
      throw error;
    }
  })();
  
  return loadingPromise;
};

/**
 * Process audio blob to ensure it has proper headers and format
 * @param {Blob} audioBlob - Raw audio blob
 * @returns {Promise<Blob>} Processed audio blob
 */
export const processAudioChunk = async (audioBlob) => {
  try {
    // Load FFmpeg if not already loaded
    if (!isFFmpegLoaded) {
      await loadFFmpeg();
    }
    
    const ffmpeg = ffmpegInstance;
    if (!ffmpeg) {
      console.error('FFmpeg not available');
      return audioBlob; // Return original as fallback
    }
    
    // Convert blob to array buffer
    const inputData = await fetchFile(audioBlob);
    
    // Write the input file to FFmpeg's virtual file system
    await ffmpeg.writeFile('input.webm', inputData);
    
    // Run FFmpeg command to create a proper wav file with headers
    // -af aresample=async=1 helps with uneven audio durations
    await ffmpeg.exec([
      '-i', 'input.webm',
      '-c:a', 'pcm_s16le',  // PCM 16-bit little-endian (standard WAV format)
      '-af', 'aresample=async=1',
      '-ar', '16000',       // 16kHz sample rate optimized for Whisper
      '-ac', '1',           // Mono audio
      'output.wav'
    ]);
    
    // Read the output file
    const outputData = await ffmpeg.readFile('output.wav');
    
    // Create a new blob with the processed data
    const processedBlob = new Blob([outputData], { type: 'audio/wav' });
    console.log(`Processed audio: ${audioBlob.size} bytes -> ${processedBlob.size} bytes`);
    
    return processedBlob;
  } catch (error) {
    console.error('Error processing audio with FFmpeg:', error);
    // Return original blob as fallback in case of error
    return audioBlob;
  }
};
