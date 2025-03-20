# Keyword Clustering Tool

A tool for clustering keywords using OpenAI's API, with support for CSV/TSV export and custom cluster suggestions.

## Requirements

- Python 3.x
- A modern web browser
- OpenAI API key

## Setup

1. Clone the repository:
```bash
git clone <your-repo-url>
cd <repo-directory>
```

2. Create and configure your environment:
```bash
cp .env.example .env
```

3. Edit the `.env` file and add your OpenAI API key:
```
OPENAI_API_KEY=your_api_key_here
```

4. Start the server:
```bash
python3 server.py
```

5. Open http://localhost:8000 in your browser

## Features

- Upload CSV files with keywords and volume data
- Suggest custom cluster headers
- Dark/Light mode toggle
- Download results in CSV or TSV format
- Error logging with minimize/maximize functionality
- Progress tracking with ETA

## Project Structure

```
.
├── index.html          # Main HTML file
├── styles.css         # Styles and theme configuration
├── script.js          # Main JavaScript functionality
├── server.py         # Python server with environment handling
├── .env.example      # Template for environment variables
└── README.md         # This file
```

## Security Notes

- The `.env` file containing your API key is excluded from git via `.gitignore`
- API key is only served to localhost requests
- Always keep your API key private and never commit it to version control

## Development

To modify the application:

1. Edit `index.html` for structure changes
2. Edit `styles.css` for styling changes
3. Edit `script.js` for functionality changes
4. Edit `server.py` for server-side changes

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request 