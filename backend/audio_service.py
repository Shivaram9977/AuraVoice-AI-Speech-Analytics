import io
import base64
import os
import numpy as np

# Try importing librosa, matplotlib, and speech_recognition. Keep fallbacks.
try:
    import librosa
    LIBROSA_AVAILABLE = True
except ImportError:
    LIBROSA_AVAILABLE = False

try:
    import matplotlib
    matplotlib.use('Agg')  # Non-interactive backend for server environments
    import matplotlib.pyplot as plt
    MATPLOTLIB_AVAILABLE = True
except ImportError:
    MATPLOTLIB_AVAILABLE = False

try:
    import speech_recognition as sr
    SPEECH_REC_AVAILABLE = True
except ImportError:
    SPEECH_REC_AVAILABLE = False

try:
    import soundfile as sf
    SOUNDFILE_AVAILABLE = True
except ImportError:
    SOUNDFILE_AVAILABLE = False


class AudioService:
    def __init__(self):
        pass

    def transcribe_audio(self, audio_bytes: bytes, filename: str) -> str:
        """Transcribes audio bytes into text using Google Speech Recognition API."""
        if not SPEECH_REC_AVAILABLE:
            return "Error: speech_recognition library is not installed on the server."

        # Write bytes to a temporary file
        temp_filename = f"temp_{filename}"
        with open(temp_filename, "wb") as f:
            f.write(audio_bytes)

        converted_wav = f"conv_{os.path.splitext(filename)[0]}.wav"
        
        try:
            # Check if file needs conversion to standard WAV format.
            # SpeechRecognition requires WAV, AIFF, or FLAC.
            # We use soundfile/librosa to convert MP3/M4A/etc to a standard WAV.
            if not filename.lower().endswith('.wav') or not SOUNDFILE_AVAILABLE:
                if LIBROSA_AVAILABLE and SOUNDFILE_AVAILABLE:
                    # Load any audio format supported by librosa
                    y, sr_rate = librosa.load(temp_filename, sr=16000)
                    sf.write(converted_wav, y, sr_rate, format='WAV', subtype='PCM_16')
                    wav_file_to_read = converted_wav
                else:
                    # Rename directly if conversion libraries aren't available and hope it works
                    os.rename(temp_filename, converted_wav)
                    wav_file_to_read = converted_wav
            else:
                wav_file_to_read = temp_filename

            # Perform speech recognition
            recognizer = sr.Recognizer()
            with sr.AudioFile(wav_file_to_read) as source:
                # Record the audio file content
                audio_data = recognizer.record(source)
                try:
                    # Recognize speech using Google Speech Recognition
                    text = recognizer.recognize_google(audio_data)
                    return text
                except sr.UnknownValueError:
                    return "" # Return empty string for silent/unrecognized audio
                except sr.RequestError as e:
                    return f"[AudioService API Error] Could not request results: {e}"
        except Exception as e:
            return f"[AudioService Conversion Error] Could not process audio file: {e}"
        finally:
            # Clean up files
            for path in [temp_filename, converted_wav]:
                if os.path.exists(path):
                    try:
                        os.remove(path)
                    except OSError:
                        pass

    def generate_spectrogram(self, audio_bytes: bytes, filename: str) -> str:
        """Generates a Mel-Spectrogram image encoded as a base64 string."""
        if not LIBROSA_AVAILABLE or not MATPLOTLIB_AVAILABLE:
            return ""

        temp_filename = f"spec_temp_{filename}"
        with open(temp_filename, "wb") as f:
            f.write(audio_bytes)

        try:
            # Load audio using librosa
            y, sr_rate = librosa.load(temp_filename, sr=None)
            duration = librosa.get_duration(y=y, sr=sr_rate)

            # Generate Mel-Spectrogram
            # n_mels specifies the number of Mel bands
            s_mel = librosa.feature.melspectrogram(y=y, sr=sr_rate, n_mels=128, fmax=8000)
            s_mel_db = librosa.power_to_db(s_mel, ref=np.max)

            # Create plot
            fig, ax = plt.subplots(figsize=(6, 3))
            
            # Use matplotlib style for sleek UI
            fig.patch.set_facecolor('#0f172a')
            ax.set_facecolor('#0f172a')
            
            # Plot the spectrogram
            img = librosa.display.specshow(s_mel_db, x_axis='time', y_axis='mel', sr=sr_rate, fmax=8000, ax=ax, cmap='magma')
            
            # Design customization to match theme
            ax.tick_params(colors='#64748b', labelsize=8)
            ax.yaxis.label.set_color('#64748b')
            ax.xaxis.label.set_color('#64748b')
            
            # Hide borders
            for spine in ax.spines.values():
                spine.set_edgecolor('#1e293b')

            plt.title('Voice Frequency Spectrum (Mel-Spectrogram)', color='#f8fafc', fontsize=10, pad=10)
            plt.tight_layout()

            # Save plot to buffer
            buf = io.BytesIO()
            plt.savefig(buf, format='png', dpi=150, facecolor=fig.get_facecolor(), edgecolor='none')
            buf.seek(0)
            plt.close(fig)

            # Encode as base64
            img_b64 = base64.b64encode(buf.read()).decode('utf-8')
            return f"data:image/png;base64,{img_b64}"
            
        except Exception as e:
            print(f"[AudioService] Error generating spectrogram: {e}")
            return ""
        finally:
            if os.path.exists(temp_filename):
                try:
                    os.remove(temp_filename)
                except OSError:
                    pass

    def get_audio_metrics(self, audio_bytes: bytes, filename: str) -> dict:
        """Extracts basic signal characteristics such as duration and energy level."""
        metrics = {"duration": 0.0, "volume_rms": 0.0, "pacing_label": "Unknown"}
        if not LIBROSA_AVAILABLE:
            return metrics

        temp_filename = f"met_temp_{filename}"
        with open(temp_filename, "wb") as f:
            f.write(audio_bytes)

        try:
            # Load audio using librosa
            y, sr_rate = librosa.load(temp_filename, sr=None)
            duration = float(librosa.get_duration(y=y, sr=sr_rate))
            
            # Calculate RMS energy
            rms = librosa.feature.rms(y=y)
            avg_rms = float(np.mean(rms))
            
            # Normalize volume metric to a percentage (0-100)
            # Standard vocal peaks are around 0.1 - 0.2 RMS in normalized audio
            volume_score = min(100, int(avg_rms * 500))

            metrics["duration"] = round(duration, 2)
            metrics["volume_rms"] = volume_score
            
            return metrics
        except Exception as e:
            print(f"[AudioService] Error extracting metrics: {e}")
            return metrics
        finally:
            if os.path.exists(temp_filename):
                try:
                    os.remove(temp_filename)
                except OSError:
                    pass
