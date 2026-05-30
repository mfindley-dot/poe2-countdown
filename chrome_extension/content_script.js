// Same-origin GGG Stash API proxy to bypass Manifest V3 cross-origin cookie blocks
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchStash") {
    console.log("[GLG Scanner] Forwarding same-origin fetch request for GGG Stash API:", request.url);
    
    fetch(request.url, { credentials: "include" })
      .then(async res => {
        if (!res.ok) {
          const text = await res.text();
          let cleanMsg = text.length > 150 ? text.substring(0, 150) + "..." : text;
          if (res.status === 403 || text.includes("Permission Denied")) {
            cleanMsg = "Permission Denied (403). 1) Make sure your GGG Account Name does NOT include any hashtag or hyphen suffix (e.g. use 'Radiocommander' instead of 'Radiocommander#0376' or 'Radiocommander-0376'). 2) Make sure your Path of Exile Account Profile is set to PUBLIC! Go to pathofexile.com/my-account/privacy, uncheck 'Set Profile to Private' and 'Hide Characters Tab', then click Update.";
          }
          throw new Error(cleanMsg);
        }
        return res.json();
      })
      .then(data => {
        sendResponse({ success: true, data: data });
      })
      .catch(err => {
        console.error("[GLG Scanner] Stash fetch failed:", err);
        sendResponse({ success: false, error: err.message });
      });
      
    return true; // Keep the message channel open for asynchronous sendResponse
  }
});
