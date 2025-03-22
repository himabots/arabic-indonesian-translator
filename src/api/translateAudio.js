/**
 * Client-side utility for sending audio to the translation API
 */

/**
 * Sends audio data to the translation API
 * @param {string} base64Audio - Base64-encoded audio data
 * @returns {Promise<object>} The API response with translation
 */
export async function sendAudioForTranslation(base64Audio) {
  try {
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audio: base64Audio }),
    });

    const data = await response.json();
    
    // Never throw errors, just return empty translation if there's an issue
    if (!response.ok) {
      console.error('Translation API error:', data);
      return { translation: '' };
    }

    return data;
  } catch (error) {
    console.error('Error sending audio for translation:', error);
    return { translation: '' };
  }
}

/**
 * Converts a Blob to base64
 * @param {Blob} blob - The audio blob to convert
 * @returns {Promise<string>} Promise resolving to base64 string
 */
export function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result.split(',')[1];
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Processes audio chunk and returns translation
 * @param {Blob} audioChunk - Audio chunk to process
 * @returns {Promise<string>} Translation result
 */
export async function translateAudioChunk(audioChunk) {
  try {
    // Only process if audio is substantial enough
    if (audioChunk.size < 10000) { // Minimum 10KB to avoid "too short" errors
      console.log('Audio chunk too small, skipping:', audioChunk.size, 'bytes');
      return '';
    }
    
    // Convert audio to base64
    const base64Audio = await blobToBase64(audioChunk);
    // Send to translation API
    const response = await sendAudioForTranslation(base64Audio);
    return response.translation || '';
  } catch (error) {
    console.error('Error processing audio chunk:', error);
    return '';
  }
}
