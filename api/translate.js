export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(200).json({ translation: '' });
  }

  try {
    const { audio } = req.body;
    
    if (!audio) {
      return res.status(200).json({ translation: '' });
    }
    
    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audio, 'base64');
    
    // Skip processing if audio is too small - minimum 20KB to ensure it's long enough
    if (audioBuffer.length < 20000) {
      console.log('Audio too small, skipping:', audioBuffer.length, 'bytes');
      return res.status(200).json({ translation: '' });
    }
    
    try {
      // Create FormData for Whisper API
      const formData = new FormData();
      
      // Use proper MIME type that Whisper expects
      const audioBlob = new Blob([audioBuffer], { type: 'audio/webm' });
      formData.append('file', audioBlob, 'speech.webm');
      formData.append('model', 'whisper-large-v3');
      
      const whisperResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: formData
      });
      
      if (!whisperResponse.ok) {
        console.error('Whisper API error status:', whisperResponse.status);
        // Try one more time with a different MIME type if it failed
        if (whisperResponse.status === 400) {
          console.log('Retrying with different MIME type...');
          
          const retryFormData = new FormData();
          const retryBlob = new Blob([audioBuffer], { type: 'audio/mp3' });
          retryFormData.append('file', retryBlob, 'speech.mp3');
          retryFormData.append('model', 'whisper-large-v3');
          
          const retryResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
            },
            body: retryFormData
          });
          
          if (!retryResponse.ok) {
            console.error('Retry also failed:', retryResponse.status);
            return res.status(200).json({ translation: '' });
          }
          
          const retryTranscription = await retryResponse.json();
          if (!retryTranscription.text || retryTranscription.text.trim() === '') {
            return res.status(200).json({ translation: '' });
          }
          
          const retryArabicText = retryTranscription.text.trim();
          console.log('Retry transcribed text:', retryArabicText);
          
          // Proceed with translation using the retry text
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
                  content: retryArabicText
                }
              ],
              temperature: 0.2,
              max_tokens: 512
            })
          });
          
          if (!translationResponse.ok) {
            console.error('Translation API error:', translationResponse.status);
            return res.status(200).json({ translation: '' });
          }
          
          const translationResult = await translationResponse.json();
          const translation = translationResult.choices[0].message.content;
          
          return res.status(200).json({ translation });
        }
        
        return res.status(200).json({ translation: '' });
      }
      
      const transcription = await whisperResponse.json();
      
      if (!transcription.text || transcription.text.trim() === '') {
        return res.status(200).json({ translation: '' });
      }
      
      const arabicText = transcription.text.trim();
      console.log('Transcribed text:', arabicText);
      
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
        console.error('Translation API error:', translationResponse.status);
        return res.status(200).json({ translation: '' });
      }
      
      const translationResult = await translationResponse.json();
      const translation = translationResult.choices[0].message.content;
      console.log('Translation result:', translation);
      
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
