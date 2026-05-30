// GLG PoE2 Stash Scanner Extension Logic (V2.0)

// Default pre-allocated shared keys loaded dynamically from git-ignored config.json
let defaultGeminiKey = "";
let defaultSupabaseUrl = "https://qqljadcpxsubawmzkecl.supabase.co";
let defaultSupabaseAnonKey = "sb_publishable_T8G6w3OtwXRG_cXd_-h9YQ_s8U9iDnx";
let defaultGuildWriteKey = "BCU5C-reDUecvjLm4tV6QkGVvTGbX-Uyuyz5Xtpml5A";

// Global appraised item storage
let appraisedItem = null;
let activeMode = "stash"; // "stash" or "appraiser"

// Elements
const geminiInput = document.getElementById("geminiKey");
const supabaseUrlInput = document.getElementById("supabaseUrl");
const supabaseAnonKeyInput = document.getElementById("supabaseAnonKey");
const guildWriteKeyInput = document.getElementById("guildWriteKey");
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

// Bulk / Vault Routing Elements
const bulkTabIndexInput = document.getElementById("bulkTabIndex");
const vaultStashTypeSelect = document.getElementById("vaultStashType");
const personalRoutingFields = document.getElementById("personalRoutingFields");
const vaultUsernameSelect = document.getElementById("vaultUsername");
const vaultPasswordInput = document.getElementById("vaultPassword");

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

// Visual active-tab metadata matching true PoE2 stash tabs in vault.html
const STASH_TABS_METADATA = [
  { id: "currency", name: "CURRENCY", tabIndex: 0, type: "currency" },
  { id: "dump", name: "DUMP TAB", tabIndex: 1, type: "standard" },
  { id: "uniq_dump", name: "UNIQUE DUMP", tabIndex: 2, type: "standard" },
  { id: "tab_1", name: "STASH TAB 1", tabIndex: 3, type: "standard" },
  { id: "tab_2", name: "STASH TAB 2", tabIndex: 4, type: "standard" },
  { id: "tab_3", name: "STASH TAB 3", tabIndex: 5, type: "standard" },
  { id: "jewels", name: "JEWELS", tabIndex: 6, type: "standard" },
  { id: "tab_10", name: "TAB 10 (QUAD)", tabIndex: 7, type: "quad" },
  { id: "tab_11", name: "TAB 11 (QUAD)", tabIndex: 8, type: "quad" },
  { id: "tab_12", name: "TAB 12 (QUAD)", tabIndex: 9, type: "quad" },
  { id: "tab_13", name: "TAB 13 (QUAD)", tabIndex: 10, type: "quad" },
  { id: "tab_14", name: "TAB 14 (QUAD)", tabIndex: 11, type: "quad" },
  { id: "tab_15", name: "TAB 15 (QUAD)", tabIndex: 12, type: "quad" },
  { id: "tab_16", name: "TAB 16 (QUAD)", tabIndex: 13, type: "quad" },
  { id: "tab_17", name: "TAB 17 (QUAD)", tabIndex: 14, type: "quad" },
  { id: "tab_18", name: "TAB 18 (QUAD)", tabIndex: 15, type: "quad" },
  { id: "essence", name: "ESSENCE", tabIndex: 16, type: "essence" },
  { id: "delirium", name: "DELIRIUM", tabIndex: 17, type: "delirium" },
  { id: "runes", name: "RUNES", tabIndex: 18, type: "runes" },
  { id: "ritual", name: "RITUAL", tabIndex: 19, type: "ritual" }
];

const IGNORED_TABS_METADATA = [
  { id: "unique", name: "UNIQUE STASH" },
  { id: "maps", name: "MAPS STASH" },
  { id: "flasks", name: "FLASKS STASH" },
  { id: "gems", name: "GEMS STASH" }
];

// Flexible string matching helper matching GGG tab indexes
function findMatchedTab(detectedStr) {
  if (!detectedStr) return null;
  const clean = detectedStr.toUpperCase().trim();
  
  // Clean punctuation but keep spaces/numbers
  const cleanSpaced = clean.replace(/[^A-Z0-9\s]/g, "").replace(/\s+/g, " ").trim();
  
  // 1. Check ignored list first
  for (const tab of IGNORED_TABS_METADATA) {
    if (cleanSpaced.includes(tab.name) || tab.name.includes(cleanSpaced)) {
      return { ...tab, isIgnored: true };
    }
  }

  // 2. Exact match check
  for (const tab of STASH_TABS_METADATA) {
    if (cleanSpaced === tab.name) {
      return tab;
    }
  }
  
  // 3. ID match check
  for (const tab of STASH_TABS_METADATA) {
    if (cleanSpaced === tab.id.toUpperCase()) {
      return tab;
    }
  }

  // 4. Flexible match check (contains)
  for (const tab of STASH_TABS_METADATA) {
    if (cleanSpaced.includes(tab.name) || tab.name.includes(cleanSpaced)) {
      // Numerical protection (e.g. '1' matches 'TAB 1' but not 'TAB 10')
      if (/\d+/.test(cleanSpaced) && /\d+/.test(tab.name)) {
        const numInClean = cleanSpaced.match(/\d+/)[0];
        const numInTab = tab.name.match(/\d+/)[0];
        if (numInClean !== numInTab) continue;
      }
      return tab;
    }
  }
  
  return null;
}

// Spatial visual prompt coordinate guides matching true active tab layout and contents
const SYSTEM_INSTRUCTION = `You are a Path of Exile 2 Stash Tab visual auditor. 
Your task is to:
1. Identify the active stash tab name. Look at which tab name is highlighted in blue/white in the top horizontal tab row or right vertical sidebar (e.g. CURRENCY, DUMP TAB, UNIQUE DUMP, JEWELS, MAPS, ESSENCE, DELIRIUM, RUNES, RITUAL, 1, 2, 3, etc.). Gold arrow pointers in the sidebar are also visual cues. Return this exact name in the 'detected_tab' field in uppercase.
2. Based on the active tab type, extract either currency or equipment:
   - If the detected active tab is 'CURRENCY': Visually analyze the stash contents and extract exact quantities of all visible Path of Exile 2 currency items in the slot grids. Use the spatial visual guide below. Populate 'currency_data' and leave 'gear_items' empty.
   - If the detected active tab is a gear tab (like DUMP, UNIQUE DUMP, JEWELS, TAB 1, 2, 3, 10, 11, etc.): Visually analyze the stash grid and extract all visible Rare and Unique equipment gear items (rings, belts, amulets, boots, gloves, helmets, weapons, body armours). For each visible item in the grid, only extract its base type and its rarity. Populate 'gear_items' and leave 'currency_data' empty.

CURRENCY SPATIAL VISUAL GUIDE:
1. FAR-LEFT GRID (5 rows by 3 columns of slots):
   - Row 1: transmute (Col 1, Base) | greater_transmute (Col 2, II) | perfect_transmute (Col 3, III) [Dark blue circular multi-faced orbs]
   - Row 2: augmentation (Col 1, Base) | greater_augmentation (Col 2, II) | perfect_augmentation (Col 3, III) [Bronze/copper circular multi-faced orbs]
   - Row 3: regal (Col 1, Base) | greater_regal (Col 2, II) | perfect_regal (Col 3, III) [Half-blue, half-gold face orbs]
   - Row 4: exalted (Col 1, Base) | greater_exalted (Col 2, II) | perfect_exalted (Col 3, III) [Shiny gold cracked face orbs]
   - Row 5: chaos (Col 1, Base) | greater_chaos (Col 2, II) | perfect_chaos (Col 3, III) [Golden face orbs composed of multiple stacked mini-faces]

2. CENTRAL UTILITY GRID (3 rows by 3 columns of slots directly to the right of the 5x3 grid):
   - Row 1 (Top row): Column 1 (Left) is alchemy | Column 2 (Middle) is vaal | Column 3 (Right) is annulment
   - Row 2 (Middle row): Column 1 (Left) is chance | Column 2 (Middle) is fracturing | Column 3 (Right) is divine
   - Row 3 (Bottom row): Column 1 (Left) is hinekoras_lock | Column 2 (Middle) is mirror | Column 3 (Right) is artificer

3. TOP-RIGHT HORIZONTAL CLUSTER (Jewellers' Currency):
   - lesser_jeweller (Left, plain loop) | greater_jeweller (Middle) | perfect_jeweller (Right, with gem)

4. SCROLL OF WISDOM:
   - scroll (Red-tied blue scroll icon on the right side)

5. BOTTOM DUMP/LEAGUE SLOTS (Runes of Aldur League items):
   - verisium: Verisium Ore (stacks of blue crystals/shards)
   - runic_alloy: Runic Alloy (stacks of blue metallic bars)
   - aldurs_legacy: Aldur's Legacy Rune (rare golden rune with intricate glyph)
   - iron_rune: Iron Rune (round dark grey rune with an iron symbol)
   - gold_rune: Gold Rune (round gold rune with a gold symbol)
   - stone_rune: Stone Rune (round grey stone rune with a stone symbol)
   - uncut_gem: Uncut Skill Gem (blue/green/red glowing crystal gems)

EQUIPMENT EXTRACTION RULES:
For each gear item inside standard or quad stash grids, only extract:
- base: The base item type (e.g. Topaz Ring, Heavy Belt, Leather Belt, Crossbow, Amulet, plate, helmet, boots, gloves, etc.).
- rarity: 'Unique' or 'Rare' based on border color (orange for Unique, yellow for Rare).`;

// Schema definition for visual active-tab routing stash sync
const STASH_SCAN_SCHEMA = {
  type: "OBJECT",
  properties: {
    detected_tab: {
      type: "STRING",
      description: "Active stash tab name detected from screenshot cues, in UPPERCASE."
    },
    currency_data: {
      type: "OBJECT",
      description: "Currency stash tab values. Populate only if detected_tab is 'CURRENCY'.",
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
        perfect_jeweller: { type: "INTEGER" },
        verisium: { type: "INTEGER" },
        runic_alloy: { type: "INTEGER" },
        aldurs_legacy: { type: "INTEGER" },
        iron_rune: { type: "INTEGER" },
        gold_rune: { type: "INTEGER" },
        stone_rune: { type: "INTEGER" },
        uncut_gem: { type: "INTEGER" }
      }
    },
    gear_items: {
      type: "ARRAY",
      description: "Visible gear equipment list in standard/quad stash tab grids. Extract every single item visible. For each item, only extract the base type (e.g. Topaz Ring, Crossbow, Heavy Belt, Plate, Helmet, Boots) and rarity.",
      items: {
        type: "OBJECT",
        properties: {
          base: { type: "STRING", description: "The base item type, e.g. Topaz Ring, Heavy Belt, Crossbow, Helmet, Boots, Amulet, Gloves, etc." },
          rarity: { type: "STRING", description: "Rarity of the item: Unique or Rare" }
        },
        required: ["base", "rarity"]
      }
    }
  },
  required: ["detected_tab"]
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
      defaultSupabaseUrl = config.default_supabase_url || defaultSupabaseUrl;
      defaultSupabaseAnonKey = config.default_supabase_anon_key || defaultSupabaseAnonKey;
      defaultGuildWriteKey = config.default_guild_write_key || defaultGuildWriteKey;
    }
  } catch (err) {
    console.warn("Failed to load local config.json:", err);
  }

  chrome.storage.local.get([
    "geminiKey", "supabaseUrl", "supabaseAnonKey", "guildWriteKey", "hotkeyIdentify", "hotkeyAppraise", 
    "bulkTabIndex", "vaultStashType", "vaultUsername", "vaultPassword",
    "manualFireRes", "manualColdRes", "manualLightRes", "manualStr", "manualDex", "manualInt"
  ], (data) => {
    geminiInput.value = data.geminiKey || defaultGeminiKey;
    supabaseUrlInput.value = data.supabaseUrl || defaultSupabaseUrl;
    supabaseAnonKeyInput.value = data.supabaseAnonKey || defaultSupabaseAnonKey;
    guildWriteKeyInput.value = data.guildWriteKey || defaultGuildWriteKey;
    
    if (data.hotkeyIdentify) {
      hotkeyIdentify = data.hotkeyIdentify;
    }
    if (data.hotkeyAppraise) {
      hotkeyAppraise = data.hotkeyAppraise;
    }
    
    btnBindIdentify.textContent = formatHotkey(hotkeyIdentify);
    btnBindAppraise.textContent = formatHotkey(hotkeyAppraise);

    // Vault routing inputs loading
    if (data.bulkTabIndex !== undefined) bulkTabIndexInput.value = data.bulkTabIndex;
    if (data.vaultStashType) {
      vaultStashTypeSelect.value = data.vaultStashType;
      if (data.vaultStashType === "personal") {
        personalRoutingFields.style.display = "flex";
      }
    }
    if (data.vaultUsername) vaultUsernameSelect.value = data.vaultUsername;
    if (data.vaultPassword) vaultPasswordInput.value = data.vaultPassword;

    // V2.3 inputs loading
    if (data.manualFireRes !== undefined) manualFireRes.value = data.manualFireRes;
    if (data.manualColdRes !== undefined) manualColdRes.value = data.manualColdRes;
    if (data.manualLightRes !== undefined) manualLightRes.value = data.manualLightRes;
    if (data.manualStr !== undefined) manualStr.value = data.manualStr;
    if (data.manualDex !== undefined) manualDex.value = data.manualDex;
    if (data.manualInt !== undefined) manualInt.value = data.manualInt;
  });

  // Vault Routing Change Listeners
  vaultStashTypeSelect.addEventListener("change", () => {
    if (vaultStashTypeSelect.value === "personal") {
      personalRoutingFields.style.display = "flex";
    } else {
      personalRoutingFields.style.display = "none";
    }
    chrome.storage.local.set({ vaultStashType: vaultStashTypeSelect.value });
  });

  vaultUsernameSelect.addEventListener("change", () => {
    chrome.storage.local.set({ vaultUsername: vaultUsernameSelect.value });
  });

  vaultPasswordInput.addEventListener("input", () => {
    chrome.storage.local.set({ vaultPassword: vaultPasswordInput.value });
  });

  bulkTabIndexInput.addEventListener("input", () => {
    chrome.storage.local.set({ bulkTabIndex: parseInt(bulkTabIndexInput.value, 10) || 0 });
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

let VAULT_PASSCODE_HASHES = {
  "baorunner": "f00bf0465d1fede533b97579707f2557931fcf992d37eacbec7f034edd50c2ec", // bao79
  "chaz": "ddb17e5b8507c3a861fe23bfc9a38a3ac6462cf0ed331f2cc2ae8b8e587683de", // chz42
  "creg": "01dcef73763a5e49774bff772269f818be1ceb86600b486668ac7a659b06463a", // crg88
  "huneybutta": "b042927dd1b6249c78655880ab617219dcb971b5176fabdac61c626614340a42", // hny13
  "pseudofro": "394d29b7998e3510c930746d15e2a61d5cb87a08f0fb59ad94d0b8212fae0d80", // psd64
  "radiocommander": "1bc844f5e006387edaf2de438063666b0c21c72dfd4636666d6db2b64cd6bf9b", // rad75
  "smooth": "9741cb6124b4184fa4d7c24400a9d35079bdc3ea98c59590af05b15f1da3cd62", // smh27
  "petejohn": "61cd970e71bf78349a0c6a501a3d7944a70a7ac4c2f8f3b639efc7c9bd60511d" // pet33
};

async function loadLiveExtensionHashes() {
  const url = supabaseUrlInput.value.trim() || defaultSupabaseUrl;
  const key = supabaseAnonKeyInput.value.trim() || defaultSupabaseAnonKey;
  if (!url || !key) return;
  try {
    const res = await fetch(`${url}/rest/v1/poe2_guild_vault?name=eq.__GUILD_PASSCODES__&select=*`, {
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`
      }
    });
    if (res.ok) {
      const rows = await res.json();
      if (rows && rows.length > 0 && rows[0].data) {
        const data = rows[0].data;
        VAULT_PASSCODE_HASHES = { ...VAULT_PASSCODE_HASHES, ...data };
        
        const exiles = data.__EXILES_LIST__ || ["baoRunner", "Chaz", "Creg", "HuneyButta", "pseudofro", "Radiocommander", "Smooth", "Petejohn"];
        const select = document.getElementById("vaultUsername");
        if (select) {
          const prev = select.value;
          select.innerHTML = "";
          exiles.forEach(ex => {
            const opt = document.createElement("option");
            opt.value = ex.toLowerCase();
            opt.textContent = ex;
            select.appendChild(opt);
          });
          if (exiles.map(e => e.toLowerCase()).includes(prev)) {
            select.value = prev;
          }
        }
      }
    }
  } catch(e) {
    console.warn("Failed to load extension hashes:", e);
  }
}

async function validateVaultProfile() {
  if (vaultStashTypeSelect.value === "guild") return true;
  
  await loadLiveExtensionHashes();
  
  const user = vaultUsernameSelect.value.toLowerCase();
  const pass = vaultPasswordInput.value.trim();
  
  if (!pass) {
    alert("🔒 Profile Passcode required for player personal stashes!");
    return false;
  }
  
  const encoder = new TextEncoder();
  const data = encoder.encode(pass);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  
  const expected = VAULT_PASSCODE_HASHES[user];
  if (hashHex === expected) {
    return true;
  } else {
    alert("❌ Vault Passcode authentication failed. Please enter the correct profile passcode!");
    return false;
  }
}

// Stash Sync Click Trigger
btnSync.addEventListener("click", async () => {
  const geminiKey = geminiInput.value.trim();
  const supabaseUrl = supabaseUrlInput.value.trim();
  const supabaseAnonKey = supabaseAnonKeyInput.value.trim();
  const guildWriteKey = guildWriteKeyInput.value.trim();
  
  if (!geminiKey) {
    log("Error: Gemini API Key required.", "error");
    return;
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    log("Error: Supabase URL and Anon Key required.", "error");
    return;
  }
  if (!guildWriteKey) {
    log("Error: Guild Write Key required.", "error");
    return;
  }
  
  const authOk = await validateVaultProfile();
  if (!authOk) return;
  
  chrome.storage.local.set({ geminiKey, supabaseUrl, supabaseAnonKey, guildWriteKey });
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
        captureAndUpload(stream, geminiKey, supabaseUrl, supabaseAnonKey, guildWriteKey);
      }, 500);
    };
    
  } catch (err) {
    log(`Display grab aborted or failed: ${err.message}`, "error");
  }
});

// Capture frame, crop, and run Gemini/Supabase processing
async function captureAndUpload(stream, geminiKey, supabaseUrl, supabaseAnonKey, guildWriteKey) {
  try {
    const videoWidth = tempVideo.videoWidth;
    const videoHeight = tempVideo.videoHeight;
    
    // Aspect Ratio / Bounding Box Multiplier (0.5 for 16:9 width, 0.8 to crop out bottom fifth health/search overlay)
    const CROP_PERCENT = 0.5; 
    const cropWidth = Math.floor(videoWidth * CROP_PERCENT);
    const cropHeight = Math.floor(videoHeight * 0.8);
    
    log(`Capturing with aspect-crop: ${CROP_PERCENT * 100}% width, 80% height (${cropWidth}x${cropHeight})...`);
    
    const ctx = previewCanvas.getContext("2d");
    previewCanvas.width = cropWidth;
    previewCanvas.height = cropHeight;
    
    // Crop and draw only the left-side stash panel, cutting out the bottom fifth
    ctx.drawImage(tempVideo, 0, 0, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight);
    
    stream.getTracks().forEach(track => track.stop());
    log("Captured and cropped screen frame successfully.");
    
    const dataUrl = previewCanvas.toDataURL("image/png");
    const base64Data = dataUrl.split(",")[1];
    
    previewCanvas.style.display = "block";
    log("Running Gemini Multimodal Vision active-tab classification...");
    
    const apiUrL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
    
    const payload = {
      contents: [{
        parts: [
          { text: "Visually audit this Path of Exile 2 stash tab. Classify the active tab and extract its items." },
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
        responseSchema: STASH_SCAN_SCHEMA
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
    
    const data = JSON.parse(responseText);
    const rawTab = data.detected_tab || "CURRENCY";
    log(`Gemini Vision classified active tab: "${rawTab}"`, "success");
    
    const matchedTab = findMatchedTab(rawTab);
    
    if (!matchedTab) {
      log(`⚠️ Unrecognized active tab name: "${rawTab}". Sync aborted to protect database.`, "error");
      return;
    }
    
    if (matchedTab.isIgnored) {
      log(`⚠️ Ignored specialty tab detected: "${matchedTab.name}". Sync aborted as requested.`, "success");
      return;
    }
    
    log(`Routing ingestion sequence for "${matchedTab.name}" (Stash Index: ${matchedTab.tabIndex}, Type: ${matchedTab.type})...`);
    
    if (matchedTab.type === "currency") {
      log("Extracting currency quantities...");
      const cData = data.currency_data || {};
      
      const core_data = {
        scroll: cData.scroll || 0,
        transmute: (cData.transmute || 0) + (cData.greater_transmute || 0) + (cData.perfect_transmute || 0),
        augmentation: (cData.augmentation || 0) + (cData.greater_augmentation || 0) + (cData.perfect_augmentation || 0),
        alchemy: cData.alchemy || 0,
        regal: (cData.regal || 0) + (cData.greater_regal || 0) + (cData.perfect_regal || 0),
        chaos: (cData.chaos || 0) + (cData.greater_chaos || 0) + (cData.perfect_chaos || 0),
        vaal: cData.vaal || 0,
        annulment: cData.annulment || 0,
        exalted: (cData.exalted || 0) + (cData.greater_exalted || 0) + (cData.perfect_exalted || 0),
        divine: cData.divine || 0,
        mirror: cData.mirror || 0,
        verisium: cData.verisium || 0,
        runic_alloy: cData.runic_alloy || 0,
        aldurs_legacy: cData.aldurs_legacy || 0,
        iron_rune: cData.iron_rune || 0,
        gold_rune: cData.gold_rune || 0,
        stone_rune: cData.stone_rune || 0,
        uncut_gem: cData.uncut_gem || 0
      };
      
      const rates = {
        mirror: 40000.0, divine: 150.0, exalted: 15.0, annulment: 5.0, vaal: 2.0,
        chaos: 1.0, regal: 0.8, alchemy: 0.5, transmute: 0.2, augmentation: 0.15, scroll: 0.05
      };
      let total_chaos = 0.0;
      Object.keys(core_data).forEach(k => {
        total_chaos += (core_data[k] || 0) * (rates[k] || 0.0);
      });
      
      log("Syncing Currency counts directly to __GUILD_VAULT__ entry...");
      const currencyPayload = {
        ...core_data,
        sync_version: "1.0"
      };
  
      const pushRes = await fetch(`${supabaseUrl}/rest/v1/rpc/sync_vault_item`, {
        method: "POST",
        headers: {
          "apikey": supabaseAnonKey,
          "Authorization": `Bearer ${supabaseAnonKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          p_name: "__GUILD_VAULT__",
          p_data: currencyPayload,
          p_write_key: guildWriteKey
        })
      });
      
      if (!pushRes.ok) {
        throw new Error(`Supabase push failed: ${await pushRes.text()}`);
      }
      
      log(`✅ Guild Vault Currency synced successfully! Net Worth: ${total_chaos.toFixed(0)}c (~${(total_chaos/150).toFixed(1)} EX)`, "success");
      
      // Standard / Quad / Specialty Gear Stash tabs culling & reconciliation
      const gearItems = data.gear_items || [];
      log(`Scanned ${gearItems.length} items. Ditching coordinates and appraising via fingerprints...`);
      
      const stashType = vaultStashTypeSelect.value;
      const vaultUser = vaultUsernameSelect.value.toLowerCase();
      
      const deletePrefix = stashType === "guild"
        ? `ITEM_GUILD_T${matchedTab.tabIndex}_`
        : `ITEM_PERS_${vaultUser}_T${matchedTab.tabIndex}_`;
      
      // 1. Fetch existing entries inside this specific tab
      log(`Fetching current database listings for Tab Index ${matchedTab.tabIndex} (${matchedTab.name})...`);
      const existRes = await fetch(`${supabaseUrl}/rest/v1/poe2_guild_vault?name=like.${deletePrefix}*&select=*`, {
        headers: {
          "apikey": supabaseAnonKey,
          "Authorization": `Bearer ${supabaseAnonKey}`
        }
      });
      
      if (!existRes.ok) {
        throw new Error(`Failed to fetch existing database listings: ${await existRes.text()}`);
      }
      
      const existingEntries = await existRes.json();
      log(`Database currently has ${existingEntries.length} items in this tab.`);
      
      // 2. Count new items grouped by visual signature match key (Rarity + Base type for stats preservation)
      function getMatchKey(item) {
        const rarity = (item.rarity || "Rare").toLowerCase();
        const base = (item.base || "Gear").toLowerCase();
        return `${rarity}|${base}`;
      }
      
      const newCounts = {};
      gearItems.forEach(item => {
        const key = getMatchKey(item);
        newCounts[key] = (newCounts[key] || 0) + 1;
      });
      
      // 3. Group existing database items by signature key
      const existingGrouped = {};
      existingEntries.forEach(entry => {
        const item = entry.data;
        if (!item) return;
        const key = getMatchKey(item);
        if (!existingGrouped[key]) existingGrouped[key] = [];
        existingGrouped[key].push(entry);
      });
      
      // Sort to prioritize keeping manually appraised items first
      Object.keys(existingGrouped).forEach(key => {
        existingGrouped[key].sort((a, b) => {
          const aIsAppraised = a.name.includes("_FINGERPRINT_") || a.name.includes("_APPRAISED_") || (a.data && a.data.logs && a.data.logs.includes("Clipboard"));
          const bIsAppraised = b.name.includes("_FINGERPRINT_") || b.name.includes("_APPRAISED_") || (b.data && b.data.logs && b.data.logs.includes("Clipboard"));
          if (aIsAppraised && !bIsAppraised) return -1;
          if (!aIsAppraised && bIsAppraised) return 1;
          return 0;
        });
      });
      
      const entriesToDelete = [];
      const itemsToUpload = [];
      const matchedCounts = {};
      
      // Process existing database entries to decide which ones to deprecate (withdrawn)
      Object.keys(existingGrouped).forEach(key => {
        const list = existingGrouped[key];
        const limit = newCounts[key] || 0;
        
        for (let i = 0; i < list.length; i++) {
          if (i < limit) {
            matchedCounts[key] = (matchedCounts[key] || 0) + 1;
          } else {
            entriesToDelete.push(list[i].name);
          }
        }
      });
      
      // Process newly scanned items to identify what to upload
      for (let index = 0; index < gearItems.length; index++) {
        const item = gearItems[index];
        const key = getMatchKey(item);
        const matched = matchedCounts[key] || 0;
        const totalNeeded = newCounts[key] || 0;
        
        if (matched < totalNeeded) {
          const defaultName = `Identified ${item.base}`;
          const defaultAffixes = ["Visual OCR Scan"];
          const fingerprint = await getFingerprint(
            item.rarity,
            item.base,
            defaultName,
            defaultAffixes
          );
          
          itemsToUpload.push({
            item: {
              rarity: item.rarity,
              name: defaultName,
              base: item.base,
              level: 60,
              ilvl: 80,
              affixes: defaultAffixes,
              price: item.rarity === "Unique" ? "Unique Item" : "5 Chaos Orbs",
              flavor: "",
              logs: "Visual OCR Scan",
              url: getIconUrl(defaultName, item.base)
            },
            name: `${deletePrefix}FINGERPRINT_${fingerprint}`
          });
          matchedCounts[key] = matched + 1;
        }
      }
      
      log(`Diff Engine audit: ${entriesToDelete.length} culls (withdrawn), ${itemsToUpload.length} uploads (new).`);
      
      // Execute Deletions (Culling withdrawn items)
      if (entriesToDelete.length > 0) {
        log(`Purging ${entriesToDelete.length} withdrawn items from database...`);
        for (const entryName of entriesToDelete) {
          const delRes = await fetch(`${supabaseUrl}/rest/v1/rpc/purge_vault_items`, {
            method: "POST",
            headers: {
              "apikey": supabaseAnonKey,
              "Authorization": `Bearer ${supabaseAnonKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              p_prefix: entryName,
              p_write_key: guildWriteKey
            })
          });
          if (!delRes.ok) {
            console.warn(`Failed to purge stale item: ${entryName}`, await delRes.text());
          }
        }
      }
      
      // Execute Uploads (Ingesting newly seen items)
      if (itemsToUpload.length > 0) {
        log(`Uploading ${itemsToUpload.length} new items to vault...`);
        for (const uploadObj of itemsToUpload) {
          const item = uploadObj.item;
          const entryName = uploadObj.name;
          
          const itemPayload = {
            rarity: item.rarity,
            name: item.name,
            base: item.base,
            level: item.level || 0,
            ilvl: item.ilvl || 0,
            affixes: item.affixes,
            price: item.price,
            flavor: item.flavor || "",
            logs: item.logs || "Visual OCR Scan",
            url: getIconUrl(item.name, item.base),
            owner: stashType === "guild"
              ? "Shared Guild Vault"
              : vaultUsernameSelect.options[vaultUsernameSelect.selectedIndex].text
          };
          
          const pushRes = await fetch(`${supabaseUrl}/rest/v1/rpc/sync_vault_item`, {
            method: "POST",
            headers: {
              "apikey": supabaseAnonKey,
              "Authorization": `Bearer ${supabaseAnonKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              p_name: entryName,
              p_data: itemPayload,
              p_write_key: guildWriteKey
            })
          });
          
          if (!pushRes.ok) {
            console.warn(`Failed to push new gear item: ${entryName}`, await pushRes.text());
          }
        }
      }
      
      log(`✅ Zero-Click Auto-Reconciliation Complete! Tab "${matchedTab.name}" is now perfectly synced!`, "success");
    }
    
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
  const supabaseUrl = supabaseUrlInput.value.trim();
  const supabaseAnonKey = supabaseAnonKeyInput.value.trim();
  const guildWriteKey = guildWriteKeyInput.value.trim();
  
  if (!geminiKey) {
    log("Error: Gemini API Key required.", "error");
    return;
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    log("Error: Supabase URL and Anon Key required.", "error");
    return;
  }
  if (!guildWriteKey) {
    log("Error: Guild Write Key required.", "error");
    return;
  }
  if (!itemText) {
    log("Error: Please paste item stats text first.", "error");
    return;
  }
  
  chrome.storage.local.set({ geminiKey, supabaseUrl, supabaseAnonKey, guildWriteKey });
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
      await syncAppraisedItemDirectly(supabaseUrl, supabaseAnonKey, guildWriteKey);
    } else {
      appraisalCard.style.display = "block";
    }
    
  } catch (err) {
    log(`Appraisal failed: ${err.message}`, "error");
  }
}

// Generate compact deterministic item fingerprint hash
async function getFingerprint(rarity, base, name, affixes) {
  const sortedMods = (affixes || [])
    .map(mod => mod.trim().toLowerCase())
    .filter(mod => mod !== "")
    .sort();
  const modsStr = sortedMods.join(";");
  const rawStr = `${rarity.toLowerCase()}|${base.toLowerCase()}|${name.toLowerCase()}|${modsStr}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(rawStr);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
  return hashHex.substring(0, 16);
}

// Refactored modular sync function
async function syncAppraisedItemDirectly(supabaseUrl, supabaseAnonKey, guildWriteKey) {
  if (!appraisedItem) return;
  
  logBox.innerHTML = "Status: Syncing appraised gear to visual stash online...";
  
  try {
    const authOk = await validateVaultProfile();
    if (!authOk) return;

    const tabIndex = bulkTabIndexInput ? parseInt(bulkTabIndexInput.value.trim(), 10) || 1 : 1;
    const stashType = vaultStashTypeSelect.value;
    const vaultUser = vaultUsernameSelect.value.toLowerCase();
    
    const prefix = stashType === "guild"
      ? `ITEM_GUILD_T${tabIndex}_`
      : `ITEM_PERS_${vaultUser}_T${tabIndex}_`;
      
    const fingerprint = await getFingerprint(
      appraisedItem.rarity,
      appraisedItem.base_type,
      appraisedItem.name,
      appraisedItem.explicit_mods
    );
    
    const entryName = `${prefix}FINGERPRINT_${fingerprint}`;
    const itemPayload = {
      rarity: appraisedItem.rarity,
      name: appraisedItem.name,
      base: appraisedItem.base_type,
      level: appraisedItem.level_req || 0,
      ilvl: appraisedItem.item_level || 0,
      affixes: appraisedItem.explicit_mods,
      price: appraisedItem.estimated_price_string,
      flavor: appraisedItem.flavor_text || "",
      logs: appraisedItem.bot_culling_logs,
      url: getIconUrl(appraisedItem.name, appraisedItem.base_type),
      owner: stashType === "guild"
        ? "Shared Guild Vault"
        : vaultUsernameSelect.options[vaultUsernameSelect.selectedIndex].text
    };
    
    const pushRes = await fetch(`${supabaseUrl}/rest/v1/rpc/sync_vault_item`, {
      method: "POST",
      headers: {
        "apikey": supabaseAnonKey,
        "Authorization": `Bearer ${supabaseAnonKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        p_name: entryName,
        p_data: itemPayload,
        p_write_key: guildWriteKey
      })
    });
    
    if (!pushRes.ok) {
      const errTxt = await pushRes.text();
      throw new Error(`Database push failed: ${errTxt}`);
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
  const supabaseUrl = supabaseUrlInput.value.trim();
  const supabaseAnonKey = supabaseAnonKeyInput.value.trim();
  const guildWriteKey = guildWriteKeyInput.value.trim();
  syncAppraisedItemDirectly(supabaseUrl, supabaseAnonKey, guildWriteKey);
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

// Maps GGG API item payload to our standard structured JSON format
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
  const explicit_mods = affixes.map(m => m.replace(/<<.*?>>/g, ""));
  const explicit_str = explicit_mods.join(";");
  
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
  
  return {
    rarity,
    name,
    base,
    level: levelReq,
    ilvl,
    affixes: explicit_mods,
    price,
    flavor,
    logs,
    url
  };
}

// Bulk sync execution handler
async function bulkSyncStashTab() {
  const supabaseUrl = supabaseUrlInput.value.trim();
  const supabaseAnonKey = supabaseAnonKeyInput.value.trim();
  const guildWriteKey = guildWriteKeyInput.value.trim();
  const league = bulkLeagueInput.value.trim();
  const tabIndex = parseInt(bulkTabIndexInput.value.trim(), 10) || 0;
  const stashType = bulkStashTypeSelect.value;
  const accountName = bulkAccountNameInput.value.trim();
  
  if (!supabaseUrl || !supabaseAnonKey) {
    log("Error: Supabase URL and Anon Key required.", "error");
    return;
  }
  if (!guildWriteKey) {
    log("Error: Guild Write Key required.", "error");
    return;
  }
  if (!league) {
    log("Error: League Name required.", "error");
    return;
  }
  if (!accountName) {
    log("Error: GGG Account Name is required for Stash Sync.", "error");
    return;
  }
  
  // Persist input values to local storage
  chrome.storage.local.set({
    supabaseUrl: supabaseUrl,
    supabaseAnonKey: supabaseAnonKey,
    guildWriteKey: guildWriteKey,
    bulkLeague: league,
    bulkTabIndex: tabIndex,
    bulkStashType: stashType,
    bulkAccountName: accountName
  });
  
  logBox.innerHTML = `Status: Initiating bulk stash fetch from GGG API...`;
  
  try {
    // Query active tab in the current window to determine the same-origin base URL
    const activeTabs = await new Promise(resolve => {
      chrome.tabs.query({ active: true, currentWindow: true }, resolve);
    });
    
    if (!activeTabs || !activeTabs[0]) {
      throw new Error("No active browser tab found. Please make sure pathofexile.com or pathofexile2.com is active in your browser!");
    }
    
    const activeTab = activeTabs[0];
    const activeUrl = activeTab.url || "";
    
    if (!activeUrl.includes("pathofexile.com") && !activeUrl.includes("pathofexile2.com")) {
      throw new Error("Please select your active pathofexile.com or pathofexile2.com tab in Chrome first!");
    }
    
    // Extract the exact origin to ensure 100% same-origin calls with zero CORS blocks
    const targetOrigin = new URL(activeUrl).origin;
    
    // 1. Build GGG API Stash URL (realm must be 'pc' for PoE2 on PC, 'poe2' is not a valid endpoint realm value)
    let gggUrl = `${targetOrigin}/character-window/get-stash-items?league=${encodeURIComponent(league)}&tabs=1&tabIndex=${tabIndex}&realm=pc`;
    if (stashType === "guild") {
      gggUrl += "&guild=true";
    }
    if (accountName) {
      gggUrl += `&accountName=${encodeURIComponent(accountName)}`;
    }
    
    // Send message to the active tab's content script to execute the fetch same-origin
    const stashData = await new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(activeTab.id, { action: "fetchStash", url: gggUrl }, response => {
        if (chrome.runtime.lastError) {
          reject(new Error("Content script not loaded. Please hard-refresh (F5) your pathofexile.com or pathofexile2.com page once and try again!"));
        } else if (response && response.success) {
          resolve(response.data);
        } else {
          reject(new Error(response ? response.error : "Failed to retrieve stash data same-origin from the active tab."));
        }
      });
    });
    
    if (!stashData || !stashData.items) {
      throw new Error("Invalid tab index or no items found in this stash tab.");
    }
    
    if (stashData.tabs) {
      console.log("All Available Stash Tabs:", stashData.tabs.map(t => `Index ${t.i}: "${t.n}"`));
    }
    
    const items = stashData.items;
    log(`GGG Fetch complete! Loaded ${items.length} items.`, "success");
    
    // V2.2.1 Auto-Detect Currency Tab vs. Gear Tab routing
    const activeStashTab = stashData.tabs ? stashData.tabs.find(t => t.i === tabIndex) : null;
    const tabName = activeStashTab ? activeStashTab.n.toLowerCase() : "";
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
      
      const currencyPayload = {
        ...currencyCounts,
        sync_version: "1.0"
      };
      
      log("Syncing Currency counts directly to __GUILD_VAULT__ entry...");
      const pushRes = await fetch(`${supabaseUrl}/rest/v1/rpc/sync_vault_item`, {
        method: "POST",
        headers: {
          "apikey": supabaseAnonKey,
          "Authorization": `Bearer ${supabaseAnonKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          p_name: "__GUILD_VAULT__",
          p_data: currencyPayload,
          p_write_key: guildWriteKey
        })
      });
      
      if (!pushRes.ok) {
        throw new Error(`Supabase push failed: ${await pushRes.text()}`);
      }
      
      log(`✅ Guild Currency Tab synced! Net Worth: ${total_chaos.toFixed(0)}c (~${(total_chaos/150).toFixed(1)} EX)`, "success");
      return;
    }
    
    // Naming prefixes sanitized
    const safeAccount = accountName.toLowerCase().replace(/[^a-z0-9]/g, "");
    const deletePrefix = stashType === "guild"
      ? `ITEM_GUILD_T${tabIndex}_`
      : `ITEM_PERS_${safeAccount}_T${tabIndex}_`;
      
    // 2. Fetch existing items in this tab from Supabase
    log("Fetching existing items for this tab from online vault...");
    const existRes = await fetch(`${supabaseUrl}/rest/v1/poe2_guild_vault?name=like.${deletePrefix}*&select=*`, {
      headers: {
        "apikey": supabaseAnonKey,
        "Authorization": `Bearer ${supabaseAnonKey}`
      }
    });
    const existingEntries = existRes.ok ? await existRes.json() : [];
    
    // Parse new GGG items
    const newParsedItems = items.map(parsePoEItem);
    
    // Helper to generate a match key (Rarity + Base type for stats preservation)
    function getMatchKey(item) {
      const rarity = (item.rarity || "Rare").toLowerCase();
      const base = (item.base || "Gear").toLowerCase();
      return `${rarity}|${base}`;
    }
    
    // Count new items grouped by match key
    const newCounts = {};
    newParsedItems.forEach(item => {
      const key = getMatchKey(item);
      newCounts[key] = (newCounts[key] || 0) + 1;
    });
    
    // Group existing entries in this tab by match key
    const existingGrouped = {};
    existingEntries.forEach(entry => {
      const item = entry.data;
      if (!item) return;
      const key = getMatchKey(item);
      if (!existingGrouped[key]) existingGrouped[key] = [];
      existingGrouped[key].push(entry);
    });
    
    // Prioritize keeping appraised items
    Object.keys(existingGrouped).forEach(key => {
      existingGrouped[key].sort((a, b) => {
        const aIsAppraised = a.name.includes("_FINGERPRINT_") || a.name.includes("_APPRAISED_") || (a.data && a.data.logs && a.data.logs.includes("Clipboard"));
        const bIsAppraised = b.name.includes("_FINGERPRINT_") || b.name.includes("_APPRAISED_") || (b.data && b.data.logs && b.data.logs.includes("Clipboard"));
        if (aIsAppraised && !bIsAppraised) return -1;
        if (!aIsAppraised && bIsAppraised) return 1;
        return 0;
      });
    });
    
    const entriesToDelete = [];
    const itemsToUpload = [];
    const matchedCounts = {};
    
    // Process existing entries to determine which ones to delete
    Object.keys(existingGrouped).forEach(key => {
      const list = existingGrouped[key];
      const limit = newCounts[key] || 0;
      
      for (let i = 0; i < list.length; i++) {
        if (i < limit) {
          // Keep this entry
          matchedCounts[key] = (matchedCounts[key] || 0) + 1;
        } else {
          // Delete this entry (it has been removed/taken from the tab in-game!)
          entriesToDelete.push(list[i].name);
        }
      }
    });
    
    // Process new scanned items to determine which ones to upload
    for (let index = 0; index < newParsedItems.length; index++) {
      const item = newParsedItems[index];
      const key = getMatchKey(item);
      const matched = matchedCounts[key] || 0;
      const totalNeeded = newCounts[key] || 0;
      
      if (matched < totalNeeded) {
        // Generate deterministic fingerprint for upload name
        const fingerprint = await getFingerprint(
          item.rarity,
          item.base,
          item.name,
          item.affixes
        );
        // We need to upload this item as a new basic entry
        itemsToUpload.push({
          item: item,
          name: `${deletePrefix}FINGERPRINT_${fingerprint}`
        });
        matchedCounts[key] = matched + 1;
      }
    }
    
    // Perform deletions
    let deleteCount = 0;
    if (entriesToDelete.length > 0) {
      log(`Deprecating ${entriesToDelete.length} stale/taken items from database...`);
      for (const entryName of entriesToDelete) {
        try {
          const delRes = await fetch(`${supabaseUrl}/rest/v1/rpc/purge_vault_items`, {
            method: "POST",
            headers: {
              "apikey": supabaseAnonKey,
              "Authorization": `Bearer ${supabaseAnonKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              p_prefix: entryName,
              p_write_key: guildWriteKey
            })
          });
          if (delRes.ok) {
            deleteCount++;
          }
          await new Promise(r => setTimeout(r, 60)); // Rate limit protection
        } catch (delErr) {
          console.warn("Item deletion failed:", entryName, delErr);
        }
      }
      log(`Deprecated ${deleteCount}/${entriesToDelete.length} items.`, "success");
    }
    
    // Perform uploads
    let successCount = 0;
    if (itemsToUpload.length > 0) {
      log(`Uploading ${itemsToUpload.length} new items to Creg's Depot Drop...`);
      for (const upload of itemsToUpload) {
        try {
          const itemPayload = {
            ...upload.item,
            owner: stashType === "guild" ? "Shared Guild Vault" : accountName
          };
          
          const pushRes = await fetch(`${supabaseUrl}/rest/v1/rpc/sync_vault_item`, {
            method: "POST",
            headers: {
              "apikey": supabaseAnonKey,
              "Authorization": `Bearer ${supabaseAnonKey}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              p_name: upload.name,
              p_data: itemPayload,
              p_write_key: guildWriteKey
            })
          });
          if (pushRes.ok) {
            successCount++;
          }
          await new Promise(r => setTimeout(r, 60)); // Rate limit protection
        } catch (pushErr) {
          console.warn("Item upload failed:", upload.name, pushErr);
        }
      }
      log(`Synced ${successCount}/${itemsToUpload.length} new items.`, "success");
    }
    
    log(`✅ Sync Complete! Kept ${existingEntries.length - entriesToDelete.length} appraised items, deprecated ${deleteCount} taken items, and added ${successCount} new items online!`, "success");
    
  } catch (err) {
    log(`Bulk Sync failed: ${err.message}`, "error");
  }
}

// Bind Syncer trigger button
btnBulkSync.addEventListener("click", bulkSyncStashTab);



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
    const league = bulkLeagueInput.value.trim() || "Runes of Aldur";
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

