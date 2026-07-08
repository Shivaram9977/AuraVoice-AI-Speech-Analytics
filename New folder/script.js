/* =========================================================================
   AuraVoice AI | JavaScript Logic
   Includes: Real-time Audio, Chart.js, FastAPI connection, Fallback Mock engine
   ========================================================================= */

const BACKEND_URL = "http://127.0.0.1:8000";

// DOM Elements
const startBtn = document.getElementById("startBtn");
const statusMsg = document.getElementById("statusMsg");
const connectionBadge = document.getElementById("connectionBadge");
const connectionText = document.getElementById("connectionText");
const dropZone = document.getElementById("dropZone");
const browseFileLink = document.getElementById("browseFileLink");
const audioFileInput = document.getElementById("audioFileInput");
const downloadBtn = document.getElementById("downloadBtn");
const clearAllBtn = document.getElementById("clearAllBtn");
const historyList = document.getElementById("historyList");
const assistantResponse = document.getElementById("assistantResponse");

// Tab Elements
const tabLinks = document.querySelectorAll(".tab-link");
const tabContents = document.querySelectorAll(".tab-content");
const spectrogramTabBtn = document.getElementById("spectrogramTabBtn");
const specPlaceholder = document.getElementById("specPlaceholder");
const spectrogramImg = document.getElementById("spectrogramImg");

// Metrics Elements
const fluencyVal = document.getElementById("fluencyVal");
const fluencyRing = document.getElementById("fluencyRing");
const fluencyFooter = document.getElementById("fluencyFooter");
const pacingVal = document.getElementById("pacingVal");
const pacingRing = document.getElementById("pacingRing");
const pacingFooter = document.getElementById("pacingFooter");
const sentimentVal = document.getElementById("sentimentVal");
const sentimentRing = document.getElementById("sentimentRing");
const sentimentFooter = document.getElementById("sentimentFooter");

// Transcript Elements
const transcriptionText = document.getElementById("transcriptionText");
const wordCountVal = document.getElementById("wordCountVal");
const durationVal = document.getElementById("durationVal");

// Insights Elements
const keyphrasesList = document.getElementById("keyphrasesList");
const entPerson = document.getElementById("entPerson").querySelector(".badge-num");
const entOrg = document.getElementById("entOrg").querySelector(".badge-num");
const entGpe = document.getElementById("entGpe").querySelector(".badge-num");
const entDate = document.getElementById("entDate").querySelector(".badge-num");
const entitiesDetails = document.getElementById("entitiesDetails");
const summaryText = document.getElementById("summaryText");

// Visualizer Canvas
const canvas = document.getElementById("visualizerCanvas");
const canvasCtx = canvas.getContext("2d");
const canvasOverlay = document.getElementById("canvasOverlay");

// State Variables
let recognition;
let isListening = false;
let backendOnline = false;
let silenceTimer;
let finalTranscript = "";
let recordingStartTime;
let audioContext;
let analyser;
let dataArray;
let sourceNode;
let animationFrameId;
let chartInstance = null;

// Heuristic dictionaries for offline mode
const MOCK_POSITIVE_WORDS = ["good", "great", "excellent", "awesome", "wonderful", "amazing", "love", "like", "happy", "best", "perfect", "fantastic", "brilliant", "outstanding", "superb", "helpful", "smart", "improve", "success"];
const MOCK_NEGATIVE_WORDS = ["bad", "terrible", "worst", "awful", "horrible", "hate", "dislike", "sad", "angry", "wrong", "error", "fail", "failure", "broken", "difficult", "slow", "problem", "issue", "poor"];
const MOCK_FILLER_WORDS = ["um", "uh", "ah", "like", "you know", "so", "actually", "basically", "seriously", "literally", "right", "okay", "i mean"];
const MOCK_STOPWORDS = ["i", "me", "my", "we", "our", "you", "your", "he", "she", "it", "they", "this", "that", "the", "a", "an", "and", "but", "if", "or", "of", "to", "in", "is", "was", "were", "be", "have", "had", "do", "for", "with", "on", "at", "by"];

// =========================================================================
// 1. Initialization & Health Check
// =========================================================================
window.onload = async () => {
  initCanvas();
  initChart([0, 0, 100]); // Start with neutral chart
  loadSessionHistory();
  await checkBackendHealth();
  
  // Setup tabs
  tabLinks.forEach(link => {
    link.addEventListener("click", () => {
      if (link.disabled) return;
      tabLinks.forEach(l => l.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));
      link.classList.add("active");
      document.getElementById(link.dataset.tab).classList.add("active");
    });
  });
};

// Check if FastAPI backend is running
async function checkBackendHealth() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      backendOnline = true;
      connectionBadge.className = "badge badge-success";
      connectionText.textContent = "Local API Connected";
      statusMsg.textContent = "AI engine active. Ready to process speech and audio.";
      spectrogramTabBtn.disabled = false;
      console.log("[AuraVoice] FastAPI server active:", data);
    } else {
      throw new Error();
    }
  } catch (err) {
    backendOnline = false;
    connectionBadge.className = "badge badge-warning";
    connectionText.textContent = "Demo / Offline Mode";
    statusMsg.textContent = "Running in browser demo mode. Spectrogram generation disabled (requires backend).";
    spectrogramTabBtn.disabled = true;
    console.warn("[AuraVoice] Local FastAPI server not found. Falling back to local offline ML engines.");
  }
}

// =========================================================================
// 2. Audio Visualizer Canvas Setup
// =========================================================================
function initCanvas() {
  canvas.width = canvas.parentElement.clientWidth;
  canvas.height = 120;
  
  // Draw flat line initially
  canvasCtx.fillStyle = '#0f1016';
  canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
  canvasCtx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
  canvasCtx.lineWidth = 2;
  canvasCtx.beginPath();
  canvasCtx.moveTo(0, canvas.height / 2);
  canvasCtx.lineTo(canvas.width, canvas.height / 2);
  canvasCtx.stroke();
}

async function startVisualizer() {
  if (!window.AudioContext && !window.webkitAudioContext) return;
  
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    
    sourceNode = audioContext.createMediaStreamSource(stream);
    sourceNode.connect(analyser);
    
    const bufferLength = analyser.frequencyBinCount;
    dataArray = new Uint8Array(bufferLength);
    
    canvasOverlay.style.display = "none";
    drawWaveform();
  } catch (err) {
    console.error("[Visualizer] Could not get user media: ", err);
    canvasOverlay.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> <span>Mic access blocked</span>`;
  }
}

function drawWaveform() {
  if (!isListening) return;
  animationFrameId = requestAnimationFrame(drawWaveform);
  
  analyser.getByteTimeDomainData(dataArray);
  
  canvasCtx.fillStyle = '#0f1016';
  canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Custom glowing line
  canvasCtx.lineWidth = 3;
  canvasCtx.strokeStyle = '#6366f1';
  canvasCtx.shadowBlur = 8;
  canvasCtx.shadowColor = '#6366f1';
  
  canvasCtx.beginPath();
  const sliceWidth = canvas.width * 1.0 / dataArray.length;
  let x = 0;
  
  for (let i = 0; i < dataArray.length; i++) {
    const v = dataArray[i] / 128.0;
    const y = v * canvas.height / 2;
    
    if (i === 0) {
      canvasCtx.moveTo(x, y);
    } else {
      canvasCtx.lineTo(x, y);
    }
    x += sliceWidth;
  }
  
  canvasCtx.lineTo(canvas.width, canvas.height / 2);
  canvasCtx.stroke();
  canvasCtx.shadowBlur = 0; // Reset shadow
}

function stopVisualizer() {
  isListening = false;
  if (animationFrameId) cancelAnimationFrame(animationFrameId);
  if (sourceNode) sourceNode.disconnect();
  if (audioContext) audioContext.close();
  
  canvasOverlay.style.display = "flex";
  canvasOverlay.innerHTML = `<i class="fa-solid fa-microphone-slash"></i> <span>Microphone inactive</span>`;
  initCanvas();
}

// =========================================================================
// 3. Speech Recognition Engine
// =========================================================================
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = "en-US";
  
  startBtn.onclick = () => {
    if (!isListening) {
      startListening();
    } else {
      stopListening();
    }
  };
  
  recognition.onresult = (event) => {
    let interim = "";
    
    for (let i = event.resultIndex; i < event.results.length; i++) {
      let text = event.results[i][0].transcript;
      if (event.results[i].isFinal) {
        finalTranscript += text + " ";
      } else {
        interim += text;
      }
    }
    
    transcriptionText.innerHTML = formatHighlightedText(finalTranscript + interim);
    
    // Dynamically calculate word count
    const words = (finalTranscript + interim).trim().split(/\s+/).filter(Boolean);
    wordCountVal.textContent = words.length;
    
    // Auto timer tracking duration
    const diffSec = ((new Date() - recordingStartTime) / 1000).toFixed(1);
    durationVal.textContent = diffSec;
    
    resetSilenceTimer();
  };
  
  recognition.onerror = (e) => {
    console.error("[SpeechRecognition Error]", e);
    statusMsg.textContent = `Recognition error: ${e.error}. Try again.`;
    stopListening();
  };
  
  recognition.onend = () => {
    if (isListening) {
      stopListening();
    }
  };
} else {
  startBtn.disabled = true;
  statusMsg.textContent = "Web Speech API is not supported by your browser. Use the Audio Upload tool to analyze speech files.";
  startBtn.classList.add("disabled");
}

function startListening() {
  finalTranscript = "";
  transcriptionText.innerHTML = "Listening to speech... Speak clearly into your mic.";
  wordCountVal.textContent = "0";
  durationVal.textContent = "0.0";
  
  isListening = true;
  recordingStartTime = new Date();
  
  startBtn.classList.add("listening");
  startBtn.querySelector(".btn-lbl").textContent = "Stop Recording";
  statusMsg.textContent = "Recording in progress... Analyzing vocal streams.";
  
  recognition.start();
  startVisualizer();
  startSilenceTimer();
}

function stopListening() {
  isListening = false;
  startBtn.classList.remove("listening");
  startBtn.querySelector(".btn-lbl").textContent = "Start Recording";
  
  recognition.stop();
  stopVisualizer();
  clearTimeout(silenceTimer);
  
  // Run final analysis
  const text = (finalTranscript).trim();
  if (text) {
    const elapsedSeconds = ((new Date() - recordingStartTime) / 1000);
    durationVal.textContent = elapsedSeconds.toFixed(1);
    processSessionAnalytics(text, elapsedSeconds);
  } else {
    transcriptionText.innerHTML = "No speech detected. Click Start to try again.";
    statusMsg.textContent = "Awaiting speech inputs...";
  }
}

// Automatic silence detection (stops after 6 seconds of silence)
function startSilenceTimer() {
  silenceTimer = setTimeout(() => {
    statusMsg.textContent = "Silence detected. Finalizing speech coach analysis...";
    stopListening();
  }, 6000);
}

function resetSilenceTimer() {
  clearTimeout(silenceTimer);
  startSilenceTimer();
}

// =========================================================================
// 4. Processing Analytics (Backend API vs local Fallback Engine)
// =========================================================================
async function processSessionAnalytics(text, duration) {
  statusMsg.textContent = "Analyzing speech patterns & cognitive signals...";
  
  // Set UI duration
  durationVal.textContent = duration.toFixed(1);
  
  if (backendOnline) {
    // ----------------------------------------------------
    // API Connected Mode (FastAPI Backend)
    // ----------------------------------------------------
    try {
      const res = await fetch(`${BACKEND_URL}/api/analyze-text`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text })
      });
      
      if (!res.ok) throw new Error("API failed");
      const data = await res.json();
      
      // Calculate pacing
      const wpm = duration > 0 ? Math.round((data.word_count / duration) * 60) : 0;
      let pacingLabel = "Normal";
      if (wpm < 110) pacingLabel = "Slow Pace";
      else if (wpm <= 150) pacingLabel = "Optimal Pace";
      else pacingLabel = "Fast Pace";
      
      const payload = {
        text: data.text,
        duration: duration,
        wpm: wpm,
        pacing_label: pacingLabel,
        word_count: data.word_count,
        sentiment: data.sentiment,
        fillers: data.fillers,
        keyphrases: data.keyphrases,
        entities: data.entities,
        summary: data.summary,
        spectrogram: "" // Local live audio doesn't generate backend spectrogram
      };
      
      updateDashboardUI(payload);
      saveSessionToHistory(payload);
      runAssistantAssistant(text, payload.summary);
      statusMsg.textContent = "Analysis complete. Speech dashboard updated.";
      
    } catch (e) {
      console.error("API error, falling back to local processing", e);
      runOfflineEngine(text, duration);
    }
  } else {
    // ----------------------------------------------------
    // Demo Mode (Local Heuristic NLP Engine in Browser)
    // ----------------------------------------------------
    runOfflineEngine(text, duration);
  }
}

function runOfflineEngine(text, duration) {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  const wordCount = words.length;
  
  // 1. Sentiment analysis
  let posCount = 0;
  let negCount = 0;
  words.forEach(w => {
    if (MOCK_POSITIVE_WORDS.includes(w)) posCount++;
    if (MOCK_NEGATIVE_WORDS.includes(w)) negCount++;
  });
  
  let label = "Neutral";
  let score = 50;
  let posPct = 10, negPct = 10, neuPct = 80;
  
  const totalSent = posCount + negCount;
  if (totalSent > 0) {
    score = Math.round((posCount / totalSent) * 100);
    posPct = Math.round((posCount / wordCount) * 100) + 5;
    negPct = Math.round((negCount / wordCount) * 100) + 5;
    neuPct = 100 - (posPct + negPct);
    
    if (posCount > negCount) label = "Positive";
    else if (negCount > posCount) label = "Negative";
  }
  
  // 2. Filler words tracker
  let fillerCount = 0;
  const fillerDetails = {};
  MOCK_FILLER_WORDS.forEach(filler => {
    const regex = new RegExp(`\\b${filler}\\b`, 'gi');
    const matches = text.match(regex);
    if (matches) {
      fillerDetails[filler] = matches.length;
      fillerCount += matches.length;
    }
  });
  
  const density = (fillerCount / wordCount) * 100;
  const fluencyScore = Math.max(0, Math.round(100 - (density * 5)));
  
  // 3. Keyphrases
  const cleanWords = words.filter(w => !MOCK_STOPWORDS.includes(w) && w.length > 3);
  const wordFreqs = {};
  cleanWords.forEach(w => wordFreqs[w] = (wordFreqs[w] || 0) + 1);
  const keyphrases = Object.entries(wordFreqs)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 5)
    .map(item => ({ keyword: item[0], count: item[1] }));
    
  // 4. Summarize (Extractive: select first sentence and longest sentence)
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  let summary = "";
  if (sentences.length <= 2) {
    summary = text;
  } else {
    // Heuristic: first sentence + the sentence containing the most words
    const sortedSent = [...sentences].sort((a,b) => b.split(/\s+/).length - a.split(/\s+/).length);
    summary = sentences[0] + ". " + (sortedSent[0] !== sentences[0] ? sortedSent[0] + "." : sentences[1] + ".");
  }
  
  // 5. Named Entities mock check
  const entities = { "PERSON": [], "ORG": [], "GPE": [], "DATE_TIME": [] };
  const capWords = text.split(/\s+/).filter(w => w && w[0] === w[0].toUpperCase() && w.toLowerCase() !== w);
  capWords.forEach(w => {
    const clean = w.replace(/[^\w]/g, "");
    if (clean.length > 2 && !MOCK_STOPWORDS.includes(clean.toLowerCase())) {
      if (clean === "Google" || clean === "Microsoft" || clean === "Amazon" || clean === "OpenAI") {
        entities.ORG.push(clean);
      } else if (clean === "London" || clean === "India" || clean === "Paris" || clean === "America") {
        entities.GPE.push(clean);
      } else {
        entities.PERSON.push(clean);
      }
    }
  });
  
  // 6. Speaking Pace
  const wpm = duration > 0 ? Math.round((wordCount / duration) * 60) : 0;
  let pacingLabel = "Normal";
  if (wpm < 110) pacingLabel = "Slow Pace";
  else if (wpm <= 150) pacingLabel = "Optimal Pace";
  else pacingLabel = "Fast Pace";
  
  const payload = {
    text: text,
    duration: duration,
    wpm: wpm,
    pacing_label: pacingLabel,
    word_count: wordCount,
    sentiment: { score, label, positive_pct: posPct, negative_pct: negPct, neutral_pct: neuPct },
    fillers: { score: fluencyScore, count: fillerCount, details: fillerDetails, highlighted_text: formatHighlightedText(text) },
    keyphrases: keyphrases,
    entities: {
      PERSON: [...new Set(entities.PERSON)].slice(0, 3),
      ORG: [...new Set(entities.ORG)].slice(0, 3),
      GPE: [...new Set(entities.GPE)].slice(0, 3),
      DATE_TIME: []
    },
    summary: summary,
    spectrogram: ""
  };
  
  updateDashboardUI(payload);
  saveSessionToHistory(payload);
  runAssistantAssistant(text, payload.summary);
  statusMsg.textContent = "Analysis complete (Offline Mode). Dashboard updated.";
}

// =========================================================================
// 5. Update UI Components & SVG Progress Rings
// =========================================================================
function updateDashboardUI(data) {
  // Toggle buttons
  downloadBtn.disabled = false;
  
  // Reset spectrogram view if no spectrogram is provided
  if (!data.spectrogram) {
    spectrogramImg.style.display = "none";
    specPlaceholder.style.display = "flex";
  } else {
    specPlaceholder.style.display = "none";
    spectrogramImg.src = data.spectrogram;
    spectrogramImg.style.display = "block";
    
    // Automatically switch tabs to spectrogram to show ML result!
    tabLinks.forEach(l => l.classList.remove("active"));
    tabContents.forEach(c => c.classList.remove("active"));
    spectrogramTabBtn.classList.add("active");
    document.getElementById("spectrogramTab").classList.add("active");
  }
  
  // Word counters
  wordCountVal.textContent = data.word_count;
  durationVal.textContent = parseFloat(data.duration).toFixed(1);
  transcriptionText.innerHTML = data.fillers.highlighted_text || formatHighlightedText(data.text);
  
  // Progress Ring 1: Fluency Score
  const fluencyScore = data.fillers.score;
  fluencyVal.innerHTML = `${fluencyScore}<span class="unit">%</span>`;
  setRingProgress(fluencyRing, fluencyScore);
  
  let fluencyDesc = "Excellent speech flow";
  if (fluencyScore < 70) fluencyDesc = "High amount of fillers. Try pausing.";
  else if (fluencyScore < 90) fluencyDesc = "Moderate filler words detected.";
  fluencyFooter.textContent = fluencyDesc;
  
  // Progress Ring 2: Pacing
  pacingVal.innerHTML = `${data.wpm}<span class="unit"> WPM</span>`;
  // Normalize WPM to progress ring score. Target WPM = 130 WPM (which maps to 100% full ring).
  const pacingRingScore = Math.min(100, Math.round((data.wpm / 150) * 100));
  setRingProgress(pacingRing, pacingRingScore);
  
  let pacingDesc = "Awaiting speech";
  if (data.wpm > 0) {
    if (data.pacing_label === "Slow Pace") pacingDesc = "🐢 Speed up for engagement.";
    else if (data.pacing_label === "Fast Pace") pacingDesc = "⚡ Slow down to keep clarity.";
    else pacingDesc = "🎯 Perfect cadence for public speaking.";
  }
  pacingFooter.textContent = pacingDesc;
  
  // Progress Ring 3: Sentiment
  const sentScore = data.sentiment.score;
  sentimentVal.textContent = data.sentiment.label;
  setRingProgress(sentimentRing, sentScore);
  sentimentFooter.textContent = `Tone: ${sentScore}% Positive Ratio`;
  
  // Keyphrases Pills
  keyphrasesList.innerHTML = "";
  if (data.keyphrases && data.keyphrases.length > 0) {
    data.keyphrases.forEach(item => {
      const span = document.createElement("span");
      span.className = "pill";
      span.innerHTML = `<i class="fa-solid fa-hashtag"></i> ${item.keyword} <span class="pill-count">${item.count}</span>`;
      keyphrasesList.appendChild(span);
    });
  } else {
    keyphrasesList.innerHTML = `<span class="empty-msg">No topics extracted yet</span>`;
  }
  
  // Entities count & details
  const ent = data.entities;
  const totalEntitiesCount = ent.PERSON.length + ent.ORG.length + ent.GPE.length + (ent.DATE_TIME ? ent.DATE_TIME.length : 0);
  
  document.getElementById("entPerson").querySelector(".badge-num").textContent = ent.PERSON.length;
  document.getElementById("entOrg").querySelector(".badge-num").textContent = ent.ORG.length;
  document.getElementById("entGpe").querySelector(".badge-num").textContent = ent.GPE.length;
  document.getElementById("entDate").querySelector(".badge-num").textContent = ent.DATE_TIME ? ent.DATE_TIME.length : 0;
  
  entitiesDetails.innerHTML = "";
  if (totalEntitiesCount > 0) {
    let detailsHtml = "";
    if (ent.PERSON.length > 0) detailsHtml += `<strong>People:</strong> ${ent.PERSON.join(', ')}<br>`;
    if (ent.ORG.length > 0) detailsHtml += `<strong>Organizations:</strong> ${ent.ORG.join(', ')}<br>`;
    if (ent.GPE.length > 0) detailsHtml += `<strong>Locations:</strong> ${ent.GPE.join(', ')}<br>`;
    if (ent.DATE_TIME && ent.DATE_TIME.length > 0) detailsHtml += `<strong>Values/Dates:</strong> ${ent.DATE_TIME.join(', ')}`;
    entitiesDetails.innerHTML = detailsHtml;
  } else {
    entitiesDetails.innerHTML = `<span class="empty-msg">No specific entities detected (names, places, etc.)</span>`;
  }
  
  // Summarization
  summaryText.innerHTML = `"${data.summary}"`;
  
  // Update Chart.js Instance
  const sentimentBreakdown = [data.sentiment.positive_pct, data.sentiment.negative_pct, data.sentiment.neutral_pct];
  updateChart(sentimentBreakdown);
}

// Function to draw SVG circle indicators
function setRingProgress(ringElement, score) {
  const radius = ringElement.r.baseVal.value;
  const circumference = 2 * Math.PI * radius;
  ringElement.style.strokeDasharray = `${circumference}`;
  
  const offset = circumference - (score / 100) * circumference;
  ringElement.style.strokeDashoffset = offset;
}

// =========================================================================
// 6. Highlight & Format Speech
// =========================================================================
function formatHighlightedText(text) {
  if (!text) return "Click start to speak...";
  
  let formatted = text;
  MOCK_FILLER_WORDS.forEach(filler => {
    const regex = new RegExp(`\\b(${filler})\\b`, 'gi');
    formatted = formatted.replace(regex, `<span class="filler-word" title="Filler word: $1">$1</span>`);
  });
  
  return formatted;
}

// =========================================================================
// 7. Chart.js Implementation
// =========================================================================
function initChart(dataArray) {
  const ctx = document.getElementById('analyticsChart').getContext('2d');
  
  chartInstance = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Positive %', 'Negative %', 'Neutral %'],
      datasets: [{
        data: dataArray,
        backgroundColor: [
          '#10b981', // Positive (teal/green)
          '#ef4444', // Negative (red)
          '#6366f1'  // Neutral (indigo)
        ],
        borderWidth: 1,
        borderColor: '#11121d'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'right',
          labels: {
            color: '#8f9cae',
            font: { size: 9, family: 'Outfit' }
          }
        }
      },
      cutout: '65%'
    }
  });
}

function updateChart(newData) {
  if (chartInstance) {
    chartInstance.data.datasets[0].data = newData;
    chartInstance.update();
  }
}

// =========================================================================
// 8. Drag and Drop Audio File Upload
// =========================================================================
dropZone.addEventListener("click", () => audioFileInput.click());

browseFileLink.addEventListener("click", (e) => {
  e.stopPropagation();
  audioFileInput.click();
});

audioFileInput.addEventListener("change", (e) => {
  if (e.target.files.length > 0) {
    handleAudioFileUpload(e.target.files[0]);
  }
});

// Drag & drop handlers
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("dragover");
});

dropZone.addEventListener("dragleave", () => {
  dropZone.classList.remove("dragover");
});

dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("dragover");
  if (e.dataTransfer.files.length > 0) {
    handleAudioFileUpload(e.dataTransfer.files[0]);
  }
});

async function handleAudioFileUpload(file) {
  if (!backendOnline) {
    alert("Audio file processing requires the Python backend server running. Please run setup.bat first!");
    return;
  }
  
  statusMsg.textContent = `Uploading & transcribing ${file.name}...`;
  transcriptionText.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Running Machine Learning Speech Models on backend server. Please wait...`;
  
  const formData = new FormData();
  formData.append("file", file);
  
  try {
    const res = await fetch(`${BACKEND_URL}/api/process-audio`, {
      method: "POST",
      body: formData
    });
    
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.detail || "Transcription failed");
    }
    
    const data = await res.json();
    updateDashboardUI(data);
    saveSessionToHistory(data);
    runAssistantAssistant(data.transcription, data.summary);
    statusMsg.textContent = `Successfully processed file: ${file.name}`;
    
  } catch (err) {
    console.error("[Upload] Failed to process audio:", err);
    statusMsg.textContent = `Error processing audio: ${err.message}`;
    transcriptionText.innerHTML = `<span class="empty-msg">Error transcribing audio. Make sure the file format is supported and python server is operational.</span>`;
  }
}

// =========================================================================
// 9. Session History & LocalStorage
// =========================================================================
function saveSessionToHistory(sessionData) {
  const saved = JSON.parse(localStorage.getItem("auravoice_history")) || [];
  
  // Format history object
  const historyItem = {
    id: Date.now(),
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    text: sessionData.text || sessionData.transcription,
    data: sessionData
  };
  
  saved.unshift(historyItem);
  // Cap history at 15 items
  if (saved.length > 15) saved.pop();
  
  localStorage.setItem("auravoice_history", JSON.stringify(saved));
  loadSessionHistory();
}

function loadSessionHistory() {
  const saved = JSON.parse(localStorage.getItem("auravoice_history")) || [];
  historyList.innerHTML = "";
  
  if (saved.length === 0) {
    historyList.innerHTML = `<li class="empty-msg" style="padding:0.5rem; font-size:0.75rem;">No past sessions</li>`;
    return;
  }
  
  saved.forEach(item => {
    const li = document.createElement("li");
    li.className = "history-item";
    
    const textSpan = document.createElement("span");
    textSpan.className = "history-text";
    textSpan.textContent = `[${item.timestamp}] ${item.text.substring(0, 25)}...`;
    
    const delBtn = document.createElement("button");
    delBtn.className = "history-delete";
    delBtn.innerHTML = `<i class="fa-solid fa-trash-can"></i>`;
    
    li.onclick = () => {
      updateDashboardUI(item.data);
      statusMsg.textContent = "Loaded session analysis from history.";
    };
    
    delBtn.onclick = (e) => {
      e.stopPropagation();
      deleteHistoryItem(item.id);
    };
    
    li.appendChild(textSpan);
    li.appendChild(delBtn);
    historyList.appendChild(li);
  });
}

function deleteHistoryItem(id) {
  const saved = JSON.parse(localStorage.getItem("auravoice_history")) || [];
  const filtered = saved.filter(item => item.id !== id);
  localStorage.setItem("auravoice_history", JSON.stringify(filtered));
  loadSessionHistory();
}

clearAllBtn.onclick = () => {
  if (confirm("Delete all session history?")) {
    localStorage.removeItem("auravoice_history");
    loadSessionHistory();
    // Reset indicators
    transcriptionText.innerHTML = "History cleared. Click microphone to speak.";
    wordCountVal.textContent = "0";
    durationVal.textContent = "0.0";
    initChart([0,0,100]);
    setRingProgress(fluencyRing, 100);
    setRingProgress(pacingRing, 0);
    setRingProgress(sentimentRing, 50);
    fluencyVal.innerHTML = `100<span class="unit">%</span>`;
    pacingVal.innerHTML = `--<span class="unit"> WPM</span>`;
    sentimentVal.textContent = "Neutral";
    keyphrasesList.innerHTML = `<span class="empty-msg">No topics extracted yet</span>`;
    entitiesDetails.innerHTML = "";
    summaryText.innerHTML = `"A summary of longer speech files will be generated here."`;
    downloadBtn.disabled = true;
    
    spectrogramImg.style.display = "none";
    specPlaceholder.style.display = "flex";
  }
};

// Export transcript file
downloadBtn.onclick = () => {
  const text = transcriptionText.textContent.replace(/Filler word: [a-zA-Z\s]*/g, "").trim();
  const summary = summaryText.textContent;
  const metrics = `--- AURAVOICE AI ANALYTICS REPORT ---
Fluency: ${fluencyVal.textContent}
Pacing: ${pacingVal.textContent}
Tone: ${sentimentVal.textContent}
Word Count: ${wordCountVal.textContent}
Duration: ${durationVal.textContent}s
------------------------------------
SUMMARY:
${summary}

TRANSCRIPTION:
${text}
`;

  const blob = new Blob([metrics], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `auravoice_analytics_${Date.now()}.txt`;
  a.click();
};

// =========================================================================
// 10. Voice Assistant Logic (Jarvis Style)
// =========================================================================
function runAssistantAssistant(text, summary) {
  const query = text.toLowerCase().trim();
  let responseMsg = "";
  
  if (query.includes("open google")) {
    responseMsg = "Opening Google in a new browser tab.";
    window.open("https://www.google.com", "_blank");
  } else if (query.includes("what is time")) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    responseMsg = `The local time is ${time}.`;
  } else if (query.includes("hello")) {
    responseMsg = "Hello! I am AuraVoice assistant. How is your public speaking going?";
  } else if (query.includes("read summary") || query.includes("speak summary") || query.includes("summarize voice")) {
    responseMsg = `Reading your summary: ${summary}`;
  } else {
    responseMsg = "Command recognized. Voice coach analytics successfully calculated.";
  }
  
  assistantResponse.textContent = responseMsg;
  speakOutput(responseMsg);
}

function speakOutput(message) {
  if (!window.speechSynthesis) return;
  // Cancel active speaks
  window.speechSynthesis.cancel();
  
  const speech = new SpeechSynthesisUtterance(message);
  speech.lang = "en-US";
  speech.rate = 1.0;
  speech.pitch = 1.0;
  
  // Pick a professional-sounding default voice if possible
  const voices = window.speechSynthesis.getVoices();
  const preferredVoice = voices.find(v => v.name.includes("Google US English") || v.name.includes("Natural"));
  if (preferredVoice) speech.voice = preferredVoice;
  
  window.speechSynthesis.speak(speech);
}