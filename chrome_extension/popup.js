// GLG PoE2 Stash Scanner Extension Logic (V2.0)

// Default pre-allocated shared keys loaded dynamically from git-ignored config.json
let defaultGeminiKey = "";
let defaultDreamloKey = "";

// Global appraised item storage
let appraisedItem = null;
let activeMode = "stash"; // "stash" or "appraiser"

// Elements
const geminiInput = document.getElementById("geminiKey");
const dreamloInput = document.getElementById("dreamloKey");
const btnSync = document.getElementById("btnSync");
const logBox = document.getElementById("logBox");
const previewCanvas = document.getElementById("previewCanvas");
const tempVideo = document.getElementById("tempVideo");

// Elements V2.0
const btnModeStash = document.getElementById("btnModeStash");
const btnModeAppraiser = document.getElementById("btnModeAppraiser");
const sectionStash = document.getElementById("sectionStash");
const sectionAppraiser = document.getElementById("sectionAppraiser");
const clipboardPaste = document.getElementById("clipboardPaste");
const btnAppraise = document.getElementById("btnAppraise");
const appraisalCard = document.getElementById("appraisalCard");
const appTitle = document.getElementById("appTitle");
const appBase = document.getElementById("appBase");
const appMods = document.getElementById("appMods");
const appPrice = document.getElementById("appPrice");
const appCullingLogs = document.getElementById("appCullingLogs");
const btnSyncItem = document.getElementById("btnSyncItem");

// Spatial visual prompt coordinate guides matching true PoE2 stash tab layout
const SYSTEM_INSTRUCTION = `You are an expert Path of Exile 2 Currency Stash Tab indexer. 
Analyze the Currency Stash Tab screenshot and match numbers/quantities carefully. Use this spatial visual guide:

1. FAR-LEFT GRID (5 rows by 3 columns of slots):
   - Row 1: augmentation (Col 1, Base) | greater_augmentation (Col 2, II) | perfect_augmentation (Col 3, III) [Bronze/copper circular multi-faced orbs]
   - Row 2: transmute (Col 1, Base) | greater_transmute (Col 2, II) | perfect_transmute (Col 3, III) [Dark blue circular multi-faced orbs]
   - Row 3: regal (Col 1, Base) | greater_regal (Col 2, II) | perfect_regal (Col 3, III) [Half-blue, half-gold face orbs]
   - Row 4: exalted (Col 1, Base) | greater_exalted (Col 2, II) | perfect_exalted (Col 3, III) [Shiny gold cracked face orbs]
   - Row 5: chaos (Col 1, Base) | greater_chaos (Col 2, II) | perfect_chaos (Col 3, III) [Golden face orbs composed of multiple stacked mini-faces]

2. CENTRAL UTILITY GRID (3 rows by 3 columns of slots directly to the right of the 5x3 grid):
   - Row 1 (Top row):
     * Column 1 (Left): alchemy - Orb of Alchemy [Reddish-gold smooth face orb, count 195]
     * Column 2 (Middle): vaal - Vaal Orb [Red multi-faced skull shape, count 386]
     * Column 3 (Right): annulment - Orb of Annulment [Blue/white half-split mask, count 18]
   - Row 2 (Middle row):
     * Column 1 (Left): chance - Orb of Chance [Cracked white/gold face orb, count 38]
     * Column 2 (Middle): fracturing - Fracturing Orb [Shattered glowing yellow crystal, count 3]
     * Column 3 (Right): divine - Divine Orb [Gold coin with serene serene face, count 169]
   - Row 3 (Bottom row):
     * Column 1 (Left): hinekoras_lock - Hinekora's Lock [Dark braided purple lock/ribbon, count 0]
     * Column 2 (Middle): mirror - Mirror of Kalandra [Silver metallic runic mirror, count 0]
     * Column 3 (Right): artificer - Artificer's Orb [Dark green/grey bag shape, count 81]

3. TOP-RIGHT HORIZONTAL CLUSTER (Jewellers' Currency):
   - lesser_jeweller (Left, plain copper/bronze loop, count 349. Ensure you read all three digits '349' fully!)
   - greater_jeweller (Middle, bronze loop with inner notches, count 12)
   - perfect_jeweller (Right, gold loop holding a central blue/purple gem, count 1)

4. SCROLL OF WISDOM:
   - scroll: Red-ribbon tied blue scroll icon, located on the right side under general/popular/secondary stacks (count 91).

RULES:
 - For any slot that is completely empty or has no quantity, return 0.
 - Output numbers exactly as read. Pay extra attention to double-digit and triple-digit numbers. Do not miss the leading digit near slot borders (e.g. read '349' instead of '49').`;

// Schema definition for Structured JSON responses
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    scroll: { type: "INTEGER" },
    transmute: { type: "INTEGER" },
    greater_transmute: { type: "INTEGER" },
    perfect_transmute: { type: "INTEGER" },
    augmentation: { type: "INTEGER" },
    greater_augmentation: { type: "INTEGER" },
    perfect_augmentation: { type: "INTEGER" },
    alchemy: { type: "INTEGER" },
    regal: { type: "INTEGER" },
    greater_regal: { type: "INTEGER" },
    perfect_regal: { type: "INTEGER" },
    chaos: { type: "INTEGER" },
    greater_chaos: { type: "INTEGER" },
    perfect_chaos: { type: "INTEGER" },
    vaal: { type: "INTEGER" },
    annulment: { type: "INTEGER" },
    exalted: { type: "INTEGER" },
    greater_exalted: { type: "INTEGER" },
    perfect_exalted: { type: "INTEGER" },
    divine: { type: "INTEGER" },
    mirror: { type: "INTEGER" },
    lesser_jeweller: { type: "INTEGER" },
    greater_jeweller: { type: "INTEGER" },
    perfect_jeweller: { type: "INTEGER" }
  },
  required: ["scroll", "transmute", "augmentation", "alchemy", "regal", "chaos", "vaal", "annulment", "exalted", "divine", "mirror", "lesser_jeweller", "greater_jeweller", "perfect_jeweller"]
};

// Item Appraiser Prompt coordination V2.0
const APPRAISER_SYSTEM_INSTRUCTION = `You are an expert Path of Exile 2 Item Appraiser and Trade Evaluator.
Analyze the raw copied PoE2 item text, extract its stats, and calculate its estimated market value in Chaos Orbs or Divine Orbs based on standard early access trade values.

VALUATION RULES:
- Chase Uniques (e.g., Mageblood, Headhunter) are worth massive Divines (e.g. Mageblood 248 Divine Orbs, Headhunter 142 Divine Orbs).
- Unique weapons/rings (e.g. Dreamfeather, The Taming) are worth 4 to 35 Divine Orbs.
- Good Rare jewelry/rings with high resistances (e.g., +30% to any element), high maximum life (+50 or more), and high mana are worth 30 to 80 Chaos Orbs.
- Standard common gear with low stats or high level requirements with minimal values is worth 1 to 5 Chaos Orbs.
- Cull all bot posts (fake listings listed far below actual value). Explain what you culled in the bot_culling_logs field.
- Formulate a brief, fun flavor text or funny review from a hypothetical guild member about this item.`;

// Schema definition for Tooltip Appraisal
const APPRAISER_SCHEMA = {
  type: "OBJECT",
  properties: {
    name: { type: "STRING" },
    base_type: { type: "STRING" },
    rarity: { type: "STRING" },
    item_level: { type: "INTEGER" },
    level_req: { type: "INTEGER" },
    explicit_mods: {
      type: "ARRAY",
      items: { type: "STRING" }
    },
    estimated_price_string: { type: "STRING" },
    bot_culling_logs: { type: "STRING" },
    flavor_text: { type: "STRING" }
  },
  required: ["name", "base_type", "rarity", "item_level", "level_req", "explicit_mods", "estimated_price_string", "bot_culling_logs"]
};

// Initialize settings
document.addEventListener("DOMContentLoaded", async () => {
  // Try to load default keys from git-ignored config.json
  try {
    const configRes = await fetch(chrome.runtime.getURL("config.json"));
    if (configRes.ok) {
      const config = await configRes.json();
      defaultGeminiKey = config.default_gemini_key || "";
      defaultDreamloKey = config.default_dreamlo_key || "";
    }
  } catch (err) {
    console.warn("Failed to load local config.json:", err);
  }

  chrome.storage.local.get(["geminiKey", "dreamloKey"], (data) => {
    geminiInput.value = data.geminiKey || defaultGeminiKey;
    dreamloInput.value = data.dreamloKey || defaultDreamloKey;
  });

  // Attempt auto-clipboard read on startup if in Appraiser mode
  setupClipboardAutoDetect();
});

// Logs status updates
function log(msg, type = "") {
  let colorClass = "";
  if (type === "success") colorClass = "success";
  if (type === "error") colorClass = "error";
  
  logBox.innerHTML += `<br><span class="${colorClass}">${msg}</span>`;
  logBox.scrollTop = logBox.scrollHeight;
}

// Mode Switcher Controls
btnModeStash.addEventListener("click", () => {
  activeMode = "stash";
  btnModeStash.classList.add("active");
  btnModeAppraiser.classList.remove("active");
  sectionStash.style.display = "block";
  sectionAppraiser.style.display = "none";
  appraisalCard.style.display = "none";
  logBox.innerHTML = "Status: Switched to Stash Tab Sync mode.";
});

btnModeAppraiser.addEventListener("click", () => {
  activeMode = "appraiser";
  btnModeAppraiser.classList.add("active");
  btnModeStash.classList.remove("active");
  sectionStash.style.display = "none";
  sectionAppraiser.style.display = "block";
  logBox.innerHTML = "Status: Switched to Clipboard Item Appraiser mode.";
  
  // Trigger auto detect when switching tab
  readClipboardText();
});

// Try to auto-grab clipboard on launch/switch
function setupClipboardAutoDetect() {
  chrome.permissions.contains({ permissions: ['clipboardRead'] }, (hasPerm) => {
    if (hasPerm && activeMode === "appraiser") {
      readClipboardText();
    }
  });
}

async function readClipboardText() {
  try {
    const text = await navigator.clipboard.readText();
    if (text && (text.includes("Rarity:") || text.includes("Item Class:"))) {
      clipboardPaste.value = text;
      logBox.innerHTML = "Status: PoE item text auto-detected in clipboard!";
      log("Click 'APPRAISE CLIPBOARD ITEM' to evaluate its stats.", "success");
    }
  } catch (err) {
    console.log("Auto clipboard read blocked or empty:", err);
  }
}

// Stash Sync Click Trigger
btnSync.addEventListener("click", async () => {
  const geminiKey = geminiInput.value.trim();
  const dreamloKey = dreamloInput.value.trim();
  
  if (!geminiKey) {
    log("Error: Gemini API Key required.", "error");
    return;
  }
  if (!dreamloKey) {
    log("Error: Dreamlo Private Key required.", "error");
    return;
  }
  
  chrome.storage.local.set({ geminiKey, dreamloKey });
  logBox.innerHTML = "Status: Initializing display grab...";
  
  try {
    log("Opening screen selector...");
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: "window" },
      audio: false
    });
    
    log("Display connection established.");
    tempVideo.srcObject = stream;
    tempVideo.play();
    
    tempVideo.onloadedmetadata = () => {
      setTimeout(() => {
        captureAndUpload(stream, geminiKey, dreamloKey);
      }, 500);
    };
    
  } catch (err) {
    log(`Display grab aborted or failed: ${err.message}`, "error");
  }
});

// Capture frame, crop, and run Gemini/Dreamlo processing
async function captureAndUpload(stream, geminiKey, dreamloKey) {
  try {
    const videoWidth = tempVideo.videoWidth;
    const videoHeight = tempVideo.videoHeight;
    
    const ctx = previewCanvas.getContext("2d");
    previewCanvas.width = videoWidth;
    previewCanvas.height = videoHeight;
    
    ctx.drawImage(tempVideo, 0, 0, videoWidth, videoHeight);
    
    stream.getTracks().forEach(track => track.stop());
    log("Captured screen frame successfully.");
    
    const dataUrl = previewCanvas.toDataURL("image/png");
    const base64Data = dataUrl.split(",")[1];
    
    previewCanvas.style.display = "block";
    log("Running Gemini Multimodal Vision analysis...");
    
    const apiUrL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
    
    const payload = {
      contents: [{
        parts: [
          { text: "Extract the exact quantities of all visible Path of Exile 2 currency items in this Currency Stash Tab image." },
          {
            inlineData: {
              mimeType: "image/png",
              data: base64Data
            }
          }
        ]
      }],
      generationConfig: {
        systemInstruction: {
          parts: [{ text: SYSTEM_INSTRUCTION }]
        },
        responseMimeType: "application/json",
        responseSchema: RESPONSE_SCHEMA
      }
    };
    
    const res = await fetch(apiUrL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Gemini API returned status ${res.status}: ${errTxt}`);
    }
    
    const resJson = await res.json();
    const responseText = resJson.candidates[0].content.parts[0].text;
    log("Gemini parsed stash metrics successfully.");
    
    const data = JSON.parse(responseText);
    
    const core_data = {
      scroll: data.scroll || 0,
      transmute: (data.transmute || 0) + (data.greater_transmute || 0) + (data.perfect_transmute || 0),
      augmentation: (data.augmentation || 0) + (data.greater_augmentation || 0) + (data.perfect_augmentation || 0),
      alchemy: data.alchemy || 0,
      regal: (data.regal || 0) + (data.greater_regal || 0) + (data.perfect_regal || 0),
      chaos: (data.chaos || 0) + (data.greater_chaos || 0) + (data.perfect_chaos || 0),
      vaal: data.vaal || 0,
      annulment: data.annulment || 0,
      exalted: (data.exalted || 0) + (data.greater_exalted || 0) + (data.perfect_exalted || 0),
      divine: data.divine || 0,
      mirror: data.mirror || 0
    };
    
    const rates = {
      mirror: 40000.0, divine: 150.0, exalted: 15.0, annulment: 5.0, vaal: 2.0,
      chaos: 1.0, regal: 0.8, alchemy: 0.5, transmute: 0.2, augmentation: 0.15, scroll: 0.05
    };
    let total_chaos = 0.0;
    Object.keys(core_data).forEach(k => {
      total_chaos += core_data[k] * rates[k];
    });
    
    const core_keys = ["scroll", "transmute", "augmentation", "alchemy", "regal", "chaos", "vaal", "annulment", "exalted", "divine", "mirror"];
    const pipe_str = core_keys.map(k => core_data[k]).join("|") + "|1.0";
    
    const total_score = Math.floor(total_chaos * 10);
    log("Syncing live scan results to your online guild website...");
    
    const pushUrl = `https://dreamlo.com/lb/${dreamloKey}/add/__GUILD_VAULT__/${total_score}/0/${encodeURIComponent(pipe_str)}`;
    
    const pushRes = await fetch(pushUrl);
    if (!pushRes.ok) {
      throw new Error(`Dreamlo database push failed with status: ${pushRes.status}`);
    }
    
    log(`✅ Guild Vault successfully updated globally! Net Worth: ${total_chaos.toFixed(0)}c (~${(total_chaos/150).toFixed(1)} EX)`, "success");
    
  } catch (err) {
    log(`API Sync failed: ${err.message}`, "error");
  }
}

// ==========================================
// V2.0 ITEM APPRAISER / TOOLTIP SCAN LOGIC
// ==========================================

btnAppraise.addEventListener("click", async () => {
  const geminiKey = geminiInput.value.trim();
  const dreamloKey = dreamloInput.value.trim();
  const itemText = clipboardPaste.value.trim();
  
  if (!geminiKey) {
    log("Error: Gemini API Key required.", "error");
    return;
  }
  if (!dreamloKey) {
    log("Error: Dreamlo Private Key required.", "error");
    return;
  }
  if (!itemText) {
    log("Error: Please paste item stats text first.", "error");
    return;
  }
  
  chrome.storage.local.set({ geminiKey, dreamloKey });
  logBox.innerHTML = "Status: Appraising item text stats via Gemini AI...";
  appraisalCard.style.display = "none";
  
  try {
    const apiUrL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
    
    const payload = {
      contents: [{
        parts: [{ text: `Appraise the following Path of Exile 2 item text copied from in-game:\n\n${itemText}` }]
      }],
      generationConfig: {
        systemInstruction: {
          parts: [{ text: APPRAISER_SYSTEM_INSTRUCTION }]
        },
        responseMimeType: "application/json",
        responseSchema: APPRAISER_SCHEMA
      }
    };
    
    const res = await fetch(apiUrL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    
    if (!res.ok) {
      const errTxt = await res.text();
      throw new Error(`Gemini API returned status ${res.status}: ${errTxt}`);
    }
    
    const resJson = await res.json();
    const responseText = resJson.candidates[0].content.parts[0].text;
    
    appraisedItem = JSON.parse(responseText);
    log("Gemini successfully appraised item values!", "success");
    
    // Display appraised Poe Tooltip Card in Popup
    appTitle.textContent = appraisedItem.name;
    appBase.textContent = appraisedItem.base_type;
    
    // Rarity Color Code
    let color = "#af6025"; // Unique orange
    if (appraisedItem.rarity.toLowerCase() === 'rare') {
      color = "#f7d05e"; // Rare yellow
    } else if (appraisedItem.rarity.toLowerCase() === 'magic') {
      color = "#548cf7"; // Magic blue
    } else if (appraisedItem.rarity.toLowerCase() === 'normal') {
      color = "#cbd5e1"; // Normal white
    }
    appTitle.style.color = color;
    
    // Explicit Stats list
    appMods.innerHTML = "";
    appraisedItem.explicit_mods.forEach(mod => {
      const div = document.createElement("div");
      div.textContent = mod;
      appMods.appendChild(div);
    });
    
    appPrice.textContent = appraisedItem.estimated_price_string;
    appCullingLogs.textContent = appraisedItem.bot_culling_logs;
    
    appraisalCard.style.display = "block";
    
  } catch (err) {
    log(`Appraisal failed: ${err.message}`, "error");
  }
});

// Sync appraised item to online leaderboard Creg's Depot tab!
btnSyncItem.addEventListener("click", async () => {
  const dreamloKey = dreamloInput.value.trim();
  if (!appraisedItem) return;
  
  logBox.innerHTML = "Status: Syncing appraised gear to visual stash online...";
  
  try {
    const entryName = `ITEM_${Date.now()}`;
    const explicit_str = appraisedItem.explicit_mods.join(";");
    
    // Position pipe separated payload
    const item_payload = [
      appraisedItem.rarity,
      appraisedItem.name,
      appraisedItem.base_type,
      appraisedItem.level_req || 0,
      appraisedItem.item_level || 0,
      explicit_str,
      appraisedItem.estimated_price_string,
      appraisedItem.flavor_text || "",
      appraisedItem.bot_culling_logs,
      getIconUrl(appraisedItem.name, appraisedItem.base_type)
    ].join("|");
    
    const pushUrl = `https://dreamlo.com/lb/${dreamloKey}/add/${entryName}/0/0/${encodeURIComponent(item_payload)}`;
    
    const pushRes = await fetch(pushUrl);
    if (!pushRes.ok) {
      throw new Error(`Database push failed: ${pushRes.status}`);
    }
    
    log(`✅ Live item successfully added to Depot Drop! ${appraisedItem.name} listed at ${appraisedItem.estimated_price_string}.`, "success");
    appraisalCard.style.display = "none";
    clipboardPaste.value = "";
    appraisedItem = null;
    
  } catch (err) {
    log(`Website sync failed: ${err.message}`, "error");
  }
});

// Map item names and types to standard high-quality GGG CDN icon graphics
function getIconUrl(name, baseType) {
  const n = name.toLowerCase();
  const b = baseType.toLowerCase();
  
  if (n.includes("mageblood")) return "https://web.poecdn.com/image/Art/2DItems/Belts/Mageblood.png";
  if (n.includes("headhunter")) return "https://web.poecdn.com/image/Art/2DItems/Belts/Headhunter.png";
  if (n.includes("dreamfeather")) return "https://web.poecdn.com/image/Art/2DItems/Weapons/OneHandSwords/Dreamfeather.png";
  if (n.includes("taming")) return "https://web.poecdn.com/image/Art/2DItems/Rings/TheTaming.png";
  if (n.includes("bereks respite")) return "https://web.poecdn.com/image/Art/2DItems/Rings/BereksRespite.png";
  
  // Base type ring fallback
  if (b.includes("ring")) return "https://web.poecdn.com/image/Art/2DItems/Rings/OpalRing.png";
  if (b.includes("belt")) return "https://web.poecdn.com/image/Art/2DItems/Belts/HeavyBelt.png";
  if (b.includes("sword") || b.includes("blade")) return "https://web.poecdn.com/image/Art/2DItems/Weapons/OneHandSwords/Dreamfeather.png";
  
  // Generic fallback
  return "https://web.poecdn.com/image/Art/2DItems/Rings/OpalRing.png";
}

