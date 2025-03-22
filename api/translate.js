export default async function handler(req, res) {
  console.log('Translate function called');
  
  if (req.method !== 'POST') {
    console.log('Method not allowed:', req.method);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('Request body received:', !!req.body);
    const { audio } = req.body;
    
    if (!audio) {
      console.log('No audio data provided');
      return res.status(400).json({ error: 'No audio data provided' });
    }
    
    console.log('Audio data length:', audio.length);
    console.log('API Key present:', !!process.env.GROQ_API_KEY);
    
    // Convert base64 to buffer
    const audioBuffer = Buffer.from(audio, 'base64');
    console.log('Converted to buffer, length:', audioBuffer.length);
    
    // Step 1: Transcribe audio with Whisper via Groq
    try {
      console.log('Creating FormData for Whisper API');
      const formData = new FormData();
      formData.append('file', new Blob([audioBuffer], { type: 'audio/webm' }), 'audio.webm');
      formData.append('model', 'whisper-large-v3');
      
      console.log('Sending request to Whisper API');
      const whisperResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: formData
      });
      
      if (!whisperResponse.ok) {
        const errorText = await whisperResponse.text();
        console.error('Whisper API error:', whisperResponse.status, errorText);
        return res.status(500).json({ error: 'Transcription failed', details: errorText });
      }
      
      const transcription = await whisperResponse.json();
      console.log('Received transcription:', transcription);
      
      if (!transcription.text || transcription.text.trim() === '') {
        console.log('No speech detected in audio');
        return res.status(200).json({ translation: '' });
      }
      
      console.log('Transcribed text:', transcription.text);
      
      // Step 2: Translate with LLM
      console.log('Sending request to LLM for translation');
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
              content: transcription.text
            }
          ],
          temperature: 0.2,
          max_tokens: 512
        })
      });
      
      if (!translationResponse.ok) {
        const errorText = await translationResponse.text();
        console.error('Translation API error:', translationResponse.status, errorText);
        return res.status(500).json({ error: 'Translation failed', details: errorText });
      }
      
      const translationResult = await translationResponse.json();
      console.log('Received translation result:', !!translationResult);
      const translation = translationResult.choices[0].message.content;
      console.log('Final translation:', translation);
      
      return res.status(200).json({ translation });
    } catch (innerError) {
      console.error('Inner try block error:', innerError.message);
      return res.status(500).json({ error: 'API processing error', details: innerError.message });
    }
  } catch (error) {
    console.error('Translation processing error:', error.message, error.stack);
    return res.status(500).json({ error: 'Translation processing failed', details: error.message });
  }
}
