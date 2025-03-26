# Fahim: Real-Time Arabic to Indonesian Translation App

## Overview

Fahim is a mobile-first web application designed to provide real-time translation from Arabic to Indonesian, specifically tailored for understanding Islamic content during sermons, conversations, and religious gatherings.

### Key Features

- 🎙️ Real-time audio translation
- 🌐 Arabic to Indonesian translation
- 📱 Mobile-optimized interface
- 🔄 Manual and automatic translation modes
- 🌟 Simple, intuitive user experience

## Technology Stack

- **Frontend**: React.js
- **Backend**: Vercel Serverless Functions
- **Translation**: Groq AI
- **Audio Processing**: Web Audio API
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or Yarn
- Vercel account (for deployment)
- Groq API Key

### Installation

1. Clone the repository
```bash
git clone https://github.com/your-org/fahim-translator.git
cd fahim-translator
```

2. Install dependencies
```bash
npm install
```

3. Set up environment variables
Create a `.env.local` file in the project root:
```
GROQ_API_KEY=your_groq_api_key
```

4. Run the development server
```bash
npm run dev
```

## How It Works

1. **Start Translation**
   - Click "Start Understanding"
   - Grant microphone permissions
   - Begin audio capture

2. **Translation Modes**
   - **Manual Mode**: Tap "Translate Now" to process current audio
   - **Auto Mode**: Automatically translates every 15 seconds

3. **Translation Display**
   - Translations appear in a chat-like interface
   - Green message bubbles
   - Timestamps for each translation

## Deployment

Deploy to Vercel:
```bash
vercel
```

## Environment Variables

- `GROQ_API_KEY`: API key for Groq translation services

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Troubleshooting

- Ensure microphone permissions are granted
- Check browser compatibility (Chrome, Firefox recommended)
- Verify Groq API key is valid

## License

Distributed under the MIT License. See `LICENSE` for more information.

## Contact

Zafar Labs - himawan@zafarlabs.com

Project Link: [(https://github.com/himabots/arabic-indonesian-translator)](https://github.com/himabots/arabic-indonesian-translator)

## Acknowledgments

- Groq AI
- Vercel
- React Community
