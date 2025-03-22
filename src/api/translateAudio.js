/**
 * Client-side utility for sending audio to the translation API
 */

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
    });

    // Never show errors to the user, just return empty string or translation
    try {
      const data = await response.json();
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
  return new Promise((resolve, reject) => {
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
  });
}

/**
 * Processes audio chunk and returns translation
 * @param {Blob} audioChunk - Audio chunk to process
 * @returns {Promise<string>} Translation result
 */
export async function translateAudioChunk(audioChunk) {
  try {
    // Convert audio to base64
    const base64Audio = await blobToBase64(audioChunk);
    
    if (!base64Audio) {
      console.log('Empty base64 audio, skipping translation');
      return '';
    }
    
    // Send to translation API
    return await sendAudioForTranslation(base64Audio);
  } catch (error) {
    console.error('Error processing audio chunk:', error);
    return '';
  }
}
