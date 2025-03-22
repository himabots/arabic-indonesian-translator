import { processAudioChunk } from './audioProcessor';

/**
 * Sends audio data to the translation API
 * @param {string} base64Audio - Base64-encoded audio data
 * @returns {Promise<string>} The translated text
 */
export async function sendAudioForTranslation(base64Audio) {
  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audio: base64Audio }),
    }).catch(error => {
      console.error('Fetch error in sendAudioForTranslation:', error);
      return { ok: false, json: () => Promise.resolve({}) };
    });

    // Never show errors to the user, just return empty string or translation
    try {
      const data = await response.json().catch(error => {
        console.error('JSON parse error:', error);
        return {};
      });
      return data.translation || '';
    } catch (parseError) {
      console.error('Error parsing JSON response:', parseError);
      return '';
    }
  } catch (error) {
    console.error('Error sending audio for translation:', error);
    return '';
  }
}

/**
 * Converts a Blob to base64
 * @param {Blob} blob - The audio blob to convert
 * @returns {Promise<string>} Promise resolving to base64 string
 */
export function blobToBase64(blob) {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onloadend = () => {
        try {
          const base64String = reader.result.split(',')[1];
          resolve(base64String);
        } catch (error) {
          console.error('Error extracting base64:', error);
          resolve(''); // Resolve with empty string instead of rejecting
        }
      };
      reader.onerror = (error) => {
        console.error('FileReader error:', error);
        resolve(''); // Resolve with empty string instead of rejecting
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error in blobToBase64:', error);
      resolve('');
    }
  });
}

/**
 * Processes audio chunk and returns translation
 * @param {Blob} audioChunk - Audio chunk to process
 * @returns {Promise<string>} Translation result
 */
export async function translateAudioChunk(audioChunk) {
  try {
    console.log('Processing audio chunk with size:', audioChunk.size);
    
    // Process the audio chunk with FFmpeg (ensure proper formatting)
    const processedBlob = await processAudioChunk(audioChunk);
    console.log('Audio processed, new size:', processedBlob.size);
    
    // Convert processed audio to base64
    const base64Audio = await blobToBase64(processedBlob);
    
    if (!base64Audio) {
      console.log('Empty base64 audio, skipping translation');
      return '';
    }
    
    console.log('Sending processed audio for translation');
    // Send to translation API
    return await sendAudioForTranslation(base64Audio);
  } catch (error) {
    console.error('Error processing audio chunk:', error);
    return '';
  }
}
