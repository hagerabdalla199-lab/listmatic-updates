var UPDATER_CONFIG = {
    username: "hagerabdalla199-lab",
    repo: "listmatic-updates",
    branch: "main"
};

// Current Version
var CURRENT_VERSION = "5.5.0";

async function checkForUpdates() {
    var statusEl = document.getElementById('update-status');
    if (statusEl) statusEl.innerHTML = "Checking...";

    var rawBase = `https://raw.githubusercontent.com/${UPDATER_CONFIG.username}/${UPDATER_CONFIG.repo}/${UPDATER_CONFIG.branch}`;
    var versionUrl = rawBase + "/version.json";

    console.log("Checking update from:", versionUrl);

    try {
        var remoteData;

        // Method 1: Try Node.js (CURL) - Best for Windows File Handling
        try {
            if (typeof require !== 'undefined') {
                remoteData = await getJSONCurl(versionUrl + '?t=' + Date.now());
            } else {
                throw new Error("Node.js not enabled");
            }
        } catch (nodeErr) {
            console.warn("Node.js check failed, falling back to Browser Fetch:", nodeErr);
            // Method 2: Fallback to Browser Fetch / XHR
            var response = await fetch(versionUrl + '?t=' + Date.now(), { cache: "no-store" });
            if (!response.ok) throw new Error("HTTP " + response.status);
            remoteData = await response.json();
        }

        // VALIDATION
        if (!remoteData || !remoteData.version) {
            console.error("Invalid Remote Data:", remoteData);
            throw new Error("Invalid version data received");
        }

        if (paramVersionToNum(remoteData.version) > paramVersionToNum(CURRENT_VERSION)) {
            if (confirm(`تحديث جديد متاح (${remoteData.version})\nهل تريد التحديث الآن؟`)) {
                await performUpdate(remoteData.files, rawBase);
            }
        } else {
            if (statusEl) statusEl.innerHTML = "Up to date";
            setTimeout(function () { if (statusEl) statusEl.innerHTML = ""; }, 3000);
        }
    } catch (e) {
        console.error("Update check failed:", e);
        if (statusEl) statusEl.innerHTML = "Failed";
        // Customize error message for users
        var msg = e.message;
        if (msg.indexOf("Failed to fetch") !== -1) msg = "تأكد من الانترنت";
        alert("فشل التحقق من التحديث.\n" + msg);
    }
}

// Helper: CURL wrapper (Moved outside to be accessible)
const getJSONCurl = (url) => {
    return new Promise((resolve, reject) => {
        try {
            var cp = require('child_process');
            cp.exec('curl -s "' + url + '"', { encoding: 'utf8' }, (err, stdout, stderr) => {
                if (err) { reject(err); return; }
                try {
                    if (!stdout || stdout.trim().length === 0) { reject(new Error("Empty response")); return; }
                    resolve(JSON.parse(stdout));
                } catch (e) {
                    reject(new Error("Invalid JSON from CURL"));
                }
            });
        } catch (e) { reject(e); }
    });
};

async function performUpdate(filesList, rawBase) {
    // Get extension path using CEP API
    var extPath = csInterface.getSystemPath(SystemPath.EXTENSION);

    // Decode URI and clean path
    try { extPath = decodeURIComponent(extPath); } catch (e) { }
    extPath = extPath.replace(/^file:[\\\/]*/i, '');
    if (navigator.platform.indexOf('Win') > -1) {
        if (/^\/[a-zA-Z]:/.test(extPath)) extPath = extPath.substring(1);
    }
    // Keep forward slashes for cep.fs compatibility
    extPath = extPath.replace(/\\/g, '/');

    // Show loading overlay
    var overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.9);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;font-family:sans-serif;";
    overlay.innerHTML = '<div style="font-size:24px;margin-bottom:15px;color:#00ff88;">جاري التحديث...</div><div id="update-progress" style="font-size:14px;color:#ccc;">Starting...</div>';
    document.body.appendChild(overlay);

    try {
        // Check if cep.fs is available
        if (!window.cep || !window.cep.fs) {
            throw new Error("CEP File System not available");
        }
        var cepfs = window.cep.fs;

        for (var i = 0; i < filesList.length; i++) {
            var relativePath = filesList[i]; // e.g., "host/host.jsx"
            var fileUrl = rawBase + "/" + relativePath;
            var destPath = extPath + "/" + relativePath;

            document.getElementById('update-progress').innerText = `Downloading ${relativePath}...`;

            // 1. Download file content using browser fetch
            var response = await fetch(fileUrl + '?t=' + Date.now(), { cache: "no-store" });
            if (!response.ok) throw new Error("Failed to download: " + relativePath);
            var fileContent = await response.text();

            if (!fileContent || fileContent.length === 0) {
                throw new Error("Empty file received: " + relativePath);
            }

            // 2. Write file using CEP FS
            var writeResult = cepfs.writeFile(destPath, fileContent);
            if (writeResult.err !== 0) {
                // Try to create directory first if file write failed
                var dirPath = destPath.substring(0, destPath.lastIndexOf('/'));
                cepfs.makedir(dirPath);
                // Retry write
                writeResult = cepfs.writeFile(destPath, fileContent);
                if (writeResult.err !== 0) {
                    throw new Error("Failed to write file: " + relativePath + " (Error: " + writeResult.err + ")");
                }
            }

            var pct = Math.round(((i + 1) / filesList.length) * 100);
            document.getElementById('update-progress').innerText = pct + "% - " + relativePath + " ✓";
        }

        document.getElementById('update-progress').innerText = "Done! Reloading...";
        setTimeout(function () {
            alert("تم التحديث بنجاح! سيتم إعادة تشغيل البلاجن.");
            location.reload();
        }, 1000);

    } catch (e) {
        console.error("Update failed:", e);
        alert("فشل التحديث: " + e.message);
        document.body.removeChild(overlay);
    }
}

function paramVersionToNum(v) {
    return parseInt(v.replace(/\./g, ''));
}

// Add Update Button to UI if not exists
document.addEventListener('DOMContentLoaded', function () {
    var header = document.querySelector('.header .logo');
    if (header) {
        var btn = document.createElement('span');
        btn.innerHTML = '🔄';
        btn.style.cssText = "cursor:pointer;margin-left:10px;font-size:14px;opacity:0.7;";
        btn.title = "Check for Updates";
        btn.onclick = checkForUpdates;
        header.appendChild(btn);

        var status = document.createElement('span');
        status.id = "update-status";
        status.style.cssText = "margin-left:10px;font-size:10px;color:#00ff88;";
        header.appendChild(status);
    }
});
