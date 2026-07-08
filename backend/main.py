import os
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import services
from nlp_service import NLPService
from audio_service import AudioService, LIBROSA_AVAILABLE, MATPLOTLIB_AVAILABLE, SPEECH_REC_AVAILABLE

app = FastAPI(
    title="AuraVoice AI Backend",
    description="FastAPI backend running Machine Learning and NLP analysis for AuraVoice Cognitive Speech Coach.",
    version="1.0.0"
)

# Configure CORS so local HTML files or hosted versions can fetch the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for local/development use
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services
nlp_engine = NLPService()
audio_engine = AudioService()

class TextRequest(BaseModel):
    text: str

@app.get("/health")
def health_check():
    """Returns the status and health details of backend ML models and libraries."""
    return {
        "status": "online",
        "libraries": {
            "librosa_installed": LIBROSA_AVAILABLE,
            "matplotlib_installed": MATPLOTLIB_AVAILABLE,
            "speech_recognition_installed": SPEECH_REC_AVAILABLE,
            "nltk_resources": "Vader & Punkt enabled" if nlp_engine.sia else "Rule-based Fallback Active"
        }
    }

@app.post("/api/analyze-text")
def analyze_text(request: TextRequest):
    """Performs full NLP pipeline analysis on the input text transcript."""
    text = request.text
    
    # Run NLP Pipeline
    sentiment = nlp_engine.analyze_sentiment(text)
    fillers = nlp_engine.detect_filler_words(text)
    keyphrases = nlp_engine.extract_keyphrases(text, top_n=6)
    entities = nlp_engine.extract_entities(text)
    summary = nlp_engine.summarize_text(text)
    
    # Word count and quick metrics
    words = text.split()
    word_count = len(words)
    
    return {
        "text": text,
        "word_count": word_count,
        "sentiment": sentiment,
        "fillers": fillers,
        "keyphrases": keyphrases,
        "entities": entities,
        "summary": summary
    }

@app.post("/api/process-audio")
async def process_audio(file: UploadFile = File(...)):
    """Uploads audio file, performs Speech Recognition, extracts metrics, generates Mel-Spectrogram, and runs NLP analysis."""
    # Validate file type
    filename = file.filename
    allowed_extensions = ['.wav', '.mp3', '.m4a', '.ogg', '.flac']
    _, ext = os.path.splitext(filename.lower())
    
    if ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"Unsupported file extension {ext}. Supported: {', '.join(allowed_extensions)}")
        
    try:
        # Read file bytes
        contents = await file.read()
        
        # 1. Transcribe audio
        transcription = audio_engine.transcribe_audio(contents, filename)
        
        # 2. Extract Speech Metrics
        audio_metrics = audio_engine.get_audio_metrics(contents, filename)
        duration = audio_metrics.get("duration", 0.0)
        
        # 3. Generate Mel-Spectrogram image (base64)
        spectrogram = audio_engine.generate_spectrogram(contents, filename)
        
        # 4. Perform NLP Pipeline on the transcription
        nlp_results = {}
        words_count = 0
        wpm = 0
        pacing_label = "N/A"
        
        if transcription and not transcription.startswith("Error:"):
            nlp_results = {
                "sentiment": nlp_engine.analyze_sentiment(transcription),
                "fillers": nlp_engine.detect_filler_words(transcription),
                "keyphrases": nlp_engine.extract_keyphrases(transcription, top_n=6),
                "entities": nlp_engine.extract_entities(transcription),
                "summary": nlp_engine.summarize_text(transcription)
            }
            
            words_count = len(transcription.split())
            if duration > 0:
                # WPM = (words / duration_in_sec) * 60
                wpm = int((words_count / duration) * 60)
                
                # Speech coaching pacing thresholds
                if wpm < 110:
                    pacing_label = "Slow Pace"
                elif 110 <= wpm <= 150:
                    pacing_label = "Optimal Pace"
                else:
                    pacing_label = "Fast Pace"
        else:
            nlp_results = {
                "sentiment": nlp_engine.analyze_sentiment(""),
                "fillers": nlp_engine.detect_filler_words(""),
                "keyphrases": [],
                "entities": {"PERSON": [], "ORG": [], "GPE": [], "DATE_TIME": []},
                "summary": "No speech detected in audio."
            }
            transcription = "[No spoken words detected]"
            
        # Compile response
        response = {
            "filename": filename,
            "duration": duration,
            "volume_rms": audio_metrics.get("volume_rms", 0),
            "wpm": wpm,
            "pacing_label": pacing_label,
            "transcription": transcription,
            "word_count": words_count,
            "spectrogram": spectrogram,
            **nlp_results
        }
        
        return response
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to process audio file: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    # Run backend locally on port 8000
    uvicorn.run(app, host="127.0.0.1", port=8000)
