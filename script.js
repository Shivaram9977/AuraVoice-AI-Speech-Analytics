/* =========================================================================
   AuraVoice AI | JavaScript Logic (Professional Redesign)
   Includes: Authentication, Page Routing, Profile Settings, Analytics & Trends,
             Real-time Audio capturing, Chart.js, FastAPI connections, fallbacks
   ========================================================================= */

const BACKEND_URL = "http://127.0.0.1:8000";

// --- STATE MANAGEMENT ---
let currentUser = null;

function loadOrInitializeUser(email, name, defaultData) {
  let accounts = JSON.parse(localStorage.getItem("auravoice_accounts")) || [];
  let existingUser = accounts.find(acc => acc.email.toLowerCase() === email.toLowerCase());
  
  if (existingUser) {
    return { ...defaultData, ...existingUser };
  } else {
    const newUser = { ...defaultData, email: email, name: name };
    accounts.push(newUser);
    localStorage.setItem("auravoice_accounts", JSON.stringify(accounts));
    return newUser;
  }
}

function updateAccountInStorage(userObj) {
  if (!userObj || !userObj.email) return;
  let accounts = JSON.parse(localStorage.getItem("auravoice_accounts")) || [];
  const index = accounts.findIndex(acc => acc.email.toLowerCase() === userObj.email.toLowerCase());
  if (index !== -1) {
    accounts[index] = { ...accounts[index], ...userObj };
  } else {
    accounts.push(userObj);
  }
  localStorage.setItem("auravoice_accounts", JSON.stringify(accounts));
}

let sessionHistory = [];
let backendOnline = false;
let generatedOtp = "";
let pendingUserRegister = null;
let tokenClient;

// Audio & Speech state variables
let recognition;
let isListening = false;
let silenceTimer;
let finalTranscript = "";
let recordingStartTime;
let audioContext;
let analyser;
let dataArray;
let sourceNode;
let animationFrameId;

// Chart.js Instances
let sentimentChart = null;
let historicalChartInstance = null;

// --- DOM ELEMENTS ---
const loginView = document.getElementById("loginView");
const appView = document.getElementById("appView");
const loginForm = document.getElementById("loginForm");
const demoLoginBtn = document.getElementById("demoLoginBtn");
const googleLoginBtn = document.getElementById("googleLoginBtn");
const authLoader = document.getElementById("authLoader");
const emailInput = document.getElementById("emailInput");
const passwordInput = document.getElementById("passwordInput");

// OTP Elements
const otpOverlay = document.getElementById("otpOverlay");
const otpInput = document.getElementById("otpInput");
const otpAlert = document.getElementById("otpAlert");
const verifyOtpBtn = document.getElementById("verifyOtpBtn");
const cancelOtpBtn = document.getElementById("cancelOtpBtn");

// Navigation
const navLinks = document.querySelectorAll(".nav-link");
const viewContents = document.querySelectorAll(".view-content");
const userMenuBtn = document.getElementById("userMenuBtn");
const userDropdown = document.getElementById("userDropdown");
const logoutBtn = document.getElementById("logoutBtn");
const goToProfileBtn = document.getElementById("goToProfileBtn");
const navAvatar = document.getElementById("navAvatar");
const navUsername = document.getElementById("navUsername");
const dropName = document.getElementById("dropName");
const dropTitle = document.getElementById("dropTitle");

// Dashboard DOM Elements
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

// Visualizer Tab Elements
const tabLinks = document.querySelectorAll(".tab-link");
const tabContents = document.querySelectorAll(".tab-content");
const spectrogramTabBtn = document.getElementById("spectrogramTabBtn");
const specPlaceholder = document.getElementById("specPlaceholder");
const spectrogramImg = document.getElementById("spectrogramImg");

// Metrics Elements
const fluencyVal = document.getElementById("fluencyVal");
const fluencyBar = document.getElementById("fluencyBar");
const fluencyFooter = document.getElementById("fluencyFooter");
const pacingVal = document.getElementById("pacingVal");
const pacingBar = document.getElementById("pacingBar");
const pacingFooter = document.getElementById("pacingFooter");
const sentimentVal = document.getElementById("sentimentVal");
const sentimentBar = document.getElementById("sentimentBar");
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

// Profile DOM Elements
const profileHeroAvatar = document.getElementById("profileHeroAvatar");
const profileHeroName = document.getElementById("profileHeroName");
const profileHeroTitle = document.getElementById("profileHeroTitle");
const avatarFileInput = document.getElementById("avatarFileInput");
const targetWpmSlider = document.getElementById("targetWpmSlider");
const targetWpmVal = document.getElementById("targetWpmVal");
const fillerWordsSlider = document.getElementById("fillerWordsSlider");
const fillerWordsVal = document.getElementById("fillerWordsVal");
const profileDetailsForm = document.getElementById("profileDetailsForm");
const voicePrefsForm = document.getElementById("voicePrefsForm");

const profFullName = document.getElementById("profFullName");
const profTitle = document.getElementById("profTitle");
const profEmail = document.getElementById("profEmail");
const profCompany = document.getElementById("profCompany");
const voiceCoachGender = document.getElementById("voiceCoachGender");
const coachingLanguage = document.getElementById("coachingLanguage");
const autoDownloadCheck = document.getElementById("autoDownloadCheck");

// Analytics Tab DOM Elements
const avgFluency = document.getElementById("avgFluency");
const avgPacing = document.getElementById("avgPacing");
const totalSessions = document.getElementById("totalSessions");
const sessionsTableBody = document.getElementById("sessionsTableBody");

// Heuristic dictionaries for offline mode
const MOCK_POSITIVE_WORDS = ["good", "great", "excellent", "awesome", "wonderful", "amazing", "love", "like", "happy", "best", "perfect", "fantastic", "brilliant", "outstanding", "superb", "helpful", "smart", "improve", "success", "professional", "clear", "confident"];
const MOCK_NEGATIVE_WORDS = ["bad", "terrible", "worst", "awful", "horrible", "hate", "dislike", "sad", "angry", "wrong", "error", "fail", "failure", "broken", "difficult", "slow", "problem", "issue", "poor", "unclear", "unprepared"];
const MOCK_FILLER_WORDS = ["um", "uh", "ah", "like", "you know", "so", "actually", "basically", "seriously", "literally", "right", "okay", "i mean"];
const MOCK_STOPWORDS = ["i", "me", "my", "we", "our", "you", "your", "he", "she", "it", "they", "this", "that", "the", "a", "an", "and", "but", "if", "or", "of", "to", "in", "is", "was", "were", "be", "have", "had", "do", "for", "with", "on", "at", "by"];

// =========================================================================
// 1. Initial Setup & Routing
// =========================================================================
window.onload = async () => {
  initAuth();
  
  if (currentUser) {
    showAppWorkspace();
  } else {
    showLoginScreen();
  }

  // Set up event listeners for dropdowns and views
  setupInteractions();
};

function initAuth() {
  const loggedIn = localStorage.getItem("auravoice_logged_in") === "true";
  if (loggedIn) {
    currentUser = JSON.parse(localStorage.getItem("auravoice_profile"));
    if (!currentUser) {
      currentUser = getDemoProfile();
      localStorage.setItem("auravoice_profile", JSON.stringify(currentUser));
    updateAccountInStorage(currentUser);
    }
  }
}

function getDemoProfile() {
  return {
    name: "Sarah Jenkins",
    title: "Executive Communications VP",
    email: "sarah.j@enterprise.com",
    company: "AuraCorp Systems",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=256&auto=format&fit=crop",
    targetWpm: 130,
    maxFillerPct: 3,
    coachVoice: "female",
    coachingLanguage: "en-US",
    autoDownload: true
  };
}

function getDemoSessions() {
  return [
    {
      id: Date.now() - 86400000 * 3, // 3 days ago
      timestamp: "08/08/2026, 02:15 PM",
      text: "Um, today I want to Basically present our corporate strategy. You know, we are scaling rapidly, but we need to focus, uh, on core analytics.",
      data: {
        text: "Um, today I want to Basically present our corporate strategy. You know, we are scaling rapidly, but we need to focus, uh, on core analytics.",
        duration: 15.2,
        wpm: 98,
        pacing_label: "Slow Pace",
        word_count: 25,
        sentiment: { score: 62, label: "Positive", positive_pct: 18, negative_pct: 5, neutral_pct: 77 },
        fillers: { score: 75, count: 4, details: { "um": 1, "basically": 1, "you know": 1, "uh": 1 }, highlighted_text: "" },
        keyphrases: [{ keyword: "strategy", count: 1 }, { keyword: "analytics", count: 1 }, { keyword: "scaling", count: 1 }],
        entities: { PERSON: [], ORG: [], GPE: [], DATE_TIME: [] },
        summary: "The speaker outlines the rapid corporate scaling strategy and calls for a focus on core analytics.",
        spectrogram: ""
      }
    },
    {
      id: Date.now() - 86400000 * 2, // 2 days ago
      timestamp: "09/08/2026, 11:30 AM",
      text: "I am absolutely thrilled to announce the launch of our new AuraVoice AI analytics platform today. It provides real-time coaching feedback and is extremely responsive.",
      data: {
        text: "I am absolutely thrilled to announce the launch of our new AuraVoice AI analytics platform today. It provides real-time coaching feedback and is extremely responsive.",
        duration: 12.0,
        wpm: 125,
        pacing_label: "Optimal Pace",
        word_count: 25,
        sentiment: { score: 95, label: "Positive", positive_pct: 35, negative_pct: 0, neutral_pct: 65 },
        fillers: { score: 100, count: 0, details: {}, highlighted_text: "" },
        keyphrases: [{ keyword: "analytics", count: 1 }, { keyword: "coaching", count: 1 }, { keyword: "launch", count: 1 }],
        entities: { PERSON: [], ORG: ["AuraVoice AI"], GPE: [], DATE_TIME: ["today"] },
        summary: "The speaker confidently announces the launch of the new AuraVoice AI analytics coaching platform.",
        spectrogram: ""
      }
    },
    {
      id: Date.now() - 86400000 * 1, // 1 day ago
      timestamp: "10/08/2026, 04:45 PM",
      text: "We ran a fast experiment, like, really fast, and basically, we saw a massive drop in latency. The server processed everything in, uh, under 100 milliseconds.",
      data: {
        text: "We ran a fast experiment, like, really fast, and basically, we saw a massive drop in latency. The server processed everything in, uh, under 100 milliseconds.",
        duration: 10.5,
        wpm: 154,
        pacing_label: "Fast Pace",
        word_count: 27,
        sentiment: { score: 48, label: "Neutral", positive_pct: 10, negative_pct: 12, neutral_pct: 78 },
        fillers: { score: 82, count: 3, details: { "like": 1, "basically": 1, "uh": 1 }, highlighted_text: "" },
        keyphrases: [{ keyword: "experiment", count: 1 }, { keyword: "latency", count: 1 }, { keyword: "milliseconds", count: 1 }],
        entities: { PERSON: [], ORG: [], GPE: [], DATE_TIME: ["100 milliseconds"] },
        summary: "An experiment demonstrated a massive reduction in server processing latency.",
        spectrogram: ""
      }
    }
  ];
}

function showLoginScreen() {
  loginView.style.display = "flex";
  appView.style.display = "none";
}

async function showAppWorkspace() {
  loginView.style.display = "none";
  appView.style.display = "flex";
  
  // Populate Navbar details
  updateNavbarProfile();
  
  // Initialize Profile form values
  populateProfileForm();

  // Initialize Canvas Visualizer
  initCanvas();
  
  // Initialize Doughnut Chart
  initChart([0, 0, 100]); 
  
  // Load local storage session history
  initializeHistoryStorage();
  loadSessionHistory();
  loadAnalyticsTab();
  
  // Check backend server connection
  await checkBackendHealth();
}

function updateNavbarProfile() {
  if (!currentUser) return;
  navAvatar.src = currentUser.avatar;
  navUsername.textContent = currentUser.name.split(" ")[0];
  dropName.textContent = currentUser.name;
  dropTitle.textContent = currentUser.title;
  profileHeroAvatar.src = currentUser.avatar;
  profileHeroName.textContent = currentUser.name;
  profileHeroTitle.textContent = currentUser.title;
}

// Check if FastAPI backend is running
async function checkBackendHealth() {
  try {
    const res = await fetch(`${BACKEND_URL}/health`, { method: 'GET' });
    if (res.ok) {
      const data = await res.json();
      backendOnline = true;
      connectionBadge.className = "status-dot success";
      connectionText.textContent = "Local API Connected";
      statusMsg.textContent = "Speech engine active. Ready to process speech and audio.";
      spectrogramTabBtn.disabled = false;
      console.log("[AuraVoice] FastAPI server active:", data);
    } else {
      throw new Error();
    }
  } catch (err) {
    backendOnline = false;
    connectionBadge.className = "status-dot warning";
    connectionText.textContent = "Demo / Offline Mode";
    statusMsg.textContent = "Running in browser demo mode. Spectrogram generation disabled (requires backend).";
    spectrogramTabBtn.disabled = true;
    console.warn("[AuraVoice] Local FastAPI server not found. Falling back to local offline engines.");
  }
}

// =========================================================================
// 2. Navigation & User Interactions
// =========================================================================
function setupInteractions() {
  let isSignUpMode = false;
  const fullNameGroup = document.getElementById("fullNameGroup");
  const nameInput = document.getElementById("nameInput");
  const submitAuthBtn = document.getElementById("submitAuthBtn");
  const toggleAuthModeLink = document.getElementById("toggleAuthModeLink");

  // Toggle Auth Mode (Sign In / Sign Up)
  if (toggleAuthModeLink) {
    toggleAuthModeLink.onclick = (e) => {
      e.preventDefault();
      isSignUpMode = !isSignUpMode;
      if (isSignUpMode) {
        fullNameGroup.style.display = "block";
        nameInput.required = true;
        nameInput.focus();
        submitAuthBtn.querySelector("span").textContent = "Create Account & Sign In";
        toggleAuthModeLink.textContent = "Sign In";
        toggleAuthModeLink.parentElement.firstChild.textContent = "Already have an account? ";
      } else {
        fullNameGroup.style.display = "none";
        nameInput.required = false;
        nameInput.value = "";
        submitAuthBtn.querySelector("span").textContent = "Sign In to Dashboard";
        toggleAuthModeLink.textContent = "Sign Up";
        toggleAuthModeLink.parentElement.firstChild.textContent = "Don't have an account? ";
      }
    };
  }

  // Login Form Submission
  loginForm.onsubmit = (e) => {
    e.preventDefault();
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const name = nameInput.value.trim();
    
    if (email && password) {
      if (isSignUpMode) {
        if (!name) return;
        
        // Generate simulated 6-digit OTP
        generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
        pendingUserRegister = { name, email, password };
        
        // Display OTP Verification Overlay
        otpOverlay.style.display = "flex";
        otpInput.value = "";
        otpAlert.style.display = "none";
        otpInput.focus();
        
        // Send real OTP email via backend FastAPI server
        fetch(BACKEND_URL + '/api/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            to_email: email,
            otp_code: generatedOtp,
            user_name: name
          })
        }).then(function(r) { return r.json(); })
          .then(function(d) { console.log('[AuraVoice] OTP email sent via backend:', d); })
          .catch(function(e) { console.warn('[AuraVoice] Backend email note (code still shown in toast):', e); });

      } else {
        // --- SIGN IN: validate credentials against stored accounts ---
        const authAlert = document.getElementById("authAlert");
        const authAlertMsg = document.getElementById("authAlertMsg");
        if (authAlert) authAlert.style.display = "none";
        
        const accounts = JSON.parse(localStorage.getItem("auravoice_accounts")) || [];
        const matched = accounts.find(acc => acc.email.toLowerCase() === email.toLowerCase());
        
        if (!matched) {
          if (authAlert && authAlertMsg) {
            authAlertMsg.textContent = "No account found with this email. Please sign up first.";
            authAlert.style.display = "block";
          }
          return;
        }
        
        if (matched.password !== password) {
          if (authAlert && authAlertMsg) {
            authAlertMsg.textContent = "Incorrect password. Please try again.";
            authAlert.style.display = "block";
          }
          return;
        }
        
        // Credentials OK — log in
        authLoader.style.display = "flex";
        setTimeout(() => {
          authLoader.style.display = "none";
          localStorage.setItem("auravoice_logged_in", "true");
          
          const profileName = matched.name;
          const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profileName)}`;
          
          currentUser = loadOrInitializeUser(matched.email, profileName, {
            title: "Executive Communications Partner",
            company: "AuraCorp",
            avatar: avatarUrl,
            goals: { wpm: 130, maxFiller: 3 },
            prefs: { coachVoice: "female", coachingLanguage: "en-US", autoDownload: true }
          });
          
          localStorage.setItem("auravoice_profile", JSON.stringify(currentUser));
    updateAccountInStorage(currentUser);
          showAppWorkspace();
          statusMsg.textContent = `Welcome back, ${profileName}!`;
        }, 1200);
      }
    }
  };

  // OTP Verification Bindings
  verifyOtpBtn.onclick = () => {
    const enteredCode = otpInput.value.trim();
    if (enteredCode === generatedOtp) {
      otpOverlay.style.display = "none";
      // Close the email toast if open
      const toastEl = document.getElementById('mockEmailToast');
      if (toastEl) toastEl.style.display = 'none';
      
      authLoader.style.display = "flex";
      
      setTimeout(() => {
        authLoader.style.display = "none";
        localStorage.setItem("auravoice_logged_in", "true");
        
        const profileName = pendingUserRegister.name;
        const avatarUrl = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(profileName)}`;
        
        currentUser = loadOrInitializeUser(pendingUserRegister.email, profileName, {
          password: pendingUserRegister.password,
          title: "Newly Registered Speaker",
          company: "AuraCorp",
          avatar: avatarUrl,
          goals: { wpm: 130, maxFiller: 3 },
          prefs: { coachVoice: "female", coachingLanguage: "en-US", autoDownload: true }
        });
        
        localStorage.setItem("auravoice_profile", JSON.stringify(currentUser));
    updateAccountInStorage(currentUser);
        updateAccountInStorage(currentUser);
        
        showAppWorkspace();
        statusMsg.textContent = `Welcome to AuraVoice, ${profileName}! Account created successfully.`;
        
        generatedOtp = "";
        pendingUserRegister = null;
      }, 1000);
    } else {
      otpAlert.style.display = "block";
      otpInput.focus();
    }
  };

  cancelOtpBtn.onclick = () => {
    otpOverlay.style.display = "none";
    generatedOtp = "";
    pendingUserRegister = null;
  };

  // Demo Login Button
  demoLoginBtn.onclick = () => {
    localStorage.setItem("auravoice_logged_in", "true");
    currentUser = getDemoProfile();
    localStorage.setItem("auravoice_profile", JSON.stringify(currentUser));
    updateAccountInStorage(currentUser);
    showAppWorkspace();
  };

  // Google Login button click trigger (programmatic Token Client)
  if (googleLoginBtn) {
    googleLoginBtn.onclick = () => {
      if (tokenClient) {
        tokenClient.requestAccessToken({ prompt: 'select_account' });
      } else {
        showInlineAlert("Google Sign-In is initializing. Please try again in a moment.", "info");
      }
    };
  }
  // Nav Tabs routing
  navLinks.forEach(link => {
    link.addEventListener("click", () => {
      navLinks.forEach(l => l.classList.remove("active"));
      link.classList.add("active");
      
      const targetView = link.dataset.view;
      viewContents.forEach(content => {
        content.classList.remove("active");
      });
      document.getElementById(targetView).classList.add("active");
      
      // Stop mic if navigation changes
      if (targetView !== "dashboardView" && isListening) {
        stopListening();
      }

      if (targetView === "analyticsView") {
        loadAnalyticsTab();
      }
    });
  });

  // User Dropdown toggle
  userMenuBtn.onclick = (e) => {
    e.stopPropagation();
    userDropdown.classList.toggle("active");
  };

  document.addEventListener("click", () => {
    userDropdown.classList.remove("active");
  });

  goToProfileBtn.onclick = () => {
    const profileLink = Array.from(navLinks).find(l => l.dataset.view === "profileView");
    if (profileLink) profileLink.click();
  };

  // Logout button
  logoutBtn.onclick = () => {
    if (isListening) stopListening();
    localStorage.setItem("auravoice_logged_in", "false");
    currentUser = null;
    showLoginScreen();
  };

  // Setup Visualizer tabs (Realtime waveform vs Spectrogram)
  tabLinks.forEach(link => {
    link.addEventListener("click", () => {
      if (link.disabled) return;
      tabLinks.forEach(l => l.classList.remove("active"));
      tabContents.forEach(c => c.classList.remove("active"));
      link.classList.add("active");
      document.getElementById(link.dataset.tab).classList.add("active");
    });
  });

  // Sidebar drag & drop uploader
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

  // Drag over effects
  dropZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZone.classList.add("drag-over");
  });
  dropZone.addEventListener("dragleave", () => {
    dropZone.classList.remove("drag-over");
  });
  dropZone.addEventListener("drop", (e) => {
    e.preventDefault();
    dropZone.classList.remove("drag-over");
    if (e.dataTransfer.files.length > 0) {
      handleAudioFileUpload(e.dataTransfer.files[0]);
    }
  });

  // Profile forms submission
  profileDetailsForm.onsubmit = (e) => {
    e.preventDefault();
    currentUser.name = profFullName.value.trim();
    currentUser.title = profTitle.value.trim();
    currentUser.email = profEmail.value.trim();
    currentUser.company = profCompany.value.trim();
    localStorage.setItem("auravoice_profile", JSON.stringify(currentUser));
    updateAccountInStorage(currentUser);
    updateNavbarProfile();
    showInlineAlert("Profile details saved!", "success");
  };

  voicePrefsForm.onsubmit = (e) => {
    e.preventDefault();
    currentUser.coachVoice = voiceCoachGender.value;
    currentUser.coachingLanguage = coachingLanguage.value;
    currentUser.autoDownload = autoDownloadCheck.checked;
    localStorage.setItem("auravoice_profile", JSON.stringify(currentUser));
    updateAccountInStorage(currentUser);
    
    // Update Web Speech recognition language if active
    if (recognition) {
      recognition.lang = currentUser.coachingLanguage;
    }
    showInlineAlert("Coaching preferences saved!", "success");
  };

  // Avatar Upload Mock
  avatarFileInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        currentUser.avatar = reader.result;
        localStorage.setItem("auravoice_profile", JSON.stringify(currentUser));
    updateAccountInStorage(currentUser);
        updateNavbarProfile();
      };
      reader.readAsDataURL(file);
    }
  });

  // Goal sliders live display
  targetWpmSlider.addEventListener("input", (e) => {
    targetWpmVal.textContent = `${e.target.value} WPM`;
    if (!currentUser.goals) currentUser.goals = {};
    currentUser.goals.wpm = parseInt(e.target.value);
    localStorage.setItem("auravoice_profile", JSON.stringify(currentUser));
    updateAccountInStorage(currentUser);
  });

  fillerWordsSlider.addEventListener("input", (e) => {
    fillerWordsVal.textContent = `${e.target.value} %`;
    if (!currentUser.goals) currentUser.goals = {};
    currentUser.goals.maxFiller = parseInt(e.target.value);
    localStorage.setItem("auravoice_profile", JSON.stringify(currentUser));
    updateAccountInStorage(currentUser);
  });
}

function populateProfileForm() {
  if (!currentUser) return;
  profFullName.value = currentUser.name;
  profTitle.value = currentUser.title;
  profEmail.value = currentUser.email;
  profCompany.value = currentUser.company || "";
  voiceCoachGender.value = currentUser.coachVoice || "female";
  coachingLanguage.value = currentUser.coachingLanguage || "en-US";
  autoDownloadCheck.checked = currentUser.autoDownload !== false;
  
  targetWpmSlider.value = currentUser.targetWpm || 130;
  targetWpmVal.textContent = `${targetWpmSlider.value} WPM`;
  
  fillerWordsSlider.value = currentUser.maxFillerPct || 3;
  fillerWordsVal.textContent = `${fillerWordsSlider.value} %`;
}

function initializeHistoryStorage() {
  const history = localStorage.getItem("auravoice_history");
  if (!history) {
    const demo = getDemoSessions();
    localStorage.setItem("auravoice_history", JSON.stringify(demo));
  }
}

// =========================================================================
// 3. Audio Visualizer Canvas Setup
// =========================================================================
function initCanvas() {
  canvas.width = canvas.parentElement.clientWidth || 600;
  canvas.height = 120;
  
  // Draw flat line initially
  canvasCtx.fillStyle = '#000000';
  canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
  canvasCtx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
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
  
  canvasCtx.fillStyle = '#000000';
  canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Custom glowing line
  canvasCtx.lineWidth = 3;
  canvasCtx.strokeStyle = '#ffffff';
  canvasCtx.shadowBlur = 8;
  canvasCtx.shadowColor = '#ffffff';
  
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
// 4. Speech Recognition Engine (Web Speech API)
// =========================================================================
if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  recognition = new SpeechRecognition();
  
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.lang = currentUser ? currentUser.coachingLanguage : "en-US";
  
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
  
  startBtn.classList.add("recording");
  startBtn.querySelector(".btn-lbl").textContent = "Stop Recording";
  statusMsg.textContent = "Recording in progress... Analyzing vocal streams.";
  
  recognition.lang = currentUser ? currentUser.coachingLanguage : "en-US";
  recognition.start();
  startVisualizer();
  startSilenceTimer();
}

function stopListening() {
  isListening = false;
  startBtn.classList.remove("recording");
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
// 5. Processing Analytics (Backend API vs local Heuristic Engine)
// =========================================================================
async function processSessionAnalytics(text, duration) {
  statusMsg.textContent = "Analyzing speech patterns & metrics...";
  durationVal.textContent = duration.toFixed(1);
  
  if (backendOnline) {
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
      
      // Custom coaching evaluations based on target WPM in user settings
      const targetWpm = currentUser ? currentUser.targetWpm : 130;
      if (wpm < (targetWpm - 20)) pacingLabel = "Slow Pace";
      else if (wpm <= (targetWpm + 20)) pacingLabel = "Optimal Pace";
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
        spectrogram: "" 
      };
      
      updateDashboardUI(payload);
      saveSessionToHistory(payload);
      statusMsg.textContent = "Analysis complete. Speech dashboard updated.";
      
      // Auto-download check
      if (currentUser && currentUser.autoDownload) {
        triggerDownload(payload);
      }
      
    } catch (e) {
      console.error("API error, falling back to local processing", e);
      runOfflineEngine(text, duration);
    }
  } else {
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
    posPct = Math.min(100, Math.round((posCount / wordCount) * 100) + 5);
    negPct = Math.min(100, Math.round((negCount / wordCount) * 100) + 5);
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
  
  const density = wordCount > 0 ? (fillerCount / wordCount) * 100 : 0;
  const fluencyScore = Math.max(0, Math.round(100 - (density * 5)));
  
  // 3. Keyphrases
  const cleanWords = words.filter(w => !MOCK_STOPWORDS.includes(w) && w.length > 3);
  const wordFreqs = {};
  cleanWords.forEach(w => wordFreqs[w] = (wordFreqs[w] || 0) + 1);
  const keyphrases = Object.entries(wordFreqs)
    .sort((a,b) => b[1] - a[1])
    .slice(0, 5)
    .map(item => ({ keyword: item[0], count: item[1] }));
    
  // 4. Summarize (Extractive)
  const sentences = text.split(/[.!?]+/).map(s => s.trim()).filter(Boolean);
  let summary = "";
  if (sentences.length <= 2) {
    summary = text;
  } else {
    const sortedSent = [...sentences].sort((a,b) => b.split(/\s+/).length - a.split(/\s+/).length);
    summary = sentences[0] + ". " + (sortedSent[0] !== sentences[0] ? sortedSent[0] + "." : sentences[1] + ".");
  }
  
  // 5. Named Entities
  const entities = { "PERSON": [], "ORG": [], "GPE": [], "DATE_TIME": [] };
  const capWords = text.split(/\s+/).filter(w => w && w[0] === w[0].toUpperCase() && w.toLowerCase() !== w);
  capWords.forEach(w => {
    const clean = w.replace(/[^\w]/g, "");
    if (clean.length > 2 && !MOCK_STOPWORDS.includes(clean.toLowerCase())) {
      if (clean === "Google" || clean === "Microsoft" || clean === "Amazon" || clean === "OpenAI" || clean === "AuraCorp") {
        entities.ORG.push(clean);
      } else if (clean === "London" || clean === "India" || clean === "Paris" || clean === "America" || clean === "New York") {
        entities.GPE.push(clean);
      } else {
        entities.PERSON.push(clean);
      }
    }
  });
  
  // 6. Speaking Pace WPM evaluation against target Goals
  const wpm = duration > 0 ? Math.round((wordCount / duration) * 60) : 0;
  let pacingLabel = "Normal";
  
  const targetWpm = currentUser ? currentUser.targetWpm : 130;
  if (wpm < (targetWpm - 20)) pacingLabel = "Slow Pace";
  else if (wpm <= (targetWpm + 20)) pacingLabel = "Optimal Pace";
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
  statusMsg.textContent = "Analysis complete (Offline Mode). Dashboard updated.";
  
  if (currentUser && currentUser.autoDownload) {
    triggerDownload(payload);
  }
}

// =========================================================================
// 6. Update Dashboard UI & Visualizations
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
    
    // Switch tabs to spectrogram
    tabLinks.forEach(l => l.classList.remove("active"));
    tabContents.forEach(c => c.classList.remove("active"));
    spectrogramTabBtn.classList.add("active");
    document.getElementById("spectrogramTab").classList.add("active");
  }
  
  // Word counters
  wordCountVal.textContent = data.word_count;
  durationVal.textContent = parseFloat(data.duration).toFixed(1);
  transcriptionText.innerHTML = data.fillers.highlighted_text || formatHighlightedText(data.text);
  
  // Fluency Score
  const fluencyScore = data.fillers.score;
  fluencyVal.innerHTML = `${fluencyScore}<span class="unit">%</span>`;
  setBarProgress(fluencyBar, fluencyScore);
  
  // Evaluation messages matching custom limits
  const maxFiller = currentUser ? currentUser.maxFillerPct : 3;
  let fluencyDesc = "Excellent speech flow";
  const fillerPct = data.word_count > 0 ? (data.fillers.count / data.word_count) * 100 : 0;
  if (fillerPct > maxFiller) fluencyDesc = "Cluttered speech. Try pausing.";
  else if (fluencyScore < 90) fluencyDesc = "Moderate filler words detected.";
  fluencyFooter.textContent = fluencyDesc;
  
  // Pacing
  pacingVal.innerHTML = `${data.wpm}<span class="unit"> WPM</span>`;
  const targetWpm = currentUser ? currentUser.targetWpm : 130;
  const pacingBarScore = Math.min(100, Math.round((data.wpm / targetWpm) * 100));
  setBarProgress(pacingBar, pacingBarScore);
  
  let pacingDesc = "Awaiting speech";
  if (data.wpm > 0) {
    if (data.pacing_label === "Slow Pace") pacingDesc = `🐢 Too slow (Target: ${targetWpm} WPM).`;
    else if (data.pacing_label === "Fast Pace") pacingDesc = `⚡ Too fast (Target: ${targetWpm} WPM).`;
    else pacingDesc = "🎯 Perfect cadence for public speaking.";
  }
  pacingFooter.textContent = pacingDesc;
  
  // Sentiment
  const sentScore = data.sentiment.score;
  sentimentVal.textContent = data.sentiment.label;
  setBarProgress(sentimentBar, sentScore);
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

function setBarProgress(barElement, score) {
  if (barElement) {
    barElement.style.width = `${score}%`;
  }
}

function formatHighlightedText(text) {
  if (!text) return "Click start to speak...";
  let formatted = text;
  MOCK_FILLER_WORDS.forEach(filler => {
    const regex = new RegExp(`\\b(${filler})\\b`, 'gi');
    formatted = formatted.replace(regex, `<span class="filler-word" title="Filler word: $1">$1</span>`);
  });
  return formatted;
}

// Doughnut Chart Setup
function initChart(dataArray) {
  const chartCanvas = document.getElementById('analyticsChart');
  if (!chartCanvas) return;
  const ctx = chartCanvas.getContext('2d');
  
  if (sentimentChart) {
    sentimentChart.destroy();
  }
  
  sentimentChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Positive %', 'Negative %', 'Neutral %'],
      datasets: [{
        data: dataArray,
        backgroundColor: [
          '#14b8a6', // Positive (Teal)
          '#f43f5e', // Negative (Rose)
          '#64748b'  // Neutral (Slate Grey)
        ],
        borderWidth: 1.5,
        borderColor: '#12131a'
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
            color: '#94a3b8',
            font: { size: 9, family: 'Inter' }
          }
        }
      },
      cutout: '65%'
    }
  });
}

function updateChart(newData) {
  if (sentimentChart) {
    sentimentChart.data.datasets[0].data = newData;
    sentimentChart.update();
  }
}

// =========================================================================
// 7. Drag and Drop Audio File Upload
// =========================================================================
async function handleAudioFileUpload(file) {
  if (!backendOnline) {
    showInlineAlert("Backend not running. Please run setup.bat first!", "error");
    return;
  }
  
  // Load audio file into local playback player
  const playbackContainer = document.getElementById("playbackContainer");
  const audioPlayback = document.getElementById("audioPlayback");
  if (playbackContainer && audioPlayback) {
    audioPlayback.src = URL.createObjectURL(file);
    playbackContainer.style.display = "flex";
  }
  
  statusMsg.textContent = `Uploading & transcribing ${file.name}...`;
  transcriptionText.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Running speech transcription and analysis on backend. Please wait...`;
  
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
    statusMsg.textContent = `Successfully processed file: ${file.name}`;
    
  } catch (err) {
    console.error("[Upload] Failed to process audio:", err);
    statusMsg.textContent = `Error processing audio: ${err.message}`;
    transcriptionText.innerHTML = `<span class="empty-msg">Error transcribing audio. Make sure the file format is supported and python server is operational.</span>`;
  }
}

// =========================================================================
// 8. Session History & LocalStorage Logs
// =========================================================================
function saveSessionToHistory(sessionData) {
  const saved = JSON.parse(localStorage.getItem("auravoice_history")) || [];
  
  const historyItem = {
    id: Date.now(),
    timestamp: new Date().toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }),
    text: sessionData.text || sessionData.transcription,
    data: sessionData
  };
  
  saved.unshift(historyItem);
  if (saved.length > 20) saved.pop();
  
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
    
    const divTop = document.createElement("div");
    divTop.className = "hist-top";
    
    const nameSpan = document.createElement("span");
    nameSpan.textContent = item.text.substring(0, 18) + "...";
    
    const delBtn = document.createElement("span");
    delBtn.style.cursor = "pointer";
    delBtn.style.color = "var(--color-danger)";
    delBtn.innerHTML = `<i class="fa-regular fa-trash-can"></i>`;
    delBtn.onclick = (e) => {
      e.stopPropagation();
      deleteHistoryItem(item.id);
    };
    
    divTop.appendChild(nameSpan);
    divTop.appendChild(delBtn);
    
    const divMeta = document.createElement("div");
    divMeta.className = "hist-meta";
    
    const timeSpan = document.createElement("span");
    timeSpan.className = "hist-time";
    timeSpan.textContent = item.timestamp.split(",")[1]?.trim() || item.timestamp;
    
    const scoreSpan = document.createElement("span");
    scoreSpan.textContent = `Fluency: ${item.data.fillers.score}%`;
    
    divMeta.appendChild(timeSpan);
    divMeta.appendChild(scoreSpan);
    
    li.appendChild(divTop);
    li.appendChild(divMeta);
    
    li.onclick = () => {
      updateDashboardUI(item.data);
      statusMsg.textContent = "Loaded session analysis from history.";
    };
    
    historyList.appendChild(li);
  });
}

function deleteHistoryItem(id) {
  const saved = JSON.parse(localStorage.getItem("auravoice_history")) || [];
  const filtered = saved.filter(item => item.id !== id);
  localStorage.setItem("auravoice_history", JSON.stringify(filtered));
  loadSessionHistory();
  loadAnalyticsTab();
}

clearAllBtn.onclick = () => {
  if (confirm("Delete all session history?")) {
    localStorage.setItem("auravoice_history", JSON.stringify([]));
    loadSessionHistory();
    loadAnalyticsTab();
    
    // Reset indicators
    transcriptionText.innerHTML = "History cleared. Click microphone to speak.";
    wordCountVal.textContent = "0";
    durationVal.textContent = "0.0";
    initChart([0,0,100]);
    
    // Hide audio player
    const playbackContainer = document.getElementById("playbackContainer");
    const audioPlayback = document.getElementById("audioPlayback");
    if (playbackContainer && audioPlayback) {
      audioPlayback.src = "";
      playbackContainer.style.display = "none";
    }
    setBarProgress(fluencyBar, 100);
    setBarProgress(pacingBar, 0);
    setBarProgress(sentimentBar, 50);
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

// =========================================================================
// 9. History Tab Logs & Performance Trend Analysis
// =========================================================================
function loadAnalyticsTab() {
  const saved = JSON.parse(localStorage.getItem("auravoice_history")) || [];
  
  // Calculate average metrics
  let totalFluency = 0;
  let totalWpm = 0;
  let sessionsWithPacing = 0;
  
  saved.forEach(item => {
    totalFluency += item.data.fillers.score;
    if (item.data.wpm > 0) {
      totalWpm += item.data.wpm;
      sessionsWithPacing++;
    }
  });
  
  const avgFl = saved.length > 0 ? (totalFluency / saved.length).toFixed(1) : "100";
  const avgPc = sessionsWithPacing > 0 ? Math.round(totalWpm / sessionsWithPacing) : "0";
  
  avgFluency.textContent = `${avgFl}%`;
  avgPacing.textContent = `${avgPc} WPM`;
  totalSessions.textContent = `${saved.length} Session${saved.length !== 1 ? 's' : ''}`;
  
  // Populate Logs Table
  sessionsTableBody.innerHTML = "";
  
  if (saved.length === 0) {
    sessionsTableBody.innerHTML = `<tr><td colspan="7" class="empty-msg" style="text-align: center; padding: 2rem;">No speech sessions recorded yet. Try speaking or uploading files.</td></tr>`;
    destroyHistoricalChart();
    return;
  }
  
  saved.forEach(item => {
    const tr = document.createElement("tr");
    
    tr.innerHTML = `
      <td>${item.timestamp}</td>
      <td><strong>${item.text.substring(0, 32)}...</strong></td>
      <td>${parseFloat(item.data.duration).toFixed(1)}s</td>
      <td><span class="badge" style="color:${item.data.fillers.score > 90 ? 'var(--color-success)' : 'var(--color-warning)'}">${item.data.fillers.score}%</span></td>
      <td>${item.data.wpm} WPM</td>
      <td>${item.data.sentiment.label}</td>
      <td><button class="btn btn-secondary btn-view-log" style="padding: 0.3rem 0.6rem; font-size: 0.75rem;"><i class="fa-solid fa-folder-open"></i> Load</button></td>
    `;
    
    // Row click handler to load the log back to dashboard
    tr.querySelector(".btn-view-log").onclick = () => {
      // Click dashboard link to swap tabs
      const dashboardLink = Array.from(navLinks).find(l => l.dataset.view === "dashboardView");
      if (dashboardLink) dashboardLink.click();
      
      updateDashboardUI(item.data);
      statusMsg.textContent = `Loaded practices session: ${item.timestamp}`;
    };
    
    sessionsTableBody.appendChild(tr);
  });
  
  // Render line chart
  renderHistoricalChart(saved);
}

function renderHistoricalChart(historyData) {
  const chartCanvas = document.getElementById("historicalChart");
  if (!chartCanvas) return;
  
  const ctx = chartCanvas.getContext("2d");
  
  if (historicalChartInstance) {
    historicalChartInstance.destroy();
  }
  
  // Sort items chronological for trends (oldest first)
  const sorted = [...historyData].reverse();
  const labels = sorted.map(item => item.timestamp.split(",")[0] || item.timestamp);
  const fluencyPoints = sorted.map(item => item.data.fillers.score);
  const pacingPoints = sorted.map(item => item.data.wpm);
  
  historicalChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Fluency %',
          data: fluencyPoints,
          borderColor: '#3b82f6', // Cobalt Blue line
          backgroundColor: 'rgba(59, 130, 246, 0.05)',
          yAxisID: 'y',
          tension: 0.2,
          fill: true
        },
        {
          label: 'Pacing WPM',
          data: pacingPoints,
          borderColor: '#14b8a6', // Teal line
          backgroundColor: 'transparent',
          yAxisID: 'y1',
          tension: 0.2,
          borderDash: [5, 5]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: { color: '#94a3b8', font: { size: 9 } }
        },
        y: {
          type: 'linear',
          display: true,
          position: 'left',
          min: 0,
          max: 100,
          grid: { color: 'rgba(255, 255, 255, 0.03)' },
          ticks: { color: '#94a3b8' },
          title: { display: true, text: 'Fluency %', color: '#3b82f6', font: { size: 10, weight: 'bold' } }
        },
        y1: {
          type: 'linear',
          display: true,
          position: 'right',
          grid: { drawOnChartArea: false }, // avoid double grids
          ticks: { color: '#94a3b8' },
          title: { display: true, text: 'Pacing WPM', color: '#14b8a6', font: { size: 10, weight: 'bold' } }
        }
      },
      plugins: {
        legend: {
          labels: { color: '#94a3b8', font: { family: 'Inter', size: 10 } }
        }
      }
    }
  });
}

function destroyHistoricalChart() {
  if (historicalChartInstance) {
    historicalChartInstance.destroy();
    historicalChartInstance = null;
  }
}

// =========================================================================
// 10. Document Generation & Exports
// =========================================================================
downloadBtn.onclick = () => {
  const text = transcriptionText.textContent.replace(/Filler word: [a-zA-Z\s]*/g, "").trim();
  const summary = summaryText.textContent;
  
  const payload = {
    text: text,
    transcription: text,
    summary: summary,
    fillers: { score: parseInt(fluencyVal.textContent) },
    wpm: parseInt(pacingVal.textContent),
    sentiment: { label: sentimentVal.textContent }
  };
  
  triggerDownload(payload);
};

function triggerDownload(data) {
  const cleanText = data.text || data.transcription;
  const metrics = `--- AURAVOICE SPEECH ANALYTICS REPORT ---
Generated: ${new Date().toLocaleString()}
User: ${currentUser ? currentUser.name : "Anonymous"}
Title: ${currentUser ? currentUser.title : "Speaker"}
----------------------------------------
Fluency Rating: ${data.fillers.score}%
Pacing Speed: ${data.wpm} WPM
Overall Sentiment: ${data.sentiment ? data.sentiment.label : "Neutral"}
----------------------------------------
COACH SUMMARY:
${data.summary}

TRANSCRIPTION LOG:
${cleanText}
`;

  const blob = new Blob([metrics], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `AuraVoice_SessionReport_${Date.now()}.txt`;
  a.click();
}

// Google Identity Services (GIS) OAuth 2.0 Token Client Initializer
function initGoogleAuth() {
  try {
    tokenClient = google.accounts.oauth2.initTokenClient({
      client_id: '267220528710-b9o3u3n9thp5cnmq1jt00gejrq5am4k8.apps.googleusercontent.com',
      scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
      callback: async (tokenResponse) => {
        if (tokenResponse && tokenResponse.access_token) {
          const authLoader = document.getElementById("authLoader");
          if (authLoader) authLoader.style.display = "flex";
          
          try {
            // Fetch verified user details from Google UserInfo API
            const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
              headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
            });
            
            if (!userInfoRes.ok) throw new Error("Failed to fetch Google profile");
            
            const payload = await userInfoRes.json();
            
            setTimeout(() => {
              if (authLoader) authLoader.style.display = "none";
              localStorage.setItem("auravoice_logged_in", "true");
              
              currentUser = loadOrInitializeUser(payload.email, payload.name, {
                title: "Google Verified Speaker",
                company: "AuraCorp",
                avatar: payload.picture || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(payload.name)}`,
                goals: { wpm: 130, maxFiller: 3 },
                prefs: { coachVoice: "female", coachingLanguage: "en-US", autoDownload: true }
              });
              
              localStorage.setItem("auravoice_profile", JSON.stringify(currentUser));
    updateAccountInStorage(currentUser);
              showAppWorkspace();
              
              const statusMsg = document.getElementById("statusMsg");
              if (statusMsg) {
                statusMsg.textContent = `Signed in successfully via Google Accounts as ${payload.name}.`;
              }
            }, 1000);
          } catch (err) {
            console.error("Google userinfo fetch failed:", err);
            if (authLoader) authLoader.style.display = "none";
            showInlineAlert("Failed to retrieve Google profile. Try again.", "error");
          }
        }
      }
    });
    console.log("[AuraVoice] Google OAuth Token Client initialized successfully.");
  } catch (err) {
    console.error("Failed to initialize Google OAuth Client:", err);
  }
}


// =========================================================================
// UTILITY: Close the mock email sidebar toast
// =========================================================================
function closeMockEmail() {
  var toastEl = document.getElementById('mockEmailToast');
  if (toastEl) toastEl.style.display = 'none';
}

// =========================================================================
// UTILITY: Non-blocking inline status toast (replaces browser alert)
// =========================================================================
function showInlineAlert(message, type) {
  type = type || 'info';
  var toastContainer = document.getElementById('_inlineAlertContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = '_inlineAlertContainer';
    toastContainer.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:99999;display:flex;flex-direction:column;gap:8px;align-items:center;pointer-events:none;';
    document.body.appendChild(toastContainer);
  }
  var colors = { success: '#14b8a6', error: '#ef4444', info: '#38bdf8' };
  var icons  = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
  var col = colors[type] || colors.info;
  var icn = icons[type]  || icons.info;
  var toast = document.createElement('div');
  toast.style.cssText = 'background:rgba(15,15,30,0.97);border:1px solid ' + col + ';color:#e2e8f0;padding:10px 20px;border-radius:8px;font-size:0.83rem;display:flex;align-items:center;gap:10px;box-shadow:0 8px 32px rgba(0,0,0,0.5);pointer-events:auto;';
  toast.innerHTML = '<i class=\"fa-solid ' + icn + '\" style=\"color:' + col + '\"></i>' + message;
  toastContainer.appendChild(toast);
  setTimeout(function() { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.4s'; setTimeout(function(){ toast.remove(); }, 400); }, 3500);
}
