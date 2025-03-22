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

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Translation API error: ${errorData.error || response.statusText}`);
    }

    const data = await response.json();
    return data.translation || '';
  } catch (error) {
    console.error('Error sending audio for translation:', error);
    throw error;
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
export async function processAudioChunk(audioChunk) {
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
