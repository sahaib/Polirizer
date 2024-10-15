# Polirizer: AI-Powered Privacy Policy Summarizer

Polirizer is a Chrome extension that uses advanced AI models to simplify complex privacy policies, making them easier for users to understand quickly.

## Features

- Summarize privacy policies from URLs or pasted text
- Support for multiple AI models:
  - GPT-4o-mini
  - Claude 3.5 Sonnet
  - Gemini 1.5 Flash 8B
  - Mistral Small
- User-friendly interface with customizable settings
- Free summary quota with option to use personal API keys
- Copy summary to clipboard functionality

## Installation

1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions`
3. Enable "Developer mode" in the top right corner
4. Click "Load unpacked" and select the `extension` directory from this project

## Usage

1. Click the Polirizer icon in your Chrome toolbar
2. Enter a URL or paste the text of a privacy policy
3. Select an AI model from the dropdown
4. Click "Summarize"
5. View the generated summary and copy it if desired

## Development

### Frontend (Chrome Extension)

The extension is built with HTML, CSS, and JavaScript. Key files:

- `popup.html`: Main interface
- `popup.js`: Core functionality
- `background.js`: Background processes and API communication

### Backend (Flask API)

The backend is a Flask application that handles AI model integration and summarization requests.

To set up the backend:

1. Navigate to the `backend` directory
2. Install dependencies: `pip install -r requirements.txt`
3. Set up environment variables (see `.env.example`)
4. Run the server: `python app.py`

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

[MIT License](LICENSE)

## Acknowledgements

- OpenAI for GPT models
- Anthropic for Claude
- Google for Gemini
- Mistral AI for Mistral models
