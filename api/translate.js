export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ translation: '' }); // Return empty instead of error
  }

  try {
    const { audio } = req.body;
    
    if (!audio) {
      return res.status(200).json({ translation: '' });
    }
    
    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audio, 'base64');
    
    // Check if audio is too small
    if (audioBuffer.length < 10000) { // Increase minimum size to 10KB
      console.log('Audio too small, skipping:', audioBuffer.length, 'bytes');
      return res.status(200).json({ translation: '' });
    }
    
    // Create FormData for Whisper API
    const formData = new FormData();
    
    // Try a different approach - convert to mp3 format or use raw PCM
    // For now, just change the MIME type and filename
    const audioBlob = new Blob([audioBuffer], { type: 'audio/mp3' });
    formData.append('file', audioBlob, 'speech.mp3');
    formData.append('model', 'whisper-large-v3');
    
    try {
      const whisperResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: formData
      });
      
      if (!whisperResponse.ok) {
        // Handle error gracefully without alerting the user
        console.error('Whisper API error status:', whisperResponse.status);
        return res.status(200).json({ translation: '' });
      }
      
      const transcription = await whisperResponse.json();
      
      if (!transcription.text || transcription.text.trim() === '') {
        return res.status(200).json({ translation: '' });
      }
      
      // Only proceed with translation if we have transcribed text
      const arabicText = transcription.text.trim();
      
      // Send to translation API
      const translationResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama3-70b-8192',
          messages: [
            {
              role: 'system',
              content: 'You are a specialized Arabic to Indonesian translator for Islamic content. Translate the following Arabic text into natural, fluent Indonesian, preserving religious terminology appropriately. Only return the translation, nothing else.'
            },
            {
              role: 'user',
              content: arabicText
            }
          ],
          temperature: 0.2,
          max_tokens: 512
        })
      });
      
      if (!translationResponse.ok) {
        console.error('Translation API error status:', translationResponse.status);
        return res.status(200).json({ translation: '' });
      }
      
      const translationResult = await translationResponse.json();
      const translation = translationResult.choices[0].message.content;
      
      return res.status(200).json({ translation });
      
    } catch (error) {
      console.error('API processing error:', error);
      return res.status(200).json({ translation: '' });
    }
  } catch (error) {
    console.error('Server error:', error);
    return res.status(200).json({ translation: '' });
  }
}
