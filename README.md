# Polirizer Chrome Extension

## Overview

Polirizer is a Chrome extension that uses AI to summarize privacy policies, making them easier to understand. It supports multiple AI models and offers features like text-to-speech for accessibility.

## Features

- Summarize privacy policies from URLs or pasted text
- Support for multiple AI models:
  - GPT-4o-mini (OpenAI)
  - Claude-3-5-sonnet (Anthropic)
  - Gemini-1.5-flash-8b (Google)
  - Mistral-small-latest (Mistral AI)
- Text-to-speech functionality
- Copy summary to clipboard
- User-friendly interface with emoji indicators
- 10 free summaries for new users
- Option to use personal API keys for unlimited summaries

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked" and select the cloned repository folder

## Usage

1. Click the Polirizer icon in your Chrome toolbar
2. Enter a URL or paste text of a privacy policy
3. Select an AI model
4. Click "Summarize"
5. View the structured summary with key points

## Development

### Prerequisites

- Node.js and npm

### Setup

1. Install dependencies:
   ```
   npm install
   ```

2. Build the extension:
   ```
   npm run build
   ```

### File Structure

- `popup.html`: Main extension popup and for Styling popup
- `popup.js`: Core functionality
- `manifest.json`: Extension configuration

### API Integration

The extension communicates with a backend server for AI processing. Ensure the correct API endpoint is set in `popup.js`.

## Privacy and Security

- No personal user data is stored
- All processed data is encrypted in transit
- User preferences and API keys are stored locally and encrypted

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

For issues or feature requests, please open an issue on this repository.

## App Preview

![Main App](MainApp.png)
![Summaries](Summaries-new.png)
![TTS](TTS.png)
![Ai Models](AI_Models.png)
