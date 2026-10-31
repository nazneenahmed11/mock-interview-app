import os
import tempfile

from flask import Flask, jsonify, request
from flask_cors import CORS
import whisper
import google.generativeai as genai
from dotenv import load_dotenv
from pypdf import PdfReader

load_dotenv()

app = Flask(__name__)
CORS(app)

# Load Whisper model once at startup. Try "small" for better accuracy.
whisper_model = whisper.load_model("base")

# Gemini setup (key comes from the .env file)
api_key = os.environ.get("GEMINI_API_KEY")
if not api_key:
    raise RuntimeError("GEMINI_API_KEY not set. Add it to your .env file.")
genai.configure(api_key=api_key)
model_name = os.environ.get("GEMINI_MODEL", "models/gemini-3.8-flash")
if not model_name.startswith("models/"):
    model_name = "models/" + model_name
print("Using Gemini model:", model_name)
gemini_model = genai.GenerativeModel(model_name)


def build_context(data):
    """Turns level / role / resume from the frontend into prompt text."""
    level = (data.get('level') or 'Fresher').strip()
    role = (data.get('role') or '').strip()
    resume = (data.get('resume') or '').strip()[:6000]
    parts = [f"Candidate experience level: {level}."]
    if role:
        parts.append(f"Role they are applying for: {role}.")
    if resume:
        parts.append("Candidate's resume:\n" + resume)
    return "\n".join(parts)


@app.route('/parse-resume', methods=['POST'])
def parse_resume():
    try:
        if 'resume' not in request.files:
            return jsonify({'error': 'No resume file in request'}), 400
        f = request.files['resume']
        name = (f.filename or '').lower()
        if name.endswith('.pdf'):
            reader = PdfReader(f.stream)
            text = "\n".join((page.extract_text() or '') for page in reader.pages)
        elif name.endswith('.txt'):
            text = f.read().decode('utf-8', errors='ignore')
        else:
            return jsonify({'error': 'Please upload a PDF or TXT file'}), 400
        text = text.strip()
        if not text:
            return jsonify({'error': 'Could not read any text (scanned PDF?)'}), 400
        return jsonify({'text': text[:6000], 'chars': len(text)}), 200
    except Exception as e:
        app.logger.error(f"Resume error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/generate-question', methods=['POST'])
def generate_question():
    try:
        data = request.json
        round_name = data.get('round', 'HR')
        prompt = (
            build_context(data) + "\n\n"
            f"Generate exactly 3 {round_name} interview questions suited to this candidate. "
            "If a resume is provided, make at least one question about something specific in it. "
            "Output ONLY the 3 questions, one per line, numbered 1., 2., 3. "
            "No introduction, no explanations, no headings, no bold, no extra text."
        )
        response = gemini_model.generate_content(prompt)
        questions = [q.strip() for q in response.text.split('\n') if q.strip()]
        return jsonify({
            'round': round_name,
            'questions': questions
        }), 200
    except Exception as e:
        app.logger.error(f"Generate error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/evaluate-answer', methods=['POST'])
def evaluate_answer():
    try:
        data = request.json
        question = data.get('question', '')
        answer = data.get('answer', '')
        prompt = (
            build_context(data) + "\n\n"
            f"Interview question:\n{question}\n\n"
            f"Candidate's answer:\n{answer}\n\n"
            "Give clear, constructive feedback suited to this candidate's level and target role. "
            "Mention strengths and areas for improvement. Where relevant, point out how "
            "they could use specific items from their resume. Keep it concise."
        )
        response = gemini_model.generate_content(prompt)
        return jsonify({'feedback': response.text}), 200
    except Exception as e:
        app.logger.error(f"Evaluate error: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/transcribe-audio', methods=['POST'])
def transcribe_audio():
    path = None
    try:
        if 'audio' not in request.files:
            return jsonify({'error': 'No audio file in request'}), 400
        audio_file = request.files['audio']
        with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as tmp:
            path = tmp.name
        audio_file.save(path)
        result = whisper_model.transcribe(path)
        return jsonify({'transcription': result["text"]}), 200
    except Exception as e:
        app.logger.error(f"Transcription error: {e}")
        return jsonify({'error': str(e)}), 500
    finally:
        if path and os.path.exists(path):
            os.remove(path)


if __name__ == '__main__':
    # use_reloader=False stops constant restarts from watching other folders
    app.run(debug=True, use_reloader=False)
