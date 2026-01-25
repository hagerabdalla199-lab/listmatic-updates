var UPDATER_CONFIG = {
    username: "YOUR_GITHUB_USER",
    repo: "listmatic-updates",
    branch: "main"
};

var fs = require('fs');
var https = require('https');
var path = require('path');

// Current Version (Initial)
var CURRENT_VERSION = "3.0.0";

async function checkForUpdates() {
    var statusEl = document.getElementById('update-status');
    if (statusEl) statusEl.innerHTML = "Checking for updates...";

    var rawBase = `https://raw.githubusercontent.com/${UPDATER_CONFIG.username}/${UPDATER_CONFIG.repo}/${UPDATER_CONFIG.branch}`;
    var versionUrl = rawBase + "/version.json";

    try {
        // Fetch remote version
        var response = await fetch(versionUrl + '?t=' + Date.now());
        if (!response.ok) throw new Error("Repo not found");

        var remoteData = await response.json();

        if (paramVersionToNum(remoteData.version) > paramVersionToNum(CURRENT_VERSION)) {
            if (confirm(`تحديث جديد متاح (${remoteData.version})\nهل تريد التحديث الآن؟`)) {
                await performUpdate(remoteData.files, rawBase);
            }
        } else {
            console.log("No updates found.");
            if (statusEl) statusEl.innerHTML = "Version is up to date";
            setTimeout(function () { if (statusEl) statusEl.innerHTML = ""; }, 3000);
        }
    } catch (e) {
        console.error("Update check failed:", e);
        if (statusEl) statusEl.innerHTML = "Check failed (GitHub unreachable)";
    }
}

async function performUpdate(filesList, rawBase) {
    var extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
    var updatedCount = 0;

    // Show loading
    var overlay = document.createElement('div');
    overlay.style.cssText = "position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:white;";
    overlay.innerHTML = '<div style="font-size:24px;margin-bottom:10px;">جاري التحديث...</div><div id="update-progress">0%</div>';
    document.body.appendChild(overlay);

    try {
        for (var i = 0; i < filesList.length; i++) {
            var relativePath = filesList[i]; // e.g., "host/host.jsx"
            var fileUrl = rawBase + "/" + relativePath;
            var destPath = path.join(extPath, relativePath);

            document.getElementById('update-progress').innerText = `Deleting ${relativePath}...`;

            await downloadFile(fileUrl, destPath);
            updatedCount++;

            var pct = Math.round(((i + 1) / filesList.length) * 100);
            document.getElementById('update-progress').innerText = pct + "%";
        }

        alert("تم التحديث بنجاح! سيتم إعادة تشغيل البلاجن.");
        location.reload();

    } catch (e) {
        alert("فشل التحديث: " + e.message);
        document.body.removeChild(overlay);
    }
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        var file = fs.createWriteStream(dest);
        https.get(url, function (response) {
            response.pipe(file);
            file.on('finish', function () {
                file.close(resolve);
            });
        }).on('error', function (err) {
            fs.unlink(dest);
            reject(err);
        });
    });
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
