/**
 * ListMatic V5 - Enhanced License Manager
 * Encrypted License File System with Windows GUID
 */

const LicenseManager = (function () {
    // Encryption key (obfuscated in final version)
    const SECRET_KEY = "LM5_S3CR3T_K3Y_2024";
    const LICENSE_FILENAME = ".lm5license";

    // Simple XOR encryption for license file
    function encrypt(text) {
        let result = '';
        for (let i = 0; i < text.length; i++) {
            result += String.fromCharCode(text.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length));
        }
        return btoa(result); // Base64 encode
    }

    function decrypt(encoded) {
        try {
            const text = atob(encoded); // Base64 decode
            let result = '';
            for (let i = 0; i < text.length; i++) {
                result += String.fromCharCode(text.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length));
            }
            return result;
        } catch (e) {
            return null;
        }
    }

    // Generate signature for integrity check
    function generateSignature(data) {
        const str = data.serial + data.machineId + data.activatedAt + SECRET_KEY;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16).toUpperCase();
    }

    // Get license file path
    function getLicenseFilePath() {
        if (typeof csInterface !== 'undefined') {
            let extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
            try { extPath = decodeURIComponent(extPath); } catch (e) { }
            extPath = extPath.replace(/^file:[\\\/]*/i, '');
            if (navigator.platform.indexOf('Win') > -1) {
                if (/^\/[a-zA-Z]:/.test(extPath)) extPath = extPath.substring(1);
            }
            extPath = extPath.replace(/\\/g, '/');
            return extPath + '/' + LICENSE_FILENAME;
        }
        return null;
    }

    // Save license to encrypted file
    function saveLicense(serial, machineId) {
        const licenseData = {
            serial: serial,
            machineId: machineId,
            activatedAt: new Date().toISOString(),
            version: "5.0.0"
        };
        licenseData.signature = generateSignature(licenseData);

        const encrypted = encrypt(JSON.stringify(licenseData));
        const filePath = getLicenseFilePath();

        if (filePath && window.cep && window.cep.fs) {
            const result = window.cep.fs.writeFile(filePath, encrypted);
            if (result.err === 0) {
                console.log("License saved successfully");
                return true;
            }
        }

        // Fallback to localStorage
        localStorage.setItem('lm5_license_backup', encrypted);
        return true;
    }

    // Load and verify license from file
    function loadLicense() {
        const filePath = getLicenseFilePath();
        let encrypted = null;

        // Try file first
        if (filePath && window.cep && window.cep.fs) {
            const result = window.cep.fs.readFile(filePath);
            if (result.err === 0 && result.data) {
                encrypted = result.data;
            }
        }

        // Fallback to localStorage
        if (!encrypted) {
            encrypted = localStorage.getItem('lm5_license_backup');
        }

        if (!encrypted) return null;

        // Decrypt
        const decrypted = decrypt(encrypted);
        if (!decrypted) return null;

        try {
            const licenseData = JSON.parse(decrypted);

            // Verify signature
            const expectedSig = generateSignature(licenseData);
            if (licenseData.signature !== expectedSig) {
                console.error("License signature mismatch - tampered!");
                return null;
            }

            return licenseData;
        } catch (e) {
            console.error("License parse error:", e);
            return null;
        }
    }

    // Clear license
    function clearLicense() {
        const filePath = getLicenseFilePath();
        if (filePath && window.cep && window.cep.fs) {
            window.cep.fs.deleteFile(filePath);
        }
        localStorage.removeItem('lm5_license_backup');
    }

    // Verify license against machine
    function verifyLicense(currentMachineId) {
        const license = loadLicense();
        if (!license) return { valid: false, reason: "no_license" };

        if (license.machineId !== currentMachineId) {
            return { valid: false, reason: "wrong_machine" };
        }

        return { valid: true, license: license };
    }

    // Public API
    return {
        save: saveLicense,
        load: loadLicense,
        clear: clearLicense,
        verify: verifyLicense,
        encrypt: encrypt,
        decrypt: decrypt
    };
})();

// Make globally available
window.LicenseManager = LicenseManager;
