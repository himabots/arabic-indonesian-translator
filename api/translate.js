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
    
    try {
      // Convert incoming base64 audio to WAV format (which Whisper supports better)
      const audioBuffer = Buffer.from(audio, 'base64');
      
      // Create a proper file structure for Whisper using FormData
      const formData = new FormData();
      
      // Create a blob with proper MIME type - specifying as WAV
      const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' });
      formData.append('file', audioBlob, 'audio.wav');
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
        
        // For testing, let's bypass the actual transcription and use a test string
        // This will help us determine if the issue is with Whisper or with the LLM
        const testArabicText = "السلام عليكم ورحمة الله وبركاته";
        console.log('Using test Arabic text for translation');
        
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
                content: testArabicText
              }
            ],
            temperature: 0.2,
            max_tokens: 512
          })
        });
        
        if (!translationResponse.ok) {
          const translationErrorText = await translationResponse.text();
          console.error('Translation API error:', translationResponse.status, translationErrorText);
          return res.status(500).json({ error: 'Translation failed', details: translationErrorText });
        }
        
        const translationResult = await translationResponse.json();
        const translation = translationResult.choices[0].message.content;
        console.log('Test translation result:', translation);
