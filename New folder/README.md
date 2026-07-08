# 🎤 AuraVoice AI | Speech Analytics & Cognitive Communication Coach

AuraVoice AI is a professional, full-stack Machine Learning and Natural Language Processing (NLP) web application designed to analyze verbal communication patterns, track speech fluency, generate visual voice spectrograms, and extract cognitive insights from spoken language.

### 🔗 Portfolio Live Demo Mode
🌐 **[Try AuraVoice online on GitHub Pages](https://Shivaram9977.github.io/speech-recognition-system/)**  
*(Note: Online version runs in **Client-side Demo Mode** using browser Web Speech API & heuristic JS analytics. Run the FastAPI local server for full backend ML & Librosa spectrogram features).*

---

## 📌 Project Overview & Architecture
This project is engineered to serve as a high-caliber entry on a resume (CV), showcasing how to integrate front-end audio capturing with backend machine learning, signal processing, and textual analysis. 

```
               [ FRONTEND: HTML5 / Glassmorphic CSS / JavaScript ]
                                       |
                   +-------------------+-------------------+
                   | (Real-time Mic)                       | (Audio Upload / drag-n-drop)
                   v                                       v
         [ Web Speech API ]                     [ FastAPI: /api/process-audio ]
         [ Web Audio API Visualizer ]            - SpeechRecognition Transcriber
         [ Chart.js Analytics ]                  - Librosa Spectrogram Plotter (base64)
                   |                             - NLTK & Custom NLP Engine
                   |                                       |
                   v                                       v
         [ /api/analyze-text ] <---------------------------+
         - VADER Sentiment Analysis
         - Extracted Keyphrase Engine
         - Rule-Based Named Entity Recognition (NER)
         - Automated Extracted Summarization
```

---

## ✨ Features (What makes this project special?)
Unlike a simple Speech-to-Text API wrapper, AuraVoice AI integrates multiple signal processing and NLP layers:

1. **Dual Execution System**: The frontend automatically checks for the local python server. If offline, it acts as a static serverless app (ideal for GitHub Pages portfolio hosting). If online, it unlocks full Python ML engines.
2. **Audio Signal Processing (Mel-Spectrogram)**: When an audio file is uploaded, the backend uses `librosa` and `matplotlib` to apply Short-Time Fourier Transform (STFT), plotting the voice frequency intensities over time in decibels.
3. **Fluency & Filler Word Coach**: Scans transcripts for vocal clutter ("um", "uh", "like", "you know", "basically") to highlight them and compute a **Fluency Score**.
4. **NLP Insight Pipeline**:
   - **Sentiment Intensity Analysis**: Powered by VADER (Valence Aware Dictionary and sEntiment Reasoner) to map positive, negative, and neutral percentages.
   - **Smart Summarization**: Uses an frequency-based extractive summarization algorithm to provide a bulleted summary of long recordings.
   - **Named Entity Recognition (NER)**: Parses text to classify people, organizations, locations, and time values.
5. **Speech Pacing Analysis**: Computes words-per-minute (WPM) to coach speakers on whether they are talking too fast, slow, or optimally.
6. **Jarvis Voice Assistant**: Runs text commands (e.g., "what is time", "open google", "speak summary") using Speech Synthesis.

---

## 🛠️ Technologies Used
- **Backend API**: Python, FastAPI, Uvicorn, Pydantic
- **Speech Processing & Signal Analytics**: Librosa, Soundfile, SpeechRecognition (Google API Wrapper), Matplotlib, NumPy
- **Natural Language Processing**: NLTK (Vader Sentiment Classifier, Tokenizers, Stopwords)
- **Frontend Dashboard**: HTML5, Vanilla CSS3 (Glassmorphic dark design, animations, responsive grids), JavaScript, Chart.js (CDN), FontAwesome Icons

---

## ⚙️ How to Setup and Run Locally

### Windows (One-Click Setup)
1. Navigate into the `backend/` directory.
2. Double-click the file `setup.bat`. This automatically:
   - Creates a Python virtual environment (`.venv`).
   - Upgrades pip and installs all required dependencies from `requirements.txt`.
   - Downloads required NLP models (NLTK corpora).
   - Launches the FastAPI server at `http://127.0.0.1:8000`.
3. Open `index.html` in your web browser. The green badge will update to **Local API Connected**.

### macOS / Linux (Terminal Setup)
1. Open your terminal and navigate to the project directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python3 -m venv .venv
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Download NLTK data:
   ```bash
   python3 -c "import nltk; nltk.download('punkt'); nltk.download('vader_lexicon'); nltk.download('stopwords')"
   ```
5. Launch the FastAPI server:
   ```bash
   python3 main.py
   ```
6. Double-click or open `index.html` in the root folder.

---

## 💡 How to Pitch This Project in Interviews
When technical recruiters or interviewers ask **"What is special about your project?"**, focus on these engineering aspects:

1. **System Resiliency (Dual-Mode)**: Explain that you engineered the application to work serverlessly for static sites (like GitHub Pages) via fallback heuristic engines in JS, whilst unlocking deep neural/signal processing capabilities once the Python FastAPI server is running.
2. **Signal Analysis**: Discuss how the Mel-Spectrogram represents audio. Inform them that you utilized `librosa` to map frequencies to the Mel-Scale (which mimics human hearing perception) rather than using a standard linear frequency spectrogram.
3. **Optimized Network Payloads**: Rather than writing backend-generated plots to disk (creating storage waste), you generated the spectrogram images as in-memory streams, converted them to Base64 strings, and sent them directly to the client browser inside standard image tags.
4. **NLP Algorithm Choice**: Discuss why you chose VADER for sentiment analysis—it is specifically tuned for sentiments expressed in social media and spoken dialogue (accounting for capitalization, exclamations, and context cues) and runs with low latency compared to heavy transformer models, making it ideal for real-time speech coaching.
