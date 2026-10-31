import React, { useState, useRef } from 'react';
import axios from 'axios';
import ReactMarkdown from 'react-markdown';

export default function QuestionGenerator() {
  const [questions, setQuestions] = useState([]);
  const [selectedQuestion, setSelectedQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");

  // Personalisation: experience level, target role, resume text
  const [level, setLevel] = useState('Fresher');
  const [role, setRole] = useState('');
  const [resumeText, setResumeText] = useState('');
  const [resumeName, setResumeName] = useState('');
  const [resumeStatus, setResumeStatus] = useState('');

  // Stores the submitted answer + feedback separately for EACH question
  // shape: { [question]: { submittedAnswer, feedback, loading } }
  const [results, setResults] = useState({});

  // Audio recording state and refs
  const [recording, setRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const current = results[selectedQuestion] || {};

  const fetchQuestions = async (round) => {
    setLoading(true);
    setQuestions([]);
    setSelectedQuestion('');
    setAnswer('');
    setResults({});
    setAudioURL(null);
    try {
      const response = await axios.post('http://127.0.0.1:5000/generate-question', {
        round, level, role, resume: resumeText
      });
      setQuestions(response.data.questions);
    } catch (error) {
      alert('Error: ' + error.message);
    }
    setLoading(false);
  };

  const handleResumeUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setResumeStatus('Reading resume...');
    const formData = new FormData();
    formData.append('resume', file);
    try {
      const res = await axios.post('http://127.0.0.1:5000/parse-resume', formData);
      setResumeText(res.data.text);
      setResumeName(file.name);
      setResumeStatus('Resume loaded ✅');
    } catch (err) {
      setResumeText('');
      setResumeName('');
      const msg = err.response?.data?.error || err.message;
      setResumeStatus('Could not read resume: ' + msg);
    }
  };

  const clearResume = () => {
    setResumeText('');
    setResumeName('');
    setResumeStatus('');
  };

  const selectQuestion = (q) => {
    setSelectedQuestion(q);
    setAnswer('');        // empty box for the new question
    setAudioURL(null);
  };

  const handleAnswerSubmit = async () => {
    if (!selectedQuestion) return;
    const q = selectedQuestion;      // lock in which question this answer belongs to
    const submitted = answer;

    setResults(prev => ({
      ...prev,
      [q]: { submittedAnswer: submitted, feedback: '', loading: true }
    }));
    setAnswer('');

    let feedbackText;
    try {
      const res = await axios.post('http://127.0.0.1:5000/evaluate-answer', {
        question: q,
        answer: submitted,
        level,
        role,
        resume: resumeText
      });
      feedbackText = res.data.feedback;
    } catch (err) {
      feedbackText = 'Error getting feedback: ' + err.message;
    }

    setResults(prev => ({
      ...prev,
      [q]: { submittedAnswer: submitted, feedback: feedbackText, loading: false }
    }));
  };

  const startRecording = async () => {
    setAudioURL(null);
    audioChunksRef.current = [];
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorderRef.current = new MediaRecorder(stream);
    mediaRecorderRef.current.start();
    setRecording(true);

    mediaRecorderRef.current.ondataavailable = e => {
      audioChunksRef.current.push(e.data);
    };

    mediaRecorderRef.current.onstop = () => {
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
      setAudioURL(URL.createObjectURL(audioBlob));
      uploadAudio(audioBlob);
      setRecording(false);
    };
  };

  const stopRecording = () => {
    mediaRecorderRef.current.stop();
  };

  const uploadAudio = async (blob) => {
    const formData = new FormData();
    formData.append('audio', blob);
    try {
      const res = await axios.post('http://127.0.0.1:5000/transcribe-audio', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setAnswer(res.data.transcription);
    } catch (err) {
      alert('Error uploading audio: ' + err.message);
    }
  };

  const answeredCount = questions.filter(q => results[q] && !results[q].loading).length;

  return (
    <div>
      <h2>Generate Interview Questions</h2>

      <div style={{ marginBottom: '12px', padding: '10px', border: '1px solid #ccc', borderRadius: '6px' }}>
        <div style={{ marginBottom: '8px' }}>
          <label>Experience level: </label>
          <select value={level} onChange={e => setLevel(e.target.value)}>
            <option>Fresher</option>
            <option>1-3 years</option>
            <option>3-5 years</option>
            <option>Senior (5+ years)</option>
          </select>
        </div>
        <div style={{ marginBottom: '8px' }}>
          <label>Target role: </label>
          <input
            type="text"
            value={role}
            onChange={e => setRole(e.target.value)}
            placeholder="e.g. Data Analyst Intern"
            size={30}
          />
        </div>
        <div>
          <label>Resume (PDF or TXT, optional): </label>
          <input type="file" accept=".pdf,.txt" onChange={handleResumeUpload} />
          {resumeName && <button onClick={clearResume}>Remove {resumeName}</button>}
          {resumeStatus && <p style={{ margin: '4px 0' }}>{resumeStatus}</p>}
        </div>
      </div>

      <button onClick={() => fetchQuestions('HR')}>Get HR Questions</button>
      <button onClick={() => fetchQuestions('Technical')}>Get Technical Questions</button>
      <button onClick={() => fetchQuestions('Managerial')}>Get Managerial Questions</button>
      {loading && <p>Loading...</p>}

      {questions.length > 0 && (
        <p>Answered {answeredCount} of {questions.length} questions</p>
      )}

      <ul>
        {questions.map((q, i) => (
          <li
            key={i}
            onClick={() => selectQuestion(q)}
            style={{
              background: selectedQuestion === q ? "#ddf2fa" : "",
              cursor: "pointer",
              marginBottom: "8px",
              padding: "5px",
              border: selectedQuestion === q ? "2px solid #2980b9" : "1px solid #ccc",
              borderRadius: "6px"
            }}
          >
            {results[q] && !results[q].loading ? "✅ " : ""}{q}
          </li>
        ))}
      </ul>

      {selectedQuestion && (
        <div style={{ marginTop: '1em' }}>
          <h2>Type Your Answer for Selected Question</h2>
          <p><b>{selectedQuestion}</b></p>
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            rows={5}
            cols={50}
            placeholder="Type your answer here or use audio recording..."
          />
          <br />
          <button onClick={handleAnswerSubmit} disabled={!answer.trim()}>Submit Answer</button>
          <div style={{ marginTop: '10px' }}>
            {!recording && <button onClick={startRecording}>Start Recording</button>}
            {recording && <button onClick={stopRecording}>Stop Recording</button>}
            {audioURL && (
              <>
                <audio src={audioURL} controls />
                <p>Transcribed answer will appear above, you can edit it if needed.</p>
              </>
            )}
          </div>
          {current.submittedAnswer && (
            <div>
              <h3>Your Submitted Answer:</h3>
              <p>{current.submittedAnswer}</p>
            </div>
          )}
          {current.loading && <p>Evaluating...</p>}
          {current.feedback && (
            <div>
              <h3>AI Feedback:</h3>
              <div style={{ lineHeight: 1.6 }}>
                <ReactMarkdown>{current.feedback}</ReactMarkdown>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
