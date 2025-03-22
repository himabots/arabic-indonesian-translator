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
