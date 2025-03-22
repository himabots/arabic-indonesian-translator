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
    console.log('Sending audio for translation, length:', base64Audio.length);
    
    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ audio: base64Audio }),
    });

    console.log('Response status:', response.status);
    
    const data = await response.json();
    console.log('Response data:', data);
    
    if (!response.ok) {
      throw new Error(`Translation API error: ${data.error || response.statusText}. Details: ${data.details || 'No details provided'}`);
    }

    return data.translation || '';
  } catch (error) {
    console.error('Error sending audio for translation:', error);
    alert(`Translation error: ${error.message}`);
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
    // Convert audio to base64
    const base64Audio = await blobToBase64(audioChunk);
    // Send to translation API
    return await sendAudioForTranslation(base64Audio);
  } catch (error) {
    console.error('Error processing audio chunk:', error);
    return '';
  }
}
