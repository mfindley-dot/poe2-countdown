/**
 * PATH OF EXILE 2 INTERACTIVE COUNTDOWN APP
 * Core Frontend JavaScript Logic
 */

// ==========================================================================
// 1. MILESTONE CONFIGURATION & ROLLOVER SYSTEM
// ==========================================================================

const MILESTONES = [
  {
    id: "patch-050",
    name: 'Patch 0.5.0 "Return of the Ancients"',
    // May 29, 2026, 1:00 PM PDT / 8:00 PM UTC
    targetDate: new Date("2026-05-29T20:00:00Z"),
    description: "The Final Major Early Access Update before the full 1.0 Release! Complete endgame rework and campaign finalization."
  },
  {
    id: "league-1",
    name: 'PoE 2 League 1 "Wrath of the Karui"',
    // September 18, 2026, 1:00 PM PDT / 8:00 PM UTC (Scuttlebutt Date)
    targetDate: new Date("2026-09-18T20:00:00Z"),
    description: "Unofficial League 1 launch window. Brace your builds and loot filters for the first official league cycle in PoE 2!"
  },
  {
    id: "release-10",
    name: 'Path of Exile 2 Full 1.0 Release',
    // December 11, 2026, 1:00 PM PDT / 8:00 PM UTC (Target Year End Release)
    targetDate: new Date("2026-12-11T20:00:00Z"),
    description: "The grand official launch of Path of Exile 2! The golden gates of Wraeclast swing wide open forever."
  }
];

// Funny state messages depending on time remaining
const STATUS_MESSAGES = [
  "Chris Wilson is personally balancing the drop rates...",
  "Synthesizing maximum loot filter dopamine...",
  "Cyclone AOE is shrinking in real-time...",
  "Applying 47 layers of defense to our servers...",
  "Consulting the economy experts in the trade channel...",
  "Still sane, exiles?",
  "Calculating build pathing to survive the campaign...",
  "The Mirror of Kalandra awaits... theoretically.",
  "Preparing coffee pots for 72-hour league launch streams..."
];

let activeMilestoneId = "";
let countdownInterval = null;

// Core Dopamine clicker currencies list and active cycle index
const dopamineCurrencies = [
  "divine", "scroll", "transmute", "augmentation", "alchemy", 
  "regal", "chaos", "vaal", "annulment", "exalted", "mirror"
];
let currentDopamineCurrencyIndex = 0;

// Determine target date and auto-rollover
function initializeMilestone() {
  const now = new Date();
  
  // Find the first milestone that is in the future
  let nextFutureMilestone = MILESTONES.find(m => m.targetDate > now);
  
  // If all are in the past, fallback to the last one
  if (!nextFutureMilestone) {
    nextFutureMilestone = MILESTONES[MILESTONES.length - 1];
  }
  
  activeMilestoneId = nextFutureMilestone.id;
  
  // Set select element
  const selector = document.getElementById("milestoneSelect");
  if (selector) {
    selector.value = activeMilestoneId;
  }
  
  updateMilestoneInfo();
}

function updateMilestoneInfo() {
  const select = document.getElementById("milestoneSelect");
  const targetId = select.value;
  const milestone = MILESTONES.find(m => m.id === targetId);
  
  if (milestone) {
    document.getElementById("milestoneName").textContent = milestone.name;
    
    // Clear and restart timer
    if (countdownInterval) clearInterval(countdownInterval);
    runCountdown(milestone.targetDate);
    
    // Periodically change the funny status message
    updateStatusMessage();
  }
}

function runCountdown(targetDate) {
  const nowTime = new Date().getTime();
  const targetTime = targetDate.getTime();
  
  updateClock(targetTime - nowTime);
  
  countdownInterval = setInterval(() => {
    const current = new Date().getTime();
    const diff = targetTime - current;
    
    if (diff <= 0) {
      clearInterval(countdownInterval);
      handleMilestonePassed();
    } else {
      updateClock(diff);
    }
  }, 1000);
}

function updateClock(diff) {
  // Calculations
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diff % (1000 * 60)) / 1000);
  
  // Pad zeros
  const pad = (num) => String(num).padStart(2, '0');
  
  // Update Displays
  document.getElementById("daysValue").textContent = pad(days);
  document.getElementById("minsValue").textContent = pad(minutes);
  
  document.getElementById("displayDays").textContent = `${days}d`;
  document.getElementById("displayHours").textContent = `${pad(hours)}h`;
  document.getElementById("displayMinutes").textContent = `${pad(minutes)}m`;
  document.getElementById("displaySeconds").textContent = `${pad(seconds)}s`;
  
  document.getElementById("hoursSubtext").textContent = `${hours} Hours Left`;
  document.getElementById("secsSubtext").textContent = `${seconds} Seconds Left`;
  
  // Dynamically slosh Life and Mana fluid based on percentage of completion
  // For aesthetics: Life globe ticks with Days/Hours, Mana globe ticks with Mins/Secs
  // Let's map 0-100 days to life globe (0% to 90% fluid height)
  // And 0-60 minutes to mana globe (0% to 90% fluid height)
  
  const lifePercentage = Math.min(95, Math.max(5, (days / 100) * 90 + 5));
  const manaPercentage = Math.min(95, Math.max(5, (minutes / 60) * 90 + 5));
  
  updateFluidGlobe("lifeGlobe", lifePercentage);
  updateFluidGlobe("manaGlobe", manaPercentage);
}

function updateFluidGlobe(globeId, percentage) {
  const globe = document.getElementById(globeId);
  if (!globe) return;
  
  // The waves are animated using rotate/translate in CSS.
  // Translating -100% is full, 0% is empty (due to geometry, translate values must be calibrated)
  // Let's set standard variable level
  // 100% liquid is translateY(-75%), 0% liquid is translateY(10%)
  const yValue = 10 - (percentage * 0.85); // maps 0-100 to 10 to -75
  
  const mainWave = globe.querySelector(".fluid-wave:not(.wave-back)");
  const backWave = globe.querySelector(".fluid-wave.wave-back");
  
  if (mainWave) mainWave.style.setProperty("--wave-level", `${yValue}%`);
  if (backWave) backWave.style.setProperty("--wave-level-back", `${yValue - 2}%`);
}

function handleMilestonePassed() {
  document.getElementById("daysValue").textContent = "00";
  document.getElementById("minsValue").textContent = "00";
  document.getElementById("displayDays").textContent = "00d";
  document.getElementById("displayHours").textContent = "00h";
  document.getElementById("displayMinutes").textContent = "00m";
  document.getElementById("displaySeconds").textContent = "00s";
  
  document.getElementById("timeStatusMessage").textContent = "🛡️ THE GATES OF WRAECLAST HAVE OPENED! HYPE DISCHARGED! 🛡️";
  
  // Trigger massive currency explosion!
  playMirrorSound();
  triggerMirrorExplosion();
  
  // Auto rollover: Wait 15 seconds, then check if there is a next milestone to auto-transition to
  setTimeout(() => {
    initializeMilestone();
  }, 15000);
}

function updateStatusMessage() {
  const index = Math.floor(Math.random() * STATUS_MESSAGES.length);
  document.getElementById("timeStatusMessage").textContent = STATUS_MESSAGES[index].toUpperCase();
}

// Rotate status messages every 15 seconds
setInterval(updateStatusMessage, 15000);


// ==========================================================================
// 2. HIGH-FIDELITY WEB AUDIO SYNTHESIZER & LOCAL SOUND FALLBACK SYSTEM
// ==========================================================================

let audioCtx = null;

function initAudio() {
  if (audioCtx) return;
  // Initialize standard web audio context safely
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  const banner = document.getElementById("audioBanner");
  if (banner) banner.classList.add("hidden");
}

// Robust local audio file loader with bulletproof synthesiser fallback
function playSoundWithFallback(filename, synthesizerFn) {
  initAudio();
  
  const localPath = `sounds/filterblade/${filename}`;
  const audio = new Audio(localPath);
  audio.volume = 0.65;
  
  let fallbackTriggered = false;
  
  const triggerFallback = () => {
    if (fallbackTriggered) return;
    fallbackTriggered = true;
    synthesizerFn();
  };
  
  // Triggers if file is missing (404) or failed to load
  audio.onerror = () => {
    triggerFallback();
  };
  
  audio.play()
    .then(() => {
      // Audio is playing successfully!
    })
    .catch((err) => {
      // Autoplay blocked, or file 404, fall back to synthesiser
      triggerFallback();
    });
}

// Synthesize: Divine Orb sound (Hollow metallic clang / cymbal crash)
function playDivineSound() {
  playSoundWithFallback("AlertSound1.mp3", () => {
    if (!audioCtx) return;
    
    const now = audioCtx.currentTime;
    
    const osc = audioCtx.createOscillator();
    const subOsc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = "triangle";
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(450, now + 0.1); // pitch bend up
    
    subOsc.type = "sawtooth";
    subOsc.frequency.setValueAtTime(160, now);
    
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.28, now + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(380, now);
    filter.frequency.exponentialRampToValueAtTime(500, now + 0.5);
    filter.Q.value = 3;
    
    osc.connect(filter);
    subOsc.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start(now);
    subOsc.start(now);
    osc.stop(now + 1.0);
    subOsc.stop(now + 1.0);
  });
}

// Synthesize: Exalted Orb sound (Clean glass bell + metallic echo)
function playExaltedSound() {
  playSoundWithFallback("AlertSound16.mp3", () => {
    if (!audioCtx) return;
    
    const now = audioCtx.currentTime;
    
    // 1. High chime bell tone
    const osc1 = audioCtx.createOscillator();
    const osc2 = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(1150, now);
    osc1.frequency.exponentialRampToValueAtTime(800, now + 1.2);
    
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(1730, now); // Metallic disharmony
    
    gainNode.gain.setValueAtTime(0.001, now);
    gainNode.gain.linearRampToValueAtTime(0.25, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
    
    // Filter for metallic ring
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1200;
    filter.Q.value = 4.0;
    
    // Connections
    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 1.6);
    osc2.stop(now + 1.6);
    
    // 2. Add high transient strike (click)
    const transientOsc = audioCtx.createOscillator();
    const transientGain = audioCtx.createGain();
    transientOsc.type = "triangle";
    transientOsc.frequency.setValueAtTime(2500, now);
    transientOsc.frequency.exponentialRampToValueAtTime(150, now + 0.05);
    
    transientGain.gain.setValueAtTime(0.18, now);
    transientGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    
    transientOsc.connect(transientGain);
    transientGain.connect(audioCtx.destination);
    transientOsc.start(now);
    transientOsc.stop(now + 0.1);
  });
}

// Synthesize: Chaos Orb sound (Dull chaotic impact + rustle)
function playChaosSound() {
  playSoundWithFallback("AlertSound2.mp3", () => {
    if (!audioCtx) return;
    
    const now = audioCtx.currentTime;
    
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(50, now + 0.3);
    
    gainNode.gain.setValueAtTime(0.35, now);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.35);
    
    // Noise transient (rustle)
    const bufferSize = audioCtx.sampleRate * 0.15;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    
    const noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.value = 800;
    
    const noiseGain = audioCtx.createGain();
    noiseGain.gain.setValueAtTime(0.18, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    
    osc.start(now);
    noise.start(now);
    osc.stop(now + 0.4);
    noise.stop(now + 0.4);
  });
}

// Synthesize: Mirror of Kalandra sound (Ultra-premium epic bell chord chime!)
function playMirrorSound() {
  playSoundWithFallback("AlertSound16.mp3", () => {
    if (!audioCtx) return;
    
    const now = audioCtx.currentTime;
    const frequencies = [261.63, 329.63, 392.00, 523.25, 783.99, 1046.50]; // Beautiful C Major chime chord
    
    frequencies.forEach((freq, index) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      // alternate chime shapes for harmonic riches
      osc.type = index % 2 === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(freq, now + (index * 0.04)); // Arpeggiated strike
      
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.2, now + (index * 0.04) + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);
      
      // Add pulsing tremolo to the main chime chord
      const tremolo = audioCtx.createGain();
      const lfo = audioCtx.createOscillator();
      lfo.frequency.value = 6; // 6Hz hum
      const lfoGain = audioCtx.createGain();
      lfoGain.gain.value = 0.4;
      
      lfo.connect(lfoGain);
      lfoGain.connect(tremolo.gain);
      
      osc.connect(gainNode);
      gainNode.connect(tremolo);
      tremolo.connect(audioCtx.destination);
      
      lfo.start(now);
      osc.start(now);
      lfo.stop(now + 3.2);
      osc.stop(now + 3.2);
    });
  });
}

// Synthesize: Hype Guild RIP (Sad gothic minor synth roll)
function playRipSound() {
  playSoundWithFallback("AlertSoundDouble.mp3", () => {
    if (!audioCtx) return;
    
    const now = audioCtx.currentTime;
    // A Minor chord notes arpeggiated downwards
    const notes = [440.00, 349.23, 293.66, 220.00]; // A4 -> F4 -> D4 -> A3
    
    notes.forEach((freq, index) => {
      const osc = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now + (index * 0.15));
      
      gainNode.gain.setValueAtTime(0.001, now);
      gainNode.gain.linearRampToValueAtTime(0.15, now + (index * 0.15) + 0.02);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      
      const filter = audioCtx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(400, now);
      
      osc.connect(filter);
      filter.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      osc.start(now);
      osc.stop(now + 1.5);
    });
  });
}

// Voice synthesis: "Still Sane, Exile?" using browser Speech Synthesis API with custom deep pitch filters
function speakStillSane() {
  initAudio();
  
  if ('speechSynthesis' in window) {
    // Stop any ongoing speech
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance("Still Sane, Exile?");
    
    // Attempt to make it sound like Zana or a creepy entity
    utterance.pitch = 0.5; // low pitch
    utterance.rate = 0.85;  // slightly slower
    utterance.volume = 1.0;
    
    // Choose a British English voice if available for high fantasy feel
    const voices = window.speechSynthesis.getVoices();
    const ukVoice = voices.find(voice => voice.lang.includes('GB') || voice.lang.includes('EN-GB'));
    if (ukVoice) {
      utterance.voice = ukVoice;
    }
    
    window.speechSynthesis.speak(utterance);
    
    // Play a background dark chime
    if (audioCtx) {
      const now = audioCtx.currentTime;
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(100, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.8);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(now);
      osc.stop(now + 1.1);
    }
  } else {
    // Fallback simple sound if Speech Synthesis doesn't work
    playRipSound();
  }
}


// ==========================================================================
// 3. CANVAS PHYSICS PARTICLE ENGINE (CURRENCY RAIN)
// ==========================================================================

const canvas = document.getElementById("particleCanvas");
const ctx = canvas.getContext("2d");

let particles = [];

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

const CURRENCY_TYPES = [
  { char: "🪙", color: "#ffd700", shadow: "rgba(255,215,0,0.5)" }, // Divine
  { char: "👑", color: "#e5c158", shadow: "rgba(229,193,88,0.5)" }, // Exalted
  { char: "🌀", color: "#a55eea", shadow: "rgba(165,94,234,0.5)" }, // Chaos
  { char: "🪞", color: "#ffffff", shadow: "rgba(255,255,255,0.7)" }, // Mirror
  { char: "📜", color: "#f7b731", shadow: "rgba(247,183,49,0.3)" }  // Scroll
];

class Particle {
  constructor(x, y, isExplosion = false) {
    this.x = x;
    this.y = y;
    
    // Random currency selection
    const type = CURRENCY_TYPES[Math.floor(Math.random() * CURRENCY_TYPES.length)];
    this.char = type.char;
    this.color = type.color;
    this.shadow = type.shadow;
    
    // Sizing
    this.size = Math.random() * 15 + 16; // 16px to 31px
    
    // Physics
    const angle = Math.random() * Math.PI * 2;
    const speed = isExplosion ? (Math.random() * 12 + 6) : (Math.random() * 6 + 2);
    
    this.vx = Math.cos(angle) * speed;
    this.vy = isExplosion ? (Math.sin(angle) * speed - 6) : (Math.sin(angle) * speed - 3); // initial upward boost
    
    this.gravity = 0.28;
    this.bounce = 0.65;
    this.friction = 0.98;
    
    this.rotation = Math.random() * Math.PI * 2;
    this.vRotation = (Math.random() * 0.15 - 0.075);
    
    this.alpha = 1;
    this.decay = Math.random() * 0.015 + 0.008;
  }
  
  update() {
    this.vy += this.gravity;
    this.vx *= this.friction;
    this.x += this.vx;
    this.y += this.vy;
    
    this.rotation += this.vRotation;
    
    // Bounce off bottom floor
    if (this.y + this.size/2 >= canvas.height) {
      this.y = canvas.height - this.size/2;
      this.vy = -this.vy * this.bounce;
      this.vx *= 0.8; // Slide friction
    }
    
    // Bounce off side walls
    if (this.x - this.size/2 <= 0) {
      this.x = this.size/2;
      this.vx = -this.vx * this.bounce;
    } else if (this.x + this.size/2 >= canvas.width) {
      this.x = canvas.width - this.size/2;
      this.vx = -this.vx * this.bounce;
    }
    
    this.alpha -= this.decay;
  }
  
  draw() {
    ctx.save();
    ctx.globalAlpha = this.alpha;
    ctx.translate(this.x, this.y);
    ctx.rotate(this.rotation);
    
    ctx.font = `${this.size}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    
    // Glow effect
    ctx.shadowColor = this.shadow;
    ctx.shadowBlur = 10;
    
    ctx.fillText(this.char, 0, 0);
    ctx.restore();
  }
}

function triggerClickExplosion(e) {
  // Determine spawn coordinates (fallback to screen center if triggered via keypress)
  const x = e ? e.clientX : canvas.width / 2;
  const y = e ? e.clientY : canvas.height / 2;
  
  const count = 12 + Math.floor(Math.random() * 8);
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, false));
  }
}

function triggerMirrorExplosion() {
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  
  const count = 120;
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(centerX, centerY, true));
  }
}

function animateParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  particles = particles.filter(p => p.alpha > 0);
  
  particles.forEach(p => {
    p.update();
    p.draw();
  });
  
  requestAnimationFrame(animateParticles);
}
animateParticles();


// ==========================================================================
// 4. MOCK POE 2 PATCH NOTES GENERATOR
// ==========================================================================

const MOCK_PATCH_NOTES = [
  "Reduced Cyclone radius by another 15% to foster melee class humbleness and character-building suffering.",
  "Divine Orb drops now play a custom sound file of Chris Wilson chuckling gently.",
  "Added new 'Excel Spreadsheet Integration' support layer. PoE 2 can now be played entirely within a Microsoft Excel workbook.",
  "Streamer RIP statistics are now displayed as a giant burning monument in the main town square.",
  "The drop rate of Mirror of Kalandra has been increased from 0.00001% to 0.000011%. Enjoy the abundance, exiles.",
  "To maintain trade balance, item drops are now encrypted in ancient Sumerian cuneiform and require manual decryption before trade.",
  "Witch minions now occasionally Unionize, requesting higher health insurance, longer screen-time, and active hazard pay.",
  "Introduced a new league mechanic: 'Tax Audits'. Defeat the Inland Revenue monsters to retain your hard-earned Exalted Orbs.",
  "Quin69's characters now receive a passive -25% DPS debuff titled 'Coping Mechanism'.",
  "Reworked gold system: Stashing gold now generates fractional interest rates dependent on the current Federal Reserve index.",
  "Chaos Orbs now randomly change the language of your user interface to standard pirate slang.",
  "Wrangling with Path of Building is now officially a playable endgame map boss called 'The Builder of Paths'.",
  "Added new item: 'Scroll of Regretful Buying'. Instantly refunds any skin purchase that doesn't make you look like a god.",
  "Melee classes are now equipped with a standard in-game tissue box for continuous tear management.",
  "Fusing links now has a pity timer. At 4,000 Fusing Orbs, Chris Wilson will send you a sympathetic postcard.",
  "Ranger's dodge rate has been re-evaluated. If you fail a dodge, your computer screen will physically flicker to scold you.",
  "Characters who die in Hardcore mode are now automatically registered as organs donors in Wraeclast standard hospitals.",
  "Path of Exile 2 now requires a three-factor authentication process using a physical, glowing golden relic shipped to your home.",
  "Loot filter sound volumes now scale with item rarity. Mirror drops will physically blast your speakers and alert local law enforcement.",
  "Added a new Ascendancy class: 'The Trading Bot'. Specializes in sitting in the hideout doing absolutely nothing but making wealth.",
  "Due to climate change in Wraeclast, ice-based spells now cause sea levels in Act 1 to rise by 2.4 inches.",
  "Trade site CAPTCHAs now ask you to identify which spell paths require a PhD in mathematics to successfully operate."
];

function rollNewPatchNote() {
  const noteBox = document.getElementById("patchNotesBox");
  if (!noteBox) return;
  
  // Fade out
  noteBox.style.opacity = 0;
  
  setTimeout(() => {
    const randomIndex = Math.floor(Math.random() * MOCK_PATCH_NOTES.length);
    const selectedNote = MOCK_PATCH_NOTES[randomIndex];
    
    noteBox.innerHTML = `
      <div class="patch-note-card">
        <span class="patch-note-version">PATCH 0.5.0 HYPE PREDICTION:</span>
        <p class="patch-note-text">"${selectedNote}"</p>
      </div>
    `;
    
    // Fade in
    noteBox.style.opacity = 1;
  }, 250);
}


// ==========================================================================
// 5. SECURE DISCORD WEBHOOK INTEGRATION
// ==========================================================================

const WEBHOOK_STORAGE_KEY = "poe_guild_webhook_url";
const TOTAL_CLICKS_KEY = "poe_guild_dopamine_clicks";

let currentClicks = parseInt(localStorage.getItem(TOTAL_CLICKS_KEY) || "0", 10);

function initializeDopamineCount() {
  document.getElementById("clickCountDisplay").textContent = currentClicks;
}

function incrementClicks() {
  currentClicks++;
  localStorage.setItem(TOTAL_CLICKS_KEY, currentClicks);
  document.getElementById("clickCountDisplay").textContent = currentClicks;
}

// Discord Webhook Logic
function initWebhookFields() {
  const webhookInput = document.getElementById("webhookUrl");
  const storedUrl = localStorage.getItem(WEBHOOK_STORAGE_KEY);
  
  if (webhookInput && storedUrl) {
    webhookInput.value = storedUrl;
  }
}

async function sendDiscordWebhook() {
  const webhookInput = document.getElementById("webhookUrl");
  const statusMsg = document.getElementById("webhookStatusMessage");
  
  if (!webhookInput || !statusMsg) return;
  
  const webhookUrl = webhookInput.value.trim();
  
  if (!webhookUrl) {
    showWebhookStatus("⚠️ Please input a valid Discord Webhook URL first!", "error-text");
    return;
  }
  
  // Basic URL structure validation
  if (!webhookUrl.startsWith("https://discord.com/api/webhooks/") && !webhookUrl.startsWith("https://canary.discord.com/api/webhooks/")) {
    showWebhookStatus("❌ Invalid Webhook URL. It must begin with 'https://discord.com/api/webhooks/'", "error-text");
    return;
  }
  
  // Save to local storage for future convenience
  localStorage.setItem(WEBHOOK_STORAGE_KEY, webhookUrl);
  
  // Compile payload data
  const targetId = document.getElementById("milestoneSelect").value;
  const milestone = MILESTONES.find(m => m.id === targetId);
  const now = new Date();
  
  // Compute remaining time string
  const diff = milestone.targetDate - now;
  let remainingString = "";
  if (diff <= 0) {
    remainingString = "🎉 ALREADY LAUNCHED! Hype has peaked!";
  } else {
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    remainingString = `${days}d : ${String(hours).padStart(2,'0')}h : ${String(minutes).padStart(2,'0')}m : ${String(seconds).padStart(2,'0')}s`;
  }
  
  // Grab a random patch note for extra humor
  const randomNote = MOCK_PATCH_NOTES[Math.floor(Math.random() * MOCK_PATCH_NOTES.length)];
  
  // Setup Rich Embed Payload
  const payload = {
    embeds: [
      {
        title: `🔥 WRAECLAST HYPE BROADCASTER 🔥`,
        description: `Your guild mates have sent a patch countdown updates alert!`,
        url: window.location.href.includes("file://") ? "https://github.com/pages" : window.location.href,
        color: 13934391, // Gold color #d4af37
        fields: [
          {
            name: `🛡️ TARGET MILESTONE`,
            value: `**${milestone.name}**\n*${milestone.description}*`,
            inline: false
          },
          {
            name: `⏳ TIME REMAINING`,
            value: `\`\`\`css\n${remainingString}\n\`\`\``,
            inline: false
          },
          {
            name: `🪙 DIVINE CLICK COUNTER`,
            value: `Guild has clicked the Divine Orb \`${currentClicks}\` times!`,
            inline: true
          },
          {
            name: `📜 CURRENT COPING MECHANISM`,
            value: `*"${randomNote}"*`,
            inline: false
          }
        ],
        footer: {
          text: `PoE 2 Hype Meter • Made by Exiles, for Exiles`,
          icon_url: `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=64&auto=format&fit=crop`
        },
        timestamp: new Date().toISOString()
      }
    ]
  };
  
  showWebhookStatus("⚡ Sending broadcast to Discord...", "success-text");
  
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });
    
    if (response.ok) {
      showWebhookStatus("✅ Broadcast Successfully posted to Discord Guild Channel!", "success-text");
      // Trigger a clean sound effect
      playDivineSound();
      triggerClickExplosion();
    } else {
      const errorMsg = await response.text();
      showWebhookStatus(`❌ Discord Webhook Error: ${response.status} (${response.statusText})`, "error-text");
    }
  } catch (err) {
    showWebhookStatus(`❌ Network Failure: Unable to contact Discord. Check your connection!`, "error-text");
    console.error(err);
  }
}

function clearWebhook() {
  const webhookInput = document.getElementById("webhookUrl");
  if (webhookInput) {
    webhookInput.value = "";
  }
  localStorage.removeItem(WEBHOOK_STORAGE_KEY);
  showWebhookStatus("🗑️ Webhook URL has been cleared from local browser memory.", "success-text");
}

function showWebhookStatus(text, className) {
  const statusMsg = document.getElementById("webhookStatusMessage");
  if (!statusMsg) return;
  
  statusMsg.textContent = text;
  statusMsg.className = "status-msg " + className;
}


// ==========================================================================
// 6. EVENT BINDINGS & CONTROLLERS
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  
  // 1. Setup Active countdowns & Select changes
  initializeMilestone();
  document.getElementById("milestoneSelect").addEventListener("change", updateMilestoneInfo);
  
  // 2. Click Divine Orb Clicker Dopamine Injector
  const clickerBtn = document.getElementById("divineClickerButton");
  if (clickerBtn) {
    clickerBtn.addEventListener("click", (e) => {
      // Shakes the orb
      clickerBtn.classList.remove("shake-element");
      void clickerBtn.offsetWidth; // Trigger reflow to restart CSS animation
      clickerBtn.classList.add("shake-element");
      
      // Update counters
      incrementClicks();
      
      // Cycle currency image
      currentDopamineCurrencyIndex = (currentDopamineCurrencyIndex + 1) % dopamineCurrencies.length;
      const nextCurrency = dopamineCurrencies[currentDopamineCurrencyIndex];
      
      const orbImg = document.getElementById("dopamineOrbImg");
      if (orbImg) {
        let fileName = `item_${nextCurrency}.png`;
        if (nextCurrency === "alchemy") fileName = "orb_alchemy.png";
        else if (nextCurrency === "transmute") fileName = "item_transmutation.png";
        
        orbImg.src = `assets/images/currency/${fileName}`;
      }
      
      // Play appropriate synthesis drop sound for the current currency!
      if (nextCurrency === "mirror") {
        try { playMirrorSound(); } catch (err) { playDivineSound(); }
      } else if (nextCurrency === "divine") {
        playDivineSound();
      } else if (nextCurrency === "exalted" || nextCurrency === "annulment") {
        try { playExaltedSound(); } catch (err) { playDivineSound(); }
      } else if (nextCurrency === "chaos" || nextCurrency === "vaal" || nextCurrency === "regal") {
        try { playChaosSound(); } catch (err) { playDivineSound(); }
      } else {
        // scroll, transmute, augmentation, alchemy
        try { playRipSound(); } catch (err) { playDivineSound(); }
      }
      
      // Physics Currency Rain
      triggerClickExplosion(e);
      
      // Roll a mock patch note
      rollNewPatchNote();
    });
  }
  
  // 3. Soundboard Triggers
  const soundboardButtons = document.querySelectorAll(".sound-btn");
  soundboardButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
      const soundType = btn.getAttribute("data-sound");
      
      // Play Audio Context Synthesizer
      if (soundType === "mirror") playMirrorSound();
      else if (soundType === "divine") playDivineSound();
      else if (soundType === "exalted") playExaltedSound();
      else if (soundType === "chaos") playChaosSound();
      else if (soundType === "rip") playRipSound();
      else if (soundType === "sane") speakStillSane();
      
      // Spawn particles matching click coordinate or randomly inside buttons
      triggerClickExplosion(e);
      
      // Shake
      btn.style.transform = "scale(0.95)";
      setTimeout(() => btn.style.transform = "", 100);
    });
  });
  
  // 4. Next Patch Note Button
  const nextNoteBtn = document.getElementById("nextPatchNoteBtn");
  if (nextNoteBtn) {
    nextNoteBtn.addEventListener("click", rollNewPatchNote);
  }
  
  // 5. Drawer Triggers
  const toggleDiscordBtn = document.getElementById("toggleDiscordBtn");
  const discordDrawer = document.getElementById("discordDrawer");
  const closeDiscordBtn = document.getElementById("closeDiscordBtn");
  
  if (toggleDiscordBtn && discordDrawer && closeDiscordBtn) {
    toggleDiscordBtn.addEventListener("click", () => {
      discordDrawer.classList.toggle("hidden");
      // Scroll to drawer for smooth view on smaller screens
      if (!discordDrawer.classList.contains("hidden")) {
        discordDrawer.scrollIntoView({ behavior: 'smooth' });
      }
    });
    
    closeDiscordBtn.addEventListener("click", () => {
      discordDrawer.classList.add("hidden");
    });
  }
  
  // Webhook action bindings
  const webhookSendBtn = document.getElementById("btnSendTestWebhook");
  const webhookClearBtn = document.getElementById("btnClearWebhook");
  
  if (webhookSendBtn) {
    webhookSendBtn.addEventListener("click", sendDiscordWebhook);
  }
  if (webhookClearBtn) {
    webhookClearBtn.addEventListener("click", clearWebhook);
  }
  
  // Webhook Password Mask Toggle
  const toggleVisBtn = document.getElementById("btnToggleWebhookVisibility");
  const webhookInput = document.getElementById("webhookUrl");
  if (toggleVisBtn && webhookInput) {
    toggleVisBtn.addEventListener("click", () => {
      if (webhookInput.type === "password") {
        webhookInput.type = "text";
        toggleVisBtn.textContent = "🙈";
      } else {
        webhookInput.type = "password";
        toggleVisBtn.textContent = "👁️";
      }
    });
  }
  
  // Initialize counts and stored webhook inputs
  initializeDopamineCount();
  initWebhookFields();
  
  // 6. User Engagement Banner - Synchronize AudioContext on click
  const audioBanner = document.getElementById("audioBanner");
  if (audioBanner) {
    // Show banner initially if AudioContext is suspended or hasn't started
    audioBanner.classList.remove("hidden");
    
    const dismissAudioBanner = () => {
      initAudio();
      audioBanner.classList.add("hidden");
      document.removeEventListener("click", dismissAudioBanner);
      document.removeEventListener("keydown", dismissAudioBanner);
    };
    
    document.addEventListener("click", dismissAudioBanner);
    document.addEventListener("keydown", dismissAudioBanner);
  }

  // ==========================================================================
  // STACKING BLUR CHALLENGE & REFILLING MUG RENDERER (5-Row Spritesheet System)
  // ==========================================================================
  let blurStacks = 0;
  const MAX_BLUR_STACKS = 3;
  const BLUR_PIXELS_PER_STACK = 4.5;
  const STACK_DURATION = 5000; // 5 seconds
  
  // Mug Animation State
  let steinState = "FULL"; // "FULL", "DRINKING", "EMPTY", "REFILLING"
  let steinFrame = 0;
  let steinTick = 0;
  let lastClickTime = 0;
  
  // Load spritesheet asset
  const mugSpritesheet = new Image();
  mugSpritesheet.src = "assets/images/interactive/barcade-mug_spritesheet.png";
  
  function initSteinAleChallenge() {
    const btnStein = document.getElementById("btnSteinAle");
    const steinCanvas = document.getElementById("steinCanvas");
    if (!btnStein || !steinCanvas) return;
    
    const steinCtx = steinCanvas.getContext("2d");
    
    // Mouse Event: Click to drink beer and stack blur
    btnStein.addEventListener("click", () => {
      if (blurStacks < MAX_BLUR_STACKS) {
        blurStacks++;
        lastClickTime = Date.now();
        
        // Enter DRINKING animation sequence
        steinState = "DRINKING";
        steinFrame = 0;
        steinTick = 0;
        
        // Update styling
        btnStein.classList.add("drinking-active");
        updateSiteBlur();
        
        // Synthesize dynamic glug sound
        playSynthAleGlugChime();
        
        // Schedule decay after 5 seconds
        setTimeout(() => {
          if (blurStacks > 0) {
            blurStacks--;
            updateSiteBlur();
          }
        }, STACK_DURATION);
      }
    });
    
    // Start Mug Canvas draw tick (12 FPS animation frame rate)
    function animateMugCanvas() {
      steinCtx.clearRect(0, 0, steinCanvas.width, steinCanvas.height);
      
      const frameW = 64;
      const frameH = 57.2; // 286 / 5 rows
      
      let activeRow = 0; // Row 1: Full froth loop (index 0)
      let activeCol = 0;
      
      const now = Date.now();
      
      if (steinState === "FULL") {
        activeRow = 0;
        steinTick++;
        if (steinTick >= 5) { // Slow loop rate for smooth foam
          steinTick = 0;
          steinFrame = (steinFrame + 1) % 8;
        }
        activeCol = steinFrame;
      } 
      else if (steinState === "DRINKING") {
        activeRow = 1; // Row 2: Drinking/draining (index 1)
        steinTick++;
        if (steinTick >= 3) { // Rapid draining frames
          steinTick = 0;
          steinFrame++;
          if (steinFrame >= 8) {
            // Drink completed! Go empty/refilling immediately
            steinFrame = 0;
            steinState = "REFILLING";
          }
        }
        activeCol = Math.min(7, steinFrame);
      } 
      else if (steinState === "EMPTY") {
        activeRow = 2; // Row 3: Empty dry glass (index 2)
        activeCol = 7;
      } 
      else if (steinState === "REFILLING") {
        activeRow = 3; // Row 4: Refilling pouring frames (index 3)
        const elapsed = now - lastClickTime;
        const ratio = Math.min(1.0, elapsed / STACK_DURATION);
        
        // Map 0.0-1.0 filling progress to 0-7 frame indices
        activeCol = Math.min(7, Math.floor(ratio * 8));
        
        if (ratio >= 1.0) {
          // Glass is fully refilled and overflowing with froth!
          steinState = "FULL";
          steinFrame = 0;
          steinTick = 0;
        }
      }
      
      const srcX = activeCol * frameW;
      const srcY = activeRow * frameH;
      
      // Draw slice accurately
      if (mugSpritesheet.complete && mugSpritesheet.naturalWidth > 0) {
        steinCtx.imageSmoothingEnabled = false;
        steinCtx.drawImage(
          mugSpritesheet,
          srcX, srcY,
          frameW, frameH,
          0, 0,
          steinCanvas.width, steinCanvas.height
        );
      } else {
        // Fallback: draw text emoji inside canvas until loaded
        steinCtx.fillStyle = "#fbbf24";
        steinCtx.font = "24px Arial";
        steinCtx.textAlign = "center";
        steinCtx.textBaseline = "middle";
        steinCtx.fillText(steinState === "FULL" ? "🍺" : "🍻", steinCanvas.width / 2, steinCanvas.height / 2);
      }
      
      requestAnimationFrame(animateMugCanvas);
    }
    
    // Start loops
    requestAnimationFrame(animateMugCanvas);
  }
  
  function updateSiteBlur() {
    const appContainer = document.querySelector(".app-container");
    if (!appContainer) return;
    
    const blurVal = blurStacks * BLUR_PIXELS_PER_STACK;
    appContainer.style.setProperty("--site-blur", `${blurVal}px`);
    
    const btnStein = document.getElementById("btnSteinAle");
    if (btnStein) {
      if (blurStacks > 0) {
        btnStein.classList.add("drinking-active");
        btnStein.querySelector(".stein-text-content").textContent = `ALE DRUNK: ${blurStacks}x STACKS!`;
        btnStein.querySelector(".stein-subtext").innerHTML = `<span style="color: #ef4444 !important; font-weight: bold;">Blurring active! Refill in progress...</span>`;
      } else {
        btnStein.classList.remove("drinking-active");
        btnStein.querySelector(".stein-text-content").textContent = "DRINK GUILD ALE";
        btnStein.querySelector(".stein-subtext").innerHTML = `(Click to add Blur Challenge! Stacks up to 3x)`;
      }
    }
  }
  
  function playSynthAleGlugChime() {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContextClass();
      const now = ctx.currentTime;
      
      // 1. Dynamic pop bubble-glug sound!
      for (let i = 0; i < 4; i++) {
        const bubbleTime = now + i * 0.12;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = "sine";
        osc.frequency.setValueAtTime(150 + i * 40, bubbleTime);
        osc.frequency.exponentialRampToValueAtTime(450 + i * 80, bubbleTime + 0.08);
        
        gain.gain.setValueAtTime(0.08, bubbleTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, bubbleTime + 0.09);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(bubbleTime);
        osc.stop(bubbleTime + 0.1);
      }
      
      // 2. High-pitched clinking glass bell ding!
      const clinkTime = now + 0.48;
      const oscClink = ctx.createOscillator();
      const gainClink = ctx.createGain();
      oscClink.type = "triangle";
      oscClink.frequency.setValueAtTime(1600, clinkTime);
      oscClink.frequency.exponentialRampToValueAtTime(800, clinkTime + 0.15);
      
      gainClink.gain.setValueAtTime(0.12, clinkTime);
      gainClink.gain.exponentialRampToValueAtTime(0.0001, clinkTime + 0.2);
      
      oscClink.connect(gainClink);
      gainClink.connect(ctx.destination);
      oscClink.start(clinkTime);
      oscClink.stop(clinkTime + 0.25);
    } catch (e) {
      console.warn("Ale synth audio fail:", e);
    }
  }

  // Trigger init on DOM load
  initSteinAleChallenge();
});
