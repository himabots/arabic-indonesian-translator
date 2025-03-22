export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { audio } = req.body;
    
    if (!audio) {
      return res.status(200).json({ translation: '' }); // Return empty instead of error
    }
    
    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audio, 'base64');
    
    // Check if audio is too small (less than 5KB)
    if (audioBuffer.length < 5000) {
      console.log('Audio too small, skipping:', audioBuffer.length, 'bytes');
      return res.status(200).json({ translation: '' });
    }
    
    // Create FormData for Whisper API
    const formData = new FormData();
    
    // Create a blob with proper MIME type
    const audioBlob = new Blob([audioBuffer], { type: 'audio/webm;codecs=opus' });
    formData.append('file', audioBlob, 'speech.webm');
    formData.append('model', 'whisper-large-v3');
    
    // Send to Whisper API
    try {
      const whisperResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: formData
      });
      
      if (!whisperResponse.ok) {
        const errorData = await whisperResponse.text();
        console.error('Whisper API error:', errorData);
        return res.status(200).json({ translation: '' }); // Return empty instead of error
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
        const errorData = await translationResponse.text();
        console.error('Translation API error:', errorData);
        return res.status(200).json({ translation: '' }); // Return empty instead of error
      }
      
      const translationResult = await translationResponse.json();
      const translation = translationResult.choices[0].message.content;
      
      // Return both the original text and translation
      return res.status(200).json({ 
        translation,
        originalText: arabicText
      });
      
    } catch (error) {
      console.error('API processing error:', error);
      return res.status(200).json({ translation: '' }); // Return empty instead of error
    }
  } catch (error) {
    console.error('Server error:', error);
    return res.status(200).json({ translation: '' }); // Return empty instead of error
  }
}
