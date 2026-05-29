/**
 * GLG GUILD HALL ARCADE - GAME ENGINE
 * Auto-Shooter Action Game (PoE2 Style)
 */

(() => {
// ==========================================================================
// 1. GAME SETUP, CONSTANTS & STASH TAB CONFIG
// ==========================================================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false; // Retro pixel feel

// Live serverless dreamlo.com leaderboard keys (Pre-allocated for GLG Guild!)
const DREAMLO_PUBLIC_KEY = "6654ef248f40bb8e945c7ba9";
const DREAMLO_PRIVATE_KEY = "uK1WlH9CPE-XjFskW0R4Agz7r510_lMEC6t3fXGZwt_A";

// Game State Enum
const GameState = {
  SELECT: "select",
  PLAY: "play",
  LEVEL_UP: "levelup",
  GAMEOVER: "gameover"
};

let levelUpChoices = [];
let mousePos = { x: 0, y: 0 };
let lastPickupSoundTime = 0;
const PICKUP_SOUND_COOLDOWN = 150;

// Dynamic Game Music Soundtracks (Google Flow Music generated)
const bgMusic = new Audio("music/the-grind-begins.mp3");
const bossMusic = new Audio("music/monkey-boss-smash.mp3");
const bankerMusic = new Audio("music/banker-stash-dash.mp3");
const tavernMusic = new Audio("music/GLG_tavern_theme.mp3");

bgMusic.loop = true;
bossMusic.loop = true;
bankerMusic.loop = true;
tavernMusic.loop = true;

// Music Mute and Crossfading States
let musicMuted = false;
const maxVolumes = {
  tavern: 0.35,
  bg: 0.28,
  boss: 0.32,
  banker: 0.35
};
const currentVolumes = {
  tavern: 0.0,
  bg: 0.0,
  boss: 0.0,
  banker: 0.0
};

// Track live currency deducted from reserves during active Banker chase
let bankerDeductedChaosThisRun = 0;

let currentGameState = GameState.SELECT;
let gameMuted = false;
let gameScoreSubmitted = false;
let gamePaused = false;
let joystickActive = false;
let joystickMoveX = 0;
let joystickMoveY = 0;
let prevGamepadButtons = {};

// Global settings for UI HUD & damage hit flash
let showItemLabels = true;
let damageFlashIntensity = 0;

function toggleItemLabels() {
  showItemLabels = !showItemLabels;
  const labelsBtn = document.getElementById("btnToggleLabels");
  if (labelsBtn) {
    if (showItemLabels) {
      labelsBtn.textContent = "SHOW ITEMS: ON (V)";
      labelsBtn.classList.remove("muted");
    } else {
      labelsBtn.textContent = "SHOW ITEMS: OFF (V)";
      labelsBtn.classList.add("muted");
    }
  }
}

let lastHitShakeTime = 0;
function triggerPlayerHitEffect() {
  player.lastDamageTime = Date.now(); // Record hit timestamp globally to safely interrupt regen!
  
  // Throttle screen shakes & flash overlays to prevent visual strobe effects during heavy horde hits
  const nowMs = Date.now();
  if (nowMs - lastHitShakeTime < 150) return;
  lastHitShakeTime = nowMs;
  
  damageFlashIntensity = 0.45; // Soft translucent full-screen red hit flash
  triggerCameraShake(14, 6);   // Softer rumble for comfortable long-term play
}

// Custom 16-Bit Graphics Preloader & Cache
const CurrencyImages = {};
const currencyListKeys = [
  "scroll", "transmute", "augmentation", "alchemy", "regal", 
  "chaos", "vaal", "annulment", "exalted", "divine", "mirror"
];

currencyListKeys.forEach(key => {
  const img = new Image();
  let fileName = `item_${key}.png`;
  if (key === "alchemy") fileName = "orb_alchemy.png";
  else if (key === "transmute") fileName = "item_transmutation.png";
  
  img.src = `assets/images/currency/${fileName}`;
  CurrencyImages[key] = img;
});

// Preload Chase Unique Items to render high-resolution icons in stock ticker marquee
const chaseItemsList = {
  mageblood: "assets/images/items/mageblood_icon.png",
  headhunter: "assets/images/items/headhunter_icon.png"
};

Object.keys(chaseItemsList).forEach(key => {
  const img = new Image();
  img.src = chaseItemsList[key];
  CurrencyImages[key] = img;
});

// Preload Stash Frame visual texture background
const stashFrameImg = new Image();
stashFrameImg.src = "assets/images/currency/stash-tab_frame.png";

// Preload Player Character Sprites
const PlayerSprites = {
  ranger: new Image()
};
PlayerSprites.ranger.src = "assets/images/characters/ranger_spritesheet.png";

// Preload Enemy Character Sprites
const EnemySprites = {
  zombie: new Image(),
  ape: new Image(),
  banker: new Image(),
  spider: new Image(),
  ghost: new Image()
};
EnemySprites.zombie.src = "assets/images/enemies/zombie_spritesheet.png";
EnemySprites.ape.src = "assets/images/bosses/ape_boss_spritesheet.png";
EnemySprites.banker.src = "assets/images/characters/creg_banker_spritesheet.png";
EnemySprites.spider.src = "assets/images/enemies/spider_spritesheet.png";
EnemySprites.ghost.src = "assets/images/enemies/ghost_spritesheet.png";

// Reusable offscreen canvas for damage hit flashes (prevents whole-canvas destination compositing!)
const scratchCanvas = document.createElement("canvas");
const scratchCtx = scratchCanvas.getContext("2d");

function drawApeFlashRed(apeImg, srcX, srcY, frameW, frameH, drawX, drawY, drawW, drawH) {
  scratchCanvas.width = frameW;
  scratchCanvas.height = frameH;
  scratchCtx.clearRect(0, 0, frameW, frameH);
  
  // Draw the exact sprite frame onto the offscreen canvas
  scratchCtx.drawImage(apeImg, srcX, srcY, frameW, frameH, 0, 0, frameW, frameH);
  
  // Apply the source-atop composite fill locally
  scratchCtx.globalCompositeOperation = "source-atop";
  scratchCtx.fillStyle = "rgba(239, 68, 68, 0.55)";
  scratchCtx.fillRect(0, 0, frameW, frameH);
  
  // Draw the offscreen canvas onto the main game context
  ctx.drawImage(scratchCanvas, drawX, drawY, drawW, drawH);
}

// Preload Parallax Background (8-frame sequence) & Canopy Layer
const forestBgFrames = [];
for (let i = 1; i <= 8; i++) {
  const img = new Image();
  img.src = `assets/images/backgrounds/dark-forest/dark-forest_bg-${i}.png`;
  forestBgFrames.push(img);
}

const canopyImg = new Image();
canopyImg.src = "assets/images/backgrounds/dark-forest/dark-forest_canopy.png";

// Runtime offscreen scaling canvas to solve "Sprite Math Trap" of 57.2px height per frame
let processedApeImg = null;
function getProcessedApeImg() {
  if (processedApeImg) return processedApeImg;
  const rawImg = EnemySprites.ape;
  if (!rawImg.complete || rawImg.naturalWidth === 0) return null;
  
  const originalW = rawImg.naturalWidth;
  const originalH = rawImg.naturalHeight;
  
  // Find a height that is a multiple of 5 close to originalH
  // For 286px height, Math.round(286 / 5) * 5 = 285px (5 rows * 57px each)!
  const targetH = Math.round(originalH / 5) * 5;
  
  // Create offscreen canvas
  const canvas = document.createElement("canvas");
  canvas.width = originalW;
  canvas.height = targetH;
  const ctx = canvas.getContext("2d");
  
  // Disable image smoothing to preserve pixel art crispness
  ctx.imageSmoothingEnabled = false;
  ctx.mozImageSmoothingEnabled = false;
  ctx.webkitImageSmoothingEnabled = false;
  ctx.msImageSmoothingEnabled = false;
  
  // Scale raw image onto the integer-aligned canvas
  ctx.drawImage(rawImg, 0, 0, originalW, originalH, 0, 0, originalW, targetH);
  
  // Programmatically clean up semi-transparent white/gray halo edges to nix jaggies
  try {
    const imgData = ctx.getImageData(0, 0, originalW, targetH);
    const data = imgData.data;
    
    // First pass: clear very faint pixels
    for (let i = 0; i < data.length; i += 4) {
      if (data[i+3] < 60) {
        data[i+3] = 0;
      }
    }
    
    // Second pass: detect and eliminate white/grey border halo jaggies using 3x3 neighborhood edge check
    const tempAlpha = new Uint8Array(originalW * targetH);
    for (let i = 0; i < data.length; i += 4) {
      tempAlpha[i/4] = data[i+3];
    }
    
    for (let y = 1; y < targetH - 1; y++) {
      for (let x = 1; x < originalW - 1; x++) {
        const idx = (y * originalW + x) * 4;
        const r = data[idx];
        const g = data[idx+1];
        const b = data[idx+2];
        const a = data[idx+3];
        
        if (a > 0) {
          // If the pixel is white-ish or grey-ish
          if (r > 165 && g > 165 && b > 165) {
            // Check if it borders a transparent pixel (anti-aliasing artifact!)
            let bordersTransparency = false;
            for (let ny = -1; ny <= 1; ny++) {
              for (let nx = -1; nx <= 1; nx++) {
                const nIdx = ((y + ny) * originalW + (x + nx));
                if (tempAlpha[nIdx] < 30) {
                  bordersTransparency = true;
                  break;
                }
              }
              if (bordersTransparency) break;
            }
            
            // Clear the pixel completely if it borders transparency
            if (bordersTransparency) {
              data[idx+3] = 0;
            }
          }
        }
      }
    }
    
    ctx.putImageData(imgData, 0, 0);
  } catch (e) {
    console.warn("Could not clean up sprite halos programmatically:", e);
  }
  
  processedApeImg = canvas;
  return processedApeImg;
}

// Preload Terrain Tiles
const TerrainTiles = {
  grass1: new Image(),
  grass2: new Image(),
  grass3: new Image(),
  grass4: new Image(),
  dirt1: new Image(),
  dirt2: new Image()
};
TerrainTiles.grass1.src = "assets/images/terrain/grass/grass-tile_1.jpg";
TerrainTiles.grass2.src = "assets/images/terrain/grass/grass-tile_2.jpg";
TerrainTiles.grass3.src = "assets/images/terrain/grass/grass-tile_3.jpg";
TerrainTiles.grass4.src = "assets/images/terrain/grass/grass-tile_4.jpg";
TerrainTiles.dirt1.src = "assets/images/terrain/dirt/dirt-tile_1.jpg";
TerrainTiles.dirt2.src = "assets/images/terrain/dirt/dirt-tile_2.jpg";

// Procedural Forest Parallax Special Effects
let forestFogParticles = [];
let forestEyes = [];

// Background Dark Forest Animation Sequence State
let forestBgCurrentFrame = 0; // index 0 corresponds to dark-forest_bg-1.png
let forestAnimSequence = [];
let forestAnimSeqIndex = 0;
let forestAnimTick = 0;
let forestAnimDelay = 8; // ticks per frame
let forestNextTriggerTime = Date.now() + 4000 + Math.random() * 4000;

// Initialize procedural fog particles in the background
function initProceduralFog() {
  forestFogParticles = [];
  // Spawn 6 volumetric fog puffs
  for (let i = 0; i < 6; i++) {
    forestFogParticles.push({
      x: Math.random() * 1600,
      y: 50 + Math.random() * 220, // strictly within the woods zone
      vx: (0.1 + Math.random() * 0.2) * (Math.random() < 0.5 ? 1 : -1),
      vy: (0.02 + Math.random() * 0.04) * (Math.random() < 0.5 ? 1 : -1),
      radius: 90 + Math.random() * 70, // slightly larger for widescreen scaling
      opacity: 0.15 + Math.random() * 0.25,
      maxOpacity: 0.3 + Math.random() * 0.2,
      fadeDir: Math.random() < 0.5 ? 1 : -1
    });
  }
}

// Initialize random blinking red eye positions in dark forest corners
function initProceduralEyes() {
  forestEyes = [
    { x: 225, y: 180, state: "closed", timer: Math.random() * 200, opacity: 0, pulse: Math.random() * Math.PI },
    { x: 550, y: 135, state: "closed", timer: Math.random() * 200 + 100, opacity: 0, pulse: Math.random() * Math.PI },
    { x: 1125, y: 202, state: "closed", timer: Math.random() * 200 + 200, opacity: 0, pulse: Math.random() * Math.PI },
    { x: 1450, y: 157, state: "closed", timer: Math.random() * 200 + 300, opacity: 0, pulse: Math.random() * Math.PI },
    { x: 350, y: 292, state: "closed", timer: Math.random() * 200 + 150, opacity: 0, pulse: Math.random() * Math.PI },
    { x: 1250, y: 315, state: "closed", timer: Math.random() * 200 + 250, opacity: 0, pulse: Math.random() * Math.PI }
  ];
}

// Update procedural animations
function updateProceduralForestEffects() {
  // Update Fog Particles
  forestFogParticles.forEach(f => {
    f.x += f.vx;
    f.y += f.vy;
    
    // Bounce/wrap fog (scaled to 1600x900)
    if (f.x < -150) f.x = 1750;
    if (f.x > 1750) f.x = -150;
    if (f.y < 20 || f.y > 330) f.vy *= -1; // bounce within woods zone
    
    // Gentle opacity breath cycle
    f.opacity += f.fadeDir * 0.0005;
    if (f.opacity >= f.maxOpacity) {
      f.opacity = f.maxOpacity;
      f.fadeDir = -1;
    } else if (f.opacity <= 0.05) {
      f.opacity = 0.05;
      f.fadeDir = 1;
    }
  });
  
  // Update Glowing Eyes
  forestEyes.forEach(eye => {
    eye.timer--;
    
    if (eye.state === "closed") {
      eye.opacity = 0;
      if (eye.timer <= 0) {
        eye.state = "opening";
        eye.timer = 30 + Math.random() * 30; // opening speed
      }
    } 
    else if (eye.state === "opening") {
      eye.opacity = Math.min(1.0, eye.opacity + 0.05);
      if (eye.opacity >= 1.0) {
        eye.state = "open";
        eye.timer = 120 + Math.random() * 180; // duration open
      }
    } 
    else if (eye.state === "open") {
      eye.opacity = 1.0;
      eye.pulse += 0.05; // pulsation speed
      if (eye.timer <= 0) {
        eye.state = "closing";
        eye.timer = 30 + Math.random() * 30; // closing speed
      }
    } 
    else if (eye.state === "closing") {
      eye.opacity = Math.max(0.0, eye.opacity - 0.05);
      if (eye.opacity <= 0.0) {
        eye.state = "closed";
        eye.timer = 200 + Math.random() * 400; // time until next blink
      }
    }
  });

  // Spawn drifting forest ambient leaves (4% chance per frame if game is active)
  if (currentGameState === GameState.PLAY && Math.random() < 0.04) {
    particleEffects.push({
      x: 1650, // slightly off-screen right
      y: Math.random() * 900,
      vx: -1.2 - Math.random() * 1.8, // drift left
      vy: 0.4 + Math.random() * 1.0,  // drift down
      isAmbientLeaf: true,
      color: ["#166534", "#15803d", "#14532d", "#854d0e", "#a16207", "#ca8a04"][Math.floor(Math.random() * 6)], // greens and autumn tones
      radius: 3 + Math.random() * 4,
      angle: Math.random() * Math.PI * 2,
      va: (Math.random() - 0.5) * 0.03, // slow spin
      age: 0,
      maxAge: 600 // long max lifetime fallback
    });
  }

  // Tick the dark forest backgrounds sequence animator
  updateForestBgAnimation();
}

// Background Dark Forest sequence animator update function
function updateForestBgAnimation() {
  const now = Date.now();
  
  // If we are idle (showing base frame) and it's time to trigger a spooky event
  if (forestAnimSequence.length === 0 && now > forestNextTriggerTime) {
    // Choose one of three scary blink/mist surge sequences!
    const roll = Math.random();
    if (roll < 0.35) {
      // Slow fade open, hold, slow fade shut
      forestAnimSequence = [0, 1, 2, 3, 4, 5, 6, 7, 7, 7, 7, 6, 5, 4, 3, 2, 1, 0];
      forestAnimDelay = 8; // slow/atmospheric
    } else if (roll < 0.70) {
      // Panicked rapid double-blink
      forestAnimSequence = [0, 1, 2, 3, 2, 3, 4, 5, 6, 7, 7, 6, 7, 6, 5, 4, 2, 1, 0];
      forestAnimDelay = 4; // fast and sudden!
    } else {
      // Mist surge / eyes pulsing
      forestAnimSequence = [0, 1, 2, 3, 4, 5, 6, 7, 5, 6, 7, 5, 6, 7, 4, 3, 2, 1, 0];
      forestAnimDelay = 6;
    }
    
    forestAnimSeqIndex = 0;
    forestAnimTick = 0;
    forestBgCurrentFrame = forestAnimSequence[0];
  }
  
  // If actively playing a sequence
  if (forestAnimSequence.length > 0) {
    forestAnimTick++;
    if (forestAnimTick >= forestAnimDelay) {
      forestAnimTick = 0;
      forestAnimSeqIndex++;
      
      if (forestAnimSeqIndex >= forestAnimSequence.length) {
        // Sequence completed! Reset to base frame and schedule next trigger
        forestAnimSequence = [];
        forestAnimSeqIndex = 0;
        forestBgCurrentFrame = 0;
        // Schedule next blink in 6 to 18 seconds
        forestNextTriggerTime = Date.now() + 6000 + Math.random() * 12000;
      } else {
        forestBgCurrentFrame = forestAnimSequence[forestAnimSeqIndex];
      }
    }
  }
}

const terrainMap = [];
const mapCols = 20;
const mapRows = 12;

function generateTerrainMap() {
  for (let r = 0; r < mapRows; r++) {
    terrainMap[r] = [];
    for (let c = 0; c < mapCols; c++) {
      const roll = Math.random() * 100;
      let tileKey = "grass1";
      if (roll < 45) tileKey = "grass1";
      else if (roll < 70) tileKey = "grass2";
      else if (roll < 80) tileKey = "grass3";
      else if (roll < 88) tileKey = "grass4";
      else if (roll < 94) tileKey = "dirt1";
      else tileKey = "dirt2";
      
      terrainMap[r][c] = tileKey;
    }
  }
}

// Player Sprite Sheet animation state variables
let playerAnimFrame = 0;
let playerAnimTick = 0;
let lastPlayerDirectionRow = 0;

// Currency items configuration (Extended to 11 currencies)
const CURRENCY_CONFIG = {
  scroll: { name: "Scroll of Wisdom", char: "📜", worth: 0.1, color: "#e2e8f0", border: "#78716c", bg: "#1c1917" },
  transmute: { name: "Orb of Transmutation", char: "🔵", worth: 0.2, color: "#3b82f6", border: "#2563eb", bg: "#1e3a8a" },
  augmentation: { name: "Orb of Augmentation", char: "🔧", worth: 0.15, color: "#93c5fd", border: "#3b82f6", bg: "#172554" },
  alchemy: { name: "Orb of Alchemy", char: "🟡", worth: 0.5, color: "#eab308", border: "#ca8a04", bg: "#422006" },
  regal: { name: "Regal Orb", char: "👑", worth: 0.8, color: "#d97706", border: "#b45309", bg: "#451a03" },
  chaos: { name: "Chaos Orb", char: "🌀", worth: 1.0, color: "#ffd700", border: "#ffd700", bg: "#2a2100", sound: "AlertSound2.mp3" },
  vaal: { name: "Vaal Orb", char: "🔴", worth: 2.0, color: "#ef4444", border: "#dc2626", bg: "#450a0a" },
  annulment: { name: "Orb of Annulment", char: "🧿", worth: 5.0, color: "#a855f7", border: "#7e22ce", bg: "#3b0764" },
  exalted: { name: "Exalted Orb", char: "👑", worth: 15.0, color: "#f97316", border: "#ea580c", bg: "#431407", sound: "AlertSound1.mp3" },
  divine: { name: "Divine Orb", char: "🪙", worth: 150.0, color: "#fff", border: "#ffd700", bg: "#422006", sound: "AlertSound16.mp3" },
  mirror: { name: "Mirror of Kalandra", char: "🪞", worth: 40000.0, color: "#fff", border: "#dc2626", bg: "#450a0a", sound: "AlertSound16.mp3", special: true }
};

// Guild Stash Tab state (Active run)
let playerStash = {
  scroll: 0,
  transmute: 0,
  augmentation: 0,
  alchemy: 0,
  regal: 0,
  chaos: 0,
  vaal: 0,
  annulment: 0,
  exalted: 0,
  divine: 0,
  mirror: 0
};

// Player's Lifetime Inventory (Persistent local storage)
let lifetimeStash = {
  scroll: 0,
  transmute: 0,
  augmentation: 0,
  alchemy: 0,
  regal: 0,
  chaos: 0,
  vaal: 0,
  annulment: 0,
  exalted: 0,
  divine: 0,
  mirror: 0
};

// Active stash UI tab state
let activeStashView = "run"; // "run", "lifetime", "guild"
let globalOverallGuildChaos = 0; // Derived mathematically from online dreamlo entries

function loadLifetimeStash() {
  try {
    const data = localStorage.getItem("GLG_LIFETIME_STASH");
    if (data) {
      const parsed = JSON.parse(data);
      Object.keys(lifetimeStash).forEach(key => {
        if (typeof parsed[key] === "number") {
          lifetimeStash[key] = parsed[key];
        }
      });
    }
  } catch (err) {
    console.error("Failed to load lifetime stash:", err);
  }
}

function saveLifetimeStash() {
  try {
    localStorage.setItem("GLG_LIFETIME_STASH", JSON.stringify(lifetimeStash));
  } catch (err) {
    console.error("Failed to save lifetime stash:", err);
  }
}

function formatStashQty(qty) {
  if (qty >= 1000000) {
    return (qty / 1000000).toFixed(1) + "M";
  }
  if (qty >= 1000) {
    return (qty / 1000).toFixed(1) + "K";
  }
  return qty;
}

function updateActiveStashTabHighlight() {
  const btns = {
    run: document.getElementById("btnStashViewRun"),
    lifetime: document.getElementById("btnStashViewLifetime"),
    guild: document.getElementById("btnStashViewGuild")
  };
  
  Object.keys(btns).forEach(key => {
    const btn = btns[key];
    if (!btn) return;
    if (key === activeStashView) {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });
}

// ==========================================================================
// 2. PLAYER CLASSES & STATS
// ==========================================================================

let player = {
  x: 320,
  y: 200,
  vx: 0,
  vy: 0,
  speed: 3.1,
  radius: 30,
  class: "Ranger",
  hp: 100,
  maxHp: 100,
  level: 1,
  xp: 0,
  maxXp: 150,
  lastShotTime: 0,
  shotCooldown: 280, // ms
  damage: 8,
  lastDamageTime: 0,
  frozen: false,
  freezeTimer: 0,
  slowStacks: 0,
  slowTimer: 0,
  poisonRemaining: 0,
  
  // Dodge Roll properties (Spacebar dash)
  isRolling: false,
  rollTimer: 0,
  rollDuration: 14,
  rollVx: 0,
  rollVy: 0,
  lastRollTime: 0,
  rollCooldown: 1000, // 1.0 second cooldown
  rollSpeedMultiplier: 1.95,
  
  // Active Spreadshot ability (E Key)
  lastSpreadshotTime: 0,
  spreadshotCooldown: 1500 // 1.5 second cooldown
};

// Keyboard state
const keys = {
  w: false, a: false, s: false, d: false,
  ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false
};

// Witch & Ranger configurations
function setWitchClass() {
  player.class = "Witch";
  player.maxHp = 90;
  player.hp = 90;
  player.speed = 2.6;
  player.damage = 18; // Increased player base damage (up from 12)
  player.shotCooldown = 480;
  
  const btnWitch = document.getElementById("btnSelectWitch");
  const btnRanger = document.getElementById("btnSelectRanger");
  if (btnWitch) btnWitch.classList.add("active-class");
  if (btnRanger) btnRanger.classList.remove("active-class");
}

function setRangerClass() {
  player.class = "Ranger";
  player.maxHp = 100;
  player.hp = 100;
  player.speed = 3.1;
  player.damage = 14; // Increased player base damage (up from 8)
  player.shotCooldown = 280;
  
  const btnWitch = document.getElementById("btnSelectWitch");
  const btnRanger = document.getElementById("btnSelectRanger");
  if (btnRanger) btnRanger.classList.add("active-class");
  if (btnWitch) btnWitch.classList.remove("active-class");
}

// ==========================================================================
// 3. GAME RUNTIME ENTITIES
// ==========================================================================

let projectiles = [];
let enemyProjectiles = [];
let enemies = [];
let groundLoot = [];
let particleEffects = [];
let activeApeBoss = null;

let wave = 1;
let lastWaveSpawnTime = 0;
let baseEnemyCount = 4;
let enemyWorthMultiplier = 1.0;

class GameProjectile {
  constructor(x, y, vx, vy, color, damage, isSpark = false) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.radius = 4;
    this.color = color;
    this.damage = damage;
    this.isSpark = isSpark;
    this.sparkAge = 0;
    this.sparkChangeDirTime = 0;
    this.active = true;
    this.piercing = !isSpark; // Ranger arrows pierce once
    this.pierceCount = isSpark ? 0 : 2;
  }

  update() {
    if (this.isSpark) {
      this.sparkAge++;
      // Sparks bounce around chaoticly
      if (this.sparkAge > this.sparkChangeDirTime) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4.2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.sparkChangeDirTime = this.sparkAge + 15 + Math.floor(Math.random() * 20);
      }
      
      // Bounce off boundaries
      if (this.x <= 0 || this.x >= canvas.width) this.vx = -this.vx;
      if (this.y <= 0 || this.y >= canvas.height) this.vy = -this.vy;
    }
    
    this.x += this.vx;
    this.y += this.vy;
    
    // Boundary check
    if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
      if (!this.isSpark) this.active = false;
    }
    
    // Spark maximum age
    if (this.isSpark && this.sparkAge > 180) {
      this.active = false;
    }
    
    // Spawn gorgeous glowing projectile trail particles! (glowing cyan/blue tails matching the Pitch Frame)
    if (this.active && Math.random() < 0.45) {
      particleEffects.push({
        isProjectileTrail: true,
        x: this.x - this.vx * 0.3,
        y: this.y - this.vy * 0.3,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: Math.random() * 2.8 + 1.2,
        color: this.color,
        age: 0,
        maxAge: 12 + Math.floor(Math.random() * 12)
      });
    }
  }

  draw() {
    if (this.isSpark) {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 8;
      ctx.fill();
      ctx.shadowBlur = 0; // reset
    } else {
      const angle = Math.atan2(this.vy, this.vx);
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(angle);
      
      ctx.shadowColor = "#38bdf8";
      ctx.shadowBlur = 8;
      
      // Draw elongated glowing arrow shaft
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      ctx.lineTo(6, 0);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2.2;
      ctx.lineCap = "round";
      ctx.stroke();
      
      // Draw arrowhead
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(1, -4);
      ctx.moveTo(6, 0);
      ctx.lineTo(1, 4);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2.2;
      ctx.stroke();
      
      ctx.restore();
    }
  }
}

// Enemy Class
class Enemy {
  constructor(x, y, type) {
    this.x = x;
    this.y = y;
    this.type = type; // "spider", "ghost", "ape"
    
    this.vx = 0;
    this.vy = 0;
    this.active = true;
    
    // Sprite animation states
    this.animFrame = 0;
    this.animTick = 0;
    this.isDead = false;
    this.deathTimer = 0;
    
    // Stats base on types
    if (type === "spider") {
      this.radius = 55;
      this.hp = 5 + (wave * 1.5);
      this.maxHp = this.hp;
      this.speed = 1.3 + Math.random() * 0.4;
      this.color = "#4b5563"; // slate grey
      this.damage = 3; // reduced from 8 to make poison-dot tick survivable!
    } 
    else if (type === "ghost") {
      this.radius = 65;
      this.hp = 14 + (wave * 2.5);
      this.maxHp = this.hp;
      this.speed = 0.9;
      this.color = "#a5f3fc"; // glowing freeze cyan
      this.damage = 7; // reduced from 12
      this.lastFreezeBeamTime = 0;
      this.beamCharging = false;
      this.beamChargeTimer = 0;
      this.beamTargetAngle = 0;
    } 
    else if (type === "ape") {
      // The pillar of doom Boss!
      this.radius = 80; // Scaled to 80 to match 270px visual size
      this.hp = 1200 + (wave * 300); // Massive boss HP (up from 350+100) to create a long strategic encounter
      this.maxHp = this.hp;
      this.speed = 0.75;
      this.color = "#7c2d12"; // dark brick red ape
      this.damage = 20; // reduced from 30
      this.lastSlamTime = Date.now();
      this.slamCharging = false;
      this.slamTargetX = 0;
      this.slamTargetY = 0;
      this.slamChargeTimer = 0;
      this.rollTimer = 0;
      this.lastRollTime = 0;
      this.rollVx = 0;
      this.rollVy = 0;
      
      // Enrage state
      this.enraged = false;
      this.isEnrageCasting = false;
      this.enrageTimer = 0;
 
      // Cinematic intro and Combo State Machine
      this.introActive = true;
      this.introHPProgress = 0;
      this.comboState = "idle";
      this.comboTimer = 0;
      this.comboStep = 0;
      this.currentCombo = null;
      this.lastComboTime = Date.now() + 2000; // wait 2s after intro
    }
    else if (type === "banker") {
      // Creg the Guild Banker!
      this.radius = 65;
      this.hp = 200; // slightly lower HP so beating loot out of him is faster
      this.maxHp = this.hp;
      this.speed = player.speed * 1.05; // catchable speed (down from 1.25 + 0.4)
      this.color = "#fbbf24"; // Golden amber
      this.damage = 0; // Banker does not attack player
      this.bankerTimer = 1500; // 25 seconds stay (increased from 10 seconds!)
      this.bounceY = 0;
      this.isBoss = false;
    }
  }

  update() {
    if (this.isDead) {
      this.vx = 0;
      this.vy = 0;
      this.deathTimer--;
      if (this.deathTimer <= 0) {
        this.active = false;
      }
      return;
    }
    
    // Sprite animation tick
    this.animTick++;
    const animInterval = (this.isBoss || this.type === "ape") ? 4 : 6;
    if (this.animTick >= animInterval) {
      this.animTick = 0;
      this.animFrame = (this.animFrame + 1) % 8;
    }

    // Frozen player? They still move towards player
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist > 2) {
      this.vx = (dx / dist) * this.speed;
      this.vy = (dy / dist) * this.speed;
    } else {
      this.vx = 0;
      this.vy = 0;
    }

    if (this.type === "spider") {
      this.x += this.vx;
      this.y += this.vy;
      
      // Little comical hops occasionally while moving!
      const isMoving = (this.vx !== 0 || this.vy !== 0);
      if (isMoving && !this.isDead) {
        this.bounceY = Math.abs(Math.sin((this.animFrame + this.x * 0.05) * 0.9)) * 5;
      } else {
        this.bounceY = 0;
      }
    } 
    else if (this.type === "ghost") {
      const now = Date.now();
      
      if (this.beamCharging) {
        this.beamChargeTimer++;
        
        // Stops moving while charging
        this.vx = 0;
        this.vy = 0;
        
        if (this.beamChargeTimer > 45) { // 0.75 second charge
          this.beamCharging = false;
          this.beamChargeTimer = 0;
          this.lastFreezeBeamTime = now;
          
          // Fire Freezing Projectile!
          fireGhostProjectile(this.x, this.y, this.beamTargetAngle);
        }
      } 
      else if (now - this.lastFreezeBeamTime > 3500 && dist < 220) { // charges beam if close
        this.beamCharging = true;
        this.beamChargeTimer = 0;
        this.beamTargetAngle = Math.atan2(dy, dx);
      } 
      else {
        this.x += this.vx;
        this.y += this.vy;
      }
    } 
    else if (this.type === "ape") {
      const now = Date.now();
      
      // 0. Cinematic Intro check
      if (this.introActive) {
        // Fall down dramatically from sky!
        const targetY = 440;
        
        if (this.y < targetY) {
          // Rapid vertical drop (meteor style!)
          this.y += 18;
          
          // Calculate HP bar fill progress ratio dynamically based on falling distance from Y=-350 to Y=440
          this.introHPProgress = Math.min(1.0, Math.max(0.0, (this.y - (-350)) / (440 - (-350))));
          
          if (this.y >= targetY) {
            this.y = targetY;
            this.introHPProgress = 1.0;
            
            // Severe camera shake rumble on impact!
            triggerCameraShake(35, 20);
            
            // Translucent red damage flash vignette for visual impact
            damageFlashIntensity = 0.6;
            
            // Spawn 4 massive expanding shockwave rings around his feet shadow (purely visual, hasHitPlayer = true)
            for (let i = 0; i < 4; i++) {
              particleEffects.push({
                isSlamRing: true,
                x: this.x,
                y: this.y + 60, // Align with feet shadow
                radius: 130 + i * 30, // Visual maximum radius
                color: i % 2 === 0 ? "rgba(239, 68, 68, 0.45)" : "rgba(251, 191, 36, 0.45)",
                age: 0,
                maxAge: 35 + i * 5,
                hasHitPlayer: true // Purely visual, does not damage player on spawn landing
              });
            }
            
            // Spawn 16 stone-grey debris particles exploding in all directions
            for (let i = 0; i < 16; i++) {
              const angle = (i / 16) * Math.PI * 2;
              const spd = 4 + Math.random() * 8;
              particleEffects.push({
                x: this.x,
                y: this.y + 60,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd * 0.45, // Flatten for 2D perspective shadow depth
                radius: 3 + Math.random() * 5,
                color: "#78716c", // Stone dust grey
                age: 0,
                maxAge: 25 + Math.random() * 15
              });
            }
            
            if (!gameMuted) {
              try {
                playSynthRoarSound();
              } catch (e) {}
            }
            
            particleEffects.push({
              x: this.x,
              y: this.y - 100,
              text: "🔥 DESTRUCTION BEGINS! 🔥",
              color: "#fbbf24",
              age: 0,
              maxAge: 90
            });
            
            this.introActive = false;
            this.lastComboTime = now;
          }
        }
        return; // Skip standard AI updates while in intro!
      }
      
      // 1. Enrage state check (Invincible phase-change enrage transition when <= 1/3 HP)
      if (this.hp <= this.maxHp / 3 && !this.enraged && !this.isEnrageCasting) {
        this.isEnrageCasting = true;
        this.enrageTimer = 90; // 1.5 seconds invincibility/channeling!
        
        // Stop boss movement
        this.vx = 0;
        this.vy = 0;
        
        // Hype enraged text particle
        particleEffects.push({
          x: this.x,
          y: this.y - 45,
          text: "🚨 BOSS ENRAGING! SHIELD UP!",
          color: "#dc2626",
          age: 0,
          maxAge: 90
        });
        
        if (!gameMuted) {
          try {
            playSynthRoarSound();
          } catch (e) {
            console.log("Synth roar error:", e);
          }
        }
      }
      
      if (this.isEnrageCasting) {
        this.enrageTimer--;
        this.vx = 0;
        this.vy = 0;
        
        // Spawn rising enrage flames
        if (Math.random() < 0.35) {
          particleEffects.push({
            isProjectileTrail: true,
            x: this.x + (Math.random() * 60 - 30),
            y: this.y + 40,
            vx: 0,
            vy: -Math.random() * 2 - 1,
            radius: Math.random() * 4 + 2,
            color: "#ef4444",
            age: 0,
            maxAge: 25
          });
        }
        
        if (this.enrageTimer <= 0) {
          this.isEnrageCasting = false;
          this.enraged = true;
          this.speed = 0.75 * 1.35; // 35% faster in enraged phase!
          triggerCameraShake(20, 15);
          
          particleEffects.push({
            x: this.x,
            y: this.y - 45,
            text: "🔥 UNLEASHED ENRAGE!",
            color: "#ef4444",
            age: 0,
            maxAge: 60
          });
        }
        return; // Skip other behaviors while enrage is casting!
      }

      // 1.5 Combo Controller
      if (this.comboState === "active") {
        if (this.currentCombo === "doubleslam") {
          if (!this.slamCharging && !this.isRolling) {
            if (this.comboStep === 0) {
              this.slamCharging = true;
              this.slamChargeTimer = 0;
              this.slamTargetX = player.x;
              this.slamTargetY = player.y;
              this.comboStep = 1;
              particleEffects.push({
                x: this.x, y: this.y - 30,
                text: "⚠️ COMBO: DOUBLE SLAM (1/2)!",
                color: "#f59e0b", age: 0, maxAge: 50
              });
            } else if (this.comboStep === 1) {
              this.slamCharging = true;
              this.slamChargeTimer = 0;
              this.slamTargetX = player.x;
              this.slamTargetY = player.y;
              this.comboStep = 2;
              particleEffects.push({
                x: this.x, y: this.y - 30,
                text: "⚠️ COMBO: DOUBLE SLAM (2/2)!",
                color: "#ef4444", age: 0, maxAge: 50
              });
            } else {
              this.comboState = "idle";
              this.currentCombo = null;
              this.lastComboTime = now;
            }
          }
        }
        else if (this.currentCombo === "rollslam") {
          if (!this.isRolling && !this.slamCharging) {
            if (this.comboStep === 0) {
              this.isRolling = true;
              this.rollTimer = 45;
              this.lastRollTime = now;
              const rollSpeed = this.speed * 3.0;
              this.rollVx = (dx / dist) * rollSpeed;
              this.rollVy = (dy / dist) * rollSpeed;
              this.comboStep = 1;
              particleEffects.push({
                x: this.x, y: this.y - 30,
                text: "🌀 COMBO: ROLL & SLAM (ROLLING)!",
                color: "#3b82f6", age: 0, maxAge: 50
              });
            } else if (this.comboStep === 1) {
              this.slamCharging = true;
              this.slamChargeTimer = 0;
              this.slamTargetX = player.x;
              this.slamTargetY = player.y;
              this.comboStep = 2;
              particleEffects.push({
                x: this.x, y: this.y - 30,
                text: "💥 COMBO: ROLL & SLAM (SLAM!)!",
                color: "#ef4444", age: 0, maxAge: 50
              });
            } else {
              this.comboState = "idle";
              this.currentCombo = null;
              this.lastComboTime = now;
            }
          }
        }
        else if (this.currentCombo === "tripleroll") {
          if (!this.isRolling) {
            if (this.comboStep === 0) {
              this.isRolling = true;
              this.rollTimer = 35;
              this.lastRollTime = now;
              const rollSpeed = this.speed * 3.2;
              this.rollVx = (dx / dist) * rollSpeed;
              this.rollVy = (dy / dist) * rollSpeed;
              this.comboStep = 1;
              this.comboTimer = 20;
              particleEffects.push({
                x: this.x, y: this.y - 30,
                text: "🏃 COMBO: TRIPLE ROLL (1/3)!",
                color: "#f59e0b", age: 0, maxAge: 40
              });
            } else if (this.comboStep === 1) {
              this.comboTimer--;
              if (this.comboTimer <= 0) {
                this.isRolling = true;
                this.rollTimer = 35;
                this.lastRollTime = now;
                const rollSpeed = this.speed * 3.2;
                this.rollVx = (dx / dist) * rollSpeed;
                this.rollVy = (dy / dist) * rollSpeed;
                this.comboStep = 2;
                this.comboTimer = 20;
                particleEffects.push({
                  x: this.x, y: this.y - 30,
                  text: "🏃 COMBO: TRIPLE ROLL (2/3)!",
                  color: "#f59e0b", age: 0, maxAge: 40
                });
              }
            } else if (this.comboStep === 2) {
              this.comboTimer--;
              if (this.comboTimer <= 0) {
                this.isRolling = true;
                this.rollTimer = 35;
                this.lastRollTime = now;
                const rollSpeed = this.speed * 3.2;
                this.rollVx = (dx / dist) * rollSpeed;
                this.rollVy = (dy / dist) * rollSpeed;
                this.comboStep = 3;
                particleEffects.push({
                  x: this.x, y: this.y - 30,
                  text: "🔥 COMBO: TRIPLE ROLL (3/3)!",
                  color: "#ef4444", age: 0, maxAge: 40
                });
              }
            } else {
              this.comboState = "idle";
              this.currentCombo = null;
              this.lastComboTime = now;
            }
          }
        }
      }
      else {
        if (now - this.lastComboTime > 8000 && !this.isRolling && !this.slamCharging) {
          const comboOptions = ["doubleslam", "rollslam", "tripleroll"];
          this.currentCombo = comboOptions[Math.floor(Math.random() * comboOptions.length)];
          this.comboState = "active";
          this.comboStep = 0;
          this.comboTimer = 0;
        }
      }
      
      // 2. State Machine: Roll Charge vs Slam Charge vs Normal Walk
      if (this.isRolling) {
        this.rollTimer--;
        
        // Locked rolling charge movement (ignores player dynamic vector updates)
        this.x += this.rollVx;
        this.y += this.rollVy;
        
        // Boundaries clamp to stay within grid clearing
        const forestLoaded = forestBgFrames.length > 0 && forestBgFrames[0].complete && forestBgFrames[0].naturalWidth > 0;
        const minY = forestLoaded ? 360 + this.radius : this.radius;
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        this.y = Math.max(minY, Math.min(canvas.height - this.radius, this.y));
        
        // Spawn dirt/dust trail particles
        if (this.rollTimer % 3 === 0) {
          particleEffects.push({
            x: this.x + (Math.random() * 20 - 10),
            y: this.y + 18 + (Math.random() * 8 - 4),
            text: "💨",
            color: "#d97706",
            age: 0,
            maxAge: 20
          });
        }
        
        // Hit check player during roll
        const rDx = player.x - this.x;
        const rDy = player.y - this.y;
        const rDist = Math.sqrt(rDx * rDx + rDy * rDy);
        
        if (rDist < this.radius + player.radius) {
          if (player.hp > 0 && currentGameState === GameState.PLAY && !player.isRolling && !player.frozen) {
            // Player hit by direct rolling charge!
            player.hp = Math.max(0, player.hp - 30);
            
            // Heavy knockback from roll impact!
            player.x += (rDx / rDist) * 22;
            player.y += (rDy / rDist) * 22;
            
            particleEffects.push({
              x: player.x,
              y: player.y - 12,
              text: "CHARGED!",
              color: "#ef4444",
              age: 0,
              maxAge: 40
            });
            
            triggerPlayerHitEffect(); // Damage red flash and camera rumble!
            if (!gameMuted) playRipAudioFallback(); // crash sound
            
            if (player.hp <= 0) {
              handlePlayerDeath();
            }
          }
        }
        
        if (this.rollTimer <= 0) {
          this.isRolling = false;
          this.lastRollTime = now;
        }
      }
      else if (this.slamCharging) {
        this.slamChargeTimer++;
        this.vx = 0;
        this.vy = 0;
        
        if (this.slamChargeTimer > 40) { // 40 frames charge
          this.slamCharging = false;
          this.slamChargeTimer = 0;
          this.lastSlamTime = now;
          
          // Slam shockwave!
          executeApeSlam(this.slamTargetX, this.slamTargetY);
        }
      } 
      else {
        // Normal walking movement towards player
        this.x += this.vx;
        this.y += this.vy;
        
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        const forestLoaded = forestBgFrames.length > 0 && forestBgFrames[0].complete && forestBgFrames[0].naturalWidth > 0;
        const minY = forestLoaded ? 360 + this.radius : this.radius;
        this.y = Math.max(minY, Math.min(canvas.height - this.radius, this.y));
        
        // Decide to roll or slam
        // Roll: Mid-range distance (130px to 280px) and roll cooldown (6.0s) has elapsed
        if (now - this.lastRollTime > 6000 && dist > 130 && dist < 280) {
          this.isRolling = true;
          this.rollTimer = 45; // 0.75 seconds charge
          this.lastRollTime = now;
          
          const rollSpeed = this.speed * 3.0; // Moves at 3x speed during roll!
          this.rollVx = (dx / dist) * rollSpeed;
          this.rollVy = (dy / dist) * rollSpeed;
          
          // Start-rolling burst particles
          for (let i = 0; i < 5; i++) {
            particleEffects.push({
              x: this.x + (Math.random() * 24 - 12),
              y: this.y + (Math.random() * 24 - 12),
              text: "💨",
              color: "#fbbf24",
              age: 0,
              maxAge: 25
            });
          }
          
          if (!gameMuted) {
            try {
              playSynthRollSound();
            } catch (e) {}
          }
        }
        // Slam: Melee range (dist < 120px) and slam cooldown (4.5s) has elapsed
        else if (now - this.lastSlamTime > 4500 && dist < 120) {
          this.slamCharging = true;
          this.slamChargeTimer = 0;
          this.slamTargetX = player.x;
          this.slamTargetY = player.y;
        }
      }
    }
    else if (this.type === "banker") {
      this.bankerTimer--;
      
      if (this.bankerTimer <= 60) {
        // Stop moving and channel TP scroll escape animation!
        this.vx = 0;
        this.vy = 0;
        this.bounceY = 0; // stop hopping while casting TP scroll
      } else {
        // Flee away from player position with erratic zig-zag wobble
        const dx = this.x - player.x;
        const dy = this.y - player.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist > 2) {
          // High-frequency comical zig-zag wobble angle offset
          const wobble = Math.sin(this.bankerTimer * 0.22) * 0.75;
          const angle = Math.atan2(dy, dx) + wobble;
          
          let fleeX = Math.cos(angle);
          let fleeY = Math.sin(angle);
          
          // Edge-avoidance steering vector overrides
          if (this.x < 60) fleeX = 1;
          if (this.x > canvas.width - 60) fleeX = -1;
          if (this.y < 60) fleeY = 1;
          if (this.y > canvas.height - 60) fleeY = -1;
          
          const fleeLen = Math.sqrt(fleeX * fleeX + fleeY * fleeY);
          if (fleeLen > 0) {
            // Comical rapid sprint dashes: every 50 frames, do a high-speed sprint burst for 12 frames
            const isDashing = (this.bankerTimer % 50) < 12;
            const currentSpeed = isDashing ? this.speed * 1.4 : this.speed;
            
            this.vx = (fleeX / fleeLen) * currentSpeed;
            this.vy = (fleeY / fleeLen) * currentSpeed;
          }
        } else {
          this.vx = 0;
          this.vy = 0;
        }
        
        this.x += this.vx;
        this.y += this.vy;
        
        // Edge clamping
        this.x = Math.max(this.radius, Math.min(canvas.width - this.radius, this.x));
        const forestLoaded = forestBgFrames.length > 0 && forestBgFrames[0].complete && forestBgFrames[0].naturalWidth > 0;
        const minY = forestLoaded ? 360 + this.radius : this.radius;
        this.y = Math.max(minY, Math.min(canvas.height - this.radius, this.y));
        
        // Hop bounce offset for comical hopping animation
        this.bounceY = Math.abs(Math.sin(this.bankerTimer * 0.3)) * 14;
        
        // Spawn panicked sweat droplets in game world!
        if (Math.random() < 0.14) {
          particleEffects.push({
            x: this.x + (Math.random() * 12 - 6),
            y: this.y - 10 + (Math.random() * 8 - 4),
            text: Math.random() < 0.55 ? "💦" : "💧",
            color: "#38bdf8",
            age: 0,
            maxAge: 30
          });
        }
      }
      
      // Escape condition
      if (this.bankerTimer <= 0) {
        this.active = false;
        if (typeof triggerBankerEscape === "function") {
          triggerBankerEscape(this.x, this.y);
        }
      }
    }

    // Constrain normal enemies to the active playfield bounds if forest is loaded
    if (this.type !== "ape" && !this.isDead) {
      const forestLoaded = forestBgFrames.length > 0 && forestBgFrames[0].complete && forestBgFrames[0].naturalWidth > 0;
      const minY = forestLoaded ? 360 + this.radius : this.radius;
      this.y = Math.max(minY, Math.min(canvas.height - this.radius, this.y));
    }
  }

  draw() {
    ctx.save();
    
    let drewSprite = false;
    let img = null;
    if (this.type === "spider") img = EnemySprites.spider;
    else if (this.type === "ghost") img = EnemySprites.ghost;
    else if (this.type === "zombie") img = EnemySprites.zombie;
    
    const isStandardMob = (this.type === "spider" || this.type === "ghost" || this.type === "zombie");
    
    if (isStandardMob && img && img.complete && img.naturalWidth > 0) {
      const cols = 8;
      const rows = 3;
      const frameW = img.naturalWidth / cols;
      const frameH = img.naturalHeight / rows;
      
      let activeRow = 0; // Default Row 1: Walk / Hover (index 0)
      
      if (this.isDead) {
        activeRow = 2; // Row 3: Death (index 2)
      } else {
        if (this.type === "ghost") {
          if (this.beamCharging) {
            activeRow = 1; // Row 2: Spell Cast (index 1)
          }
        } else {
          const dx = player.x - this.x;
          const dy = player.y - this.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < this.radius + player.radius + 8) {
            activeRow = 1; // Row 2: Attack (index 1)
          }
        }
      }
      
      let activeCol = this.animFrame;
      if (this.isDead) {
        // Death splat progression mapped to deathTimer at double-speed, then lingering on frame 7
        activeCol = Math.max(0, Math.min(7, Math.floor((45 - this.deathTimer) / 2)));
      }
      
      const srcX = activeCol * frameW;
      const srcY = activeRow * frameH;
      
      let alphaSaved = false;
      if (this.isDead && this.deathTimer < 14) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, this.deathTimer / 14));
        alphaSaved = true;
      }
      
      // Underfoot perspective shadow (Fainter and larger for floating ghosts!)
      ctx.beginPath();
      if (this.type === "ghost") {
        ctx.ellipse(this.x, this.y + 27.5, 22.5, 7.5, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
      } else {
        ctx.ellipse(this.x, this.y + 22.5, 17.5, 6.25, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
      }
      ctx.fill();
      
      // Render standard sprite frame (with bounce for zombie/spider, hover bob for ghosts!)
      const drawW = 80;
      const drawH = drawW * (frameH / frameW);
      
      let drawY = this.y;
      if (this.isDead) {
        drawY = this.y;
      } else if (this.type === "ghost") {
        // Slow natural hover float bobbing
        const bobY = Math.sin((Date.now() / 320) + this.x * 0.03) * 3.8;
        drawY = this.y - bobY;
      } else {
        drawY = this.y - (this.bounceY || 0);
      }
      
      ctx.drawImage(
        img,
        srcX, srcY,
        frameW, frameH,
        this.x - drawW / 2, drawY - drawH / 2,
        drawW, drawH
      );
      
      drewSprite = true;
      if (alphaSaved) {
        ctx.restore();
      }
    } 
    else if (this.type === "ape") {
      const apeImg = getProcessedApeImg();
      if (apeImg) {
        const cols = 8;
        const rows = 5;
        const frameW = apeImg.width / cols;
        const frameH = apeImg.height / rows;
        
        let activeRow = 0; // Row 1: Walk (index 0)
        
        if (this.isDead) {
          activeRow = 4; // Row 5: Death (index 4)
        } else if (this.slamCharging) {
          activeRow = 2; // Row 3: Pill Slam (index 2)
        } else if (this.isRolling) {
          activeRow = 1; // Row 2: Roll (index 1)
        } else if (this.enraged) {
          activeRow = 3; // Row 4: Enrage (index 3)
        }
        
        let activeCol = this.animFrame;
        if (this.isDead) {
          // Death collapse frame progression (starts at 60, double-speed 16 frames collapse, then linger)
          activeCol = Math.max(0, Math.min(7, Math.floor((60 - this.deathTimer) / 2)));
        } else if (this.slamCharging) {
          // Slam charge progress animation synced to 40-frame charge
          activeCol = Math.min(7, Math.floor((this.slamChargeTimer / 40) * 8));
        } else if (this.isRolling) {
          // Map rolling animation directly to rollTimer progress
          const rollMax = (this.currentCombo === "tripleroll") ? 35 : 45;
          const rollElapsed = Math.max(0, rollMax - this.rollTimer);
          activeCol = Math.min(7, Math.floor((rollElapsed / rollMax) * 8));
        }
        
        const srcX = activeCol * frameW;
        const srcY = activeRow * frameH;
        
        let alphaSaved = false;
        if (this.isDead && this.deathTimer < 14) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, this.deathTimer / 14));
          alphaSaved = true;
        }
        
        // Underfoot perspective radial glow shadow for the giant boss
        ctx.save();
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + 60, 75, 22, 0, 0, Math.PI * 2);
        const shadowGrad = ctx.createRadialGradient(this.x, this.y + 60, 0, this.x, this.y + 60, 75);
        shadowGrad.addColorStop(0, "rgba(0, 0, 0, 0.65)");
        shadowGrad.addColorStop(0.6, "rgba(0, 0, 0, 0.35)");
        shadowGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
        ctx.fillStyle = shadowGrad;
        ctx.fill();
        ctx.restore();
        
        // Render boss sprite frame using our offscreen scratch canvas to prevent destination color leaks
        const drawW = 270;
        const drawH = drawW * (frameH / frameW);
        const drawX = this.x - drawW / 2;
        const drawY = this.y - drawH / 2;
        
        if (this.lastHitTime && Date.now() - this.lastHitTime < 150) {
          drawApeFlashRed(apeImg, srcX, srcY, frameW, frameH, drawX, drawY, drawW, drawH);
        } else {
          ctx.drawImage(
            apeImg,
            srcX, srcY,
            frameW, frameH,
            drawX, drawY,
            drawW, drawH
          );
        }
        
        drewSprite = true;
        if (alphaSaved) {
          ctx.restore();
        }
      }
    }
    
    if (!drewSprite) {
      // Standard vector circle fallback
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = this.color;
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.fill();
      ctx.stroke();
    }
    
    // Draw charging indicator lines
    if (this.type === "ghost" && this.beamCharging) {
      ctx.save();
      // Use a dashed line to make it look like a targeting guide, not a laser beam!
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      const targetX = this.x + Math.cos(this.beamTargetAngle) * 220;
      const targetY = this.y + Math.sin(this.beamTargetAngle) * 220;
      ctx.lineTo(targetX, targetY);
      ctx.strokeStyle = "rgba(6, 182, 212, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      
      // Draw a small charging energy ball at the ghost itself
      const chargeRadius = (this.beamChargeTimer / 45) * 12;
      const chargeGrad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, chargeRadius + 4);
      chargeGrad.addColorStop(0, "#ffffff");
      chargeGrad.addColorStop(0.5, "#22d3ee");
      chargeGrad.addColorStop(1, "rgba(34, 211, 238, 0)");
      ctx.fillStyle = chargeGrad;
      ctx.beginPath();
      ctx.arc(this.x, this.y, chargeRadius + 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    
    if (this.type === "ape") {
      // Draw boss name above
      ctx.fillStyle = "#ef4444";
      ctx.font = "bold 8px Cinzel";
      ctx.textAlign = "center";
      ctx.fillText("OLE-APE PILLAR DEMON", this.x, this.y - this.radius - 8);
      
      // Draw health bar above boss
      const barW = 40;
      const barH = 3;
      const pct = this.hp / this.maxHp;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(this.x - barW/2, this.y - this.radius - 5, barW, barH);
      ctx.fillStyle = "#ef4444";
      ctx.fillRect(this.x - barW/2, this.y - this.radius - 5, barW * pct, barH);
      
      if (this.slamCharging) {
        // Red target reticle on player coordinates
        ctx.beginPath();
        ctx.arc(this.slamTargetX, this.slamTargetY, 120, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.1 + (this.slamChargeTimer/40)*0.5})`;
        ctx.fillStyle = `rgba(239, 68, 68, ${this.slamChargeTimer/160})`;
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
      }
    }
    else if (this.type === "banker") {
      const img = EnemySprites.banker;
      const drawY = this.y - (this.bounceY || 0);
      const faceDir = (this.vx || 0) >= 0 ? 1 : -1;
      
      if (img && img.complete && img.naturalWidth > 0) {
        const cols = 8;
        const rows = 4;
        const frameW = img.naturalWidth / cols;
        const frameH = img.naturalHeight / rows;
        
        // Row selection logic based on state
        let activeRow = 0; // Default Row 1: Normal Run (index 0)
        
        if (this.bankerTimer <= 60) {
          activeRow = 3; // Row 4: Escape with TP Scroll (index 3)
        }
        else {
          const isDashing = (this.bankerTimer % 50) < 12;
          if (isDashing || this.hp < this.maxHp * 0.35) {
            activeRow = 2; // Row 3: Panicked Run (index 2)
          } else if (this.hp < this.maxHp * 0.75) {
            activeRow = 1; // Row 2: Stressed Hobble (index 1)
          }
        }
        
        const activeCol = this.animFrame;
        const srcX = activeCol * frameW;
        const srcY = activeRow * frameH;
        
        // Ambient perspective circle dropshadow under feet
        ctx.beginPath();
        ctx.ellipse(this.x, this.y + 32.5, 25, 8.75, 0, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(0, 0, 0, 0.4)";
        ctx.fill();
        
        // Render Creg the Banker sprite frame
        const drawW = 95;
        const drawH = drawW * (frameH / frameW);
        
        ctx.save();
        // Flip horizontally if facing left
        if (faceDir === -1) {
          ctx.translate(this.x, drawY);
          ctx.scale(-1, 1);
          ctx.drawImage(
            img,
            srcX, srcY,
            frameW, frameH,
            -drawW / 2, -drawH / 2 - 5,
            drawW, drawH
          );
        } else {
          ctx.translate(this.x, drawY);
          ctx.drawImage(
            img,
            srcX, srcY,
            frameW, frameH,
            -drawW / 2, -drawH / 2 - 5,
            drawW, drawH
          );
        }
        ctx.restore();
        
      } else {
        // Comical Vector placeholder fallback (in case image is still loading)
        ctx.beginPath();
        ctx.rect(this.x - 10, drawY - 17, 20, 34);
        ctx.fillStyle = "#fbbf24";
        ctx.strokeStyle = "#451a03";
        ctx.lineWidth = 2;
        ctx.fill();
        ctx.stroke();
      }
      
      // Draw nameplate (anchored to actual position to stay steady and readable)
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 8.5px Cinzel";
      ctx.textAlign = "center";
      ctx.fillText("CREG THE BANKER", this.x, this.y - this.radius - 16);
      
      // Draw escape timer
      const secondsLeft = (this.bankerTimer / 60).toFixed(1);
      ctx.fillStyle = "#f87171";
      ctx.font = "bold 7px Inter";
      ctx.textAlign = "center";
      ctx.fillText(`ESCAPE IN: ${secondsLeft}s`, this.x, this.y - this.radius - 6);
      
      // Draw health bar
      const barW = 32;
      const barH = 2.5;
      const pct = this.hp / this.maxHp;
      ctx.fillStyle = "rgba(0,0,0,0.5)";
      ctx.fillRect(this.x - barW/2, this.y - this.radius - 12, barW, barH);
      ctx.fillStyle = "#10b981"; // Healthy reserves green
      ctx.fillRect(this.x - barW/2, this.y - this.radius - 12, barW * pct, barH);
    }
    
    ctx.restore();
  }
}

// Loot Drop Engine Ground Item
class GroundLoot {
  constructor(x, y, key) {
    this.x = x;
    this.y = y;
    this.key = key;
    this.config = CURRENCY_CONFIG[key];
    this.active = true;
    this.pulseAge = 0;
    this.radius = 12;
  }

  update() {
    this.pulseAge++;
    
    // Check pickup proximity
    const dx = player.x - this.x;
    const dy = player.y - this.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < player.radius + this.radius) {
      this.pickup();
    }
  }

  pickup() {
    this.active = false;
    
    // Update player stash tab counts
    playerStash[this.key]++;
    lifetimeStash[this.key]++;
    saveLifetimeStash();
    updateStashTabUI();
    
    // Particle effect feedback
    particleEffects.push({
      x: this.x,
      y: this.y,
      text: `+1 ${this.config.name}!`,
      color: this.config.color,
      age: 0,
      maxAge: 40
    });
    
    // Play Filterblade Audio Drop Sound with 150ms Rate-limiting clamp!
    if (!gameMuted) {
      const nowTime = Date.now();
      if (nowTime - lastPickupSoundTime >= PICKUP_SOUND_COOLDOWN) {
        lastPickupSoundTime = nowTime;
        if (this.config.sound) {
          if (typeof window.playSoundWithFallback === "function") {
            window.playSoundWithFallback(this.config.sound, () => {
              if (this.key === "chaos") playChaosAudioFallback();
              else playDivineAudioFallback();
            });
          } else {
            playDivineAudioFallback();
          }
        } else {
          playLootClickAudio();
        }
      }
    }
  }

  draw() {
    ctx.save();
    
    // Draw glowing back beam for high-tier loot (Divine/Mirror)
    if (this.key === "divine" || this.key === "mirror") {
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x, this.y - 120);
      const grad = ctx.createLinearGradient(this.x, this.y, this.x, this.y - 120);
      grad.addColorStop(0, this.config.border);
      grad.addColorStop(1, "rgba(255,255,255,0)");
      ctx.strokeStyle = grad;
      ctx.lineWidth = this.key === "mirror" ? 4 : 2;
      ctx.stroke();
    }
    
    // Render custom image sprite if loaded and ready
    const img = CurrencyImages[this.key];
    if (img && img.complete && img.naturalWidth > 0) {
      const scale = 1 + Math.sin(this.pulseAge * 0.08) * 0.08;
      const drawSize = this.key === "mirror" ? 22 : this.key === "divine" || this.key === "exalted" ? 18 : 16;
      ctx.drawImage(img, this.x - (drawSize * scale)/2, this.y - (drawSize * scale)/2, drawSize * scale, drawSize * scale);
    } else {
      // Pulsing circle highlight (fallback)
      const scale = 1 + Math.sin(this.pulseAge * 0.08) * 0.12;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius * scale, 0, Math.PI * 2);
      ctx.fillStyle = this.config.bg;
      ctx.strokeStyle = this.config.border;
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
      
      // Draw Icon text
      ctx.font = "9px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.config.char, this.x, this.y);
    }
    
    // Floating Text Nameplate styled like PoE ground filters!
    if (showItemLabels) {
      const paddingX = 4;
      const paddingY = 2;
      ctx.font = "bold 6.5px Inter";
      const textWidth = ctx.measureText(this.config.name.toUpperCase()).width;
      
      const rectW = textWidth + paddingX * 2;
      const rectH = 10 + paddingY * 2;
      const rectX = this.x - rectW / 2;
      const rectY = this.y + 11;
      
      // Loot filter backing
      ctx.fillStyle = this.config.bg;
      ctx.strokeStyle = this.config.border;
      ctx.lineWidth = 1;
      ctx.fillRect(rectX, rectY, rectW, rectH);
      ctx.strokeRect(rectX, rectY, rectW, rectH);
      
      // Text color
      ctx.fillStyle = this.config.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.config.name.toUpperCase(), this.x, rectY + rectH/2);
    }
    
    ctx.restore();
  }
}


// ==========================================================================
// 4. ACTION ABILITIES & COMBAT LOGIC
// ==========================================================================

// Enemy Projectile Entity (Frost Orbs, Poison Darts, etc.)
class EnemyProjectile {
  constructor(x, y, vx, vy, color, damage, radius = 5) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.color = color;
    this.damage = damage;
    this.radius = radius;
    this.active = true;
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    
    // Spawn custom frost trail particles! (increased rate and nicer look)
    if (Math.random() < 0.75) {
      particleEffects.push({
        x: this.x + (Math.random() * 6 - 3),
        y: this.y + (Math.random() * 6 - 3),
        vx: -this.vx * 0.3 + (Math.random() * 0.6 - 0.3),
        vy: -this.vy * 0.3 + (Math.random() * 0.6 - 0.3),
        color: Math.random() < 0.5 ? "#22d3ee" : "#e0f2fe", // glowing cyan and bright frosty white
        radius: Math.random() * 2.5 + 1,
        age: 0,
        maxAge: 20,
        isTrail: true
      });
    }
    
    // Boundary check
    if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
      this.active = false;
    }
  }

  draw() {
    ctx.save();
    
    // Outer glowing ice halo
    const glowGrad = ctx.createRadialGradient(this.x, this.y, 2, this.x, this.y, this.radius + 8);
    glowGrad.addColorStop(0, "#ffffff");
    glowGrad.addColorStop(0.3, "#06b6d4"); // cyan
    glowGrad.addColorStop(0.6, "rgba(6, 182, 212, 0.4)");
    glowGrad.addColorStop(1, "rgba(6, 182, 212, 0)");
    
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius + 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Inner frosty ice core
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = "#e0f2fe";
    ctx.strokeStyle = "#0891b2";
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
    
    // Draw 6-pointed star detailing inside to look like a snowflake/crystal core!
    ctx.strokeStyle = "#06b6d4";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI) / 3;
      const x1 = this.x + Math.cos(angle) * (this.radius - 1.5);
      const y1 = this.y + Math.sin(angle) * (this.radius - 1.5);
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(x1, y1);
    }
    ctx.stroke();
    
    ctx.restore();
  }
}

// Ghost cold freeze projectile launcher
function fireGhostProjectile(x, y, angle) {
  const speed = 2.4; // Slow chilling orb
  const vx = Math.cos(angle) * speed;
  const vy = Math.sin(angle) * speed;
  
  enemyProjectiles.push(new EnemyProjectile(x, y, vx, vy, "#a5f3fc", 10, 8));
  
  if (!gameMuted) {
    try {
      playSynthLaserSound();
    } catch (e) {}
  }
}

// Ape Pillar of Doom Slam
function executeApeSlam(tx, ty) {
  // Shockwave particle - expands dynamically and is dodge-rollable!
  particleEffects.push({
    isSlamRing: true,
    x: tx,
    y: ty,
    radius: 120, // Boss-sized epic expanding shockwave
    age: 0,
    maxAge: 45,
    hasHitPlayer: false
  });
  
  if (!gameMuted) {
    playRipAudioFallback(); // Boom impact sound
    try {
      playSynthSlamSound(); // Seismic rumble sound
    } catch (e) {}
  }
}

// Helpers for math geometry
function getDistanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const l2 = dx * dx + dy * dy;
  if (l2 === 0) return Math.sqrt((px - x1)*(px - x1) + (py - y1)*(py - y1));
  
  let t = ((px - x1) * dx + (py - y1) * dy) / l2;
  t = Math.max(0, Math.min(1, t));
  
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.sqrt((px - projX)*(px - projX) + (py - projY)*(py - projY));
}


// ==========================================================================
// 5. THE POE MINIGAME LOOT GENERATION TABLE
// ==========================================================================

function rollMobLoot(x, y, isBoss = false) {
  // Calculate raw drop probability
  // Boss always drops 3 items
  const rollCount = isBoss ? 3 : 1;
  const dropChance = isBoss ? 1.0 : (0.08 + (wave * 0.005)); // drops item on 8% of mobs
  
  for (let c = 0; c < rollCount; c++) {
    if (Math.random() > dropChance && !isBoss) continue;
    
    const roll = Math.random() * 100;
    let lootKey = "scroll";
    
    // Satisfying drop weights for all 11 currencies (calibrated for slower/premium feel):
    // Mirror: 0.003%
    // Divine: 0.4%
    // Exalted: 1.2%
    // Annulment: 2.0%
    // Vaal: 4.0%
    // Chaos: 12.0%
    // Regal: 10.0%
    // Alchemy: 15.0%
    // Transmute: 15.0%
    // Augmentation: 15.0%
    // Scroll: Rest
    
    if (roll < 0.003) {
      lootKey = "mirror";
    } else if (roll < 0.403) {
      lootKey = "divine";
    } else if (roll < 1.603) {
      lootKey = "exalted";
    } else if (roll < 3.603) {
      lootKey = "annulment";
    } else if (roll < 7.603) {
      lootKey = "vaal";
    } else if (roll < 19.603) {
      lootKey = "chaos";
    } else if (roll < 29.603) {
      lootKey = "regal";
    } else if (roll < 44.603) {
      lootKey = "alchemy";
    } else if (roll < 59.603) {
      lootKey = "transmute";
    } else if (roll < 74.603) {
      lootKey = "augmentation";
    } else {
      lootKey = "scroll";
    }
    
    // Spawn item slightly offset to scatter drops
    const scatterX = x + (Math.random() * 16 - 8);
    const scatterY = y + (Math.random() * 16 - 8);
    
    groundLoot.push(new GroundLoot(scatterX, scatterY, lootKey));
  }
}


// ==========================================================================
// 6. SYNTHESIZED SOUND FALLBACKS (Muted safe)
// ==========================================================================

let gameAudioCtx = null;

function initGameAudio() {
  if (gameAudioCtx) return;
  gameAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playChaosAudioFallback() {
  initGameAudio();
  if (!gameAudioCtx || gameMuted) return;
  const now = gameAudioCtx.currentTime;
  const osc = gameAudioCtx.createOscillator();
  const gain = gameAudioCtx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(110, now);
  osc.frequency.exponentialRampToValueAtTime(40, now + 0.25);
  gain.gain.setValueAtTime(0.25, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
  osc.connect(gain);
  gain.connect(gameAudioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.3);
}

function awardXp(amount) {
  if (currentGameState !== GameState.PLAY) return;
  player.xp += amount;
  if (player.xp >= player.maxXp) {
    player.level++;
    player.xp -= player.maxXp;
    player.maxXp = Math.floor(player.maxXp * 1.65);
    triggerLevelUp();
  }
}

function triggerLevelUp() {
  currentGameState = GameState.LEVEL_UP;
  const hud = document.querySelector(".game-ui-overlay");
  if (hud) hud.classList.add("hidden");
  
  if (!gameMuted) {
    try {
      playLevelUpChime();
    } catch (e) {
      playDivineAudioFallback();
    }
  }
  
  particleEffects.push({
    x: player.x,
    y: player.y - 15,
    text: `LEVEL UP! LEVEL ${player.level}!`,
    color: "#10b981",
    age: 0,
    maxAge: 70
  });

  const allChoices = [
    { type: "damage", title: "ATTACK DAMAGE", desc: "+2 base damage", icon: "⚔️", standard: "+2 DMG", exalted: "+4 DMG" },
    { type: "firerate", title: "ATTACK SPEED", desc: "-10% shot cooldown", icon: "⚡", standard: "-10% CD", exalted: "-20% CD" },
    { type: "speed", title: "MOVE SPEED", desc: "+15% movement velocity", icon: "🏃", standard: "+0.45 Speed", exalted: "+0.90 Speed" },
    { type: "maxhp", title: "MAX HEALTH", desc: "+20 Max HP & Heal", icon: "❤️", standard: "+20 HP", exalted: "+40 HP" }
  ];
  
  const shuffled = allChoices.sort(() => 0.5 - Math.random());
  levelUpChoices = shuffled.slice(0, 3);
}

function playLevelUpChime() {
  initGameAudio();
  if (!gameAudioCtx || gameMuted) return;
  const now = gameAudioCtx.currentTime;
  
  const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
  notes.forEach((freq, index) => {
    const time = now + index * 0.08;
    const osc = gameAudioCtx.createOscillator();
    const gain = gameAudioCtx.createGain();
    
    osc.type = index % 2 === 0 ? "triangle" : "sine";
    osc.frequency.setValueAtTime(freq, time);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, time + 0.12);
    
    gain.gain.setValueAtTime(0.12, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
    
    osc.connect(gain);
    gain.connect(gameAudioCtx.destination);
    
    osc.start(time);
    osc.stop(time + 0.35);
  });
}

function handleLevelUpClick(clickX, clickY) {
  const cardW = 240;
  const cardH = 340;
  const y = 280;
  const spacing = 50;
  const startX = (1600 - (3 * cardW + 2 * spacing)) / 2;
  
  for (let i = 0; i < levelUpChoices.length; i++) {
    const choice = levelUpChoices[i];
    const x = startX + i * (cardW + spacing);
    
    const btnStdX = x + 20;
    const btnStdY = y + 190;
    const btnStdW = cardW - 40;
    const btnStdH = 45;
    
    if (clickX >= btnStdX && clickX <= btnStdX + btnStdW && clickY >= btnStdY && clickY <= btnStdY + btnStdH) {
      applyUpgrade(choice.type, false);
      return;
    }
    
    const btnExX = x + 20;
    const btnExY = y + 255;
    const btnExW = cardW - 40;
    const btnExH = 50;
    
    if (playerStash.exalted >= 10 && clickX >= btnExX && clickX <= btnExX + btnExW && clickY >= btnExY && clickY <= btnExY + btnExH) {
      playerStash.exalted -= 10;
      applyUpgrade(choice.type, true);
      return;
    }
  }
}

function applyUpgrade(type, isExalted) {
  const multiplier = isExalted ? 2 : 1;
  
  if (type === "damage") {
    const dmgGain = isExalted ? 4 : 2;
    player.damage += dmgGain;
    particleEffects.push({
      x: player.x,
      y: player.y - 25,
      text: `+${dmgGain} ATTACK DMG!`,
      color: "#ef4444",
      age: 0,
      maxAge: 60
    });
  } 
  else if (type === "firerate") {
    const cooldownMultiplier = isExalted ? 0.80 : 0.90;
    player.shotCooldown = Math.max(100, player.shotCooldown * cooldownMultiplier);
    particleEffects.push({
      x: player.x,
      y: player.y - 25,
      text: `${isExalted ? "-20%" : "-10%"} SHOT COOLDOWN!`,
      color: "#3b82f6",
      age: 0,
      maxAge: 60
    });
  } 
  else if (type === "speed") {
    player.speed += 0.15 * multiplier;
    particleEffects.push({
      x: player.x,
      y: player.y - 25,
      text: `+${(isExalted ? 30 : 15)}% MOVE SPEED!`,
      color: "#fbbf24",
      age: 0,
      maxAge: 60
    });
  } 
  else if (type === "maxhp") {
    player.maxHp += 20 * multiplier;
    player.hp = Math.min(player.maxHp, player.hp + 20 * multiplier);
    particleEffects.push({
      x: player.x,
      y: player.y - 25,
      text: `+${20 * multiplier} MAX HEALTH!`,
      color: "#10b981",
      age: 0,
      maxAge: 60
    });
  }
  
  player.hp = player.maxHp;
  
  if (!gameMuted) {
    try {
      playLootClickAudio();
      setTimeout(() => {
        playDivineAudioFallback();
      }, 100);
    } catch (e) {}
  }
  
  currentGameState = GameState.PLAY;
  const hud = document.querySelector(".game-ui-overlay");
  if (hud) hud.classList.remove("hidden");
}

function playDivineAudioFallback() {
  initGameAudio();
  if (!gameAudioCtx || gameMuted) return;
  const now = gameAudioCtx.currentTime;
  const osc = gameAudioCtx.createOscillator();
  const gain = gameAudioCtx.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(980, now);
  osc.frequency.exponentialRampToValueAtTime(650, now + 0.8);
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
  osc.connect(gain);
  gain.connect(gameAudioCtx.destination);
  osc.start(now);
  osc.stop(now + 1.0);
}

function playLootClickAudio() {
  initGameAudio();
  if (!gameAudioCtx || gameMuted) return;
  const now = gameAudioCtx.currentTime;
  const osc = gameAudioCtx.createOscillator();
  const gain = gameAudioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(1500, now);
  osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
  gain.gain.setValueAtTime(0.12, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
  osc.connect(gain);
  gain.connect(gameAudioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.07);
}

// Bulletproof Dark Souls "You Died" sound effect player with synthesized sad funeral minor chord fallback!
function playDarkSoulsYouDiedAudio() {
  initGameAudio();
  if (gameMuted) return;
  
  const localPath = "sounds/dark-souls_you-died.mp3";
  const audio = new Audio(localPath);
  audio.volume = 0.75;
  
  let fallbackPlayed = false;
  
  const playSymphonyFallback = () => {
    if (fallbackPlayed || !gameAudioCtx) return;
    fallbackPlayed = true;
    
    // Sad funeral minor chord synthesiser
    const now = gameAudioCtx.currentTime;
    const notes = [220.00, 261.63, 329.63, 110.00]; // A3, C4, E4, A2
    
    notes.forEach((freq, idx) => {
      const osc = gameAudioCtx.createOscillator();
      const gain = gameAudioCtx.createGain();
      osc.type = idx === 3 ? "sawtooth" : "sine"; // deep bass drone
      osc.frequency.value = freq;
      
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.15, now + 0.1);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.0);
      
      osc.connect(gain);
      gain.connect(gameAudioCtx.destination);
      osc.start(now);
      osc.stop(now + 3.2);
    });
  };
  
  audio.onerror = () => {
    playSymphonyFallback();
  };
  
  audio.play()
    .catch((err) => {
      // Missing file, play synth
      playSymphonyFallback();
    });
}

let lastHitSoundTime = 0;
function playRipAudioFallback() {
  initGameAudio();
  if (!gameAudioCtx || gameMuted) return;
  
  // Audio overlap throttle: minimum 150ms buffer between player hit sounds
  const nowMs = Date.now();
  if (nowMs - lastHitSoundTime < 150) return;
  lastHitSoundTime = nowMs;
  
  const now = gameAudioCtx.currentTime;
  const osc = gameAudioCtx.createOscillator();
  const gain = gameAudioCtx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(150, now);
  osc.frequency.linearRampToValueAtTime(50, now + 0.18);
  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
  osc.connect(gain);
  gain.connect(gameAudioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.25);
}

// Low growl/roar sound for Ape Boss enrage
function playSynthRoarSound() {
  initGameAudio();
  if (!gameAudioCtx || gameMuted) return;
  const now = gameAudioCtx.currentTime;
  
  const osc = gameAudioCtx.createOscillator();
  const gain = gameAudioCtx.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(100, now);
  osc.frequency.linearRampToValueAtTime(160, now + 0.15);
  osc.frequency.linearRampToValueAtTime(80, now + 0.45);
  
  gain.gain.setValueAtTime(0.35, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
  
  osc.connect(gain);
  gain.connect(gameAudioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.55);
}

// Rapid sweeping swoosh for Ape Boss roll
function playSynthRollSound() {
  initGameAudio();
  if (!gameAudioCtx || gameMuted) return;
  const now = gameAudioCtx.currentTime;
  
  const osc = gameAudioCtx.createOscillator();
  const gain = gameAudioCtx.createGain();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(60, now);
  osc.frequency.linearRampToValueAtTime(140, now + 0.35);
  osc.frequency.linearRampToValueAtTime(50, now + 0.7);
  
  gain.gain.setValueAtTime(0.3, now);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
  
  osc.connect(gain);
  gain.connect(gameAudioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.75);
}

// Deep seismic rumble slam sound for Pill Slam
function playSynthSlamSound() {
  initGameAudio();
  if (!gameAudioCtx || gameMuted) return;
  const now = gameAudioCtx.currentTime;
  
  const freqs = [90, 45]; // deep bass combination
  freqs.forEach((freq, idx) => {
    const osc = gameAudioCtx.createOscillator();
    const gain = gameAudioCtx.createGain();
    osc.type = idx === 0 ? "sawtooth" : "square";
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.linearRampToValueAtTime(freq / 2.5, now + 0.45);
    
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
    
    osc.connect(gain);
    gain.connect(gameAudioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.55);
  });
}

// High-pitch chime sound for E key Spreadshot
function playSynthSpreadshotSound() {
  initGameAudio();
  if (!gameAudioCtx || gameMuted) return;
  const now = gameAudioCtx.currentTime;
  const osc = gameAudioCtx.createOscillator();
  const gain = gameAudioCtx.createGain();
  
  osc.type = "sine";
  osc.frequency.setValueAtTime(440, now);
  osc.frequency.exponentialRampToValueAtTime(1200, now + 0.12);
  
  gain.gain.setValueAtTime(0.2, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
  
  osc.connect(gain);
  gain.connect(gameAudioCtx.destination);
  osc.start(now);
  osc.stop(now + 0.2);
}

// Synchronize and crossfade background, boss, banker, and lobby soundtracks (CORS-safe dynamic volume blending)
function syncGameMusic() {
  // Determine which game soundtrack SHOULD play right now
  let activeMusicTrack = "none";
  
  if (!gameMuted && !musicMuted && !gamePaused) {
    if (currentGameState === GameState.PLAY || currentGameState === GameState.LEVEL_UP) {
      const hasBanker = enemies && enemies.some(e => e.type === "banker");
      if (hasBanker) {
        activeMusicTrack = "banker";
      } else if (activeApeBoss && activeApeBoss.hp > 0 && !activeApeBoss.isDead) {
        activeMusicTrack = "boss";
      } else {
        activeMusicTrack = "bg";
      }
    } else {
      // Lobby / Gameover screens play the Tavern Theme!
      activeMusicTrack = "tavern";
    }
  }

  // Define our Audio elements map
  const audioTracks = {
    tavern: tavernMusic,
    bg: bgMusic,
    boss: bossMusic,
    banker: bankerMusic
  };

  // Crossfade step: Gradually shift actual volumes toward their target volumes
  const fadeSpeed = 0.012; // approx 1.2 seconds transition
  
  Object.keys(audioTracks).forEach(trackKey => {
    const audio = audioTracks[trackKey];
    if (!audio) return;

    const targetVolume = (trackKey === activeMusicTrack) ? maxVolumes[trackKey] : 0.0;
    
    // Gradual volume shift
    if (currentVolumes[trackKey] < targetVolume) {
      currentVolumes[trackKey] = Math.min(targetVolume, currentVolumes[trackKey] + fadeSpeed);
    } else if (currentVolumes[trackKey] > targetVolume) {
      currentVolumes[trackKey] = Math.max(0.0, currentVolumes[trackKey] - fadeSpeed);
    }

    // Set Audio volume property
    audio.volume = currentVolumes[trackKey];

    // Manage play/pause states based on volume to save browser CPU resources
    if (currentVolumes[trackKey] > 0.0) {
      if (audio.paused) {
        audio.play().catch(err => {
          // Blocked by autoplay initially (this is normal until first click!)
        });
      }
    } else {
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0; // reset track position
      }
    }
  });
}


// ==========================================================================
// 7. THE INTERACTIVE STASH TAB COMPONENT
// ==========================================================================

function updateStashTabUI() {
  const grid = document.getElementById("stashGrid");
  const summaryBox = document.getElementById("stashSummary");
  
  if (!grid || !summaryBox) return;
  
  grid.innerHTML = "";
  
  // 1. Determine active counts map based on tab state
  let activeCounts = {};
  let stashLabelText = "WORTH: 0c";
  let totalNetWorth = 0;
  
  const currencyKeys = Object.keys(CURRENCY_CONFIG);
  
  if (activeStashView === "run") {
    activeCounts = { ...playerStash };
    currencyKeys.forEach(key => {
      totalNetWorth += activeCounts[key] * CURRENCY_CONFIG[key].worth;
    });
    stashLabelText = `RUN WORTH: ${totalNetWorth.toFixed(1)}c`;
    document.getElementById("gameWorthText").textContent = `${totalNetWorth.toFixed(1)}c`;
  } 
  else if (activeStashView === "lifetime") {
    activeCounts = { ...lifetimeStash };
    currencyKeys.forEach(key => {
      totalNetWorth += activeCounts[key] * CURRENCY_CONFIG[key].worth;
    });
    stashLabelText = `LIFETIME LOOTING: ${totalNetWorth.toFixed(1)}c`;
  } 
  else {
    // Guild Vault - derived from globalOverallGuildChaos
    const c = globalOverallGuildChaos;
    activeCounts = {
      mirror: Math.floor(c / 40000),
      divine: Math.floor(c / 150),
      exalted: Math.floor(c / 15),
      annulment: Math.floor(c / 5),
      vaal: Math.floor(c / 2),
      chaos: Math.floor(c / 1),
      regal: Math.floor(c / 0.8),
      alchemy: Math.floor(c / 0.5),
      transmute: Math.floor(c / 0.2),
      augmentation: Math.floor(c / 0.15),
      scroll: Math.floor(c / 0.1)
    };
    
    currencyKeys.forEach(key => {
      totalNetWorth += activeCounts[key] * CURRENCY_CONFIG[key].worth;
    });
    stashLabelText = `GUILD VAULT: ${totalNetWorth.toFixed(0)}c`;
  }
  
  document.getElementById("stashNetWorth").textContent = stashLabelText;
  
  // Dedicated PoE-style slot coordinate mapping for our 11 currencies (row, col in 12x12 grid)
  // Each printed gold box is represented by a 2x2 span centered symmetrically in the 12x12 grid.
  const CURRENCY_SLOTS = {
    // Top Row (5 boxes)
    scroll: { row: 3, col: 2, rSpan: 2, cSpan: 2 },
    transmute: { row: 3, col: 4, rSpan: 2, cSpan: 2 },
    augmentation: { row: 3, col: 6, rSpan: 2, cSpan: 2 },
    alchemy: { row: 3, col: 8, rSpan: 2, cSpan: 2 },
    regal: { row: 3, col: 10, rSpan: 2, cSpan: 2 },

    // Middle Row (5 boxes)
    chaos: { row: 7, col: 2, rSpan: 2, cSpan: 2 },
    vaal: { row: 7, col: 4, rSpan: 2, cSpan: 2 },
    annulment: { row: 7, col: 6, rSpan: 2, cSpan: 2 },
    exalted: { row: 7, col: 8, rSpan: 2, cSpan: 2 },
    divine: { row: 7, col: 10, rSpan: 2, cSpan: 2 },

    // Bottom Row (1 centered box)
    mirror: { row: 10, col: 6, rSpan: 2, cSpan: 2 }
  };

  // 2. Render all 11 active currency slots placed explicitly on 2x2 grid areas
  Object.keys(CURRENCY_SLOTS).forEach(keyForThisSlot => {
    const slotConf = CURRENCY_SLOTS[keyForThisSlot];
    const qty = activeCounts[keyForThisSlot] || 0;
    const conf = CURRENCY_CONFIG[keyForThisSlot];
    const img = CurrencyImages[keyForThisSlot];

    const cell = document.createElement("div");
    cell.className = "stash-grid-cell active-slot";
    cell.title = `${conf.name} ${qty > 0 ? `(Qty: ${qty})` : '(Empty Slot)'}`;
    
    // Explicit 2x2 placement in CSS Grid (using 1-based index)
    cell.style.gridColumn = `${slotConf.col} / span ${slotConf.cSpan}`;
    cell.style.gridRow = `${slotConf.row} / span ${slotConf.rSpan}`;

    // Create currency image element (active or ghosted)
    const iconImg = document.createElement("img");
    if (img && img.complete && img.naturalWidth > 0) {
      iconImg.src = img.src;
    } else {
      iconImg.src = `assets/images/currency/item_${keyForThisSlot}.png`;
    }
    iconImg.alt = conf.name;

    // Fine-tune asymmetrical icon alignment inside the slot frame grid windows
    if (keyForThisSlot === "chaos" || keyForThisSlot === "vaal" || keyForThisSlot === "annulment") {
      iconImg.style.marginTop = "-4px";
      iconImg.style.marginLeft = "3px";
    } else if (keyForThisSlot === "exalted" || keyForThisSlot === "divine") {
      iconImg.style.marginTop = "-4px";
    } else if (keyForThisSlot === "mirror") {
      iconImg.style.marginTop = "3px";
    }

    if (qty > 0) {
      iconImg.className = "stash-image-icon";
      cell.appendChild(iconImg);

      // Render quantity label
      const qtyLabel = document.createElement("span");
      qtyLabel.className = "stash-count";
      qtyLabel.textContent = formatStashQty(qty);
      cell.appendChild(qtyLabel);
    } else {
      // GHOSTED VERSION of the currency
      iconImg.className = "stash-image-icon ghosted-icon";
      cell.appendChild(iconImg);
    }

    grid.appendChild(cell);
  });
  
  // 3. Text Summary panel items
  summaryBox.innerHTML = "";
  currencyKeys.forEach(key => {
    const qty = activeCounts[key] || 0;
    if (qty > 0) {
      const conf = CURRENCY_CONFIG[key];
      const item = document.createElement("span");
      item.className = "summary-item";
      
      const img = CurrencyImages[key];
      if (img && img.complete && img.naturalWidth > 0) {
        item.innerHTML = `<img src="${img.src}" style="width: 22px; height: 22px; object-fit: contain; margin-right: 6px;" alt="${conf.name}"> <span class="summary-qty">${formatStashQty(qty)}x</span> <span class="summary-name">${conf.name}</span>`;
      } else {
        item.innerHTML = `<span style="font-size: 1.25rem; margin-right: 6px;">${conf.char}</span> <span class="summary-qty">${formatStashQty(qty)}x</span> <span class="summary-name">${conf.name}</span>`;
      }
      summaryBox.appendChild(item);
    }
  });
  
  if (summaryBox.children.length === 0) {
    summaryBox.innerHTML = "<span class='text-gold-faded'>Stash is currently empty. Go kill some mobs!</span>";
  }
}

// Calculate total score worth in Chaos
function calculateNetWorthScore() {
  let score = 0;
  Object.keys(CURRENCY_CONFIG).forEach(key => {
    score += playerStash[key] * CURRENCY_CONFIG[key].worth;
  });
  return Math.floor(score * 10); // multiplied for solid integer scoring
}


// ==========================================================================
// 8. SERVERLESS LEADERBOARD MODULE (dreamlo integration)
// ==========================================================================

let currentLeaderboardTab = "topRuns"; // "topRuns" or "totalGrind"
let leaderboardEntriesRaw = [];       // Cache raw records to prevent repeat API calls
let guildBankerUnlocked = false;       // Set globally base on collective tax reserves
let globalGuildTaxChaos = 0;

// Default premium gothic/PoE themed local mock entries as offline fallback
const defaultMockEntries = [
  { name: "ChrisWilson-1716912000", score: "50000", seconds: "Witch" },
  { name: "GoodLootGuy-1716912100", score: "32000", seconds: "Ranger" },
  { name: "Neon-1716912200", score: "25000", seconds: "Ranger" },
  { name: "Mathil-1716912300", score: "18000", seconds: "Witch" },
  { name: "Zizaran-1716912400", score: "15000", seconds: "Ranger" },
  { name: "Octavian-1716912500", score: "12000", seconds: "Witch" },
  { name: "StillSaneExile-1716912600", score: "8500", seconds: "Witch" },
  { name: "CregTheBanker-1716912700", score: "-5000", seconds: "Banker" },
  { name: "NoCregsAllowed-1716912800", score: "4500", seconds: "Ranger" },
  { name: "WraeclastEnjoyer-1716912900", score: "3200", seconds: "Witch" }
];

// Read cached leaderboards or initialize with defaults
function getLeaderboardCache() {
  try {
    const cached = localStorage.getItem("poe_guild_leaderboard_cache");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Failed to read leaderboard cache:", e);
  }
  
  try {
    localStorage.setItem("poe_guild_leaderboard_cache", JSON.stringify(defaultMockEntries));
  } catch (e) {
    console.error("Failed to save default mock leaderboard:", e);
  }
  return defaultMockEntries;
}

async function loadDreamloLeaderboard() {
  const tbody = document.getElementById("leaderboardBody");
  if (!tbody) return;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4000); // 4 seconds timeout
  
  try {
    const response = await fetch(`https://dreamlo.com/lb/${DREAMLO_PUBLIC_KEY}/json`, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error("Leaderboard API returned status: " + response.status);
    
    const data = await response.json();
    tbody.innerHTML = "";
    
    if (data && data.dreamlo && data.dreamlo.leaderboard && data.dreamlo.leaderboard.entry) {
      let entries = data.dreamlo.leaderboard.entry;
      
      // Normalize single record to array
      if (!Array.isArray(entries)) {
        entries = [entries];
      }
      
      leaderboardEntriesRaw = entries;
      
      // Cache entries locally in localStorage
      try {
        localStorage.setItem("poe_guild_leaderboard_cache", JSON.stringify(entries));
      } catch (e) {
        console.error("Failed to update local leaderboard cache:", e);
      }
      
      // Process database records
      renderActiveLeaderboard();
      calculateCollectiveGuildTax();
      
    } else {
      tbody.innerHTML = "<tr><td colspan='4' class='center-text text-gold-faded'>NO SCORES RECORDED. BE THE FIRST!</td></tr>";
      updateGuildTaxReservesDisplay(0);
    }
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn("Dreamlo online fetch failed or timed out. Falling back to local cache/mock data.", err);
    
    // Load fallback data from local storage
    const cachedEntries = getLeaderboardCache();
    leaderboardEntriesRaw = cachedEntries;
    
    tbody.innerHTML = "";
    renderActiveLeaderboard();
    calculateCollectiveGuildTax();
    
    // Append a subtle indicator that we're showing offline data
    const statusLabel = document.getElementById("guildGrindStatus");
    if (statusLabel && !statusLabel.textContent.includes("(OFFLINE)")) {
      statusLabel.textContent += " (OFFLINE)";
    }
  }
}

// Calculate collective guild wealth tax in real-time from ALL scores
function calculateCollectiveGuildTax() {
  let overallGuildScore = 0;
  let totalDeductionsScore = 0;
  
  leaderboardEntriesRaw.forEach(entry => {
    const score = parseInt(entry.score, 10);
    const rawName = entry.name;
    const name = rawName.includes("-") ? rawName.split("-")[0] : rawName;
    
    // Separate valid player runs from CREG deduction entries
    if (name.toUpperCase().startsWith("CREG") || score < 0) {
      totalDeductionsScore += Math.abs(score);
    } else {
      overallGuildScore += score;
    }
  });
  
  // Convert scores back into Chaos: score = chaos * 10
  const overallGuildChaos = overallGuildScore / 10;
  const deductionsChaos = totalDeductionsScore / 10;
  
  // Set global for derived calculations in Guild Tab
  globalOverallGuildChaos = overallGuildChaos;
  updateStashTabUI();
  
  // Guild Tax is exactly 15% of player runs, minus exact banker deductions taken live!
  const reservesChaos = 1500 + (overallGuildChaos * 0.15) - deductionsChaos;
  
  // Update reserves progress bar (gold)
  updateGuildTaxReservesDisplay(reservesChaos);
  
  // Update cumulative grind goal progress bar (purple)
  updateGuildGrindTotalDisplay(overallGuildChaos);
}

function updateGuildTaxReservesDisplay(taxChaos) {
  // Convert Chaos to Exalted Orbs (at 15c = 1 Exalt)
  const taxExalted = taxChaos / 15;
  const progressPct = Math.min(100, (taxExalted / 100) * 100);
  
  const bar = document.getElementById("guildReservesBar");
  const text = document.getElementById("guildReservesText");
  const status = document.getElementById("guildReservesStatus");
  
  if (bar) bar.style.width = `${progressPct}%`;
  if (text) text.textContent = `${taxExalted.toFixed(1)} / 100.0 EX`;
  
  if (status) {
    if (taxExalted >= 100.0) {
      guildBankerUnlocked = true;
      status.textContent = "🔓 GUILD BANKER ACTIVE! (10% WAVE CHANCE)";
      status.className = "reserves-status-subtext text-gold";
    } else {
      guildBankerUnlocked = false;
      status.textContent = `🔒 GUILD BANKER LOCKED (NEED ${(100.0 - taxExalted).toFixed(1)} EX)`;
      status.className = "reserves-status-subtext text-gold-faded";
    }
  }
}

function updateGuildGrindTotalDisplay(grindChaos) {
  const text = document.getElementById("guildGrindTotalText");
  const bar = document.getElementById("guildGrindBar");
  const status = document.getElementById("guildGrindStatus");
  
  if (text) {
    text.textContent = `${grindChaos.toFixed(1)} Chaos`;
  }
  
  const targetGoal = 10000.0; // 10k Chaos guild goal
  const progressPct = Math.min(100, (grindChaos / targetGoal) * 100);
  
  if (bar) {
    bar.style.width = `${progressPct}%`;
  }
  
  if (status) {
    status.textContent = `GUILD GOAL: ${targetGoal.toLocaleString()}c (${progressPct.toFixed(1)}% hit)`;
  }
}

// Submit negative score to dreamlo representing loot deducted from reserves
async function submitBankerDeduction(chaosValue) {
  const deductedScore = -Math.floor(chaosValue * 10);
  const dbName = `CREG_DEDUCTION-${Date.now()}`;
  const url = `https://dreamlo.com/lb/${DREAMLO_PRIVATE_KEY}/add/${encodeURIComponent(dbName)}/${deductedScore}/0/Banker`;
  
  console.log(`Submitting banker deduction of ${chaosValue}c (score: ${deductedScore}) to database...`);
  
  // Reset local variable immediately to prevent double submissions
  bankerDeductedChaosThisRun = 0;
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 seconds timeout
  
  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error("Database returned error status: " + response.status);
    console.log("Banker deduction submitted successfully!");
    
    // Add locally to raw entries immediately
    const newEntry = { name: dbName, score: deductedScore.toString(), seconds: "Banker" };
    leaderboardEntriesRaw.push(newEntry);
    try {
      localStorage.setItem("poe_guild_leaderboard_cache", JSON.stringify(leaderboardEntriesRaw));
    } catch (e) {
      console.error(e);
    }
    
    // Reload leaderboard and calculate new reserves live!
    loadDreamloLeaderboard();
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn("Failed to submit banker deduction online. Saving locally.", err);
    
    // Offline local storage update
    const dbName = `CREG_DEDUCTION-${Date.now()}`;
    const newEntry = { name: dbName, score: deductedScore.toString(), seconds: "Banker" };
    
    const cachedEntries = getLeaderboardCache();
    cachedEntries.push(newEntry);
    
    try {
      localStorage.setItem("poe_guild_leaderboard_cache", JSON.stringify(cachedEntries));
    } catch (e) {
      console.error(e);
    }
    
    leaderboardEntriesRaw = cachedEntries;
    renderActiveLeaderboard();
    calculateCollectiveGuildTax();
  }
}

// Banker escape portal animation, sound, and dialogue
function triggerBankerEscape(x, y) {
  // Portal blue shockwave ring
  particleEffects.push({
    isSlamRing: true, // Re-use slam ring expanding circle for portal blue ring
    x: x,
    y: y,
    radius: 30,
    age: 0,
    maxAge: 30
  });
  
  // Escape speech bubble text particle
  particleEffects.push({
    x: x,
    y: y - 20,
    text: "💬 Creg has logged out to save his pixels!",
    color: "#f87171", // light red bubble text
    age: 0,
    maxAge: 120
  });
  
  if (!gameMuted) playRipAudioFallback(); // escape portal warp beep
  
  // Submit negative score representing looted goods
  if (bankerDeductedChaosThisRun > 0) {
    submitBankerDeduction(bankerDeductedChaosThisRun);
  }
  
  // Sync music back
  setTimeout(() => {
    syncGameMusic();
  }, 100);
}

function renderActiveLeaderboard() {
  const tbody = document.getElementById("leaderboardBody");
  if (!tbody || leaderboardEntriesRaw.length === 0) return;
  
  tbody.innerHTML = "";
  
  // Filter out any entries related to Creg deductions or negative values to isolate player runs
  const filteredEntries = leaderboardEntriesRaw.filter(entry => {
    const rawName = entry.name;
    const name = rawName.includes("-") ? rawName.split("-")[0] : rawName;
    const score = parseInt(entry.score, 10);
    return !name.toUpperCase().startsWith("CREG") && score > 0;
  });
  
  if (currentLeaderboardTab === "topRuns") {
    // 1. TOP RUNS MODE: Show top individual runs
    const parsedRuns = filteredEntries.map(entry => {
      const rawName = entry.name;
      // Split out name from timestamp
      const name = rawName.includes("-") ? rawName.split("-")[0] : rawName;
      const score = parseInt(entry.score, 10);
      const classType = entry.seconds ? entry.seconds : "Witch";
      return { name, class: classType, score };
    });
    
    // Sort descending by score
    parsedRuns.sort((a, b) => b.score - a.score);
    
    parsedRuns.slice(0, 10).forEach((run, idx) => {
      const tr = document.createElement("tr");
      const worthInChaos = (run.score / 10).toFixed(1);
      
      tr.innerHTML = `
        <td>#${idx + 1}</td>
        <td>${escapeHtml(run.name)}</td>
        <td>${escapeHtml(run.class)}</td>
        <td class="text-gold">${worthInChaos}c</td>
      `;
      tbody.appendChild(tr);
    });
  } 
  else {
    // 2. TOTAL GRIND MODE: Sum all scores per unique handle
    const cumulativeMap = {};
    
    filteredEntries.forEach(entry => {
      const rawName = entry.name;
      const name = rawName.includes("-") ? rawName.split("-")[0] : rawName;
      const score = parseInt(entry.score, 10);
      const classType = entry.seconds ? entry.seconds : "Witch";
      
      if (!cumulativeMap[name]) {
        cumulativeMap[name] = { name: name, class: classType, score: 0 };
      }
      cumulativeMap[name].score += score;
    });
    
    // Convert map to array and sort descending
    const parsedGrinds = Object.values(cumulativeMap);
    parsedGrinds.sort((a, b) => b.score - a.score);
    
    parsedGrinds.slice(0, 10).forEach((grind, idx) => {
      const tr = document.createElement("tr");
      const worthInChaos = (grind.score / 10).toFixed(1);
      
      tr.innerHTML = `
        <td>#${idx + 1}</td>
        <td>${escapeHtml(grind.name)}</td>
        <td>${escapeHtml(grind.class)}</td>
        <td class="text-gold">${worthInChaos}c</td>
      `;
      tbody.appendChild(tr);
    });
  }
}

async function submitScoreToLeaderboard() {
  if (gameScoreSubmitted) return;
  
  const nameInput = document.getElementById("playerNameInput");
  const submitBtn = document.getElementById("btnSubmitScore");
  const statusMsg = document.getElementById("submitStatusMsg");
  
  if (!nameInput || !submitBtn || !statusMsg) return;
  
  const rawName = nameInput.value.trim();
  
  // Clean alphanumeric name
  const cleanName = rawName.replace(/[^a-zA-Z0-9]/g, "");
  
  if (!cleanName || cleanName.length < 2) {
    statusMsg.textContent = "❌ Name must be at least 2 alphanumeric chars!";
    statusMsg.className = "status-msg error-text";
    return;
  }
  
  // Lock inputs
  submitBtn.disabled = true;
  nameInput.disabled = true;
  gameScoreSubmitted = true;
  
  const score = calculateNetWorthScore();
  const playerClass = player.class;
  
  statusMsg.textContent = "🛡️ RECORDING YOUR LOOT TO GUILD HALL...";
  statusMsg.className = "status-msg success-text";
  
  try {
    // Append timestamp to name to treat every run as a separate unique record
    const dbName = `${cleanName}-${Date.now()}`;
    const url = `https://dreamlo.com/lb/${DREAMLO_PRIVATE_KEY}/add/${encodeURIComponent(dbName)}/${score}/0/${encodeURIComponent(playerClass)}`;
    
    // API request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 seconds timeout
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (!response.ok) throw new Error("Submitting score returned status: " + response.status);
    
    statusMsg.textContent = "🏆 SCORES UPLOADED SUCCESSFULLY!";
    statusMsg.className = "status-msg success-text";
    
    // Add locally to raw entries immediately
    const newEntry = { name: dbName, score: score.toString(), seconds: playerClass };
    leaderboardEntriesRaw.push(newEntry);
    try {
      localStorage.setItem("poe_guild_leaderboard_cache", JSON.stringify(leaderboardEntriesRaw));
    } catch (e) {
      console.error(e);
    }
    
    // Reload leaderboard board
    loadDreamloLeaderboard();
    
    // Trigger fun currency rain on header title for visual feedback
    if (typeof window.triggerClickExplosion === "function") {
      window.triggerClickExplosion();
    }
    
  } catch (err) {
    clearTimeout(timeoutId);
    console.warn("Online score submission failed/timed out. Saving to local cache.", err);
    
    // Offline / Blocked fallback logic!
    const dbName = `${cleanName}-${Date.now()}`;
    const newEntry = { name: dbName, score: score.toString(), seconds: playerClass };
    
    // Load current cache and push the new entry
    const cachedEntries = getLeaderboardCache();
    cachedEntries.push(newEntry);
    
    try {
      localStorage.setItem("poe_guild_leaderboard_cache", JSON.stringify(cachedEntries));
    } catch (e) {
      console.error("Failed to write to local storage leaderboard:", e);
    }
    
    leaderboardEntriesRaw = cachedEntries;
    
    statusMsg.textContent = "🏆 OFFLINE HYPE: LOOT RECORDED LOCALLY!";
    statusMsg.className = "status-msg success-text";
    
    // Re-render and calculate based on new entries
    renderActiveLeaderboard();
    calculateCollectiveGuildTax();
    
    // Trigger click explosion
    if (typeof window.triggerClickExplosion === "function") {
      window.triggerClickExplosion();
    }
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}


// ==========================================================================
// 9. CORE CANVAS GAME LOOP & PHYSICS ENGINE
// ==========================================================================

let cameraShake = { x: 0, y: 0, duration: 0 };

function triggerCameraShake(duration = 18, intensity = 8) {
  cameraShake.duration = duration;
  cameraShake.intensity = intensity;
}

function handleInput() {
  // Poll desktop / browser HTML5 gamepads
  const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null;
  for (let i = 0; i < gamepads.length; i++) {
    if (gamepads[i]) {
      gp = gamepads[i];
      break;
    }
  }

  if (gp) {
    const justPressed = (btnIndex) => {
      const isPressed = gp.buttons[btnIndex] ? gp.buttons[btnIndex].pressed : false;
      const wasPressed = prevGamepadButtons[btnIndex] || false;
      return isPressed && !wasPressed;
    };

    // Global Pause button check: Start button (button 9)
    if (justPressed(9)) {
      if (currentGameState === GameState.PLAY) {
        toggleGamePause();
      }
    }

    // Lobby Selection: select character
    if (currentGameState === GameState.SELECT) {
      if (justPressed(14)) { // D-pad Left
        setRangerClass();
      }
      if (justPressed(15)) { // D-pad Right
        setWitchClass();
      }
      if (justPressed(0) || justPressed(9)) { // A button or Start to play
        resetGame();
      }
    }

    // Gameplay active actions
    if (currentGameState === GameState.PLAY && !gamePaused) {
      // A button (button 0): Dodge Roll
      if (justPressed(0)) {
        triggerPlayerDodgeRoll();
      }
      // X button (button 2): Special Attack (Spreadshot)
      if (justPressed(2)) {
        triggerPlayerSpreadshot();
      }
    }

    // Store button states for next tick
    for (let i = 0; i < gp.buttons.length; i++) {
      prevGamepadButtons[i] = gp.buttons[i].pressed;
    }
  } else {
    prevGamepadButtons = {};
  }

  // Early return if not active playing or frozen
  if (currentGameState !== GameState.PLAY || player.frozen) {
    player.vx = 0;
    player.vy = 0;
    return;
  }

  let moveX = 0;
  let moveY = 0;

  // Gamepad analog stick & D-pad movement vector
  let gpMoveX = 0;
  let gpMoveY = 0;
  if (gp && !gamePaused) {
    const deadzone = 0.15;
    const ax = gp.axes[0] || 0;
    const ay = gp.axes[1] || 0;
    if (Math.abs(ax) > deadzone) gpMoveX = ax;
    if (Math.abs(ay) > deadzone) gpMoveY = ay;

    // D-pad movement overrides
    if (gp.buttons[12] && gp.buttons[12].pressed) gpMoveY = -1; // D-pad Up
    if (gp.buttons[13] && gp.buttons[13].pressed) gpMoveY = 1;  // D-pad Down
    if (gp.buttons[14] && gp.buttons[14].pressed) gpMoveX = -1; // D-pad Left
    if (gp.buttons[15] && gp.buttons[15].pressed) gpMoveX = 1;  // D-pad Right
  }

  if (gp && !gamePaused && (Math.abs(gpMoveX) > 0 || Math.abs(gpMoveY) > 0)) {
    moveX = gpMoveX;
    moveY = gpMoveY;
  } else if (typeof joystickActive !== "undefined" && joystickActive) {
    moveX = joystickMoveX;
    moveY = joystickMoveY;
  } else {
    if (keys.w || keys.ArrowUp) { moveY = -1; lastPlayerDirectionRow = 1; }
    if (keys.s || keys.ArrowDown) { moveY = 1; lastPlayerDirectionRow = 0; }
    if (keys.a || keys.ArrowLeft) { moveX = -1; lastPlayerDirectionRow = 2; }
    if (keys.d || keys.ArrowRight) { moveX = 1; lastPlayerDirectionRow = 3; }
  }

  // Normalize movements vector
  const len = Math.sqrt(moveX * moveX + moveY * moveY);
  if (len > 0) {
    const slowMultiplier = 1.0 - ((player.slowStacks || 0) * 0.03);
    player.vx = (moveX / len) * player.speed * slowMultiplier;
    player.vy = (moveY / len) * player.speed * slowMultiplier;
    
    // Auto-update face direction from dominant stick/joystick vector
    if ((gp && !gamePaused && (Math.abs(gpMoveX) > 0 || Math.abs(gpMoveY) > 0)) || (typeof joystickActive !== "undefined" && joystickActive)) {
      if (Math.abs(moveX) > Math.abs(moveY)) {
        lastPlayerDirectionRow = moveX > 0 ? 3 : 2;
      } else {
        lastPlayerDirectionRow = moveY > 0 ? 0 : 1;
      }
    }
  } else {
    player.vx = 0;
    player.vy = 0;
  }
}

// Witch seeks closest, Ranger shoots in move/aim direction
function executePlayerAutoShooting() {
  const now = Date.now();
  if (now - player.lastShotTime < player.shotCooldown) return;
  
  if (player.class === "Witch") {
    // Find closest enemy
    let closestEnemy = null;
    let closestDist = Infinity;
    
    enemies.forEach(e => {
      if (e.isDead || !e.active) return;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closestDist = dist;
        closestEnemy = e;
      }
    });
    
    if (closestEnemy) {
      player.lastShotTime = now;
      const dx = closestEnemy.x - player.x;
      const dy = closestEnemy.y - player.y;
      const angle = Math.atan2(dy, dx);
      
      const speed = 2.5; // Sparks move chaoticly but start towards target
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      
      // Fire 2 Spark projectiles
      projectiles.push(new GameProjectile(player.x, player.y, vx, vy, "#22d3ee", player.damage, true));
      setTimeout(() => {
        if (currentGameState === GameState.PLAY) {
          projectiles.push(new GameProjectile(player.x, player.y, vx * 0.9, vy * 0.9, "#22d3ee", player.damage, true));
        }
      }, 80);
      
      if (!gameMuted) playLootClickAudio();
    }
  } 
  else if (player.class === "Ranger") {
    // Find closest or face direction
    let closestEnemy = null;
    let closestDist = Infinity;
    
    enemies.forEach(e => {
      if (e.isDead || !e.active) return;
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closestDist = dist;
        closestEnemy = e;
      }
    });
    
    // Shoot towards closest, fallback to moving direction
    let angle = 0;
    if (closestEnemy) {
      angle = Math.atan2(closestEnemy.y - player.y, closestEnemy.x - player.x);
    } else {
      angle = Math.atan2(player.vy, player.vx);
      if (player.vx === 0 && player.vy === 0) angle = -Math.PI/2; // shoots up if still
    }
    
    player.lastShotTime = now;
    const speed = 6.5;
    
    // Split Arrow Fan (3 arrows at angles: -12deg, 0deg, 12deg)
    const angles = [angle - 0.2, angle, angle + 0.2];
    
    angles.forEach(ang => {
      const vx = Math.cos(ang) * speed;
      const vy = Math.sin(ang) * speed;
      projectiles.push(new GameProjectile(player.x, player.y, vx, vy, "#38bdf8", player.damage, false));
    });
    
    if (!gameMuted) playLootClickAudio();
  }
}

// Spawner rules
function handleEnemySpawning() {
  const now = Date.now();
  
  if (activeApeBoss) {
    lastWaveSpawnTime = now; // keep resetting timer so waves don't tick while boss is active!
    return;
  }
  
  // Spawn every 20 seconds (gives plenty of time to maneuver the hordes!)
  if (now - lastWaveSpawnTime > 20000) {
    lastWaveSpawnTime = now;
    
    // Wave calculations: smooth exponential curves (fewer mobs early, ramps up later!)
    const count = baseEnemyCount + Math.floor(wave * 0.8 + Math.pow(wave, 1.3) * 0.4);
    
    // Choose spawn positions offscreen
    const forestLoaded = forestBgFrames.length > 0 && forestBgFrames[0].complete && forestBgFrames[0].naturalWidth > 0;
    
    for (let i = 0; i < count; i++) {
      let sx, sy;
      const border = Math.floor(Math.random() * 4); // 0: Top, 1: Right, 2: Bottom, 3: Left
      
      if (border === 0) { 
        sx = Math.random() * canvas.width; 
        sy = forestLoaded ? 360 + 55 : -20; 
      }
      else if (border === 1) { 
        sx = canvas.width + 20; 
        sy = forestLoaded ? 360 + 65 + Math.random() * (canvas.height - 360 - 130) : Math.random() * canvas.height; 
      }
      else if (border === 2) { 
        sx = Math.random() * canvas.width; 
        sy = canvas.height + 20; 
      }
      else { 
        sx = -20; 
        sy = forestLoaded ? 360 + 65 + Math.random() * (canvas.height - 360 - 130) : Math.random() * canvas.height; 
      }
      
      // Mobs pool selection (Spider is default, Ghost is an uncommon ranged chill projectile spawn)
      let type = "spider";
      
      const roll = Math.random() * 100;
      if (wave >= 2 && roll < 12) {
        type = "ghost";
      }
      
      enemies.push(new Enemy(sx, sy, type));
    }
    
    // Spawn Boss Chieftain Ape! (spaced out to happen every 5 waves, pausing wave progression)
    if (wave % 5 === 0 && !activeApeBoss) {
      // Spawn at top center
      activeApeBoss = new Enemy(canvas.width / 2, -350, "ape");
      enemies.push(activeApeBoss);
      
      // Hype splash note on HUD
      particleEffects.push({
        x: canvas.width / 2,
        y: 120,
        text: "🚨 WARNING: OLE-APE BOSS SPAWNED! slam incoming!",
        color: "#dc2626",
        age: 0,
        maxAge: 100
      });
    }
    // Spawn Guild Banker Creg! (10% chance on wave spawn if unlocked & no active banker is alive)
    const hasBanker = enemies.some(e => e.type === "banker");
    if (guildBankerUnlocked && !hasBanker && Math.random() < 0.10 && wave >= 2) {
      let sx, sy;
      const border = Math.floor(Math.random() * 4);
      if (border === 0) { 
        sx = Math.random() * canvas.width; 
        sy = forestLoaded ? 360 + 65 : -20; 
      }
      else if (border === 1) { 
        sx = canvas.width + 20; 
        sy = forestLoaded ? 360 + 65 + Math.random() * (canvas.height - 360 - 130) : Math.random() * canvas.height; 
      }
      else if (border === 2) { 
        sx = Math.random() * canvas.width; 
        sy = canvas.height + 20; 
      }
      else { 
        sx = -20; 
        sy = forestLoaded ? 360 + 65 + Math.random() * (canvas.height - 360 - 130) : Math.random() * canvas.height; 
      }
      
      const bankerNPC = new Enemy(sx, sy, "banker");
      enemies.push(bankerNPC);
      
      // Hype HUD alert
      particleEffects.push({
        x: canvas.width / 2,
        y: 100,
        text: "🚨 CREG THE GUILD BANKER HAS SPAWNED! CHASE HIM!",
        color: "#fbbf24",
        age: 0,
        maxAge: 130
      });
      
      // Reset banker deduction tracking for this event
      bankerDeductedChaosThisRun = 0;
      
      // Trigger banker chase soundtrack
      setTimeout(() => {
        syncGameMusic();
      }, 50);
    }
    
    wave++;
    document.getElementById("gameWaveText").textContent = wave - 1;
  }
}

// Collisions and hits calculations
function processGamePhysics() {
  // Update background procedural forest effects (fog and blinking eyes)
  updateProceduralForestEffects();

  // Move player (Dodge roll overrides standard steering)
  if (player.isRolling) {
    player.x += player.rollVx;
    player.y += player.rollVy;
    
    // Spawn ghostly trail particles
    particleEffects.push({
      x: player.x,
      y: player.y,
      isTrail: true,
      color: player.class === "Ranger" ? "rgba(15, 118, 110, 0.42)" : "rgba(88, 28, 135, 0.42)",
      age: 0,
      maxAge: 12
    });
    
    player.rollTimer--;
    if (player.rollTimer <= 0) {
      player.isRolling = false;
    }
  } else {
    player.x += player.vx;
    player.y += player.vy;
  }
  
  // Freeze debuff timer
  if (player.frozen) {
    player.freezeTimer--;
    if (player.freezeTimer <= 0) {
      player.frozen = false;
    }
  }

  // Bounds checks player dynamically depending on active forest background horizon
  player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
  const forestLoaded = forestBgFrames.length > 0 && forestBgFrames[0].complete && forestBgFrames[0].naturalWidth > 0;
  const minY = forestLoaded ? 360 + player.radius : player.radius;
  player.y = Math.max(minY, Math.min(canvas.height - player.radius, player.y));

  // Poison damage over time ticking
  if (player.poisonRemaining > 0 && player.hp > 0) {
    const tickAmt = Math.min(player.poisonRemaining, 0.08);
    player.hp = Math.max(0, player.hp - tickAmt);
    player.poisonRemaining -= tickAmt;
    if (player.hp <= 0) {
      handlePlayerDeath();
    }
  }

  // Scaling Health Regeneration (Ramps up based on how long player avoids taking combat hits!)
  if (player.hp > 0 && player.hp < player.maxHp) {
    const nowMs = Date.now();
    const secondsSinceDamage = (nowMs - (player.lastDamageTime || 0)) / 1000;
    
    if (secondsSinceDamage >= 5.0) { // Unhit for 5+ seconds!
      // Base regen: 0.012 HP per frame (approx 0.7 HP per second)
      const baseRegen = 0.012;
      
      // Ramping rate: increases rate by 12% for every second above 5s of safety, up to 4.0x max multiplier
      const rampMultiplier = 1.0 + Math.min(3.0, (secondsSinceDamage - 5.0) * 0.12);
      
      player.hp = Math.min(player.maxHp, player.hp + baseRegen * rampMultiplier);
    }
  }

  // Chill slow stacks decay ticking (decays 1 stack every 2 seconds / 120 updates)
  if (player.slowStacks > 0) {
    player.slowTimer = (player.slowTimer || 0) + 1;
    if (player.slowTimer >= 120) {
      player.slowStacks--;
      player.slowTimer = 0;
    }
  } else {
    player.slowTimer = 0;
  }

  // Move projectiles
  projectiles.forEach(p => p.update());
  projectiles = projectiles.filter(p => p.active);

  // Move enemy projectiles
  enemyProjectiles.forEach(ep => ep.update());
  enemyProjectiles = enemyProjectiles.filter(ep => ep.active);

  // Move enemies
  enemies.forEach(e => e.update());
  enemies = enemies.filter(e => e.active);

  // Loot triggers
  groundLoot.forEach(l => l.update());
  groundLoot = groundLoot.filter(l => l.active);

  // Update particles
  particleEffects.forEach(p => {
    p.age++;
    if (p.isBeam) return;
    
    if (p.isProjectileTrail) {
      if (p.vx) p.x += p.vx;
      if (p.vy) p.y += p.vy;
      return;
    }
    
    if (p.isAmbientLeaf) {
      if (p.vx) p.x += p.vx;
      if (p.vy) p.y += p.vy;
      if (p.va) p.angle += p.va;
      
      // Memory leak guard: instantly expire when off-screen boundary is crossed!
      if (p.x < -50 || p.y > 950) {
        p.age = p.maxAge;
      }
      return;
    }
    
    if (p.isSlamRing) {
      // Dynamic dodge-rollable shockwave check
      if (!p.hasHitPlayer && player.hp > 0 && currentGameState === GameState.PLAY) {
        const currentRadius = p.radius * (p.age / p.maxAge);
        const dx = player.x - p.x;
        const dy = player.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Has the expanding shockwave reached the player?
        if (dist <= currentRadius + player.radius) {
          if (player.isRolling) {
            // Player timed a dodge roll perfectly over the shockwave!
            p.hasHitPlayer = true;
            
            particleEffects.push({
              x: player.x,
              y: player.y - 15,
              text: "DODGED!",
              color: "#a7f3d0", // Light emerald green
              age: 0,
              maxAge: 35
            });
          } else {
        // Player hit by shockwave!
        p.hasHitPlayer = true;
        player.hp = Math.max(0, player.hp - 45);
        player.lastDamageTime = Date.now();
            
            particleEffects.push({
              x: player.x,
              y: player.y - 12,
              text: "PILLAR SLAMMED!",
              color: "#ef4444",
              age: 0,
              maxAge: 45
            });
            
            triggerPlayerHitEffect(); // Damage red flash and camera rumble!
            if (!gameMuted) playRipAudioFallback(); // Boom impact sound
            
            if (player.hp <= 0) {
              handlePlayerDeath();
            }
          }
        }
      }
      return;
    }
    
    // float text upwards
    p.y -= 0.6;
  });
  particleEffects = particleEffects.filter(p => p.age < p.maxAge);

  // 1. PROJECTILE VS ENEMY COLLISIONS
  projectiles.forEach(p => {
    enemies.forEach(e => {
      if (!p.active || !e.active || e.isDead) return;
      
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < p.radius + e.radius) {
        // Hit!
        if (e.type === "ape") {
          if (e.isEnrageCasting) {
            // Boss is invulnerable while enraging/channeling!
            p.active = false;
            if (Math.random() < 0.15) {
              particleEffects.push({
                x: e.x + (Math.random() * 20 - 10),
                y: e.y - 20,
                text: "🛡️ SHIELDED",
                color: "#fbbf24",
                age: 0,
                maxAge: 30
              });
            }
            return;
          }
          
          if (!e.enraged) {
            // Clamp health at exactly 33.3% and trigger enrage invincibility casting!
            const threshold = e.maxHp / 3;
            if (e.hp - p.damage < threshold) {
              e.hp = threshold;
              e.isEnrageCasting = true;
              e.enrageTimer = 90;
              e.vx = 0;
              e.vy = 0;
              
              // Spark breaks, arrow pierces
              if (p.isSpark) {
                p.active = false;
              } else {
                p.pierceCount--;
                if (p.pierceCount <= 0) p.active = false;
              }
              
              // Spawn enrage shield indicator
              particleEffects.push({
                x: e.x,
                y: e.y - 45,
                text: "🚨 BOSS ENRAGING! SHIELD UP!",
                color: "#dc2626",
                age: 0,
                maxAge: 90
              });
              
              if (!gameMuted) {
                try {
                  playSynthRoarSound();
                } catch (err) {
                  console.log("Synth roar error:", err);
                }
              }
              
              return;
            }
          }
        }
        
        e.hp -= p.damage;
        e.lastHitTime = Date.now();
        
        // Creg drops loot on hit!
        if (e.type === "banker") {
          const roll = Math.random();
          let dropKey = null;
          if (roll < 0.005) {
            dropKey = "mirror";     // 0.5% chance of Mirror of Kalandra!
          } else if (roll < 0.015) {
            dropKey = "divine";     // 1.0% chance of Divine Orb!
          } else if (roll < 0.055) {
            dropKey = "exalted";    // 4.0% chance of Exalted Orb!
          } else if (roll < 0.095) {
            dropKey = "annulment";  // 4.0% chance of Annulment Orb!
          } else if (roll < 0.175) {
            dropKey = "vaal";       // 8.0% chance of Vaal Orb!
          } else if (roll < 0.425) {
            dropKey = "chaos";      // 25.0% chance of Chaos Orb!
          } else if (roll < 0.575) {
            dropKey = "regal";      // 15.0% chance of Regal Orb!
          } else if (roll < 0.725) {
            dropKey = "alchemy";    // 15.0% chance of Alchemy!
          } else if (roll < 0.825) {
            dropKey = "transmute";  // 10.0% chance of Transmute!
          } else if (roll < 0.925) {
            dropKey = "augmentation";// 10.0% chance of Augmentation!
          } else {
            dropKey = "scroll";     // 7.5% chance of Scroll!
          }
          
          if (dropKey) {
            const lootVal = CURRENCY_CONFIG[dropKey].worth;
            bankerDeductedChaosThisRun += lootVal;
            
            const scatterX = e.x + (Math.random() * 20 - 10);
            const scatterY = e.y + (Math.random() * 20 - 10);
            groundLoot.push(new GroundLoot(scatterX, scatterY, dropKey));
          }
        }
        
        // Spark breaks, arrow pierces
        if (p.isSpark) {
          p.active = false;
        } else {
          p.pierceCount--;
          if (p.pierceCount <= 0) p.active = false;
        }
        
        // Spawn damage splash text
        particleEffects.push({
          x: e.x + (Math.random() * 10 - 5),
          y: e.y - 4,
          text: p.damage,
          color: p.isSpark ? "#67e8f9" : "#fef08a",
          age: 0,
          maxAge: 25
        });

        // Kill check
        // Kill check
        if (e.hp <= 0) {
          if (e.type === "spider" || e.type === "ape") {
            // Melee classic zombie or Ape Boss death collapse!
            e.isDead = true;
            e.deathTimer = e.type === "ape" ? 60 : 45; // Spiders collapse over 45 updates, Ape Boss over 60
            e.vx = 0;
            e.vy = 0;
            
            if (e.type === "ape") {
              activeApeBoss = null; // Clear active reference immediately to restore music and spawn future bosses
            }
            
            // Roll drops! (e.isBoss is true for Ape, rolling 3x items)
            rollMobLoot(e.x, e.y, e.isBoss);
            
            // Award XP (Ape Boss awards massive XP, spiders award 1 XP)
            const xpGained = e.type === "ape" ? 50 : 1;
            awardXp(xpGained);
          } 
          else {
            e.active = false;
            
            if (e.type === "banker") {
              // Defeat jackpot! (Gothic 11-currency explosion)
              const jackpot = [
                "divine", "exalted", "exalted", "annulment", "vaal", "vaal", 
                "chaos", "chaos", "chaos", "chaos", "regal", "regal", 
                "alchemy", "alchemy", "transmute", "augmentation"
              ];
              // 2% chance of extra Mirror jackpot drop!
              if (Math.random() < 0.02) jackpot.push("mirror");
              
              jackpot.forEach(k => {
                const scatterX = e.x + (Math.random() * 30 - 15);
                const scatterY = e.y + (Math.random() * 30 - 15);
                groundLoot.push(new GroundLoot(scatterX, scatterY, k));
                
                const lootVal = CURRENCY_CONFIG[k].worth;
                bankerDeductedChaosThisRun += lootVal;
              });
              
              particleEffects.push({
                x: e.x,
                y: e.y - 20,
                text: "💥 CREG DEFEATED! RESERVES LOOTED!",
                color: "#fbbf24",
                age: 0,
                maxAge: 110
              });
              
              if (bankerDeductedChaosThisRun > 0) {
                submitBankerDeduction(bankerDeductedChaosThisRun);
              }
              
              awardXp(20); // Defeating Creg the Banker awards 20 XP!

              setTimeout(() => {
                syncGameMusic();
              }, 100);
            } else {
              // Roll normal drops!
              rollMobLoot(e.x, e.y, e.isBoss);
              
              // Award XP
              const xpGained = e.isBoss ? 50 : (e.type === "ghost" ? 3 : 1);
              awardXp(xpGained);
            }
          }
        }
      }
    });
  });

  // 2. ENEMY VS PLAYER COLLISIONS
  const now = Date.now();
  enemies.forEach(e => {
    if (e.isDead || !e.active || player.frozen || player.hp <= 0 || currentGameState === GameState.GAMEOVER) return; // Dead, inactive, frozen, or already game over checks
    
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < e.radius + player.radius) {
      if (player.isRolling) return; // Invulnerable frame! Skip hit calculations.
      
      // Hit exile!
      // Knockback exile slightly to prevent instant death
      player.x -= (dx / dist) * 12;
      player.y -= (dy / dist) * 12;
      
      if (e.type === "spider") {
        player.poisonRemaining = (player.poisonRemaining || 0) + e.damage;
        player.lastDamageTime = Date.now();
        triggerPlayerHitEffect(); // Red flash and camera rumble!
        
        // Floating green poison warning text!
        particleEffects.push({
          x: player.x,
          y: player.y - 12,
          text: `🤢 POISONED!`,
          color: "#84cc16",
          age: 0,
          maxAge: 35
        });
      } else {
        player.hp = Math.max(0, player.hp - e.damage);
        player.lastDamageTime = Date.now();
        triggerPlayerHitEffect(); // Red flash and camera rumble!
        
        // Floating damage text
        particleEffects.push({
          x: player.x,
          y: player.y - 12,
          text: `-${e.damage}`,
          color: "#dc2626",
          age: 0,
          maxAge: 30
        });
      }
      
      if (player.hp <= 0) {
        handlePlayerDeath();
      } else {
        if (!gameMuted) playRipAudioFallback(); // ouch tick
      }
    }
  });

  // 3. ENEMY PROJECTILES VS PLAYER COLLISIONS
  enemyProjectiles.forEach(ep => {
    if (!ep.active || player.hp <= 0 || player.isRolling) return;
    
    const dx = ep.x - player.x;
    const dy = ep.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < ep.radius + player.radius) {
      ep.active = false;
      player.hp = Math.max(0, player.hp - ep.damage);
      
      // Apply Chill / Slow Stack! Stacks up to 5 times (3% slow per stack)
      player.slowStacks = Math.min(5, (player.slowStacks || 0) + 1);
      player.slowTimer = 0; // Reset decay timer
      
      // Floating chill stack warning text!
      particleEffects.push({
        x: player.x,
        y: player.y - 12,
        text: `❄️ CHILLED (${player.slowStacks}x)`,
        color: "#a5f3fc",
        age: 0,
        maxAge: 35
      });
      
      triggerPlayerHitEffect(); // Red flash and camera rumble!
      player.lastDamageTime = Date.now();
      if (!gameMuted) playRipAudioFallback();
      
      if (player.hp <= 0) {
        handlePlayerDeath();
      }
    }
  });

  // Camera Shake Decay
  if (cameraShake.duration > 0) {
    cameraShake.duration--;
    const intensity = cameraShake.intensity || 8;
    cameraShake.x = (Math.random() * intensity - intensity / 2);
    cameraShake.y = (Math.random() * intensity - intensity / 2);
  } else {
    cameraShake.x = 0;
    cameraShake.y = 0;
  }

  // Damage Flash Decay
  if (damageFlashIntensity > 0) {
    damageFlashIntensity = Math.max(0, damageFlashIntensity - 0.04); // decay smoothly over 11-12 updates
  }

  // Global death check (Triggers correctly regardless of damage source: lasers, slams, or contact)
  if (player.hp <= 0 && currentGameState === GameState.PLAY) {
    handlePlayerDeath();
  }
}

function applyDeathTax() {
  let hasTaxedAny = false;
  let taxedDetails = [];

  Object.keys(CURRENCY_CONFIG).forEach(key => {
    const qty = playerStash[key] || 0;
    if (qty > 0) {
      let tax = 0;
      if (key === "divine" || key === "mirror") {
        tax = qty < 5 ? 0 : 1;
      } else {
        tax = Math.floor(qty * 0.15);
      }
      
      if (tax > 0) {
        playerStash[key] -= tax;
        lifetimeStash[key] = Math.max(0, lifetimeStash[key] - tax);
        hasTaxedAny = true;
        const conf = CURRENCY_CONFIG[key];
        // Use clean style colors from our currency configuration for standard display
        const dispColor = (key === "scroll" || key === "transmute" || key === "augmentation") ? "#cbd5e1" : (conf.color || "#fff");
        taxedDetails.push(`<span style="color: ${dispColor}; font-weight: bold;">${tax}x ${conf.name}</span>`);
      }
    }
  });

  if (hasTaxedAny) {
    saveLifetimeStash();
    updateStashTabUI();
  }
  
  return taxedDetails;
}

function handlePlayerDeath() {
  currentGameState = GameState.GAMEOVER;
  
  // Calculate and apply death tax immediately
  const taxedDetails = applyDeathTax();
  const breakdownEl = document.getElementById("deathTaxBreakdown");
  if (breakdownEl) {
    if (taxedDetails.length > 0) {
      breakdownEl.innerHTML = `<span class="tax-breakdown-title">⚖️ CREG'S REVENUE COLLECTION (15% TAX):</span><br>` + taxedDetails.join(" | ");
      breakdownEl.classList.remove("hidden");
    } else {
      breakdownEl.innerHTML = `<span class="tax-breakdown-title">🛡️ NO LOOT TO TAX... THIS TIME.</span>`;
      breakdownEl.classList.remove("hidden");
    }
  }

  // Stop all active loop music immediately safely
  try { bgMusic.pause(); } catch(e){}
  try { bossMusic.pause(); } catch(e){}
  try { if (typeof bankerMusic !== "undefined") bankerMusic.pause(); } catch(e){}

  
  // Choose random Dark Souls death messages
  const deathMessages = [
    "FUCK YOU, CREG",
    "STILL SANE, EXILE?",
    "YOU HAVE DIED TO A PILLAR!",
    "CYCLONE RADIUS TOO SMALL!",
    "HARDCORE CHALLENGE COMPLETED... NOT.",
    "CHRIS WILSON HAS DELETED YOUR EXILE"
  ];
  
  const msgIdx = Math.floor(Math.random() * deathMessages.length);
  // Default first run is always "FUCK YOU, CREG" unless they changed it!
  const finalMsg = deathMessages[msgIdx];
  document.getElementById("deathMessage").textContent = finalMsg;
  
  // Show death panel
  document.getElementById("deathScreen").classList.remove("hidden");
  
  // Hide mobile touch virtual controls inside handlePlayerDeath
  const joystickContainer = document.getElementById("virtualJoystickContainer");
  const mobileActionButtons = document.getElementById("mobileActionButtons");
  if (joystickContainer) {
    joystickContainer.style.display = "none";
    joystickContainer.classList.add("hidden");
  }
  if (mobileActionButtons) {
    mobileActionButtons.style.display = "none";
    mobileActionButtons.classList.add("hidden");
  }
  
  // Reset scoreboard forms
  document.getElementById("playerNameInput").disabled = false;
  document.getElementById("btnSubmitScore").disabled = false;
  document.getElementById("submitStatusMsg").textContent = "";
  gameScoreSubmitted = false;
  
  // Play You Died music/chime
  playDarkSoulsYouDiedAudio();
}


// ===================================================
function drawGamePlayScreen() {
  ctx.save();
  ctx.translate(cameraShake.x, cameraShake.y);

  // Parallax Coordinates calculations (scaled to 1600x900 center: 800 and 450)
  const bgOffsetX = -(player.x - 800) * 0.06;
  const bgOffsetY = -(player.y - 450) * 0.06;

  let forestBgActive = false;

  // 1. Far Background Matte Painting (Animated sequence of 8 frames)
  const bgImg = forestBgFrames[forestBgCurrentFrame];
  if (bgImg && bgImg.complete && bgImg.naturalWidth > 0) {
    forestBgActive = true;
  }

  if (forestBgActive) {
    // Draw the forest sequence backdrop at 90% opacity, y from 0 to 360 (split)
    ctx.save();
    ctx.globalAlpha = 0.90;
    const targetW = 1800; // Expanded to cover 1600 width with panning space
    const bgDrawX = 800 - targetW / 2 + bgOffsetX;
    ctx.drawImage(bgImg, bgDrawX, 0, targetW, 360);
    ctx.restore();

    // 1a. Procedural Glowing Red Eyes (strictly within woods zone y: [0, 360])
    forestEyes.forEach(eye => {
      if (eye.opacity > 0) {
        // Map 1600x900 space onto the top 360px with parallax
        const ex = bgDrawX + (eye.x / 1600) * targetW;
        const ey = (eye.y / 900) * 360; // Constrained strictly within [0, 360]!
        
        ctx.save();
        const pulseAmt = Math.sin(eye.pulse) * 0.15 + 0.85;
        const alpha = eye.opacity * pulseAmt;
        
        // Soft red glow bloom backdrop
        const bloomGrad1 = ctx.createRadialGradient(ex - 4, ey, 0, ex - 4, ey, 5);
        bloomGrad1.addColorStop(0, `rgba(239, 68, 68, ${alpha * 0.35})`);
        bloomGrad1.addColorStop(1, "rgba(239, 68, 68, 0)");
        ctx.fillStyle = bloomGrad1;
        ctx.beginPath();
        ctx.arc(ex - 4, ey, 5, 0, Math.PI * 2);
        ctx.fill();
        
        const bloomGrad2 = ctx.createRadialGradient(ex + 4, ey, 0, ex + 4, ey, 5);
        bloomGrad2.addColorStop(0, `rgba(239, 68, 68, ${alpha * 0.35})`);
        bloomGrad2.addColorStop(1, "rgba(239, 68, 68, 0)");
        ctx.fillStyle = bloomGrad2;
        ctx.beginPath();
        ctx.arc(ex + 4, ey, 5, 0, Math.PI * 2);
        ctx.fill();
        
        // Retro pupil cores (glowing red)
        ctx.fillStyle = `rgba(239, 68, 68, ${eye.opacity})`;
        ctx.beginPath();
        ctx.arc(ex - 4, ey, 1.2, 0, Math.PI * 2);
        ctx.arc(ex + 4, ey, 1.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    });

    // 1b. Procedural Drifting Volumetric Fog (strictly within woods zone y: [0, 360])
    forestFogParticles.forEach(f => {
      ctx.save();
      const fx = bgDrawX + (f.x / 1600) * targetW;
      const fy = (f.y / 900) * 360; // Constrained strictly within [0, 360]!
      
      const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, f.radius);
      grad.addColorStop(0, `rgba(30, 64, 175, ${f.opacity})`); // Gorgeous electric blue fog
      grad.addColorStop(0.5, `rgba(30, 58, 138, ${f.opacity * 0.45})`); // Deep night-sky indigo
      grad.addColorStop(1, "rgba(0, 0, 0, 0)");
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(fx, fy, f.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Draw the tiled grass/dirt floor ONLY in rows 4 to 11 (y from 320 to 960), clipped to y >= 360
    const tileSize = 80;
    let allTerrainLoaded = true;
    Object.values(TerrainTiles).forEach(img => {
      if (!img.complete || img.naturalWidth === 0) allTerrainLoaded = false;
    });

    if (allTerrainLoaded && terrainMap.length > 0) {
      ctx.save();
      // Clip to gameplay area below horizon split
      ctx.beginPath();
      ctx.rect(0, 360, canvas.width, canvas.height - 360);
      ctx.clip();

      for (let r = 4; r < mapRows; r++) {
        for (let c = 0; c < mapCols; c++) {
          const tileKey = terrainMap[r][c];
          const img = TerrainTiles[tileKey];
          ctx.drawImage(img, c * tileSize, r * tileSize, tileSize, tileSize);
        }
      }
      
      // Soft shadow transition at the top of the playfield (shading it to deep dark blue/black as it meets the forest)
      const shadowGrad = ctx.createLinearGradient(0, 360, 0, 480);
      shadowGrad.addColorStop(0, "rgba(5, 7, 10, 0.98)"); // solid dark forest shadow
      shadowGrad.addColorStop(0.3, "rgba(5, 7, 10, 0.82)");
      shadowGrad.addColorStop(1, "rgba(5, 7, 10, 0)");     // fades out onto the grass
      ctx.fillStyle = shadowGrad;
      ctx.fillRect(0, 360, canvas.width, 120);
      
      // Volumetric Slate-Blue Drifting Mist overlay (Moody Gothic Atmosphere matching the Pitch Frame)
      const mistGrad = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, canvas.width / 4,
        canvas.width / 2, canvas.height / 2, canvas.width
      );
      mistGrad.addColorStop(0, "rgba(30, 58, 138, 0)");       // clear center
      mistGrad.addColorStop(0.7, "rgba(30, 58, 138, 0.12)");   // soft indigo mist
      mistGrad.addColorStop(1, "rgba(15, 23, 42, 0.48)");     // deep night-sky vignette border
      ctx.fillStyle = mistGrad;
      ctx.fillRect(0, 360, canvas.width, canvas.height - 360);
      
      // Grid lines for bottom - toned down to 0.03 opacity to be organic and seamless!
      ctx.strokeStyle = "rgba(22, 17, 13, 0.03)";
      ctx.lineWidth = 0.5;
      for (let x = 0; x < canvas.width; x += tileSize) {
        ctx.beginPath();
        ctx.moveTo(x, 360);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 360; y < canvas.height; y += tileSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
      ctx.restore();
    } else {
      // Vector fallback grid for bottom 60%
      ctx.fillStyle = "#2d3c34"; // Dark forest green floor
      ctx.fillRect(0, 360, canvas.width, canvas.height - 360);
      ctx.strokeStyle = "rgba(22, 17, 13, 0.3)";
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += tileSize) {
        ctx.beginPath();
        ctx.moveTo(x, 360);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 360; y < canvas.height; y += tileSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }
  } else {
    // DEFAULT FULL TILE FLOOR (if forest background is not active)
    const tileSize = 80;
    let allTerrainLoaded = true;
    Object.values(TerrainTiles).forEach(img => {
      if (!img.complete || img.naturalWidth === 0) allTerrainLoaded = false;
    });

    if (allTerrainLoaded && terrainMap.length > 0) {
      for (let r = 0; r < mapRows; r++) {
        for (let c = 0; c < mapCols; c++) {
          const tileKey = terrainMap[r][c];
          const img = TerrainTiles[tileKey];
          ctx.drawImage(img, c * tileSize, r * tileSize, tileSize, tileSize);
        }
      }
      ctx.strokeStyle = "rgba(22, 17, 13, 0.18)";
      ctx.lineWidth = 0.5;
      for (let x = 0; x < canvas.width; x += tileSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += tileSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    } else {
      // Vector fallback full screen
      ctx.strokeStyle = "#16110d";
      ctx.lineWidth = 1;
      for (let x = 0; x < canvas.width; x += tileSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += tileSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }
    }
  }

  // 2. Render Ground loot items
  groundLoot.forEach(l => l.draw());

  // 3. Render enemies
  enemies.forEach(e => e.draw());

  // 4. Render projectiles
  projectiles.forEach(p => p.draw());
  enemyProjectiles.forEach(ep => ep.draw());

  // 5. Render Particle animations (dodge roll trails and wind leaves now render behind players!)
  drawParticles();

  // 6. Render player Exile
  drawPlayerCharacter();

  // 6.5 Render Foreground Canopy Parallax Layer (anchored strictly at the top 200px, at 90% opacity)
  if (canopyImg.complete && canopyImg.naturalWidth > 0) {
    const targetCanopyW = 2000;
    const canopyOffsetX = -(player.x - 800) * 0.20;
    const canopyDrawX = 800 - targetCanopyW / 2 + canopyOffsetX;
    
    ctx.save();
    ctx.globalAlpha = 0.90; // Solid 90% opacity!
    ctx.drawImage(canopyImg, canopyDrawX, 0, targetCanopyW, 250);
    ctx.restore();
  }

  // 7. Render Epic Boss Health Bar if activeApeBoss is alive! (Repositioned to very bottom center, translucent 45% alpha)
  if (activeApeBoss && activeApeBoss.hp > 0 && !activeApeBoss.isDead) {
    ctx.save();
    ctx.globalAlpha = 0.45; // Sleek 45% translucent alpha overlay
    
    const barW = 800;
    const barH = 20;
    const barX = (canvas.width - barW) / 2;
    const barY = canvas.height - 60; // Placed at the very bottom center
    
    // Draw background panel
    ctx.fillStyle = "rgba(10, 8, 5, 0.75)";
    ctx.strokeStyle = "rgba(217, 119, 6, 0.4)";
    ctx.lineWidth = 1.5;
    ctx.fillRect(barX, barY, barW, barH);
    ctx.strokeRect(barX, barY, barW, barH);
    
    // Draw HP Fill (Red/Gold glow)
    const ratio = activeApeBoss.introActive ? activeApeBoss.introHPProgress : (activeApeBoss.hp / activeApeBoss.maxHp);
    const fillW = barW * Math.min(1.0, Math.max(0.0, ratio));
    
    const grad = ctx.createLinearGradient(barX, barY, barX, barY + barH);
    grad.addColorStop(0, "#ef4444");
    grad.addColorStop(0.5, "#b91c1c");
    grad.addColorStop(1, "#7f1d1d");
    
    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, fillW, barH);
    
    // Draw segmented grid markers (for PoE boss look!)
    ctx.strokeStyle = "rgba(0, 0, 0, 0.35)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 10; i++) {
      const segX = barX + (barW / 10) * i;
      ctx.beginPath();
      ctx.moveTo(segX, barY);
      ctx.lineTo(segX, barY + barH);
      ctx.stroke();
    }
    
    // Draw name and subtitle
    ctx.fillStyle = "#fbbf24";
    ctx.font = "bold 15px Cinzel";
    ctx.textAlign = "center";
    
    const subtitle = activeApeBoss.introActive ? "🚨 PREPARING DESTRUCTION..." : (activeApeBoss.enraged ? "🔥 ENRAGED BOSS COMBOS ACTIVE! 🔥" : "Wielder of Seismic Slams");
    ctx.fillText(`OLE-APE PILLAR DEMON - ${subtitle}`, canvas.width / 2, barY - 8);
    
    ctx.restore();
  }

  // 8. Render full-screen red damage vignette if damageFlashIntensity > 0
  if (damageFlashIntensity > 0) {
    ctx.save();
    ctx.resetTransform();
    
    // Draw full-screen vignette
    const grad = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, canvas.height / 3,
      canvas.width / 2, canvas.height / 2, canvas.width / 2
    );
    grad.addColorStop(0, "rgba(239, 68, 68, 0)");
    grad.addColorStop(1, `rgba(185, 28, 28, ${damageFlashIntensity})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Also draw a subtle full screen solid flash
    ctx.fillStyle = `rgba(239, 68, 68, ${damageFlashIntensity * 0.25})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.restore();
  }

  ctx.restore();
}

function drawPlayerCharacter() {
  ctx.save();
  
  // Glowing freeze indicator if frozen
  if (player.frozen) {
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius + 4, 0, Math.PI*2);
    ctx.fillStyle = "rgba(6, 182, 212, 0.4)";
    ctx.strokeStyle = "#22d3ee";
    ctx.lineWidth = 1.5;
    ctx.fill();
    ctx.stroke();
  }
  
  const img = PlayerSprites.ranger;
  if (player.class === "Ranger" && img && img.complete && img.naturalWidth > 0) {
    const cols = 8;
    const rows = 7;
    const frameW = img.naturalWidth / cols;
    const frameH = img.naturalHeight / rows;
    
    // Row selection logic based on state
    let activeRow = 0; // Default Row 1: Idle (index 0)
    
    if (player.hp <= 0) {
      activeRow = 1; // Row 2: Death (index 1)
    } 
    else if (player.isRolling) {
      activeRow = 6; // Row 7: Dodge Roll (index 6)
    }
    else if (Date.now() - player.lastShotTime < 150) {
      activeRow = 5; // Row 6: Spreadshot (index 5)
    } 
    else if (Math.abs(player.vx) > 0.1 || Math.abs(player.vy) > 0.1) {
      const isMovingDiagonally = (player.vx !== 0 && player.vy !== 0);
      activeRow = isMovingDiagonally ? 3 : 2; // Row 4: Turning (index 3) OR Row 3: Walk (index 2)
    }
    
    // Column frame index select
    let activeCol = playerAnimFrame;
    if (player.hp <= 0) {
      activeCol = 7; // Final dead pose (frame 7 of Row 2)
    } else if (player.isRolling) {
      // Sync frame column indices perfectly to physics progression ratio
      const ratio = (player.rollDuration - player.rollTimer) / player.rollDuration;
      activeCol = Math.min(7, Math.floor(ratio * 8));
    }
    
    const srcX = activeCol * frameW;
    const srcY = activeRow * frameH;
    
    // Ambient circle dropshadow
    ctx.beginPath();
    ctx.ellipse(player.x, player.y + 27.5, 20, 7.5, 0, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fill();
    
    // Render the high-resolution Ranger sprite frame
    const drawW = 95;
    const drawH = drawW * (frameH / frameW);
    ctx.drawImage(
      img,
      srcX, srcY,
      frameW, frameH,
      player.x - drawW / 2, player.y - drawH / 2 - 5,
      drawW, drawH
    );
  } else {
    // Elegant gothic vector circle fallback
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
    ctx.fillStyle = player.class === "Witch" ? "#581c87" : "#0f766e"; // purple Witch, cyan Ranger
    ctx.strokeStyle = "#ffd700";
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    
    ctx.beginPath();
    ctx.arc(player.x, player.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
  }

  ctx.restore();
}

function drawParticles() {
  ctx.save();
  
  particleEffects.forEach(p => {
    if (p.isBeam) {
      // Draw flashing laser beam line
      ctx.beginPath();
      ctx.moveTo(p.startX, p.startY);
      ctx.lineTo(p.endX, p.endY);
      ctx.strokeStyle = p.color;
      ctx.lineWidth = 4 * (1 - p.age / p.maxAge);
      ctx.stroke();
    } 
    else if (p.isSlamRing) {
      // Draw expanding shockwave circles
      const pct = p.age / p.maxAge;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * pct, 0, Math.PI * 2);
      ctx.strokeStyle = p.color || `rgba(239, 68, 68, ${1 - pct})`;
      ctx.lineWidth = 4 * (1 - pct);
      
      // Add glowing energy bloom to shockwaves
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 15 * (1 - pct);
      ctx.stroke();
      ctx.shadowBlur = 0; // reset
    } 
    else if (p.isAmbientLeaf) {
      // Draw simple organic pointed leaves drifting with wind
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.beginPath();
      ctx.ellipse(0, 0, p.radius * 1.8, p.radius * 0.8, 0, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 0.55; // semi-translucent for depth
      ctx.fill();
      ctx.restore();
    }
    else if (p.isProjectileTrail) {
      // Draw small glowing particle trails
      const pct = p.age / p.maxAge;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius * (1 - pct), 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 5 * (1 - pct);
      ctx.fill();
      ctx.shadowBlur = 0; // reset
    }
    else if (p.isTrail) {
      const opacity = 1 - (p.age / p.maxAge);
      ctx.beginPath();
      ctx.arc(p.x, p.y, player.radius * 0.95, 0, Math.PI * 2);
      ctx.fillStyle = p.color.replace("0.42", (0.42 * opacity).toFixed(2)).replace("0.45", (0.45 * opacity).toFixed(2));
      ctx.fill();
    }
    else {
      // Standard floating texts
      ctx.font = "bold 8.5px Inter";
      ctx.fillStyle = p.color;
      ctx.textAlign = "center";
      ctx.fillText(p.text, p.x, p.y);
    }
  });

  ctx.restore();
}

function drawHUD() {
  // Update HTML elements directly for accurate bars
  const hpPct = Math.min(100, Math.max(0, (player.hp / player.maxHp) * 100));
  const xpPct = Math.min(100, Math.max(0, (player.xp / player.maxXp) * 100));
  
  const healthBar = document.getElementById("gameHealthBar");
  if (healthBar) {
    healthBar.style.width = `${hpPct}%`;
    if (player.poisonRemaining > 0) {
      healthBar.style.background = "linear-gradient(90deg, #3f6212 0%, #84cc16 100%)"; // Sickly green
      healthBar.style.boxShadow = "0 0 10px rgba(132, 204, 22, 0.4)";
    } else {
      healthBar.style.background = ""; // Default red
      healthBar.style.boxShadow = "";
    }
  }
  document.getElementById("gameHealthText").textContent = `HP: ${Math.ceil(player.hp)}/${player.maxHp}`;
  
  document.getElementById("gameXpBar").style.width = `${xpPct}%`;
  document.getElementById("gameXpText").textContent = `XP: Level ${player.level} (${Math.floor(xpPct)}%)`;
}

function drawLevelUpScreen() {
  ctx.save();
  
  // 1. Semi-transparent dark gold frosted overlay
  ctx.fillStyle = "rgba(10, 8, 5, 0.88)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // 2. Inner glow border
  ctx.strokeStyle = "rgba(217, 119, 6, 0.35)";
  ctx.lineWidth = 4;
  ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);
  
  // 3. Header title
  ctx.fillStyle = "#ffd700";
  ctx.font = "bold 24px Cinzel";
  ctx.textAlign = "center";
  ctx.fillText("CHOOSE YOUR REWARD EXILE", canvas.width / 2, 55);
  
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "10px Inter";
  ctx.fillText("Select a stat to level up. Or spend 10 Exalted Orbs for a double boost!", canvas.width / 2, 80);
  
  // 4. Draw Cards
  const cardW = 240;
  const cardH = 340;
  const y = 280;
  const spacing = 50;
  const startX = (1600 - (3 * cardW + 2 * spacing)) / 2;
  
  for (let i = 0; i < levelUpChoices.length; i++) {
    const choice = levelUpChoices[i];
    const x = startX + i * (cardW + spacing);
    
    // Save coordinate anchors for click registration
    choice.x = x;
    choice.y = y;
    choice.w = cardW;
    choice.h = cardH;
    
    const isHovered = (mousePos.x >= x && mousePos.x <= x + cardW && mousePos.y >= y && mousePos.y <= y + cardH);
    
    // Draw Card Background
    ctx.fillStyle = isHovered ? "rgba(45, 26, 8, 0.95)" : "rgba(21, 13, 4, 0.9)";
    ctx.strokeStyle = isHovered ? "#fbbf24" : "#d97706";
    ctx.lineWidth = isHovered ? 2.5 : 1.5;
    
    ctx.fillRect(x, y, cardW, cardH);
    ctx.strokeRect(x, y, cardW, cardH);
    
    // Card Icon / Title
    ctx.font = "40px Arial";
    ctx.fillText(choice.icon, x + cardW / 2, y + 60);
    
    ctx.fillStyle = isHovered ? "#fff" : "#fbbf24";
    ctx.font = "bold 18px Cinzel";
    ctx.fillText(choice.title, x + cardW / 2, y + 115);
    
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "13px Inter";
    ctx.fillText(choice.desc, x + cardW / 2, y + 150);
    
    // 5. Draw Standard Option Button
    const btnStdX = x + 20;
    const btnStdY = y + 190;
    const btnStdW = cardW - 40;
    const btnStdH = 45;
    
    const isHoveredStd = (mousePos.x >= btnStdX && mousePos.x <= btnStdX + btnStdW && mousePos.y >= btnStdY && mousePos.y <= btnStdY + btnStdH);
    ctx.fillStyle = isHoveredStd ? "rgba(16, 185, 129, 0.25)" : "rgba(0,0,0,0.5)";
    ctx.strokeStyle = isHoveredStd ? "#10b981" : "#059669";
    ctx.lineWidth = 1.5;
    ctx.fillRect(btnStdX, btnStdY, btnStdW, btnStdH);
    ctx.strokeRect(btnStdX, btnStdY, btnStdW, btnStdH);
    
    ctx.fillStyle = isHoveredStd ? "#34d399" : "#a7f3d0";
    ctx.font = "bold 14px Cinzel";
    ctx.fillText(`STANDARD: ${choice.standard}`, btnStdX + btnStdW / 2, btnStdY + 28);
    
    // 6. Draw Exalted Option Button
    const btnExX = x + 20;
    const btnExY = y + 255;
    const btnExW = cardW - 40;
    const btnExH = 50;
    
    const hasExalts = (playerStash.exalted >= 10);
    const isHoveredEx = (hasExalts && mousePos.x >= btnExX && mousePos.x <= btnExX + btnExW && mousePos.y >= btnExY && mousePos.y <= btnExY + btnExH);
    
    if (hasExalts) {
      ctx.fillStyle = isHoveredEx ? "rgba(245, 158, 11, 0.35)" : "rgba(67, 20, 7, 0.65)";
      ctx.strokeStyle = isHoveredEx ? "#fbbf24" : "#f97316";
    } else {
      ctx.fillStyle = "rgba(40, 40, 40, 0.4)";
      ctx.strokeStyle = "#4b5563";
    }
    ctx.lineWidth = hasExalts && isHoveredEx ? 2 : 1.5;
    ctx.fillRect(btnExX, btnExY, btnExW, btnExH);
    ctx.strokeRect(btnExX, btnExY, btnExW, btnExH);
    
    if (hasExalts) {
      ctx.fillStyle = isHoveredEx ? "#fff" : "#fdba74";
      ctx.font = "bold 14px Cinzel";
      ctx.fillText(`EXALTED: ${choice.exalted}`, btnExX + btnExW / 2, btnExY + 22);
      ctx.fillStyle = "#fbbf24";
      ctx.font = "bold 11px Inter";
      ctx.fillText("COSTS 10 👑 ORBS", btnExX + btnExW / 2, btnExY + 38);
    } else {
      ctx.fillStyle = "#6b7280";
      ctx.font = "bold 14px Cinzel";
      ctx.fillText("EXALTED LOCKED", btnExX + btnExW / 2, btnExY + 22);
      ctx.font = "11px Inter";
      ctx.fillText(`NEEDS 10 👑 (HAVE ${playerStash.exalted})`, btnExX + btnExW / 2, btnExY + 37);
    }
  }
  
  ctx.restore();
}


// ==========================================================================
// 11. GAME LOOPS MANAGERS & RESETS
// ==========================================================================

// Gothic glassmorphic pause screen overlay drawing
function drawPauseOverlay() {
  ctx.save();
  // Semi-transparent overlay to darken play area
  ctx.fillStyle = "rgba(10, 8, 6, 0.75)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  
  // Imposing Red/Gold Pause Header
  ctx.fillStyle = "#fbbf24";
  ctx.font = "bold 44px Cinzel";
  ctx.textAlign = "center";
  ctx.fillText("GRIND TEMPORARILY SUSPENDED", canvas.width / 2, canvas.height / 2 - 40);
  
  // Retro secondary message
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "bold 22px Cinzel";
  ctx.fillText("PRESS 'P' OR CLICK RESUME TO AWAKEN", canvas.width / 2, canvas.height / 2 + 20);
  ctx.restore();
}

function updateGame() {
  // Update music crossfading volumes on every frame across all states
  syncGameMusic();

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentGameState === GameState.SELECT) {
    // Draw lobby
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = varColorText("--gold-hover", "#ffd700");
    ctx.font = "bold 38px Cinzel";
    ctx.textAlign = "center";
    ctx.fillText("GLG GUILD ARCADE", canvas.width / 2, 300);
    
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "16px Inter";
    ctx.fillText("Defeat spiders and freeze ghosts. Survive the giant slam monkey's pillar of doom!", canvas.width / 2, 360);
    ctx.fillStyle = varColorText("--gold-faded", "#b8860b");
    ctx.fillText("All collected currencies dynamically stack inside your Stash Tab. Score = Net Worth!", canvas.width / 2, 400);
    
    ctx.fillStyle = "#fff8d4";
    ctx.font = "bold 20px Cinzel";
    ctx.fillText("TAP OR PRESS WASD KEYS TO AWAKEN", canvas.width / 2, 550);
  } 
  else if (currentGameState === GameState.PLAY) {
    if (gamePaused) {
      // Freeze active updates but keep rendering background scenes and overlays
      drawGamePlayScreen();
      drawHUD();
      drawPauseOverlay();
    } else {
      // Inputs & Combat triggers
      handleInput();
      executePlayerAutoShooting();
      handleEnemySpawning();
      
      // Physics and updates
      processGamePhysics();
      
      // Player Sprite Animation Tick
      playerAnimTick++;
      if (playerAnimTick >= 6) {
        playerAnimTick = 0;
        playerAnimFrame = (playerAnimFrame + 1) % 8;
      }
      
      // Draw scenes
      drawGamePlayScreen();
      drawHUD();
    }
  } 
  else if (currentGameState === GameState.LEVEL_UP) {
    drawGamePlayScreen();
    drawHUD();
    drawLevelUpScreen();
  }
  else if (currentGameState === GameState.GAMEOVER) {
    // Keep rendering background but frosted over
    drawGamePlayScreen();
    
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  requestAnimationFrame(updateGame);
}

function varColorText(cssVar, fallback) {
  try {
    const val = getComputedStyle(document.documentElement).getPropertyValue(cssVar);
    return (val && val.trim()) ? val.trim() : fallback;
  } catch (e) {
    return fallback;
  }
}

function resetGame() {
  gamePaused = false;
  const btnPause = document.getElementById("btnPauseGame");
  if (btnPause) {
    btnPause.innerHTML = "⏸️ PAUSE";
    btnPause.classList.remove("active-pause");
  }

  // Reset and pause music tracks safely
  try { bgMusic.pause(); } catch(e){}
  try { bossMusic.pause(); } catch(e){}
  try {
    if (typeof bankerMusic !== "undefined") {
      bankerMusic.pause();
      bankerMusic.currentTime = 0;
    }
  } catch(e){}
  try { bgMusic.currentTime = 0; } catch(e){}
  try { bossMusic.currentTime = 0; } catch(e){}

  // Clear live banker deduction tally
  bankerDeductedChaosThisRun = 0;

  // Hide the death tax breakdown on reset
  const breakdownEl = document.getElementById("deathTaxBreakdown");
  if (breakdownEl) {
    breakdownEl.classList.add("hidden");
    breakdownEl.innerHTML = "";
  }

  // Clear entities
  projectiles = [];
  enemyProjectiles = [];
  enemies = [];
  groundLoot = [];
  particleEffects = [];
  activeApeBoss = null;
  
  // Wave state
  wave = 1;
  lastWaveSpawnTime = 0;
  document.getElementById("gameWaveText").textContent = wave;

  // Stash clear
  playerStash = {
    scroll: 0,
    transmute: 0,
    augmentation: 0,
    alchemy: 0,
    regal: 0,
    chaos: 0,
    vaal: 0,
    annulment: 0,
    exalted: 0,
    divine: 0,
    mirror: 0
  };
  updateStashTabUI();

  // Reset player animation variables
  playerAnimFrame = 0;
  playerAnimTick = 0;
  lastPlayerDirectionRow = 0;

  // Reset player coordinates and stats
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
  player.vx = 0;
  player.vy = 0;
  player.level = 1;
  player.xp = 0;
  player.maxXp = 150;
  player.radius = 30;
  player.frozen = false;
  player.freezeTimer = 0;
  player.slowStacks = 0;
  player.slowTimer = 0;
  player.poisonRemaining = 0;
  
  if (player.class === "Witch") {
    setWitchClass();
  } else {
    setRangerClass();
  }
  
  // Hide panels, start screen & instructions overlays
  document.getElementById("deathScreen").classList.add("hidden");
  const startScr = document.getElementById("startScreen");
  if (startScr) startScr.classList.add("hidden");
  const instScr = document.getElementById("instructionsScreen");
  if (instScr) instScr.classList.add("hidden");
  
  // Show active game HUD overlay
  const hud = document.querySelector(".game-ui-overlay");
  if (hud) hud.classList.remove("hidden");
  
  // Show mobile touch virtual controls when gameplay starts on mobile
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth <= 1024);
  if (isMobile) {
    const joystickContainer = document.getElementById("virtualJoystickContainer");
    const mobileActionButtons = document.getElementById("mobileActionButtons");
    if (joystickContainer) {
      joystickContainer.style.display = "flex";
      joystickContainer.classList.remove("hidden");
    }
    if (mobileActionButtons) {
      mobileActionButtons.style.display = "flex";
      mobileActionButtons.classList.remove("hidden");
    }
  }
  
  // Re-initialize procedural forest effects
  initProceduralFog();
  initProceduralEyes();
  
  currentGameState = GameState.PLAY;
  
  // Automatically collapse simulated server stock ticker on gameplay start
  try {
    collapseStockTickerOnStart();
  } catch (err) {
    console.log("Collapse stock ticker error:", err);
  }
}

function playDodgeRollAudioFeedback() {
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = "triangle";
    osc.frequency.setValueAtTime(140, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(750, audioCtx.currentTime + 0.14);
    
    gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0.001, audioCtx.currentTime + 0.14);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    
    osc.start();
    osc.stop(audioCtx.currentTime + 0.16);
  } catch (err) {
    // blocked
  }
}

function triggerPlayerDodgeRoll() {
  if (currentGameState !== GameState.PLAY || player.frozen || player.hp <= 0 || player.isRolling) return;
  
  const now = Date.now();
  if (now - player.lastRollTime < player.rollCooldown) return;
  
  // Determine direction based on current movement keys
  let rollDx = 0;
  let rollDy = 0;
  
  if (keys.w || keys.ArrowUp) rollDy = -1;
  if (keys.s || keys.ArrowDown) rollDy = 1;
  if (keys.a || keys.ArrowLeft) rollDx = -1;
  if (keys.d || keys.ArrowRight) rollDx = 1;
  
  // If player is standing still, roll in their last direction
  if (rollDx === 0 && rollDy === 0) {
    if (lastPlayerDirectionRow === 1) rollDy = -1;     // Up
    else if (lastPlayerDirectionRow === 2) rollDx = -1;  // Left
    else if (lastPlayerDirectionRow === 3) rollDx = 1;   // Right
    else rollDy = 1;                                    // Down
  }
  
  const len = Math.sqrt(rollDx * rollDx + rollDy * rollDy);
  const vx = (rollDx / len) * player.speed * player.rollSpeedMultiplier;
  const vy = (rollDy / len) * player.speed * player.rollSpeedMultiplier;
  
  player.isRolling = true;
  player.rollTimer = player.rollDuration;
  player.rollVx = vx;
  player.rollVy = vy;
  player.lastRollTime = now;
  
  // Create an initial trail burst
  for (let i = 0; i < 3; i++) {
    particleEffects.push({
      x: player.x + (Math.random() * 8 - 4),
      y: player.y + (Math.random() * 8 - 4),
      isTrail: true,
      color: player.class === "Ranger" ? "rgba(15, 118, 110, 0.45)" : "rgba(88, 28, 135, 0.45)",
      age: 0,
      maxAge: 14
    });
  }
  
  if (!gameMuted) {
    playDodgeRollAudioFeedback();
  }
}

// Trigger Ranger's active Spreadshot ability (E Key, 1.5s Cooldown)
function triggerPlayerSpreadshot() {
  if (currentGameState !== GameState.PLAY || player.frozen || player.hp <= 0 || player.class !== "Ranger") return;
  
  const now = Date.now();
  if (now - player.lastSpreadshotTime < player.spreadshotCooldown) return;
  
  // Find target angle based on closest active enemy
  let angle = 0;
  let closestEnemy = null;
  let closestDist = Infinity;
  enemies.forEach(e => {
    if (e.isDead || !e.active) return;
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < closestDist) {
      closestDist = dist;
      closestEnemy = e;
    }
  });
  
  if (closestEnemy) {
    angle = Math.atan2(closestEnemy.y - player.y, closestEnemy.x - player.x);
  } else {
    angle = Math.atan2(player.vy, player.vx);
    if (player.vx === 0 && player.vy === 0) angle = -Math.PI/2; // shoots up if still
  }
  
  player.lastSpreadshotTime = now;
  player.lastShotTime = now; // sync animation visual triggers
  
  const speed = 7.0;
  const numArrows = 8;
  
  // Fire 8 arrows in a wide spread fan!
  for (let i = 0; i < numArrows; i++) {
    const ang = angle - 0.7 + (i / (numArrows - 1)) * 1.4;
    const vx = Math.cos(ang) * speed;
    const vy = Math.sin(ang) * speed;
    projectiles.push(new GameProjectile(player.x, player.y, vx, vy, "#38bdf8", player.damage * 1.25, false));
  }
  
  // Visual ability splash text particle above player
  particleEffects.push({
    x: player.x,
    y: player.y - 18,
    text: "🏹 SPREADSHOT!",
    color: "#f59e0b",
    age: 0,
    maxAge: 40
  });
  
  // Fancy ability sparkles
  for (let i = 0; i < 6; i++) {
    particleEffects.push({
      x: player.x + (Math.random() * 16 - 8),
      y: player.y + (Math.random() * 16 - 8),
      isTrail: true,
      color: "rgba(245, 158, 11, 0.42)",
      age: 0,
      maxAge: 16
    });
  }
  
  if (!gameMuted) {
    try {
      playSynthSpreadshotSound();
    } catch(err){}
  }
}

// Bind keyboard
window.addEventListener("keydown", (e) => {
  if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")) {
    return;
  }

  if (e.key === "p" || e.key === "P") {
    e.preventDefault();
    toggleGamePause();
    return;
  }

  if (e.key === "t" || e.key === "T") {
    e.preventDefault();
    toggleTheatreMode();
    return;
  }

  if (e.key === "f" || e.key === "F") {
    e.preventDefault();
    toggleFullscreenMode();
    return;
  }

  if (e.key === " " || e.key === "Spacebar") {
    e.preventDefault();
    if (gamePaused) return;
    triggerPlayerDodgeRoll();
    return;
  }
  
  if (e.key === "e" || e.key === "E") {
    e.preventDefault();
    if (gamePaused) return;
    triggerPlayerSpreadshot();
    return;
  }

  if (e.key === "v" || e.key === "V") {
    e.preventDefault();
    toggleItemLabels();
    return;
  }
  
  if (["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
    keys[e.key] = true;
    e.preventDefault();
    if (currentGameState === GameState.SELECT) {
      resetGame();
    }
  }
});

window.addEventListener("keyup", (e) => {
  if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")) {
    return;
  }

  if (["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
    keys[e.key] = false;
  }
});

// Canvas click also starts game or selects level-up options
canvas.addEventListener("click", (e) => {
  if (currentGameState === GameState.SELECT) {
    resetGame();
    return;
  }
  
  if (currentGameState === GameState.LEVEL_UP) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;
    
    handleLevelUpClick(clickX, clickY);
  }
});

// Canvas mousemove tracks hover states inside level-up UI
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  mousePos.x = (e.clientX - rect.left) * scaleX;
  mousePos.y = (e.clientY - rect.top) * scaleY;
});


// Looping High-Resolution Ranger Keybind Previews
function animateKeybindPreviews() {
  const moveCanvas = document.getElementById("kbMoveCanvas");
  const rollCanvas = document.getElementById("kbRollCanvas");
  const shootCanvas = document.getElementById("kbShootCanvas");
  
  const moveCtx = moveCanvas ? moveCanvas.getContext("2d") : null;
  const rollCtx = rollCanvas ? rollCanvas.getContext("2d") : null;
  const shootCtx = shootCanvas ? shootCanvas.getContext("2d") : null;
  
  if (moveCtx) {
    moveCtx.imageSmoothingEnabled = false;
    moveCtx.mozImageSmoothingEnabled = false;
    moveCtx.webkitImageSmoothingEnabled = false;
  }
  if (rollCtx) {
    rollCtx.imageSmoothingEnabled = false;
    rollCtx.mozImageSmoothingEnabled = false;
    rollCtx.webkitImageSmoothingEnabled = false;
  }
  if (shootCtx) {
    shootCtx.imageSmoothingEnabled = false;
    shootCtx.mozImageSmoothingEnabled = false;
    shootCtx.webkitImageSmoothingEnabled = false;
  }
  
  let kbFrame = 0;
  
  function tick() {
    const img = PlayerSprites.ranger;
    if (!img || !img.complete || img.naturalWidth === 0) return;
    
    const cols = 8;
    const rows = 7;
    const frameW = img.naturalWidth / cols;
    const frameH = img.naturalHeight / rows;
    
    const drawW = 34;
    const drawH = drawW * (frameH / frameW);
    
    // Move/Walk: row index 2
    if (moveCtx && moveCanvas) {
      moveCtx.clearRect(0, 0, moveCanvas.width, moveCanvas.height);
      moveCtx.drawImage(
        img,
        kbFrame * frameW, 2 * frameH,
        frameW, frameH,
        (moveCanvas.width - drawW) / 2, (moveCanvas.height - drawH) / 2 + 1,
        drawW, drawH
      );
    }
    
    // Roll: row index 6
    if (rollCtx && rollCanvas) {
      rollCtx.clearRect(0, 0, rollCanvas.width, rollCanvas.height);
      rollCtx.drawImage(
        img,
        kbFrame * frameW, 6 * frameH,
        frameW, frameH,
        (rollCanvas.width - drawW) / 2, (rollCanvas.height - drawH) / 2 + 1,
        drawW, drawH
      );
    }
    
    // Spreadshot / Shoot: row index 5
    if (shootCtx && shootCanvas) {
      shootCtx.clearRect(0, 0, shootCanvas.width, shootCanvas.height);
      shootCtx.drawImage(
        img,
        kbFrame * frameW, 5 * frameH,
        frameW, frameH,
        (shootCanvas.width - drawW) / 2, (shootCanvas.height - drawH) / 2 + 1,
        drawW, drawH
      );
    }
    
    kbFrame = (kbFrame + 1) % 8;
  }
  
  setInterval(tick, 100);
}


// ==========================================================================
// 12a. GLOBAL PAGE VIDEO ANIMATIONS TOGGLE ENGINE
// ==========================================================================

let animationsEnabled = true;

function loadAnimationsPreference() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth <= 1024);
  if (isMobile) {
    animationsEnabled = false; // Disable heavy loops on mobile by default!
  } else {
    try {
      const saved = localStorage.getItem("GLG_ANIMATIONS_ENABLED");
      if (saved !== null) {
        animationsEnabled = saved === "true";
      }
    } catch (e) {
      console.error(e);
    }
  }
  updateAnimationsState();
}

function saveAnimationsPreference() {
  try {
    localStorage.setItem("GLG_ANIMATIONS_ENABLED", animationsEnabled.toString());
  } catch (e) {
    console.error(e);
  }
}

function updateAnimationsState() {
  const btn = document.getElementById("btnFloatingAnimToggle");
  const bgVideo = document.getElementById("bgVideoLoop");
  const headerVideo = document.getElementById("headerLogoVideo");
  const wrapper = document.getElementById("backgroundOverlayWrapper");
  
  if (animationsEnabled) {
    if (bgVideo) {
      bgVideo.play().catch(err => console.log("Video play pending interaction:", err));
      bgVideo.classList.remove("hidden");
    }
    if (headerVideo) {
      headerVideo.play().catch(err => console.log("Header video play pending interaction:", err));
    }
    if (wrapper) {
      wrapper.style.backgroundImage = "none";
    }
    if (btn) {
      btn.classList.remove("disabled");
      btn.innerHTML = "🎬"; // Play symbol clapper board
      btn.title = "Pause Background & Sign Animations";
    }
  } else {
    if (bgVideo) {
      bgVideo.pause();
      bgVideo.classList.add("hidden");
    }
    if (headerVideo) {
      headerVideo.pause();
      headerVideo.currentTime = 0;
    }
    if (wrapper) {
      wrapper.style.backgroundImage = "url('assets/images/backgrounds/GLG_guild-hall_background-image.png')";
    }
    if (btn) {
      btn.classList.add("disabled");
      btn.innerHTML = "⏸️"; // Paused matching emoji indicator
      btn.title = "Play Background & Sign Animations";
    }
  }
}

function toggleAnimations() {
  animationsEnabled = !animationsEnabled;
  saveAnimationsPreference();
  updateAnimationsState();
}

function toggleTheatreMode() {
  const isTheatre = document.body.classList.toggle("theatre-mode-active");
  const btn = document.getElementById("btnToggleTheatre");
  if (btn) {
    btn.textContent = isTheatre ? "🎬 THEATRE: ON" : "🎬 THEATRE: OFF";
    btn.classList.toggle("active-theatre", isTheatre);
  }
}

function toggleFullscreenMode() {
  const container = document.querySelector(".game-viewport-container");
  if (!container) return;
  
  if (!document.fullscreenElement) {
    container.requestFullscreen().catch(err => {
      console.error(`Error attempting to enable fullscreen: ${err.message}`);
    });
  } else {
    document.exitFullscreen().catch(err => {
      console.error(`Error attempting to exit fullscreen: ${err.message}`);
    });
  }
}

// Pause game engine state toggler
function toggleGamePause() {
  if (currentGameState !== GameState.PLAY) return;
  gamePaused = !gamePaused;
  const btnPause = document.getElementById("btnPauseGame");
  if (btnPause) {
    btnPause.innerHTML = gamePaused ? "▶️ RESUME" : "⏸️ PAUSE";
    btnPause.classList.toggle("active-pause", gamePaused);
  }
  
  // Pause/Resume music tracks via global crossfader
  syncGameMusic();
}

// Mobile touch joystick setup
function initVirtualJoystick() {
  const joystickContainer = document.getElementById("virtualJoystickContainer");
  const joystickKnob = document.getElementById("joystickKnob");
  const mobileActionButtons = document.getElementById("mobileActionButtons");
  
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || (window.innerWidth <= 1024);
  
  if (!isMobile) {
    if (joystickContainer) joystickContainer.style.display = "none";
    if (mobileActionButtons) mobileActionButtons.style.display = "none";
    return;
  }
  
  // By default, keep touch controls hidden inside character select lobby screen!
  if (joystickContainer) {
    joystickContainer.style.display = "none";
    joystickContainer.classList.add("hidden");
  }
  if (mobileActionButtons) {
    mobileActionButtons.style.display = "none";
    mobileActionButtons.classList.add("hidden");
  }
  
  if (!joystickContainer || !joystickKnob) return;
  
  let rect = joystickContainer.getBoundingClientRect();
  let centerX = rect.left + rect.width / 2;
  let centerY = rect.top + rect.height / 2;
  const maxRadius = 40; // Clamping pixel limit
  
  window.addEventListener("resize", () => {
    rect = joystickContainer.getBoundingClientRect();
    centerX = rect.left + rect.width / 2;
    centerY = rect.top + rect.height / 2;
  });
  
  function handleTouchStart(e) {
    e.preventDefault();
    rect = joystickContainer.getBoundingClientRect();
    centerX = rect.left + rect.width / 2;
    centerY = rect.top + rect.height / 2;
    joystickActive = true;
    
    if (currentGameState === GameState.SELECT) {
      resetGame();
    }
  }
  
  function handleTouchMove(e) {
    if (!joystickActive) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const dx = touch.clientX - centerX;
    const dy = touch.clientY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist === 0) {
      joystickMoveX = 0;
      joystickMoveY = 0;
      joystickKnob.style.transform = "translate(0px, 0px)";
      return;
    }
    
    const clampedDist = Math.min(dist, maxRadius);
    const angle = Math.atan2(dy, dx);
    const kx = Math.cos(angle) * clampedDist;
    const ky = Math.sin(angle) * clampedDist;
    
    joystickKnob.style.transform = `translate(${kx}px, ${ky}px)`;
    
    // Normalize to [-1, 1] bounds
    joystickMoveX = dx / dist;
    joystickMoveY = dy / dist;
  }
  
  function handleTouchEnd(e) {
    e.preventDefault();
    joystickActive = false;
    joystickMoveX = 0;
    joystickMoveY = 0;
    joystickKnob.style.transform = "translate(0px, 0px)";
  }
  
  joystickContainer.addEventListener("touchstart", handleTouchStart, { passive: false });
  joystickContainer.addEventListener("touchmove", handleTouchMove, { passive: false });
  joystickContainer.addEventListener("touchend", handleTouchEnd, { passive: false });
}


// ==========================================================================
// 12. INITIALIZATION EVENT CONTROLLERS
// ==========================================================================

function initGameEngine() {
  // Load background and header sign animation state preference
  loadAnimationsPreference();
  
  // 1. Selector bindings
  const btnWitch = document.getElementById("btnSelectWitch");
  const btnRanger = document.getElementById("btnSelectRanger");
  
  if (btnWitch) {
    btnWitch.addEventListener("click", () => {
      if (currentGameState === GameState.SELECT) {
        setWitchClass();
      }
    });
  }
  
  if (btnRanger) {
    btnRanger.addEventListener("click", () => {
      if (currentGameState === GameState.SELECT) {
        setRangerClass();
      }
    });
  }
  
  // 2. Restart and Leaderboard Submission Bindings
  const btnRestart = document.getElementById("btnRestartGame");
  if (btnRestart) {
    btnRestart.addEventListener("click", resetGame);
  }
  
  const btnSubmit = document.getElementById("btnSubmitScore");
  if (btnSubmit) {
    btnSubmit.addEventListener("click", submitScoreToLeaderboard);
  }
  
  // Allow Enter key to submit scores
  const nameInput = document.getElementById("playerNameInput");
  if (nameInput) {
    nameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        submitScoreToLeaderboard();
      }
    });
  }

  // 3. Mute Toggles button
  const muteBtn = document.getElementById("btnToggleMute");
  if (muteBtn) {
    muteBtn.addEventListener("click", () => {
      gameMuted = !gameMuted;
      if (gameMuted) {
        muteBtn.textContent = "SOUND: OFF";
        muteBtn.classList.add("muted");
      } else {
        muteBtn.textContent = "SOUND: ON";
        muteBtn.classList.remove("muted");
        playLootClickAudio();
      }
    });
  }

  // 3c. Item Labels Toggle button
  const labelsBtn = document.getElementById("btnToggleLabels");
  if (labelsBtn) {
    labelsBtn.addEventListener("click", () => {
      toggleItemLabels();
    });
  }

  // 3b. Floating Music Mute Button
  const floatMute = document.getElementById("btnFloatingMute");
  if (floatMute) {
    floatMute.addEventListener("click", () => {
      musicMuted = !musicMuted;
      if (musicMuted) {
        floatMute.classList.add("muted");
        floatMute.innerHTML = "🔇";
      } else {
        floatMute.classList.remove("muted");
        floatMute.innerHTML = "🎵";
      }
    });
  }

  // 3d. Floating Animations Toggle Button
  const floatAnim = document.getElementById("btnFloatingAnimToggle");
  if (floatAnim) {
    floatAnim.addEventListener("click", () => {
      toggleAnimations();
    });
  }

  // 4. Start Game & Instructions Button Bindings
  const btnShowInstructions = document.getElementById("btnShowInstructions");
  if (btnShowInstructions) {
    btnShowInstructions.addEventListener("click", () => {
      document.getElementById("startScreen").classList.add("hidden");
      document.getElementById("instructionsScreen").classList.remove("hidden");
    });
  }

  const btnStartArcade = document.getElementById("btnStartArcadeGame");
  if (btnStartArcade) {
    btnStartArcade.addEventListener("click", () => {
      if (currentGameState === GameState.SELECT) {
        resetGame();
      }
    });
  }

  // 5. Stash Tab Selector Button Bindings
  const btnRun = document.getElementById("btnStashViewRun");
  const btnLifetime = document.getElementById("btnStashViewLifetime");
  const btnGuild = document.getElementById("btnStashViewGuild");
  
  if (btnRun) {
    btnRun.addEventListener("click", () => {
      activeStashView = "run";
      updateActiveStashTabHighlight();
      updateStashTabUI();
    });
  }
  if (btnLifetime) {
    btnLifetime.addEventListener("click", () => {
      activeStashView = "lifetime";
      updateActiveStashTabHighlight();
      updateStashTabUI();
    });
  }
  if (btnGuild) {
    btnGuild.addEventListener("click", () => {
      activeStashView = "guild";
      updateActiveStashTabHighlight();
      updateStashTabUI();
    });
  }

  // 6. Pause Button Click Handler
  const btnPause = document.getElementById("btnPauseGame");
  if (btnPause) {
    btnPause.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleGamePause();
    });
  }

  // 6a. Theatre Mode Toggle button Click Handler
  const btnTheatre = document.getElementById("btnToggleTheatre");
  if (btnTheatre) {
    btnTheatre.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleTheatreMode();
    });
  }

  // 6b. Fullscreen Mode Toggle button Click Handler
  const btnFullscreen = document.getElementById("btnToggleFullscreen");
  if (btnFullscreen) {
    btnFullscreen.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFullscreenMode();
    });
  }
  const btnLobbyFullscreen = document.getElementById("btnLobbyFullscreen");
  if (btnLobbyFullscreen) {
    btnLobbyFullscreen.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleFullscreenMode();
    });
  }

  // 6c. Fullscreen state change listener to update HUD styling dynamically
  document.addEventListener("fullscreenchange", () => {
    const btnFs = document.getElementById("btnToggleFullscreen");
    const btnLobbyFs = document.getElementById("btnLobbyFullscreen");
    const isFs = !!document.fullscreenElement;
    
    if (btnFs) {
      if (isFs) {
        btnFs.textContent = "🖥️ EXIT FULLSCREEN";
        btnFs.classList.add("active-fullscreen");
      } else {
        btnFs.textContent = "🖥️ FULLSCREEN";
        btnFs.classList.remove("active-fullscreen");
      }
    }
    if (btnLobbyFs) {
      if (isFs) {
        btnLobbyFs.textContent = "🖥️ EXIT FULLSCREEN";
        btnLobbyFs.classList.add("active-fullscreen");
      } else {
        btnLobbyFs.textContent = "🖥️ FULLSCREEN MODE";
        btnLobbyFs.classList.remove("active-fullscreen");
      }
    }
  });

  // 7. Mobile Action Buttons Click Handlers
  const btnMobileDodge = document.getElementById("btnMobileDodge");
  if (btnMobileDodge) {
    btnMobileDodge.addEventListener("click", (e) => {
      e.stopPropagation();
      triggerPlayerDodgeRoll();
    });
  }
  const btnMobileSpread = document.getElementById("btnMobileSpread");
  if (btnMobileSpread) {
    btnMobileSpread.addEventListener("click", (e) => {
      e.stopPropagation();
      triggerPlayerSpreadshot();
    });
  }

  // 8. Pop-out Leaderboard Modal Toggle Bindings
  const modalLeaderboard = document.getElementById("leaderboardOverlayModal");
  const btnToggleLboard = document.getElementById("btnToggleLeaderboard");
  const btnCloseLboard = document.getElementById("btnCloseLeaderboard");

  if (modalLeaderboard) {
    if (btnToggleLboard) {
      btnToggleLboard.addEventListener("click", () => {
        modalLeaderboard.classList.add("modal-active");
        loadDreamloLeaderboard(); // refresh scores live when opening!
      });
    }
    if (btnCloseLboard) {
      btnCloseLboard.addEventListener("click", () => {
        modalLeaderboard.classList.remove("modal-active");
      });
    }
    // Close when clicking dimming backdrop (outside modal-content card)
    modalLeaderboard.addEventListener("click", (e) => {
      if (e.target === modalLeaderboard) {
        modalLeaderboard.classList.remove("modal-active");
      }
    });
  }

  // 9. Dual-mode Leaderboard Tabs Bindings
  const tabTopRuns = document.getElementById("btnTabTopRuns");
  const tabTotalGrind = document.getElementById("btnTabTotalGrind");

  if (tabTopRuns) {
    tabTopRuns.addEventListener("click", (e) => {
      e.stopPropagation();
      currentLeaderboardTab = "topRuns";
      tabTopRuns.classList.add("active-tab");
      if (tabTotalGrind) tabTotalGrind.classList.remove("active-tab");
      renderActiveLeaderboard();
    });
  }
  if (tabTotalGrind) {
    tabTotalGrind.addEventListener("click", (e) => {
      e.stopPropagation();
      currentLeaderboardTab = "totalGrind";
      tabTotalGrind.classList.add("active-tab");
      if (tabTopRuns) tabTopRuns.classList.remove("active-tab");
      renderActiveLeaderboard();
    });
  }

  // 10. Mobile Touch Virtual Joystick Initialization
  initVirtualJoystick();

  // Generate static grass/dirt terrain floor mapping
  generateTerrainMap();
  
  // Initialize procedural forest effects
  initProceduralFog();
  initProceduralEyes();

  // Load persistent stats
  loadLifetimeStash();
  updateActiveStashTabHighlight();

  // Load Stash visualizer initially
  updateStashTabUI();
  
  // Fetch high scores from server
  loadDreamloLeaderboard();
  
  // Start keybind canvas looping animations
  animateKeybindPreviews();
  
  // Initialize simulated server stock economy and pop-out financial charts
  initMarketTrendsControls();
  
  // Start drawing canvas engine loop
  requestAnimationFrame(updateGame);
}

  // Simulated Economy prices baseline and dynamic tracking trends
  let leagueEconomy = {
    mirror: { name: "Mirror of Kalandra", char: "🪞", base: 40000, trend: [39600, 39800, 39950, 40100, 39900, 40200, 40500], curPrice: 40500 },
    divine: { name: "Divine Orb", char: "🪙", base: 160, trend: [152, 155, 158, 156, 160, 163, 162], curPrice: 162 },
    exalted: { name: "Exalted Orb", char: "👑", base: 15, trend: [14.2, 14.5, 14.8, 14.6, 15.0, 15.3, 15.2], curPrice: 15.2 },
    chaos: { name: "Chaos Orb", char: "🌀", base: 1.0, trend: [1.0, 1.0, 1.0, 1.0, 1.0, 1.0, 1.0], curPrice: 1.0 },
    mageblood: { name: "Mageblood Heavy Belt", char: "🩸", base: 34000, trend: [32500, 33000, 33400, 33100, 33900, 34200, 34650], curPrice: 34650 },
    headhunter: { name: "Headhunter Leather Belt", char: "💀", base: 9200, trend: [9500, 9300, 9150, 8900, 9200, 9100, 9410], curPrice: 9410 }
  };

  const ACTIVE_LEAGUE_NAME = "Standard"; // Can be easily updated to new PoE 2 league names tomorrow!
  let apiFetchActive = false;

  let activeTrendItemId = "mirror";
  let mouseOnTrendsChartX = -1;
  let baseCurrency = "chaos";

  async function fetchLiveLeaguePrices() {
    try {
      // 1. Fetch currency pricing details from poe.ninja via allorigins proxy
      const currencyUrl = `https://poe.ninja/api/data/currencyoverview?league=${ACTIVE_LEAGUE_NAME}&type=Currency`;
      const curResponse = await fetch("https://api.allorigins.win/get?url=" + encodeURIComponent(currencyUrl));
      if (!curResponse.ok) throw new Error("CORS Proxy Currency query failed");
      const curJson = await curResponse.json();
      const curData = JSON.parse(curJson.contents);
      
      // 2. Fetch unique belt pricing details (for Mageblood and Headhunter)
      const beltUrl = `https://poe.ninja/api/data/itemoverview?league=${ACTIVE_LEAGUE_NAME}&type=UniqueBelt`;
      const beltResponse = await fetch("https://api.allorigins.win/get?url=" + encodeURIComponent(beltUrl));
      if (!beltResponse.ok) throw new Error("CORS Proxy UniqueBelt query failed");
      const beltJson = await beltResponse.json();
      const beltData = JSON.parse(beltJson.contents);
      
      if (!curData || !curData.lines || !beltData || !beltData.lines) {
        throw new Error("Invalid pricing payload structure returned");
      }
      
      // 3. Map currency prices to leagueEconomy structure
      const mapCurrency = (key, name) => {
        const row = curData.lines.find(l => l.currencyTypeName === name);
        if (row && row.chaosEquivalent) {
          const val = row.chaosEquivalent;
          leagueEconomy[key].curPrice = Math.round(val * 100) / 100;
        }
      };
      
      mapCurrency("mirror", "Mirror of Kalandra");
      mapCurrency("divine", "Divine Orb");
      mapCurrency("exalted", "Exalted Orb");
      mapCurrency("annulment", "Orb of Annulment");
      mapCurrency("vaal", "Vaal Orb");
      mapCurrency("regal", "Regal Orb");
      mapCurrency("alchemy", "Orb of Alchemy");
      mapCurrency("augmentation", "Orb of Augmentation");
      mapCurrency("transmute", "Orb of Transmutation");
      mapCurrency("scroll", "Scroll of Wisdom");
      
      // 4. Map unique belt prices
      const mapUnique = (key, name) => {
        const row = beltData.lines.find(l => l.name === name);
        if (row && row.chaosValue) {
          const val = row.chaosValue;
          leagueEconomy[key].curPrice = Math.round(val * 100) / 100;
        }
      };
      
      mapUnique("mageblood", "Mageblood");
      mapUnique("headhunter", "Headhunter");
      
      // Update price trends data
      Object.keys(leagueEconomy).forEach(key => {
        const item = leagueEconomy[key];
        item.trend.push(item.curPrice);
        if (item.trend.length > 7) {
          item.trend.shift();
        }
      });
      
      apiFetchActive = true;
      console.log(`Live prices successfully fetched from ${ACTIVE_LEAGUE_NAME} league API!`);
      
      // Re-draw ticker and graph modal
      syncStockTickerUI();
      const modal = document.getElementById("marketTrendsModal");
      if (modal && !modal.classList.contains("hidden")) {
        drawMarketTrendsChart(activeTrendItemId);
      }
    } catch (err) {
      apiFetchActive = false;
      console.warn("Live API blocked or league not active yet. Falling back to local economy simulator.", err);
    }
  }

  function updateLeagueEconomyPrices() {
    // If the live API is actively running and updating, skip local fluctuations to maintain exact accuracy
    if (apiFetchActive) return;
    
    // Otherwise, execute Brownian motion random walk local simulator!
    Object.keys(leagueEconomy).forEach(key => {
      if (key === "chaos") return; // Pegged to base
      const item = leagueEconomy[key];
      // Brownian motion with a slight positive bias representing league inflation
      const change = (Math.random() - 0.485) * 0.016; 
      item.curPrice = Math.max(0.1, item.curPrice * (1 + change));
      
      // Shift old trends and push new price
      item.trend.push(Math.round(item.curPrice * 100) / 100);
      if (item.trend.length > 7) {
        item.trend.shift();
      }
    });
    
    // Sync Ticker DOM elements
    syncStockTickerUI();
    
    // If trends modal is visible, re-draw the active chart!
    const modal = document.getElementById("marketTrendsModal");
    if (modal && !modal.classList.contains("hidden")) {
      drawMarketTrendsChart(activeTrendItemId);
    }
  }

  function formatPrice(val) {
    if (val >= 1000) {
      return Math.round(val).toLocaleString();
    }
    return val.toFixed(1);
  }

  function syncStockTickerUI() {
    const track = document.getElementById("stockTickerTrack");
    if (!track) return;
    
    let html = "";
    const itemKeys = Object.keys(leagueEconomy);
    
    const generateList = () => {
      itemKeys.forEach(key => {
        const item = leagueEconomy[key];
        const diff = item.curPrice - item.base;
        const pct = (diff / item.base) * 100;
        const isUp = diff >= 0;
        const arrow = isUp ? "▲" : "▼";
        const pctClass = isUp ? "ticker-pct-up" : "ticker-pct-down";
        
        let priceStr = "";
        if (baseCurrency === "exalted") {
          const exPrice = leagueEconomy.exalted ? leagueEconomy.exalted.curPrice : 15.2;
          const priceInEx = item.curPrice / exPrice;
          priceStr = `${priceInEx.toFixed(2)} ex`;
        } else {
          priceStr = key === "chaos" ? "1.00 chaos" : `${formatPrice(item.curPrice)}c`;
        }
        
        const hasIcon = CurrencyImages[key] && CurrencyImages[key].src;
        const iconHTML = hasIcon 
          ? `<img src="${CurrencyImages[key].src}" class="ticker-currency-icon" alt="${item.name}">`
          : `<span>${item.char}</span>`;
        
        html += `
          <span class="ticker-item" data-item="${key}">
            ${iconHTML}
            <span>${item.name}:</span>
            <span class="text-white font-bold">${priceStr}</span>
            <span class="${pctClass}">${arrow} ${Math.abs(pct).toFixed(1)}%</span>
          </span>
        `;
      });
    };
    
    generateList();
    generateList(); // Duplicate list for seamless infinite loop width mapping
    track.innerHTML = html;

    // Attach click events on nodes dynamically
    const items = track.querySelectorAll(".ticker-item");
    items.forEach(node => {
      node.addEventListener("click", () => {
        const k = node.getAttribute("data-item");
        openPriceTrendsFromTicker(k);
      });
    });
  }

  function openPriceTrendsFromTicker(itemId) {
    if (leagueEconomy[itemId]) {
      activeTrendItemId = itemId;
      
      const tabBtns = document.querySelectorAll(".trends-tab-btn");
      tabBtns.forEach(btn => {
        if (btn.getAttribute("data-item") === itemId) {
          btn.classList.add("active");
        } else {
          btn.classList.remove("active");
        }
      });
      
      const modal = document.getElementById("marketTrendsModal");
      if (modal) {
        modal.classList.remove("hidden");
        drawMarketTrendsChart(itemId);
      }
    }
  }

  function drawMarketTrendsChart(itemId) {
    const item = leagueEconomy[itemId];
    if (!item) return;
    
    const canvas = document.getElementById("marketChart");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    
    const width = canvas.width;
    const height = canvas.height;
    
    ctx.clearRect(0, 0, width, height);
    
    const trend = item.trend;
    const minVal = Math.min(...trend);
    const maxVal = Math.max(...trend);
    const range = maxVal - minVal || 1.0;
    
    const isUp = item.curPrice >= item.base;
    const color = isUp ? "#10b981" : "#ef4444";
    
    // Render Stats Row inside the Modal dynamically
    const nameEl = document.getElementById("chartItemName");
    const priceEl = document.getElementById("chartItemPrice");
    const changeEl = document.getElementById("chartItemChange");
    
    if (nameEl) nameEl.textContent = item.name;
    if (priceEl) {
      if (baseCurrency === "exalted") {
        const exPrice = leagueEconomy.exalted ? leagueEconomy.exalted.curPrice : 15.2;
        const priceInEx = item.curPrice / exPrice;
        priceEl.textContent = `${priceInEx.toFixed(2)} ex`;
      } else {
        priceEl.textContent = itemId === "chaos" ? "1.00 chaos" : `${formatPrice(item.curPrice)}c`;
      }
    }
    
    const diff = item.curPrice - item.base;
    const pct = (diff / item.base) * 100;
    if (changeEl) {
      changeEl.textContent = `${diff >= 0 ? "▲" : "▼"} ${Math.abs(pct).toFixed(1)}%`;
      changeEl.className = `chart-item-change ${diff >= 0 ? "trend-up" : "trend-down"}`;
    }
    
    // Draw horizontal dashed grids
    ctx.strokeStyle = "rgba(255, 215, 0, 0.05)";
    ctx.lineWidth = 1.0;
    ctx.setLineDash([4, 4]);
    for (let i = 0; i < 4; i++) {
      const yGrid = 20 + i * 40;
      ctx.beginPath();
      ctx.moveTo(25, yGrid);
      ctx.lineTo(365, yGrid);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    
    // Compute points coordinates
    const points = [];
    const startX = 35;
    const spacingX = 52;
    const startY = 150;
    const graphH = 120;
    
    trend.forEach((val, idx) => {
      const x = startX + idx * spacingX;
      const ratio = range === 0 ? 0.5 : (val - minVal) / range;
      const y = startY - ratio * graphH;
      points.push({ x, y, val });
    });
    
    // Draw area gradient under curve
    ctx.beginPath();
    ctx.moveTo(points[0].x, startY + 15);
    points.forEach(pt => ctx.lineTo(pt.x, pt.y));
    ctx.lineTo(points[points.length - 1].x, startY + 15);
    ctx.closePath();
    
    const areaGrad = ctx.createLinearGradient(0, 0, 0, height);
    areaGrad.addColorStop(0, isUp ? "rgba(16, 185, 129, 0.18)" : "rgba(239, 68, 68, 0.18)");
    areaGrad.addColorStop(1, "rgba(0, 0, 0, 0)");
    ctx.fillStyle = areaGrad;
    ctx.fill();
    
    // Draw Glowing pricing trend vector line
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.0;
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.restore();
    
    // Draw coordinate dots
    points.forEach(pt => {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#ffd700";
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();
    });
    
    // Tooltip hover detection
    if (mouseOnTrendsChartX >= 0) {
      let closestNode = null;
      let closestDist = Infinity;
      points.forEach(pt => {
        const d = Math.abs(pt.x - mouseOnTrendsChartX);
        if (d < closestDist) {
          closestDist = d;
          closestNode = pt;
        }
      });
      
      if (closestNode && closestDist < 25) {
        // Vertical indicator line
        ctx.beginPath();
        ctx.moveTo(closestNode.x, 20);
        ctx.lineTo(closestNode.x, startY + 10);
        ctx.strokeStyle = "rgba(255, 215, 0, 0.25)";
        ctx.lineWidth = 1.0;
        ctx.stroke();
        
        // Circular highlight ring
        ctx.beginPath();
        ctx.arc(closestNode.x, closestNode.y, 8, 0, Math.PI * 2);
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
        
        // Tooltip card box
        ctx.save();
        let txt = "";
        if (baseCurrency === "exalted") {
          const exPrice = leagueEconomy.exalted ? leagueEconomy.exalted.curPrice : 15.2;
          const priceInEx = closestNode.val / exPrice;
          txt = `${priceInEx.toFixed(2)} ex`;
        } else {
          txt = itemId === "chaos" ? "1.00 chaos" : `${closestNode.val.toLocaleString()}c`;
        }
        ctx.font = "bold 9px Inter";
        const txtW = ctx.measureText(txt).width;
        
        const tooltipX = Math.max(30, Math.min(width - 30 - txtW, closestNode.x));
        const tooltipY = Math.max(25, closestNode.y - 18);
        
        ctx.fillStyle = "rgba(9, 7, 5, 0.94)";
        ctx.strokeStyle = "#ffd700";
        ctx.lineWidth = 1.0;
        ctx.beginPath();
        ctx.roundRect(tooltipX - txtW / 2 - 6, tooltipY - 11, txtW + 12, 16, 4);
        ctx.fill();
        ctx.stroke();
        
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.fillText(txt, tooltipX, tooltipY);
        ctx.restore();
      }
    }
  }

  function initMarketChartEvents() {
    const canvas = document.getElementById("marketChart");
    if (!canvas) return;
    
    canvas.addEventListener("mousemove", (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseOnTrendsChartX = ((e.clientX - rect.left) / rect.width) * canvas.width;
      drawMarketTrendsChart(activeTrendItemId);
    });
    
    canvas.addEventListener("mouseleave", () => {
      mouseOnTrendsChartX = -1;
      drawMarketTrendsChart(activeTrendItemId);
    });
  }

  function initMarketTrendsControls() {
    // Render initial UI marquee track
    syncStockTickerUI();
    
    // Attempt to pull live prices from poe.ninja initially
    fetchLiveLeaguePrices();
    
    // Simulated local price updates tick every 20 seconds
    setInterval(updateLeagueEconomyPrices, 20000);
    
    // Poll the live poe.ninja API every 60 seconds (safe rate-limit)
    setInterval(fetchLiveLeaguePrices, 60000);
    
    // Toggle stock ticker marquee bar
    const btnToggleStock = document.getElementById("btnToggleStockTicker");
    const stockWrapper = document.getElementById("stockTickerWrapper");
    if (btnToggleStock && stockWrapper) {
      btnToggleStock.addEventListener("click", () => {
        const isCollapsed = stockWrapper.classList.toggle("collapsed");
        btnToggleStock.textContent = isCollapsed ? "▼" : "▲";
        document.body.classList.toggle("ticker-hidden", isCollapsed);
      });
    }
    
    // Base Currency Controls
    const btnBaseChaos = document.getElementById("btnBaseChaos");
    const btnBaseExalted = document.getElementById("btnBaseExalted");
    if (btnBaseChaos && btnBaseExalted) {
      btnBaseChaos.addEventListener("click", () => {
        baseCurrency = "chaos";
        btnBaseChaos.classList.add("active");
        btnBaseExalted.classList.remove("active");
        syncStockTickerUI();
        const modalTrends = document.getElementById("marketTrendsModal");
        if (modalTrends && !modalTrends.classList.contains("hidden")) {
          drawMarketTrendsChart(activeTrendItemId);
        }
      });
      btnBaseExalted.addEventListener("click", () => {
        baseCurrency = "exalted";
        btnBaseExalted.classList.add("active");
        btnBaseChaos.classList.remove("active");
        syncStockTickerUI();
        const modalTrends = document.getElementById("marketTrendsModal");
        if (modalTrends && !modalTrends.classList.contains("hidden")) {
          drawMarketTrendsChart(activeTrendItemId);
        }
      });
    }
    
    // Left sidebar column trends toggle button click to launch Modal popup
    const btnOpenTrends = document.getElementById("btnSidebarTrends");
    const modalTrends = document.getElementById("marketTrendsModal");
    if (btnOpenTrends && modalTrends) {
      btnOpenTrends.addEventListener("click", (e) => {
        e.stopPropagation();
        const isHidden = modalTrends.classList.toggle("hidden");
        if (!isHidden) {
          drawMarketTrendsChart(activeTrendItemId);
        }
      });
    }
    
    // Close trends popup trigger
    const btnCloseTrends = document.getElementById("btnCloseMarketTrends");
    if (btnCloseTrends && modalTrends) {
      btnCloseTrends.addEventListener("click", () => {
        modalTrends.classList.add("hidden");
      });
    }
    
    // Item Tabs click selectors
    const tabBtns = document.querySelectorAll(".trends-tab-btn");
    tabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        tabBtns.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeTrendItemId = btn.getAttribute("data-item");
        drawMarketTrendsChart(activeTrendItemId);
      });
    });
    
    // Initialize chart mousemove triggers
    initMarketChartEvents();
  }

  function collapseStockTickerOnStart() {
    const stockWrapper = document.getElementById("stockTickerWrapper");
    const btnToggleStock = document.getElementById("btnToggleStockTicker");
    if (stockWrapper) {
      stockWrapper.classList.add("collapsed");
      document.body.classList.add("ticker-hidden");
    }
    if (btnToggleStock) {
      btnToggleStock.textContent = "▼";
    }
    // Dismiss trends modal during active gaming
    const modalTrends = document.getElementById("marketTrendsModal");
    if (modalTrends) {
      modalTrends.classList.add("hidden");
    }
  }

// Bulletproof execution trigger to prevent DOMContentLoaded race conditions on fast/local page loads
if (document.readyState !== "loading") {
  initGameEngine();
} else {
  document.addEventListener("DOMContentLoaded", initGameEngine);
}
})();
