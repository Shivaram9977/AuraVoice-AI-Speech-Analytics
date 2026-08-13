import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Import services
from nlp_service import NLPService
from audio_service import AudioService, LIBROSA_AVAILABLE, MATPLOTLIB_AVAILABLE, SPEECH_REC_AVAILABLE

app = FastAPI(
    title="AuraVoice Backend",
    description="FastAPI backend running speech analysis for AuraVoice Speech Coach.",
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

class OTPRequest(BaseModel):
    to_email: str
    otp_code: str
    user_name: str = "User"


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

@app.post("/api/send-otp")
def send_otp_email(request: OTPRequest):
    """Sends a real OTP verification email to the user using Gmail SMTP."""
    
    # Sender Gmail credentials
    SENDER_EMAIL = "shivaram6tech@gmail.com"
    SENDER_APP_PASSWORD = "qaueevesqfkzszug"
    
    # Override with environment variables if set
    sender_email = os.environ.get("AURAVOICE_SMTP_EMAIL", SENDER_EMAIL)
    sender_password = os.environ.get("AURAVOICE_SMTP_PASSWORD", SENDER_APP_PASSWORD)

    
    # Build the HTML email
    html_body = f"""
    <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0f0f1e; color: #e2e8f0; padding: 32px; border-radius: 12px; border: 1px solid #1e293b;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h2 style="color: #14b8a6; margin: 0;">🎙️ AuraVoice AI</h2>
        <p style="color: #64748b; font-size: 13px; margin: 4px 0 0;">Executive Speech Analytics Platform</p>
      </div>
      <h3 style="color: #f1f5f9; margin-bottom: 8px;">Hello, {request.user_name}!</h3>
      <p style="color: #94a3b8; line-height: 1.6;">
        Thank you for signing up. Use the verification code below to complete your registration:
      </p>
      <div style="text-align: center; margin: 28px 0;">
        <div style="background: #1e293b; border: 2px solid #14b8a6; border-radius: 8px; padding: 18px 32px; display: inline-block;">
          <span style="font-size: 38px; font-weight: bold; letter-spacing: 0.2em; color: #00f2fe; font-family: monospace;">
            {request.otp_code}
          </span>
        </div>
        <p style="color: #64748b; font-size: 12px; margin-top: 10px;">Expires in 10 minutes</p>
      </div>
      <p style="color: #64748b; font-size: 12px; border-top: 1px solid #1e293b; padding-top: 16px; margin-top: 8px;">
        If you did not request this, please ignore this email. Do not share this code with anyone.
      </p>
    </div>
    """
    
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = f"AuraVoice – Your Verification Code: {request.otp_code}"
        msg["From"] = f"AuraVoice AI <{sender_email}>"
        msg["To"] = request.to_email
        
        msg.attach(MIMEText(f"Your AuraVoice verification code is: {request.otp_code}\n\nExpires in 10 minutes.", "plain"))
        msg.attach(MIMEText(html_body, "html"))
        
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, request.to_email, msg.as_string())
        
        return {"success": True, "message": f"OTP sent to {request.to_email}"}
    
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(
            status_code=500,
            detail="SMTP authentication failed. Please set AURAVOICE_SMTP_EMAIL and AURAVOICE_SMTP_PASSWORD environment variables with a valid Gmail App Password."
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to send email: {str(e)}")


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
