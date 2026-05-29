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

// Bulk Syncer Elements
const bulkLeagueInput = document.getElementById("bulkLeague");
const bulkTabIndexInput = document.getElementById("bulkTabIndex");
const bulkStashTypeSelect = document.getElementById("bulkStashType");
const groupBulkAccountName = document.getElementById("groupBulkAccountName");
const bulkAccountNameInput = document.getElementById("bulkAccountName");
const btnBulkSync = document.getElementById("btnBulkSync");

// Build Deficiency Optimizer Elements (V2.3 Pivot)
const btnCaptureChar = document.getElementById("btnCaptureChar");
const btnToggleManualAudit = document.getElementById("btnToggleManualAudit");
const manualAuditInputs = document.getElementById("manualAuditInputs");
const manualFireRes = document.getElementById("manualFireRes");
const manualColdRes = document.getElementById("manualColdRes");
const manualLightRes = document.getElementById("manualLightRes");
const manualStr = document.getElementById("manualStr");
const manualDex = document.getElementById("manualDex");
const manualInt = document.getElementById("manualInt");
const btnRunManualAudit = document.getElementById("btnRunManualAudit");

const auditResults = document.getElementById("auditResults");
const resFireVal = document.getElementById("resFireVal");
const resFireBar = document.getElementById("resFireBar");
const resColdVal = document.getElementById("resColdVal");
const resColdBar = document.getElementById("resColdBar");
const resLightVal = document.getElementById("resLightVal");
const resLightBar = document.getElementById("resLightBar");
const resStrVal = document.getElementById("resStrVal");
const resDexVal = document.getElementById("resDexVal");
const resIntVal = document.getElementById("resIntVal");
const resGapWarning = document.getElementById("resGapWarning");
const btnBuyDeficiency = document.getElementById("btnBuyDeficiency");

// Hotkey Configuration Elements and Modalities
const btnToggleHotkeys = document.getElementById("btnToggleHotkeys");
const hotkeysLabel = document.getElementById("hotkeysLabel");
const hotkeysConfig = document.getElementById("hotkeysConfig");
const btnBindIdentify = document.getElementById("btnBindIdentify");
const btnBindAppraise = document.getElementById("btnBindAppraise");

// Default keybindings: Alt+I for Identify, Alt+O for Appraise
let hotkeyIdentify = { ctrl: false, alt: true, shift: false, key: "i" };
let hotkeyAppraise = { ctrl: false, alt: true, shift: false, key: "o" };
let activeRemapTarget = null; // "identify" or "appraise"

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

// Helper to format hotkeys human-readably (e.g. "Alt+I")
function formatHotkey(hk) {
  let parts = [];
  if (hk.ctrl) parts.push("Ctrl");
  if (hk.alt) parts.push("Alt");
  if (hk.shift) parts.push("Shift");
  
  let k = hk.key;
  if (k.length === 1) {
    k = k.toUpperCase();
  } else {
    k = k.charAt(0).toUpperCase() + k.slice(1);
  }
  parts.push(k);
  return parts.join("+");
}

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

  chrome.storage.local.get([
    "geminiKey", "dreamloKey", "hotkeyIdentify", "hotkeyAppraise", 
    "bulkLeague", "bulkTabIndex", "bulkStashType", "bulkAccountName",
    "manualFireRes", "manualColdRes", "manualLightRes", "manualStr", "manualDex", "manualInt"
  ], (data) => {
    geminiInput.value = data.geminiKey || defaultGeminiKey;
    dreamloInput.value = data.dreamloKey || defaultDreamloKey;
    
    if (data.hotkeyIdentify) {
      hotkeyIdentify = data.hotkeyIdentify;
    }
    if (data.hotkeyAppraise) {
      hotkeyAppraise = data.hotkeyAppraise;
    }
    
    btnBindIdentify.textContent = formatHotkey(hotkeyIdentify);
    btnBindAppraise.textContent = formatHotkey(hotkeyAppraise);

    // V2.2 inputs loading
    if (data.bulkLeague) bulkLeagueInput.value = data.bulkLeague;
    if (data.bulkTabIndex !== undefined) bulkTabIndexInput.value = data.bulkTabIndex;
    if (data.bulkStashType) {
      bulkStashTypeSelect.value = data.bulkStashType;
      if (data.bulkStashType === "personal") {
        groupBulkAccountName.style.display = "flex";
      } else {
        groupBulkAccountName.style.display = "none";
      }
    }
    if (data.bulkAccountName) bulkAccountNameInput.value = data.bulkAccountName;

    // V2.3 inputs loading
    if (data.manualFireRes !== undefined) manualFireRes.value = data.manualFireRes;
    if (data.manualColdRes !== undefined) manualColdRes.value = data.manualColdRes;
    if (data.manualLightRes !== undefined) manualLightRes.value = data.manualLightRes;
    if (data.manualStr !== undefined) manualStr.value = data.manualStr;
    if (data.manualDex !== undefined) manualDex.value = data.manualDex;
    if (data.manualInt !== undefined) manualInt.value = data.manualInt;
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
      systemInstruction: {
        parts: [{ text: SYSTEM_INSTRUCTION }]
      },
      generationConfig: {
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

// Refactored modular appraisal function
async function appraiseItemText(itemText, autoSync = false) {
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
  if (!itemText) {
    log("Error: Please paste item stats text first.", "error");
    return;
  }
  
  chrome.storage.local.set({ geminiKey, dreamloKey });
  logBox.innerHTML = `Status: Appraising item text stats via Gemini AI... ${autoSync ? '(Auto-Syncing)' : ''}`;
  appraisalCard.style.display = "none";
  
  try {
    const apiUrL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
    
    const payload = {
      contents: [{
        parts: [{ text: `Appraise the following Path of Exile 2 item text copied from in-game:\n\n${itemText}` }]
      }],
      systemInstruction: {
        parts: [{ text: APPRAISER_SYSTEM_INSTRUCTION }]
      },
      generationConfig: {
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
    
    if (autoSync) {
      log("Direct hotkey detected: Syncing appraised item immediately...");
      await syncAppraisedItemDirectly(dreamloKey);
    } else {
      appraisalCard.style.display = "block";
    }
    
  } catch (err) {
    log(`Appraisal failed: ${err.message}`, "error");
  }
}

// Refactored modular sync function
async function syncAppraisedItemDirectly(dreamloKey) {
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
    // If auto-sync fails, keep card open so they can retry manually
    appraisalCard.style.display = "block";
  }
}

// Hook up appraiser and sync buttons
btnAppraise.addEventListener("click", () => {
  appraiseItemText(clipboardPaste.value.trim(), false);
});

btnSyncItem.addEventListener("click", () => {
  const dreamloKey = dreamloInput.value.trim();
  syncAppraisedItemDirectly(dreamloKey);
});

// ==========================================
// CUSTOM BINDINGS & KEY REMAPPER
// ==========================================

// Toggle Hotkeys panel visibility
btnToggleHotkeys.addEventListener("click", () => {
  if (hotkeysConfig.style.display === "none") {
    hotkeysConfig.style.display = "flex";
    hotkeysLabel.textContent = "Close Panel ▴";
  } else {
    hotkeysConfig.style.display = "none";
    hotkeysLabel.textContent = "Configure Bindings ▾";
  }
});

// Bind button listening state
btnBindIdentify.addEventListener("click", () => {
  activeRemapTarget = "identify";
  btnBindIdentify.textContent = "Press key...";
  btnBindIdentify.focus();
});

btnBindAppraise.addEventListener("click", () => {
  activeRemapTarget = "appraise";
  btnBindAppraise.textContent = "Press key...";
  btnBindAppraise.focus();
});

// Hotkey triggers from active clipboard
async function triggerIdentifyAndSync() {
  switchToAppraiserTab();
  try {
    const text = await navigator.clipboard.readText();
    if (text && (text.includes("Rarity:") || text.includes("Item Class:"))) {
      clipboardPaste.value = text;
      log("Item clipboard text captured.", "success");
      await appraiseItemText(text, true);
    } else {
      log("Error: Clipboard does not contain a valid Path of Exile item copy! Hover over your item in-game, press Ctrl+C, then trigger the hotkey.", "error");
    }
  } catch (err) {
    log(`Failed to read clipboard: ${err.message}. If clipboard access is blocked, paste manually into the text area.`, "error");
  }
}

async function triggerAppraiseOnly() {
  switchToAppraiserTab();
  try {
    const text = await navigator.clipboard.readText();
    if (text && (text.includes("Rarity:") || text.includes("Item Class:"))) {
      clipboardPaste.value = text;
      log("Item clipboard text captured.", "success");
      await appraiseItemText(text, false);
    } else {
      log("Error: Clipboard does not contain a valid Path of Exile item copy! Hover over your item in-game, press Ctrl+C, then trigger the hotkey.", "error");
    }
  } catch (err) {
    log(`Failed to read clipboard: ${err.message}. If clipboard access is blocked, paste manually into the text area.`, "error");
  }
}

function switchToAppraiserTab() {
  activeMode = "appraiser";
  btnModeAppraiser.classList.add("active");
  btnModeStash.classList.remove("active");
  sectionStash.style.display = "none";
  sectionAppraiser.style.display = "block";
}

function matchHotkey(e, hk) {
  return e.ctrlKey === hk.ctrl &&
         e.altKey === hk.alt &&
         e.shiftKey === hk.shift &&
         e.key.toLowerCase() === hk.key.toLowerCase();
}

// Window Keyboard Listener for Hotkey capturing and Remapping logic
window.addEventListener("keydown", async (e) => {
  // 1. If currently in remapping mode
  if (activeRemapTarget) {
    e.preventDefault();
    e.stopPropagation();
    
    // Ignore stand-alone modifier keystrokes
    if (["control", "alt", "shift", "meta"].includes(e.key.toLowerCase())) {
      return;
    }
    
    const newHotkey = {
      ctrl: e.ctrlKey,
      alt: e.altKey,
      shift: e.shiftKey,
      key: e.key.toLowerCase()
    };
    
    if (activeRemapTarget === "identify") {
      hotkeyIdentify = newHotkey;
      chrome.storage.local.set({ hotkeyIdentify });
      btnBindIdentify.textContent = formatHotkey(hotkeyIdentify);
      log(`Identify hotkey rebound to: ${formatHotkey(hotkeyIdentify)}`, "success");
    } else if (activeRemapTarget === "appraise") {
      hotkeyAppraise = newHotkey;
      chrome.storage.local.set({ hotkeyAppraise });
      btnBindAppraise.textContent = formatHotkey(hotkeyAppraise);
      log(`Appraise hotkey rebound to: ${formatHotkey(hotkeyAppraise)}`, "success");
    }
    
    activeRemapTarget = null;
    btnBindIdentify.blur();
    btnBindAppraise.blur();
    return;
  }
  
  // 2. If focus is inside input/textarea fields, ignore macro triggers to prevent typing conflicts
  if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")) {
    return;
  }
  
  // 3. Match keys
  if (matchHotkey(e, hotkeyIdentify)) {
    e.preventDefault();
    log(`Hotkey Triggered: Identify & Sync (${formatHotkey(hotkeyIdentify)})`);
    await triggerIdentifyAndSync();
  } else if (matchHotkey(e, hotkeyAppraise)) {
    e.preventDefault();
    log(`Hotkey Triggered: Appraise Only (${formatHotkey(hotkeyAppraise)})`);
    await triggerAppraiseOnly();
  }
});

// ==========================================
// V2.2 GGG WEB API BULK SYNC ENGINE
// ==========================================

// Helper mapping frameType to PoE Rarity labels
const PoE_RARITY_MAP = {
  0: "Normal",
  1: "Magic",
  2: "Rare",
  3: "Unique",
  9: "Relic"
};

// Maps GGG API item payload to our standard pipe-separated format
function parsePoEItem(item) {
  const rarity = PoE_RARITY_MAP[item.frameType] || "Rare";
  
  // Rares have empty name on API, fallback to typeLine
  let name = item.name ? item.name.replace(/<<.*?>>/g, "") : "";
  if (!name) {
    name = item.typeLine ? item.typeLine.replace(/<<.*?>>/g, "") : "Identified Item";
  }
  
  const base = item.typeLine ? item.typeLine.replace(/<<.*?>>/g, "") : "Gear";
  
  // Find Level Requirement
  let levelReq = 0;
  if (item.requirements) {
    const lvlNode = item.requirements.find(r => r.name === "Level");
    if (lvlNode && lvlNode.values && lvlNode.values[0] && lvlNode.values[0][0]) {
      levelReq = parseInt(lvlNode.values[0][0], 10) || 0;
    }
  }
  
  const ilvl = item.ilvl || 0;
  
  // Combine implicit and explicit mods
  let affixes = [];
  if (item.implicitMods) affixes.push(...item.implicitMods);
  if (item.explicitMods) affixes.push(...item.explicitMods);
  // Sanitize mods text (remove PoE internal syntax bracket codes)
  const explicit_str = affixes.map(m => m.replace(/<<.*?>>/g, "")).join(";");
  
  // Default valuations (Free, 100% tokenless heuristic)
  let price = "Gear Pool";
  if (rarity === "Unique") {
    price = "Unique Gear";
    if (name.toLowerCase().includes("mageblood")) price = "248 Divine Orbs";
    if (name.toLowerCase().includes("headhunter")) price = "142 Divine Orbs";
    if (name.toLowerCase().includes("dreamfeather")) price = "4.5 Divine Orbs";
    if (name.toLowerCase().includes("taming")) price = "15 Divine Orbs";
  } else if (rarity === "Rare") {
    // If it's a rare with high resistances or life, mark it nice
    let isGood = false;
    if (explicit_str.includes("Resistance") || explicit_str.includes("Life") || explicit_str.includes("Mana")) {
      isGood = true;
    }
    price = isGood ? "35 Chaos Orbs" : "5 Chaos Orbs";
  }
  
  let flavor = "";
  if (item.flavourText) {
    flavor = item.flavourText.map(f => f.replace(/<<.*?>>/g, "")).join(" ");
  }
  
  const logs = "GGG Web API Bulk Sync";
  const url = item.icon || "https://web.poecdn.com/image/Art/2DItems/Rings/OpalRing.png";
  
  return [
    rarity,
    name,
    base,
    levelReq,
    ilvl,
    explicit_str,
    price,
    flavor,
    logs,
    url
  ].join("|");
}

// Bulk sync execution handler
async function bulkSyncStashTab() {
  const dreamloKey = dreamloInput.value.trim();
  const league = bulkLeagueInput.value.trim();
  const tabIndex = parseInt(bulkTabIndexInput.value.trim(), 10) || 0;
  const stashType = bulkStashTypeSelect.value;
  const accountName = bulkAccountNameInput.value.trim();
  
  if (!dreamloKey) {
    log("Error: Dreamlo Private Key required.", "error");
    return;
  }
  if (!league) {
    log("Error: League Name required.", "error");
    return;
  }
  if (stashType === "personal" && !accountName) {
    log("Error: Account Name is required for Personal Stash Sync.", "error");
    return;
  }
  
  // Persist input values to local storage
  chrome.storage.local.set({
    bulkLeague: league,
    bulkTabIndex: tabIndex,
    bulkStashType: stashType,
    bulkAccountName: accountName
  });
  
  logBox.innerHTML = `Status: Initiating bulk stash fetch from GGG API...`;
  
  try {
    // 1. Build GGG API Stash URL (explicitly set realm=poe2 for Path of Exile 2)
    let gggUrl = `https://www.pathofexile.com/character-window/get-stash-items?league=${encodeURIComponent(league)}&tabs=1&tabIndex=${tabIndex}&realm=poe2`;
    if (stashType === "guild") {
      gggUrl += "&guild=true";
    } else {
      gggUrl += `&accountName=${encodeURIComponent(accountName)}`;
    }
    
    log(`Connecting to GGG Stash (Tab #${tabIndex})...`);
    const res = await fetch(gggUrl);
    
    if (res.status === 403 || res.redirected) {
      throw new Error("Access Denied (403). Please make sure you are logged into pathofexile.com in this browser first!");
    }
    if (!res.ok) {
      throw new Error(`GGG API returned status ${res.status}`);
    }
    
    const stashData = await res.json();
    if (!stashData || !stashData.items) {
      throw new Error("Invalid tab index or no items found in this stash tab.");
    }
    
    const items = stashData.items;
    log(`GGG Fetch complete! Loaded ${items.length} items.`, "success");
    
    // V2.2.1 Auto-Detect Currency Tab vs. Gear Tab routing
    const activeTab = stashData.tabs ? stashData.tabs.find(t => t.i === tabIndex) : null;
    const tabName = activeTab ? activeTab.n.toLowerCase() : "";
    const coreCurrencyNames = [
      "scroll of wisdom", "orb of transmutation", "orb of augmentation", "orb of alchemy", 
      "regal orb", "chaos orb", "vaal orb", "orb of annulment", 
      "exalted orb", "divine orb", "mirror of kalandra"
    ];
    
    const isCurrencyTab = tabName.includes("currency") || 
      (items.length > 0 && items.every(item => coreCurrencyNames.includes(item.typeLine.toLowerCase())));
      
    if (isCurrencyTab) {
      log("Currency Tab detected! Auto-calculating stack sizes...");
      
      let currencyCounts = {
        scroll: 0, transmute: 0, augmentation: 0, alchemy: 0, regal: 0,
        chaos: 0, vaal: 0, annulment: 0, exalted: 0, divine: 0, mirror: 0
      };
      
      items.forEach(item => {
        const nameLower = item.typeLine.toLowerCase();
        const qty = item.stackSize || 1;
        
        if (nameLower === "scroll of wisdom") currencyCounts.scroll += qty;
        else if (nameLower === "orb of transmutation") currencyCounts.transmute += qty;
        else if (nameLower === "orb of augmentation") currencyCounts.augmentation += qty;
        else if (nameLower === "orb of alchemy") currencyCounts.alchemy += qty;
        else if (nameLower === "regal orb") currencyCounts.regal += qty;
        else if (nameLower === "chaos orb") currencyCounts.chaos += qty;
        else if (nameLower === "vaal orb") currencyCounts.vaal += qty;
        else if (nameLower === "orb of annulment") currencyCounts.annulment += qty;
        else if (nameLower === "exalted orb") currencyCounts.exalted += qty;
        else if (nameLower === "divine orb") currencyCounts.divine += qty;
        else if (nameLower === "mirror of kalandra") currencyCounts.mirror += qty;
      });
      
      const rates = {
        mirror: 40000.0, divine: 150.0, exalted: 15.0, annulment: 5.0, vaal: 2.0,
        chaos: 1.0, regal: 0.8, alchemy: 0.5, transmute: 0.2, augmentation: 0.15, scroll: 0.05
      };
      let total_chaos = 0.0;
      Object.keys(currencyCounts).forEach(k => {
        total_chaos += currencyCounts[k] * rates[k];
      });
      
      const core_keys = ["scroll", "transmute", "augmentation", "alchemy", "regal", "chaos", "vaal", "annulment", "exalted", "divine", "mirror"];
      const pipe_str = core_keys.map(k => currencyCounts[k]).join("|") + "|1.0";
      const total_score = Math.floor(total_chaos * 10);
      
      log("Syncing Currency counts directly to __GUILD_VAULT__ entry...");
      const pushUrl = `https://dreamlo.com/lb/${dreamloKey}/add/__GUILD_VAULT__/${total_score}/0/${encodeURIComponent(pipe_str)}`;
      
      const pushRes = await fetch(pushUrl);
      if (!pushRes.ok) {
        throw new Error(`Database push failed with status: ${pushRes.status}`);
      }
      
      log(`✅ Guild Currency Tab synced! Net Worth: ${total_chaos.toFixed(0)}c (~${(total_chaos/150).toFixed(1)} EX)`, "success");
      return;
    }
    
    // 2. Fetch current database entries to purge old items
    log("Querying online database for stale entries...");
    const dlGetUrl = `https://dreamlo.com/lb/${dreamloKey}/json`;
    const dlRes = await fetch(dlGetUrl);
    let dlData = null;
    if (dlRes.ok) {
      const text = await dlRes.text();
      if (text.startsWith("ERROR:")) {
        throw new Error(`Dreamlo database error: ${text}`);
      }
      try {
        dlData = JSON.parse(text);
      } catch (jsonErr) {
        console.warn("Dreamlo did not return valid JSON, skipping stale checks:", jsonErr);
      }
    }
    
    // Naming prefixes sanitized
    const safeAccount = accountName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const deletePrefix = stashType === "guild"
      ? `ITEM_GUILD_T${tabIndex}_`
      : `ITEM_PERS_${safeAccount}_T${tabIndex}_`;
      
    let deleteCount = 0;
    if (dlData && dlData.dreamlo && dlData.dreamlo.leaderboard && dlData.dreamlo.leaderboard.entry) {
      let entries = dlData.dreamlo.leaderboard.entry;
      if (!Array.isArray(entries)) entries = [entries];
      
      const staleEntries = entries.filter(e => e.name.startsWith(deletePrefix));
      if (staleEntries.length > 0) {
        log(`Purging ${staleEntries.length} old visual items for this tab...`);
        for (const entry of staleEntries) {
          try {
            const delUrl = `https://dreamlo.com/lb/${dreamloKey}/delete/${entry.name}`;
            await fetch(delUrl);
            deleteCount++;
            await new Promise(r => setTimeout(r, 80)); // Sequential delay
          } catch (e) {
            console.warn("Purge failed for entry:", entry.name, e);
          }
        }
      }
    }
    if (deleteCount > 0) {
      log(`Database cleared: Purged ${deleteCount} stale items.`, "success");
    }
    
    // 3. Sequential uploads
    log(`Syncing ${items.length} new items to Creg's Depot Drop...`);
    let successCount = 0;
    
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const payload = parsePoEItem(item);
      const entryName = `${deletePrefix}${i}`;
      
      try {
        const pushUrl = `https://dreamlo.com/lb/${dreamloKey}/add/${entryName}/0/0/${encodeURIComponent(payload)}`;
        const pushRes = await fetch(pushUrl);
        if (pushRes.ok) {
          successCount++;
        }
        await new Promise(r => setTimeout(r, 120)); // Rate limit protection
      } catch (pushErr) {
        console.warn("Item upload failed:", item.typeLine, pushErr);
      }
    }
    
    log(`✅ Bulk Sync Complete! Successfully uploaded ${successCount}/${items.length} items online!`, "success");
    
  } catch (err) {
    log(`Bulk Sync failed: ${err.message}`, "error");
  }
}

// Bind Syncer trigger button
btnBulkSync.addEventListener("click", bulkSyncStashTab);

// Toggle Account Name field depending on Stash Type select
bulkStashTypeSelect.addEventListener("change", () => {
  const isPersonal = bulkStashTypeSelect.value === "personal";
  groupBulkAccountName.style.display = isPersonal ? "flex" : "none";
});

// ==========================================
// V2.3 BUILD DEFICIENCY OPTIMIZER LOGIC (PIVOT)
// ==========================================

const CHAR_AUDIT_SYSTEM_INSTRUCTION = `You are an expert Path of Exile 2 Character Panel OCR extractor.
Analyze the screenshot of the character sheet (opened via the in-game 'C' panel showing defense and attributes stats) and extract the active net values for:
1. Fire Resistance (look for "Fire Resistance", net percentage value, e.g. 45% or 75% (80%), extract the active net value which is the first number, in this case 45 or 75).
2. Cold Resistance (look for "Cold Resistance", net percentage value, e.g. 75).
3. Lightning Resistance (look for "Lightning Resistance", net percentage value, e.g. -15 or 60).
4. Strength (look for "Strength", e.g. 95).
5. Dexterity (look for "Dexterity", e.g. 120).
6. Intelligence (look for "Intelligence", e.g. 80).

If a stat is not found, return 0. Only return the net active value (do not include the percentage sign, return as an integer).`;

const CHAR_AUDIT_SCHEMA = {
  type: "OBJECT",
  properties: {
    fire_res: { type: "INTEGER" },
    cold_res: { type: "INTEGER" },
    lightning_res: { type: "INTEGER" },
    strength: { type: "INTEGER" },
    dexterity: { type: "INTEGER" },
    intelligence: { type: "INTEGER" }
  },
  required: ["fire_res", "cold_res", "lightning_res", "strength", "dexterity", "intelligence"]
};

// Render Audit Results visually and build Trade Solver URL
function renderAuditResults(fire, cold, light, str, dex, int) {
  // Persist to local storage to prevent state loss
  chrome.storage.local.set({
    manualFireRes: fire,
    manualColdRes: cold,
    manualLightRes: light,
    manualStr: str,
    manualDex: dex,
    manualInt: int
  });

  const TARGET_RES = 75; // Active in-game target resistance cap

  // Fire Res Gauge
  resFireVal.textContent = `${fire}% / ${TARGET_RES}%`;
  const firePercent = Math.max(0, Math.min(100, Math.floor((fire / TARGET_RES) * 100)));
  resFireBar.style.width = `${firePercent}%`;
  if (fire >= TARGET_RES) {
    resFireVal.style.color = "#10b981"; // Green
    resFireBar.style.backgroundColor = "#10b981";
  } else {
    resFireVal.style.color = "#ef4444"; // Red
    resFireBar.style.backgroundColor = "#ef4444";
  }

  // Cold Res Gauge
  resColdVal.textContent = `${cold}% / ${TARGET_RES}%`;
  const coldPercent = Math.max(0, Math.min(100, Math.floor((cold / TARGET_RES) * 100)));
  resColdBar.style.width = `${coldPercent}%`;
  if (cold >= TARGET_RES) {
    resColdVal.style.color = "#10b981"; // Green
    resColdBar.style.backgroundColor = "#10b981";
  } else {
    resColdVal.style.color = "#ef4444"; // Red
    resColdBar.style.backgroundColor = "#ef4444";
  }

  // Lightning Res Gauge
  resLightVal.textContent = `${light}% / ${TARGET_RES}%`;
  const lightPercent = Math.max(0, Math.min(100, Math.floor((light / TARGET_RES) * 100)));
  resLightBar.style.width = `${lightPercent}%`;
  if (light >= TARGET_RES) {
    resLightVal.style.color = "#10b981"; // Green
    resLightBar.style.backgroundColor = "#10b981";
  } else {
    resLightVal.style.color = "#ef4444"; // Red
    resLightBar.style.backgroundColor = "#ef4444";
  }

  // Attributes
  resStrVal.textContent = `${str}`;
  resDexVal.textContent = `${dex}`;
  resIntVal.textContent = `${int}`;

  // Identify worst deficiency for trade query solver
  let deficiencies = [
    { name: "Fire Resistance", key: "fire", current: fire, gggId: "explicit.stat_3372524274", label: "🔥 BUY FIRE RES RING" },
    { name: "Cold Resistance", key: "cold", current: cold, gggId: "explicit.stat_4220027924", label: "❄️ BUY COLD RES RING" },
    { name: "Lightning Resistance", key: "light", current: light, gggId: "explicit.stat_1676847064", label: "⚡ BUY LIGHTNING RES RING" }
  ];

  deficiencies.sort((a, b) => a.current - b.current);
  const worst = deficiencies[0];
  const gap = TARGET_RES - worst.current;

  if (gap > 0) {
    resGapWarning.textContent = `⚠️ Lacking ${gap}% ${worst.name}!`;
    resGapWarning.style.color = "#f59e0b"; // Orange
    btnBuyDeficiency.style.display = "block";
    btnBuyDeficiency.textContent = worst.label;

    // GGG official trade query object for Ring slot with deficiency filter
    const league = bulkLeagueInput.value.trim() || "Standard";
    const tradeQuery = {
      query: {
        status: { option: "online" },
        type: "Ring",
        stats: [
          {
            type: "and",
            filters: [
              {
                id: worst.gggId,
                value: { min: Math.min(45, gap) } // query at least what is missing (capped at 45)
              }
            ]
          }
        ]
      }
    };

    btnBuyDeficiency.onclick = () => {
      const tradeUrl = `https://www.pathofexile.com/trade/search/${encodeURIComponent(league)}?q=${encodeURIComponent(JSON.stringify(tradeQuery))}`;
      window.open(tradeUrl, "_blank");
    };
  } else {
    resGapWarning.textContent = "🏆 ALL RESISTANCES CAPPED!";
    resGapWarning.style.color = "#10b981"; // Green
    btnBuyDeficiency.style.display = "none";
  }

  auditResults.style.display = "flex";
}

// Heuristic manual input calculation
function runManualAudit() {
  const fire = parseInt(manualFireRes.value, 10) || 0;
  const cold = parseInt(manualColdRes.value, 10) || 0;
  const light = parseInt(manualLightRes.value, 10) || 0;
  const str = parseInt(manualStr.value, 10) || 0;
  const dex = parseInt(manualDex.value, 10) || 0;
  const int = parseInt(manualInt.value, 10) || 0;

  renderAuditResults(fire, cold, light, str, dex, int);
  logBox.innerHTML = `Status: Manual stats audit computed!`;
}

// Visual OCR capture and processing
async function runCharOcrAudit() {
  const geminiKey = geminiInput.value.trim();
  if (!geminiKey) {
    log("Error: Gemini API Key required for Visual OCR Mode.", "error");
    return;
  }

  logBox.innerHTML = "Status: Initializing display grab for Character Sheet...";
  log("Please ensure your in-game Character Panel (C key) is open on your screen!");

  try {
    const stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: "window" },
      audio: false
    });

    log("Character Panel screen grab connected.");
    tempVideo.srcObject = stream;
    tempVideo.play();

    tempVideo.onloadedmetadata = () => {
      setTimeout(() => {
        captureAndOcrCharacter(stream, geminiKey);
      }, 600);
    };

  } catch (err) {
    log(`Character grab aborted or failed: ${err.message}`, "error");
  }
}

async function captureAndOcrCharacter(stream, geminiKey) {
  try {
    const videoWidth = tempVideo.videoWidth;
    const videoHeight = tempVideo.videoHeight;

    const ctx = previewCanvas.getContext("2d");
    previewCanvas.width = videoWidth;
    previewCanvas.height = videoHeight;

    ctx.drawImage(tempVideo, 0, 0, videoWidth, videoHeight);

    // Stop video tracks
    stream.getTracks().forEach(track => track.stop());
    log("Screen frame captured successfully.");

    const dataUrl = previewCanvas.toDataURL("image/png");
    const base64Data = dataUrl.split(",")[1];

    previewCanvas.style.display = "block";
    log("Running Gemini Vision character sheet OCR analysis...");

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;

    const payload = {
      contents: [{
        parts: [
          { text: "Extract active character resistances and attributes from this Character Panel sheet image." },
          {
            inlineData: {
              mimeType: "image/png",
              data: base64Data
            }
          }
        ]
      }],
      systemInstruction: {
        parts: [{ text: CHAR_AUDIT_SYSTEM_INSTRUCTION }]
      },
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: CHAR_AUDIT_SCHEMA
      }
    };

    const res = await fetch(apiUrl, {
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
    log("Gemini parsed character stats successfully.");

    const data = JSON.parse(responseText);

    const fire = data.fire_res !== undefined ? data.fire_res : 0;
    const cold = data.cold_res !== undefined ? data.cold_res : 0;
    const light = data.lightning_res !== undefined ? data.lightning_res : 0;
    const str = data.strength !== undefined ? data.strength : 0;
    const dex = data.dexterity !== undefined ? data.dexterity : 0;
    const int = data.intelligence !== undefined ? data.intelligence : 0;

    // Autofill manual inputs with OCR values
    manualFireRes.value = fire;
    manualColdRes.value = cold;
    manualLightRes.value = light;
    manualStr.value = str;
    manualDex.value = dex;
    manualInt.value = int;

    renderAuditResults(fire, cold, light, str, dex, int);
    log(`✅ OCR Audit Complete! Stats successfully synchronized!`, "success");

  } catch (err) {
    log(`Character OCR failed: ${err.message}`, "error");
  }
}

// Bind V2.3 Event Listeners
btnCaptureChar.addEventListener("click", runCharOcrAudit);
btnToggleManualAudit.addEventListener("click", () => {
  if (manualAuditInputs.style.display === "none") {
    manualAuditInputs.style.display = "flex";
    btnToggleManualAudit.textContent = "🙈 HIDE MANUAL INPUTS";
  } else {
    manualAuditInputs.style.display = "none";
    btnToggleManualAudit.textContent = "✍️ TYPE STATS MANUALLY";
  }
});
btnRunManualAudit.addEventListener("click", runManualAudit);

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

