# Mock Interview App

An AI-powered mock interview practice tool. Pick your experience level and target role, optionally upload your resume, and get interview questions tailored to you. Answer by typing or by speaking, then get instant feedback on each answer.

## Features

- **Personalised questions** for HR, Technical and Managerial rounds, based on your experience level, target role and resume
- **Voice answers**: record your answer and it is transcribed automatically (OpenAI Whisper)
- **AI feedback** on every answer with strengths and areas to improve (Google Gemini)
- **Resume upload** (PDF or TXT) so questions can refer to your real projects
- **Per-question tracking**: answers and feedback are kept for each question, with a progress counter

## Tech stack

| Part | Technology |
|------|------------|
| Frontend | React (Create React App), Axios, react-markdown |
| Backend | Python, Flask, Flask-CORS |
| Speech to text | OpenAI Whisper (runs locally) |
| AI questions and feedback | Google Gemini API |
| Resume parsing | pypdf |

## Project structure

```
mock-interview-app/
├── app.py                  # Flask backend (API routes)
├── requirements.txt        # Python dependencies
├── .env.example            # Template for your API key
└── interview-frontend/     # React app
    └── src/QuestionGenerator.js
```

## Setup

### 1. Get a Gemini API key
Create one at [Google AI Studio](https://aistudio.google.com/app/apikey).

### 2. Create your `.env` file
Copy `.env.example` to a new file named `.env` next to `app.py`:

```
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=models/gemini-3.1-flash-lite
```

Never commit `.env`. It is already listed in `.gitignore`.

### 3. Run the backend
Whisper needs [ffmpeg](https://ffmpeg.org/) installed.

```
pip install -r requirements.txt
python app.py
```

The API runs on `http://127.0.0.1:5000`.

### 4. Run the frontend
In a second terminal:

```
cd interview-frontend
npm install
npm start
```

Open `http://localhost:3000`.

## API routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/generate-question` | POST | Returns 3 questions for a round |
| `/evaluate-answer` | POST | Returns feedback on an answer |
| `/transcribe-audio` | POST | Transcribes a recorded answer |
| `/parse-resume` | POST | Extracts text from an uploaded resume |

## Roadmap

- 1 to 10 score per answer and an end-of-round summary
- Guided flow from HR to Technical to Managerial
- Saving session history

## Privacy note

If you upload a resume, its text is sent to the Gemini API to personalise questions and feedback. Remove sensitive details such as phone number and address before uploading.
