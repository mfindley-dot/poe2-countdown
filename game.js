/**
 * GLG GUILD HALL ARCADE - GAME ENGINE
 * Auto-Shooter Action Game (PoE2 Style)
 */

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
  GAMEOVER: "gameover"
};

// Dynamic Game Music Soundtracks (Google Flow Music generated)
const bgMusic = new Audio("music/the-grind-begins.mp3");
const bossMusic = new Audio("music/monkey-boss-smash.mp3");
bgMusic.loop = true;
bossMusic.loop = true;
bgMusic.volume = 0.28;  // balanced background volume
bossMusic.volume = 0.32; // slightly louder for boss fight intensity

let currentGameState = GameState.SELECT;
let gameMuted = false;
let gameScoreSubmitted = false;

// Currency items configuration
const CURRENCY_CONFIG = {
  scroll: { name: "Scroll of Wisdom", char: "📜", worth: 0.1, color: "#e2e8f0", border: "#78716c", bg: "#1c1917" },
  transmute: { name: "Orb of Transmutation", char: "🔵", worth: 0.2, color: "#3b82f6", border: "#2563eb", bg: "#1e3a8a" },
  alchemy: { name: "Orb of Alchemy", char: "🟡", worth: 0.5, color: "#eab308", border: "#ca8a04", bg: "#422006" },
  chaos: { name: "Chaos Orb", char: "🌀", worth: 1.0, color: "#ffd700", border: "#ffd700", bg: "#2a2100", sound: "AlertSound2.mp3" },
  exalted: { name: "Exalted Orb", char: "👑", worth: 15.0, color: "#f97316", border: "#ea580c", bg: "#431407", sound: "AlertSound1.mp3" },
  divine: { name: "Divine Orb", char: "🪙", worth: 150.0, color: "#fff", border: "#ffd700", bg: "#422006", sound: "AlertSound16.mp3" },
  mirror: { name: "Mirror of Kalandra", char: "🪞", worth: 40000.0, color: "#fff", border: "#dc2626", bg: "#450a0a", sound: "AlertSound16.mp3", special: true }
};

// Guild Stash Tab state
let playerStash = {
  scroll: 0,
  transmute: 0,
  alchemy: 0,
  chaos: 0,
  exalted: 0,
  divine: 0,
  mirror: 0
};

// ==========================================================================
// 2. PLAYER CLASSES & STATS
// ==========================================================================

let player = {
  x: 320,
  y: 200,
  vx: 0,
  vy: 0,
  speed: 2.8,
  radius: 12,
  class: "Witch",
  hp: 100,
  maxHp: 100,
  level: 1,
  xp: 0,
  maxXp: 100,
  lastShotTime: 0,
  shotCooldown: 480, // ms
  damage: 10,
  frozen: false,
  freezeTimer: 0
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
  player.damage = 12;
  player.shotCooldown = 480;
  
  document.getElementById("btnSelectWitch").classList.add("active-class");
  document.getElementById("btnSelectRanger").classList.remove("active-class");
}

function setRangerClass() {
  player.class = "Ranger";
  player.maxHp = 100;
  player.hp = 100;
  player.speed = 3.1;
  player.damage = 8;
  player.shotCooldown = 280;
  
  document.getElementById("btnSelectRanger").classList.add("active-class");
  document.getElementById("btnSelectWitch").classList.remove("active-class");
}

// ==========================================================================
// 3. GAME RUNTIME ENTITIES
// ==========================================================================

let projectiles = [];
let enemies = [];
let groundLoot = [];
let particleEffects = [];
let activeApeBoss = null;

let wave = 1;
let lastWaveSpawnTime = 0;
let baseEnemyCount = 6;
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
  }

  draw() {
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = this.isSpark ? 8 : 2;
    ctx.fill();
    ctx.shadowBlur = 0; // reset
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
    
    // Stats base on types
    if (type === "spider") {
      this.radius = 9;
      this.hp = 8 + (wave * 2.2);
      this.maxHp = this.hp;
      this.speed = 1.3 + Math.random() * 0.4;
      this.color = "#4b5563"; // slate grey
      this.damage = 8;
    } 
    else if (type === "ghost") {
      this.radius = 11;
      this.hp = 18 + (wave * 3.5);
      this.maxHp = this.hp;
      this.speed = 0.9;
      this.color = "#a5f3fc"; // glowing freeze cyan
      this.damage = 12;
      this.lastFreezeBeamTime = 0;
      this.beamCharging = false;
      this.beamChargeTimer = 0;
      this.beamTargetAngle = 0;
    } 
    else if (type === "ape") {
      // The pillar of doom Boss!
      this.radius = 25;
      this.hp = 180 + (wave * 60);
      this.maxHp = this.hp;
      this.speed = 0.75;
      this.color = "#7c2d12"; // dark brick red ape
      this.damage = 25;
      this.lastSlamTime = Date.now();
      this.slamCharging = false;
      this.slamTargetX = 0;
      this.slamTargetY = 0;
      this.slamChargeTimer = 0;
      this.isBoss = true;
    }
  }

  update() {
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
          
          // Fire Freezing Beam!
          fireFreezeBeam(this.x, this.y, this.beamTargetAngle);
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
      
      if (this.slamCharging) {
        this.slamChargeTimer++;
        this.vx = 0;
        this.vy = 0;
        
        if (this.slamChargeTimer > 60) { // 1 second charge
          this.slamCharging = false;
          this.slamChargeTimer = 0;
          this.lastSlamTime = now;
          
          // Slam shockwave!
          executeApeSlam(this.slamTargetX, this.slamTargetY);
        }
      } 
      else if (now - this.lastSlamTime > 4500 && dist < 180) { // Slam trigger
        this.slamCharging = true;
        this.slamChargeTimer = 0;
        this.slamTargetX = player.x;
        this.slamTargetY = player.y;
      } 
      else {
        this.x += this.vx;
        this.y += this.vy;
      }
    }
  }

  draw() {
    ctx.save();
    
    // Draw body
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
    ctx.fillStyle = this.color;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.fill();
    ctx.stroke();
    
    // Draw charging indicator lines
    if (this.type === "ghost" && this.beamCharging) {
      // Pulsing cyan line showing beam path
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      const targetX = this.x + Math.cos(this.beamTargetAngle) * 220;
      const targetY = this.y + Math.sin(this.beamTargetAngle) * 220;
      ctx.lineTo(targetX, targetY);
      ctx.strokeStyle = "rgba(6, 182, 212, 0.4)";
      ctx.lineWidth = 1 + (this.beamChargeTimer / 10);
      ctx.stroke();
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
        ctx.arc(this.slamTargetX, this.slamTargetY, 45, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(239, 68, 68, ${0.1 + (this.slamChargeTimer/60)*0.5})`;
        ctx.fillStyle = `rgba(239, 68, 68, ${this.slamChargeTimer/240})`;
        ctx.lineWidth = 1.5;
        ctx.fill();
        ctx.stroke();
      }
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
    
    // Play Filterblade Audio Drop Sound!
    if (!gameMuted) {
      if (this.config.sound) {
        // Check if app.js playSoundWithFallback is defined (which we loaded earlier!)
        if (typeof window.playSoundWithFallback === "function") {
          // Triggers high-fidelity MP3 drop
          window.playSoundWithFallback(this.config.sound, () => {
            // Synthesiser fallback if file is missing
            if (this.key === "chaos") playChaosAudioFallback();
            else playDivineAudioFallback();
          });
        } else {
          playDivineAudioFallback();
        }
      } else {
        // Generic click tick for scrolls
        playLootClickAudio();
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
    
    // Pulsing circle highlight
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
    
    // Floating Text Nameplate styled like PoE ground filters!
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
    
    ctx.restore();
  }
}


// ==========================================================================
// 4. ACTION ABILITIES & COMBAT LOGIC
// ==========================================================================

// Ghost cold freeze beam
function fireFreezeBeam(x, y, angle) {
  // Check if player is intersecting the line segments
  const length = 220;
  const endX = x + Math.cos(angle) * length;
  const endY = y + Math.sin(angle) * length;
  
  // Flash beam visual particle
  particleEffects.push({
    isBeam: true,
    startX: x,
    startY: y,
    endX: endX,
    endY: endY,
    color: "rgba(165, 243, 252, 0.95)",
    age: 0,
    maxAge: 20
  });
  
  // Calculate distance from point to segment to check player collision
  const dist = getDistanceToSegment(player.x, player.y, x, y, endX, endY);
  
  if (dist < player.radius + 3) {
    // Freeze player!
    player.frozen = true;
    player.freezeTimer = 70; // 1.2 seconds frozen
    player.hp = Math.max(0, player.hp - 12);
    
    // Trigger sad frozen ripple particle
    particleEffects.push({
      x: player.x,
      y: player.y,
      text: "FROZEN!",
      color: "#06b6d4",
      age: 0,
      maxAge: 40
    });
    
    if (!gameMuted) playRipAudioFallback(); // chill sound
  }
}

// Ape Pillar of Doom Slam
function executeApeSlam(tx, ty) {
  // Shockwave particle
  particleEffects.push({
    isSlamRing: true,
    x: tx,
    y: ty,
    radius: 45,
    age: 0,
    maxAge: 35
  });
  
  // Check distance
  const dx = player.x - tx;
  const dy = player.y - ty;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist < player.radius + 45) {
    player.hp = Math.max(0, player.hp - 35);
    
    // Red flash particle
    particleEffects.push({
      x: player.x,
      y: player.y,
      text: "PILLAR SLAMMED!",
      color: "#ef4444",
      age: 0,
      maxAge: 50
    });
    
    // Shake camera
    triggerCameraShake();
    
    if (!gameMuted) playRipAudioFallback(); // Boom impact
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
  const dropChance = isBoss ? 1.0 : (0.15 + (wave * 0.01)); // drops item on 15% of mobs
  
  for (let c = 0; c < rollCount; c++) {
    if (Math.random() > dropChance && !isBoss) continue;
    
    const roll = Math.random() * 100;
    let lootKey = "scroll";
    
    // Crunched satisfying drop weights:
    // Mirror: 0.01%
    // Divine: 1.5%
    // Exalted: 4%
    // Chaos: 15%
    // Alchemy: 20%
    // Transmute: 25%
    // Scroll: Rest
    
    if (roll < 0.01) {
      lootKey = "mirror";
    } else if (roll < 1.5) {
      lootKey = "divine";
    } else if (roll < 5.5) {
      lootKey = "exalted";
    } else if (roll < 20.5) {
      lootKey = "chaos";
    } else if (roll < 40.5) {
      lootKey = "alchemy";
    } else if (roll < 65.5) {
      lootKey = "transmute";
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

function playRipAudioFallback() {
  initGameAudio();
  if (!gameAudioCtx || gameMuted) return;
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

// Synchronize background and boss soundtrack state (CORS-safe browser Audio player)
function syncGameMusic() {
  if (gameMuted || currentGameState !== GameState.PLAY) {
    bgMusic.pause();
    bossMusic.pause();
    return;
  }
  
  if (activeApeBoss) {
    // If boss is active and boss theme is paused, fade out normal music and play boss theme
    if (bossMusic.paused) {
      bgMusic.pause();
      bossMusic.currentTime = 0;
      bossMusic.play().catch(err => console.log("Autoplay blocked boss music: " + err));
    }
  } else {
    // If no boss active, ensure boss theme is paused and normal level music plays
    if (bgMusic.paused) {
      bossMusic.pause();
      bgMusic.play().catch(err => console.log("Autoplay blocked level music: " + err));
    }
  }
}


// ==========================================================================
// 7. THE INTERACTIVE STASH TAB COMPONENT
// ==========================================================================

function updateStashTabUI() {
  const grid = document.getElementById("stashGrid");
  const summaryBox = document.getElementById("stashSummary");
  
  if (!grid || !summaryBox) return;
  
  grid.innerHTML = "";
  
  // Calculate stash Net Worth in Chaos Orbs
  let totalNetWorth = 0;
  
  // 1. Grid Visualizer slots (12x12 = 144 squares)
  // Fill squares with items we have
  const currencyKeys = Object.keys(CURRENCY_CONFIG);
  let slotIndex = 0;
  
  // Populate existing quantities into cells
  currencyKeys.forEach(key => {
    const qty = playerStash[key];
    const conf = CURRENCY_CONFIG[key];
    
    // Add worth
    totalNetWorth += qty * conf.worth;
    
    // Render cells for stack
    if (qty > 0) {
      // Break large stacks into standard stacks (e.g. max 20)
      const stackSize = key === "mirror" ? 1 : 20;
      let remaining = qty;
      
      while (remaining > 0 && slotIndex < 144) {
        const drawQty = Math.min(stackSize, remaining);
        remaining -= drawQty;
        
        const cell = document.createElement("div");
        cell.className = "stash-grid-cell";
        cell.title = `${conf.name} (Stack: ${drawQty})`;
        
        const icon = document.createElement("span");
        icon.className = "stash-icon";
        icon.textContent = conf.char;
        
        const qtyLabel = document.createElement("span");
        qtyLabel.className = "stash-count";
        qtyLabel.textContent = drawQty;
        
        cell.appendChild(icon);
        cell.appendChild(qtyLabel);
        grid.appendChild(cell);
        
        slotIndex++;
      }
    }
  });
  
  // Fill remaining empty squares
  for (let i = slotIndex; i < 144; i++) {
    const cell = document.createElement("div");
    cell.className = "stash-grid-cell";
    grid.appendChild(cell);
  }
  
  // Estimate Net Worth display (crunched to float)
  const worthText = totalNetWorth.toFixed(1);
  document.getElementById("stashNetWorth").textContent = `WORTH: ${worthText}c`;
  document.getElementById("gameWorthText").textContent = `${worthText}c`;
  
  // 2. Text Summary Items
  summaryBox.innerHTML = "";
  currencyKeys.forEach(key => {
    const qty = playerStash[key];
    if (qty > 0) {
      const conf = CURRENCY_CONFIG[key];
      const item = document.createElement("span");
      item.className = "summary-item";
      item.innerHTML = `${conf.char} <strong>${qty}</strong>`;
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

async function loadDreamloLeaderboard() {
  const tbody = document.getElementById("leaderboardBody");
  if (!tbody) return;
  
  try {
    // dreamlo API pulls json
    const response = await fetch(`https://dreamlo.com/lb/${DREAMLO_PUBLIC_KEY}/json`);
    if (!response.ok) throw new Error("Leaderboard API returned status: " + response.status);
    
    const data = await response.json();
    tbody.innerHTML = "";
    
    if (data && data.dreamlo && data.dreamlo.leaderboard && data.dreamlo.leaderboard.entry) {
      let entries = data.dreamlo.leaderboard.entry;
      
      // If single entry returned, dreamlo returns object instead of array
      if (!Array.isArray(entries)) {
        entries = [entries];
      }
      
      // Sort entries descending by score
      entries.sort((a, b) => parseInt(b.score, 10) - parseInt(a.score, 10));
      
      entries.slice(0, 10).forEach((entry, idx) => {
        const tr = document.createElement("tr");
        
        // score back into chaos
        const worthInChaos = (parseInt(entry.score, 10) / 10).toFixed(1);
        
        // dreamlo "seconds" field is used to pass class type safely
        const classType = entry.seconds ? entry.seconds : "Witch";
        
        tr.innerHTML = `
          <td>#${idx + 1}</td>
          <td>${escapeHtml(entry.name)}</td>
          <td>${escapeHtml(classType)}</td>
          <td class="text-gold">${worthInChaos}c</td>
        `;
        tbody.appendChild(tr);
      });
    } else {
      tbody.innerHTML = "<tr><td colspan='4' class='center-text text-gold-faded'>NO SCORES RECORDED. BE THE FIRST!</td></tr>";
    }
  } catch (err) {
    console.error(err);
    tbody.innerHTML = "<tr><td colspan='4' class='center-text text-red'>FAILED TO LOAD LEADERBOARD ONLINE.</td></tr>";
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
  const cleanName = rawName.replace(/[^a-zA-Z0-9_-]/g, "");
  
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
    // dreamlo API submit: /add/PRIVATE_KEY/NAME/SCORE/SECONDS(use for class)
    const url = `https://dreamlo.com/lb/${DREAMLO_PRIVATE_KEY}/add/${encodeURIComponent(cleanName)}/${score}/0/${encodeURIComponent(playerClass)}`;
    
    // API request (Fetch is CORS safe for dreamlo)
    await fetch(url);
    
    statusMsg.textContent = "🏆 SCORES UPLOADED SUCCESSFULLY!";
    statusMsg.className = "status-msg success-text";
    
    // Reload leaderboard board
    loadDreamloLeaderboard();
    
    // Trigger fun currency rain on header title for visual feedback
    if (typeof window.triggerClickExplosion === "function") {
      window.triggerClickExplosion();
    }
    
  } catch (err) {
    console.error(err);
    statusMsg.textContent = "❌ SUBMISSION FAILED. Connection error!";
    statusMsg.className = "status-msg error-text";
    submitBtn.disabled = false;
    nameInput.disabled = false;
    gameScoreSubmitted = false;
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}


// ==========================================================================
// 9. CORE CANVAS GAME LOOP & PHYSICS ENGINE
// ==========================================================================

let cameraShake = { x: 0, y: 0, duration: 0 };

function triggerCameraShake() {
  cameraShake.duration = 18;
}

function handleInput() {
  if (currentGameState !== GameState.PLAY || player.frozen) {
    player.vx = 0;
    player.vy = 0;
    return;
  }

  let moveX = 0;
  let moveY = 0;

  if (keys.w || keys.ArrowUp) moveY = -1;
  if (keys.s || keys.ArrowDown) moveY = 1;
  if (keys.a || keys.ArrowLeft) moveX = -1;
  if (keys.d || keys.ArrowRight) moveX = 1;

  // Normalize movements vector
  const len = Math.sqrt(moveX * moveX + moveY * moveY);
  if (len > 0) {
    player.vx = (moveX / len) * player.speed;
    player.vy = (moveY / len) * player.speed;
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
      projectiles.push(new GameProjectile(player.x, player.y, vx, vy, "#eab308", player.damage, false));
    });
    
    if (!gameMuted) playLootClickAudio();
  }
}

// Spawner rules
function handleEnemySpawning() {
  const now = Date.now();
  
  // Spawn every 4.5 seconds
  if (now - lastWaveSpawnTime > 4500) {
    lastWaveSpawnTime = now;
    
    // Wave calculations
    const count = baseEnemyCount + (wave * 2);
    
    // Choose spawn positions offscreen
    for (let i = 0; i < count; i++) {
      let sx, sy;
      const border = Math.floor(Math.random() * 4); // 0: Top, 1: Right, 2: Bottom, 3: Left
      
      if (border === 0) { sx = Math.random() * canvas.width; sy = -20; }
      else if (border === 1) { sx = canvas.width + 20; sy = Math.random() * canvas.height; }
      else if (border === 2) { sx = Math.random() * canvas.width; sy = canvas.height + 20; }
      else { sx = -20; sy = Math.random() * canvas.height; }
      
      // Mobs pool selection
      // Wave 1: Spiders only
      // Wave 2: Spiders + Ghosts
      // Wave 3+: Spiders, Ghosts, and rare Boss Apes!
      let type = "spider";
      const roll = Math.random() * 100;
      
      if (wave >= 2 && roll < 30) {
        type = "ghost";
      }
      
      enemies.push(new Enemy(sx, sy, type));
    }
    
    // Spawn Boss Chieftain Ape!
    if (wave % 3 === 0 && !activeApeBoss) {
      // Spawn at top center
      activeApeBoss = new Enemy(canvas.width / 2, -40, "ape");
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
    
    wave++;
    document.getElementById("gameWaveText").textContent = wave - 1;
  }
}

// Collisions and hits calculations
function processGamePhysics() {
  // Move player
  player.x += player.vx;
  player.y += player.vy;
  
  // Freeze debuff timer
  if (player.frozen) {
    player.freezeTimer--;
    if (player.freezeTimer <= 0) {
      player.frozen = false;
    }
  }

  // Bounds checks player
  player.x = Math.max(player.radius, Math.min(canvas.width - player.radius, player.x));
  player.y = Math.max(player.radius, Math.min(canvas.height - player.radius, player.y));

  // Move projectiles
  projectiles.forEach(p => p.update());
  projectiles = projectiles.filter(p => p.active);

  // Move enemies
  enemies.forEach(e => e.update());
  enemies = enemies.filter(e => e.active);

  // Loot triggers
  groundLoot.forEach(l => l.update());
  groundLoot = groundLoot.filter(l => l.active);

  // Update particles
  particleEffects.forEach(p => {
    p.age++;
    if (p.isBeam || p.isSlamRing) return;
    
    // float text upwards
    p.y -= 0.6;
  });
  particleEffects = particleEffects.filter(p => p.age < p.maxAge);

  // 1. PROJECTILE VS ENEMY COLLISIONS
  projectiles.forEach(p => {
    enemies.forEach(e => {
      if (!p.active || !e.active) return;
      
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < p.radius + e.radius) {
        // Hit!
        e.hp -= p.damage;
        
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
        if (e.hp <= 0) {
          e.active = false;
          if (e.type === "ape") activeApeBoss = null;
          
          // Roll drops!
          rollMobLoot(e.x, e.y, e.isBoss);
          
          // Award XP
          const xpGained = e.isBoss ? 45 : (e.type === "ghost" ? 15 : 6);
          player.xp += xpGained;
          
          // Level up check
          if (player.xp >= player.maxXp) {
            player.level++;
            player.xp -= player.maxXp;
            player.maxXp = Math.floor(player.maxXp * 1.35);
            player.damage += 3;
            player.maxHp += 10;
            player.hp = player.maxHp; // Heal to full on level up!
            
            // Level up splash
            particleEffects.push({
              x: player.x,
              y: player.y - 15,
              text: `LEVEL UP! LEVEL ${player.level}!`,
              color: "#10b981",
              age: 0,
              maxAge: 70
            });
            
            if (!gameMuted) playDivineAudioFallback(); // glorious ding
          }
        }
      }
    });
  });

  // 2. ENEMY VS PLAYER COLLISIONS
  const now = Date.now();
  enemies.forEach(e => {
    if (!e.active || player.frozen) return;
    
    const dx = e.x - player.x;
    const dy = e.y - player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist < e.radius + player.radius) {
      // Hit exile!
      // Knockback exile slightly to prevent instant death
      player.x -= (dx / dist) * 12;
      player.y -= (dy / dist) * 12;
      
      player.hp = Math.max(0, player.hp - e.damage);
      
      // Floating damage text
      particleEffects.push({
        x: player.x,
        y: player.y - 12,
        text: `-${e.damage}`,
        color: "#dc2626",
        age: 0,
        maxAge: 30
      });
      
      if (player.hp <= 0) {
        handlePlayerDeath();
      } else {
        if (!gameMuted) playRipAudioFallback(); // ouch tick
      }
    }
  });

  // Camera Shake Decay
  if (cameraShake.duration > 0) {
    cameraShake.duration--;
    cameraShake.x = (Math.random() * 8 - 4);
    cameraShake.y = (Math.random() * 8 - 4);
  } else {
    cameraShake.x = 0;
    cameraShake.y = 0;
  }
}

function handlePlayerDeath() {
  currentGameState = GameState.GAMEOVER;
  
  // Stop all active loop music immediately for dramatic silence!
  bgMusic.pause();
  bossMusic.pause();
  
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
  
  // Reset scoreboard forms
  document.getElementById("playerNameInput").disabled = false;
  document.getElementById("btnSubmitScore").disabled = false;
  document.getElementById("submitStatusMsg").textContent = "";
  gameScoreSubmitted = false;
  
  // Play You Died music/chime
  playDarkSoulsYouDiedAudio();
}


// ==========================================================================
// 10. RENDERING & VISUAL ENGINE
// ==========================================================================

function drawGamePlayScreen() {
  ctx.save();
  ctx.translate(cameraShake.x, cameraShake.y);

  // 1. Grid lines for ground arena
  ctx.strokeStyle = "#16110d";
  ctx.lineWidth = 1;
  const gridSpacing = 40;
  for (let x = 0; x < canvas.width; x += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += gridSpacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // 2. Render Ground loot items
  groundLoot.forEach(l => l.draw());

  // 3. Render enemies
  enemies.forEach(e => e.draw());

  // 4. Render projectiles
  projectiles.forEach(p => p.draw());

  // 5. Render player Exile
  drawPlayerCharacter();

  // 6. Render Particle animations
  drawParticles();

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
  
  // Gilded border ring
  ctx.beginPath();
  ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2);
  ctx.fillStyle = player.class === "Witch" ? "#581c87" : "#0f766e"; // purple Witch, cyan Ranger
  ctx.strokeStyle = "#ffd700";
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  
  // Draw glowing core
  ctx.beginPath();
  ctx.arc(player.x, player.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#fff";
  ctx.fill();

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
      ctx.strokeStyle = `rgba(239, 68, 68, ${1 - pct})`;
      ctx.lineWidth = 3 * (1 - pct);
      ctx.stroke();
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
  
  document.getElementById("gameHealthBar").style.width = `${hpPct}%`;
  document.getElementById("gameHealthText").textContent = `HP: ${player.hp}/${player.maxHp}`;
  
  document.getElementById("gameXpBar").style.width = `${xpPct}%`;
  document.getElementById("gameXpText").textContent = `XP: Level ${player.level} (${Math.floor(xpPct)}%)`;
}


// ==========================================================================
// 11. GAME LOOPS MANAGERS & RESETS
// ==========================================================================

function updateGame() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (currentGameState === GameState.SELECT) {
    // Draw lobby
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = varColorText("--gold-hover", "#ffd700");
    ctx.font = "bold 22px Cinzel";
    ctx.textAlign = "center";
    ctx.fillText("GLG GUILD ARCADE", canvas.width / 2, 130);
    
    ctx.fillStyle = "#cbd5e1";
    ctx.font = "10px Inter";
    ctx.fillText("Defeat spiders and freeze ghosts. Survive the giant slam monkey's pillar of doom!", canvas.width / 2, 165);
    ctx.fillStyle = varColorText("--gold-faded", "#b8860b");
    ctx.fillText("All collected currencies dynamically stack inside your Stash Tab. Score = Net Worth!", canvas.width / 2, 185);
    
    ctx.fillStyle = "#fff8d4";
    ctx.font = "bold 11px Cinzel";
    ctx.fillText("TAP OR PRESS WASD KEYS TO AWAKEN", canvas.width / 2, 260);
  } 
  else if (currentGameState === GameState.PLAY) {
    // Inputs & Combat triggers
    handleInput();
    executePlayerAutoShooting();
    handleEnemySpawning();
    
    // Physics and updates
    processGamePhysics();
    
    // Sync level & boss soundtracks
    syncGameMusic();
    
    // Draw scenes
    drawGamePlayScreen();
    drawHUD();
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
  return getComputedStyle(document.documentElement).getPropertyValue(cssVar).trim() || fallback;
}

function resetGame() {
  // Reset and pause music tracks
  bgMusic.pause();
  bossMusic.pause();
  bgMusic.currentTime = 0;
  bossMusic.currentTime = 0;

  // Clear entities
  projectiles = [];
  enemies = [];
  groundLoot = [];
  particleEffects = [];
  activeApeBoss = null;
  
  // Wave state
  wave = 1;
  lastWaveSpawnTime = 0;
  document.getElementById("gameWaveText").textContent = wave;

  // Stash clear
  playerStash = { scroll: 0, transmute: 0, alchemy: 0, chaos: 0, exalted: 0, divine: 0, mirror: 0 };
  updateStashTabUI();

  // Reset player coordinates and stats
  player.x = canvas.width / 2;
  player.y = canvas.height / 2;
  player.vx = 0;
  player.vy = 0;
  player.level = 1;
  player.xp = 0;
  player.maxXp = 100;
  player.frozen = false;
  player.freezeTimer = 0;
  
  if (player.class === "Witch") {
    setWitchClass();
  } else {
    setRangerClass();
  }
  
  // Hide panels
  document.getElementById("deathScreen").classList.add("hidden");
  
  currentGameState = GameState.PLAY;
}

// Bind keyboard
window.addEventListener("keydown", (e) => {
  if (["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
    keys[e.key] = true;
    
    // Auto-awaken game on movements click
    if (currentGameState === GameState.SELECT) {
      resetGame();
    }
  }
});

window.addEventListener("keyup", (e) => {
  if (["w", "a", "s", "d", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
    keys[e.key] = false;
  }
});

// Canvas click also starts game
canvas.addEventListener("click", () => {
  if (currentGameState === GameState.SELECT) {
    resetGame();
  }
});


// ==========================================================================
// 12. INITIALIZATION EVENT CONTROLLERS
// ==========================================================================

document.addEventListener("DOMContentLoaded", () => {
  
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
        // Pause all active loops immediately
        bgMusic.pause();
        bossMusic.pause();
      } else {
        muteBtn.textContent = "SOUND: ON";
        muteBtn.classList.remove("muted");
        playLootClickAudio();
        // Sync active state music
        syncGameMusic();
      }
    });
  }

  // Load Stash visualizer initially
  updateStashTabUI();
  
  // Fetch high scores from server
  loadDreamloLeaderboard();
  
  // Start drawing canvas engine loop
  requestAnimationFrame(updateGame);
});
