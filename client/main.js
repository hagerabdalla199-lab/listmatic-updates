/**
 * ListMatic V2 - Main JavaScript
 * FOR SYSTEMATIC WORK
 */

var csInterface = new CSInterface();
var paths = { csv: '', save: '', imgs: '', fb: '', ig: '', tpl: '', master: '', mixed: '', 'resize-input': '', 'resize-output': '', 'catalog-tpl': '' };
var csvData = [];
var matchResults = [];
var stats = { total: 0, success: 0, failed: 0, startTime: 0, sessions: [] };
var presets = {};
var isPaused = false;
var progressInterval = null;

// Open external URL in default browser
function openExternalURL(url) {
    try {
        // Method 1: CSInterface
        if (typeof csInterface !== 'undefined' && csInterface.openURLInDefaultBrowser) {
            csInterface.openURLInDefaultBrowser(url);
            return;
        }
    } catch (e) { }

    try {
        // Method 2: cep.util
        if (window.cep && window.cep.util && window.cep.util.openURLInDefaultBrowser) {
            window.cep.util.openURLInDefaultBrowser(url);
            return;
        }
    } catch (e) { }

    try {
        // Method 3: __adobe_cep__
        if (window.__adobe_cep__ && window.__adobe_cep__.openURLInDefaultBrowser) {
            window.__adobe_cep__.openURLInDefaultBrowser(url);
            return;
        }
    } catch (e) { }

    try {
        // Method 4: Node.js (CEP has Node integration)
        var exec = require('child_process').exec;
        exec('start "" "' + url + '"');
        return;
    } catch (e) { }

    // Fallback: window.open
    window.open(url, '_blank');
}

// Initialize
document.addEventListener('DOMContentLoaded', function () {
    loadSavedPrefs();
    loadStats();
    loadPresets();
    initSwatches();

    // ESC key listener to stop process
    document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape' || e.keyCode === 27) {
            stopProcess();
        }
    });
});

function showTab(tabId) {
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });
    event.target.classList.add('active');
    document.getElementById('tab-' + tabId).classList.add('active');
}

function initSwatches() {
    var colors = ['#FF0000', '#FF6B6B', '#FFA500', '#FFD700', '#00FF00', '#00CED1', '#0080FF', '#8B5CF6', '#FF69B4', '#FFFFFF'];
    var container = document.getElementById('swatches');
    colors.forEach(function (c) {
        var div = document.createElement('div');
        div.className = 'swatch';
        div.style.background = c;
        div.onclick = function () { document.getElementById('color').value = c; };
        container.appendChild(div);
    });
}

// File Selection
function selectFile(type) {
    var filter = type === 'csv' || type === 'master' || type === 'mixed' ? '*.csv' : '*.psd';
    csInterface.evalScript('selectFileDialog("' + filter + '")', function (result) {
        if (result && result !== 'null') {
            paths[type] = result;
            var lbl = document.getElementById('lbl-' + type);
            if (lbl) {
                lbl.textContent = result.split(/[\/\\]/).pop();
                lbl.classList.add('selected');
            }
            // Show catalog settings when catalog template is selected
            if (type === 'catalog-tpl') {
                document.getElementById('catalog-settings').style.display = 'block';
            }
        }
    });
}

function selectFolder(type) {
    csInterface.evalScript('selectFolderDialog()', function (result) {
        if (result && result !== 'null') {
            paths[type] = result;
            var lbl = document.getElementById('lbl-' + type);
            if (lbl) {
                lbl.textContent = result.split(/[\/\\]/).pop();
                lbl.classList.add('selected');
            }
        }
    });
}

function clearFile(type) {
    paths[type] = '';
    var lbl = document.getElementById('lbl-' + type);
    if (lbl) {
        lbl.textContent = 'Not Selected';
        lbl.classList.remove('selected');
    }
    // Hide catalog settings when catalog template is cleared
    if (type === 'catalog-tpl') {
        document.getElementById('catalog-settings').style.display = 'none';
    }
}

// Color Picker
function pickColor() {
    csInterface.evalScript('showColorPickerDialog()', function (result) {
        if (result && result !== 'null') {
            document.getElementById('color').value = '#' + result;
        }
    });
}

function grabFG() {
    csInterface.evalScript('getForegroundColor()', function (result) {
        if (result) document.getElementById('color').value = '#' + result;
    });
}

// Helper functions
function getVal(id) { return document.getElementById(id) ? document.getElementById(id).value : ''; }
function getChecked(id) { return document.getElementById(id) ? document.getElementById(id).checked : false; }
function setStatus(msg, type) {
    var s = document.getElementById('status');
    s.textContent = msg;
    s.className = 'status ' + type;
}

// Main Process
function runProcess() {
    if (!paths.csv || !paths.save) {
        setStatus('Please select CSV and Save folder', 'error');
        return;
    }
    if (!paths.fb && !paths.ig && !paths.tpl && !paths['catalog-tpl']) {
        setStatus('Please select at least one PSD template', 'error');
        return;
    }

    var config = {
        csv: paths.csv.replace(/\\/g, '/'),
        save: paths.save.replace(/\\/g, '/'),
        imgs: paths.imgs ? paths.imgs.replace(/\\/g, '/') : '',
        fb: paths.fb ? paths.fb.replace(/\\/g, '/') : '',
        ig: paths.ig ? paths.ig.replace(/\\/g, '/') : '',
        tpl: paths.tpl ? paths.tpl.replace(/\\/g, '/') : '',
        catalogTpl: paths['catalog-tpl'] ? paths['catalog-tpl'].replace(/\\/g, '/') : '',
        catalogPerPage: parseInt(getVal('catalog-per-page')) || 6,
        expPSD: getChecked('exp-psd'),
        expJPG: getChecked('exp-jpg'),
        expPNG: getChecked('exp-png'),
        scale: parseFloat(getVal('scale')) || 100,
        color: getVal('color'),
        jpgQuality: parseInt(getVal('jpg-quality')) || 12,
        mapBrand: getVal('map-brand') || 'Brand',
        mapModel: getVal('map-model') || 'Model',
        mapStorage: getVal('map-storage') || 'Storage',
        mapPrice: getVal('map-price') || 'Price',
        mapImage: getVal('map-image') || 'Image',
        hidePrice: getChecked('hide-price'),
        hideStorageRam: getChecked('hide-storage-ram'),
        metadata: getMetadataConfig(),
        mappings: getAllMappings()
    };

    stats.startTime = Date.now();
    document.getElementById('run-btn').disabled = true;
    document.getElementById('progress-percent').textContent = '0%';
    document.getElementById('progress-fill').style.width = '0%';
    document.getElementById('progress-text').textContent = 'Counting products...';
    isPaused = false;

    var hasRegularTemplates = paths.fb || paths.ig || paths.tpl;
    var hasCatalog = paths['catalog-tpl'];

    // Count templates
    var templateCount = 0;
    if (paths.fb) templateCount++;
    if (paths.ig) templateCount++;
    if (paths.tpl) templateCount++;

    var catalogPerPage = parseInt(getVal('catalog-per-page')) || 6;

    var configStr = JSON.stringify(config).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    // Read CSV to count rows
    csInterface.evalScript("countCSVRows('" + paths.csv.replace(/\\/g, '/') + "')", function (rowCountResult) {
        var productCount = 0;
        try {
            productCount = parseInt(rowCountResult) || 0;
        } catch (e) { }

        // Calculate expected outputs
        var expectedDesigns = productCount * templateCount;
        var expectedCatalogPages = hasCatalog ? Math.ceil(productCount / catalogPerPage) : 0;
        var expectedTotal = expectedDesigns + expectedCatalogPages;

        document.getElementById('progress-text').textContent = 'Processing ' + productCount + ' products...';

        // Store expected count for stats
        var expectedCount = expectedTotal;

        function finishProcess() {
            clearInterval(progressInterval);
            document.getElementById('run-btn').disabled = false;

            // Use expectedCount from mathematical calculation
            var finalCount = expectedCount;
            var elapsed = Math.round((Date.now() - stats.startTime) / 1000);

            if (finalCount > 0) {
                stats.success += finalCount;
                stats.total += finalCount;
            }

            var msg = '✅ ';
            if (finalCount > 0) {
                msg += finalCount + ' images created';
            } else {
                msg += 'Process completed';
            }
            msg += ' in ' + elapsed + 's';

            setStatus(msg, 'success');
            saveStats();
            if (finalCount > 0) addSessionHistory(finalCount, elapsed);
            updateStatsDisplay();
        }

        function runCatalog() {
            if (paths['catalog-tpl']) {
                csInterface.evalScript("runCatalogGeneration('" + configStr + "')", function (catResult) {
                    try {
                        var cr = JSON.parse(catResult);
                        if (!cr.error) catalogCount = cr.catalogCount || 0;
                    } catch (e) { }
                    finishProcess();
                });
            } else {
                finishProcess();
            }
        }

        // Run regular batch process first if templates are selected
        if (hasRegularTemplates) {
            csInterface.evalScript("runBatchProcess('" + configStr + "')", function (result) {
                try {
                    var r = JSON.parse(result);
                    if (r.error) {
                        setStatus('Error: ' + r.error, 'error');
                    } else {
                        totalCount = r.count || 0;
                    }
                } catch (e) { }
                runCatalog();
            });
        } else {
            // Only catalog mode
            runCatalog();
        }

        // Track progress count
        var lastProgressCount = 0;

        // Progress polling
        progressInterval = setInterval(function () {
            csInterface.evalScript('getProgress()', function (result) {
                try {
                    var p = JSON.parse(result);
                    if (p.total > 0) {
                        var pct = Math.round((p.current / p.total) * 100);
                        document.getElementById('progress-fill').style.width = pct + '%';
                        document.getElementById('progress-percent').textContent = pct + '%';
                        document.getElementById('progress-text').textContent = p.status;

                        // Track the count
                        lastProgressCount = p.current;
                    }
                    if (p.done) {
                        clearInterval(progressInterval);
                        document.getElementById('progress-percent').textContent = '100%';
                        document.getElementById('progress-fill').style.width = '100%';

                        // Update stats using progress count
                        if (lastProgressCount > 0) {
                            stats.success += lastProgressCount;
                            stats.total += lastProgressCount;
                            var elapsed = Math.round((Date.now() - stats.startTime) / 1000);
                            saveStats();
                            addSessionHistory(lastProgressCount, elapsed);
                            updateStatsDisplay();
                        }
                    }
                } catch (e) { }
            });
        }, 500);
    }); // Close countCSVRows callback
} // Close runProcess

// Queue Controls - ESC key only
function stopProcess() {
    // Send cancel signal to Photoshop
    csInterface.evalScript('CANCELLED = true');
    csInterface.evalScript('cancelProcessing()');

    // Stop progress polling
    if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
    }

    // Reset UI
    var runBtn = document.getElementById('run-btn');
    if (runBtn) runBtn.disabled = false;

    var progressFill = document.getElementById('progress-fill');
    if (progressFill) progressFill.style.width = '0%';

    var progressPercent = document.getElementById('progress-percent');
    if (progressPercent) progressPercent.textContent = '0%';

    var progressText = document.getElementById('progress-text');
    if (progressText) progressText.textContent = 'Stopped (ESC)';

    setStatus('⛔ Process stopped by ESC key', 'error');

    // Reset pause state
    isPaused = false;
}

// Open folder
function openSaveFolder() {
    if (paths.save) {
        csInterface.evalScript('openFolder("' + paths.save.replace(/\\/g, '/') + '")');
    }
}

// Preview - Shows FIRST PRODUCT from CSV applied to template
function generatePreview() {
    document.getElementById('preview-container').innerHTML = '<span>⏳ Generating preview...</span>';

    // 1. Check CSV
    if (!paths.csv) {
        document.getElementById('preview-container').innerHTML = '<span style="color:var(--error)">Select CSV file first</span>';
        return;
    }

    // 2. Check Document
    csInterface.evalScript('app.documents.length', function (count) {
        if (!count || count === '0' || count === 'undefined') {
            document.getElementById('preview-container').innerHTML = '<span style="color:var(--error)">Open a PSD in Photoshop first</span>';
            return;
        }

        // 3. Read CSV
        var csvPath = paths.csv.replace(/\\/g, '/');
        csInterface.evalScript('readTextFile("' + csvPath + '")', function (csvContent) {
            if (!csvContent || csvContent === 'null' || csvContent.length < 5) {
                document.getElementById('preview-container').innerHTML = '<span style="color:var(--error)">Could not read CSV</span>';
                return;
            }

            // Simple CSV Parse
            var lines = csvContent.split(/\r?\n/);
            if (lines.length < 2) {
                document.getElementById('preview-container').innerHTML = '<span style="color:var(--error)">CSV is empty</span>';
                return;
            }

            // Parse first data row (Logic to handle quotes/commas)
            var firstRow = lines[1];
            var cols = [];
            var cur = '', inQuote = false;
            for (var i = 0; i < firstRow.length; i++) {
                var c = firstRow.charAt(i);
                if (c === '"') inQuote = !inQuote;
                else if (c === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; }
                else cur += c;
            }
            cols.push(cur.trim());

            // Map columns
            var pBrand = cols[0] || '';
            var pModel = cols[1] || '';
            // var pStorage = cols[2] || ''; 
            var pPrice = cols[3] || '';

            // Get Layer Names from UI
            var mapBrand = document.getElementById('map-brand').value || 'Brand';
            var mapModel = document.getElementById('map-model').value || 'Model';
            var mapStorage = document.getElementById('map-storage').value || 'Storage';
            var mapPrice = document.getElementById('map-price').value || 'Price';

            document.getElementById('preview-container').innerHTML = '<span>⏳ Applying: ' + pBrand + ' ' + pModel + '...</span>';

            // 4. Run Script to Update & Preview
            var jsx = [
                '(function(){',
                'try {',
                '  var doc = app.activeDocument;',
                '  var dup = doc.duplicate("MiamiPreview_Temp");',
                '  app.activeDocument = dup;',
                '  function setTxt(name, text) {',
                '    function findLayer(parent, n) {',
                '       try {',
                '          var l = parent.layers.getByName(n);',
                '          return l;',
                '       } catch(e) {',
                '          // Loop for fuzzy match',
                '          for(var i=0; i<parent.layers.length; i++) {',
                '             var l = parent.layers[i];',
                '             if(l.name.toLowerCase().replace(/\\s/g,"") == n.toLowerCase().replace(/\\s/g,"")) return l;',
                '          }',
                '       }',
                '       return null;',
                '    }',
                '    var layer = findLayer(dup, name);',
                '    if(!layer) {',
                '       // Look in groups (1 level deep)',
                '       for(var i=0; i<dup.layers.length; i++) {',
                '          if(dup.layers[i].typename == "LayerSet") {',
                '             layer = findLayer(dup.layers[i], name);',
                '             if(layer) break;',
                '          }',
                '       }',
                '    }',
                '    if(layer && layer.kind == LayerKind.TEXT) layer.textItem.contents = text;',
                '  }',
                '  setTxt("' + mapBrand + '", "' + pBrand.replace(/"/g, '\\"') + '");',
                '  setTxt("' + mapModel + '", "' + pModel.replace(/"/g, '\\"') + '");',
                '  setTxt("' + mapStorage + '", "' + cols[2].replace(/"/g, '\\"') + '");',
                '  var priceFmt = "' + pPrice.replace(/[^0-9]/g, '') + '".replace(/\\B(?=(\\d{3})+(?!\\d))/g, ",");',
                '  setTxt("' + mapPrice + '", priceFmt);',
                '  dup.flatten();',
                '  var w = dup.width.as("px");',
                '  var h = dup.height.as("px");',
                '  var scale = Math.min(300/w, 300/h, 1);',
                '  dup.resizeImage(new UnitValue(w*scale,"px"), new UnitValue(h*scale,"px"), 72, ResampleMethod.BICUBIC);',
                '  var f = new File(Folder.temp.fsName + "/miami_v4_preview.jpg");',
                '  var jpg = new JPEGSaveOptions(); jpg.quality = 6;',
                '  dup.saveAs(f, jpg, true);',
                '  dup.close(SaveOptions.DONOTSAVECHANGES);',
                '  app.activeDocument = doc;',
                '  return f.fsName;',
                '} catch(e) { return "error:" + e.message; }',
                '})()'
            ].join('\n');

            csInterface.evalScript(jsx, function (result) {
                if (result.indexOf('error:') === 0) {
                    document.getElementById('preview-container').innerHTML = '<span style="color:var(--error)">' + result + '</span>';
                } else {
                    var imgUrl = 'file:///' + result.replace(/\\/g, '/') + '?t=' + Date.now();
                    document.getElementById('preview-container').innerHTML =
                        '<img src="' + imgUrl + '" style="max-width:100%;max-height:180px;border-radius:6px;box-shadow:0 2px 5px rgba(0,0,0,0.2);" />' +
                        '<div style="font-size:10px;color:var(--primary);margin-top:5px;">' + pBrand + ' ' + pModel + '</div>' +
                        '<div style="font-size:9px;color:var(--success);">✓ Preview Applied</div>';
                }
            });
        });
    });
}

// ========== MATCHER ==========
function runMatcher() {
    if (!paths.master || !paths.mixed) {
        alert('Please select both Master and Mixed CSV files');
        return;
    }

    // Read both files
    csInterface.evalScript('readTextFile("' + paths.master.replace(/\\/g, '/') + '")', function (masterData) {
        csInterface.evalScript('readTextFile("' + paths.mixed.replace(/\\/g, '/') + '")', function (mixedData) {
            if (masterData === 'null' || mixedData === 'null') {
                alert('Error reading files');
                return;
            }

            var masterRows = parseCSV(masterData);
            var mixedRows = parseCSV(mixedData);

            matchResults = [];

            for (var i = 1; i < mixedRows.length; i++) {
                var mixedProduct = mixedRows[i][0] || '';
                if (!mixedProduct.trim()) continue;

                var bestMatch = findBestMatch(mixedProduct, masterRows);
                matchResults.push({
                    original: mixedProduct,
                    matched: bestMatch.product,
                    score: bestMatch.score,
                    masterRow: bestMatch.row
                });
            }

            displayMatchResults();
        });
    });
}

function parseCSV(text) {
    var lines = text.split(/\r?\n/);
    var result = [];
    for (var i = 0; i < lines.length; i++) {
        var cols = [];
        var cur = '';
        var inQuote = false;
        for (var j = 0; j < lines[i].length; j++) {
            var c = lines[i].charAt(j);
            if (c === '"') inQuote = !inQuote;
            else if (c === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; }
            else cur += c;
        }
        cols.push(cur.trim());
        result.push(cols);
    }
    return result;
}

function findBestMatch(input, masterRows) {
    var best = { product: '', score: 0, row: [] };
    var inputLower = input.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (var i = 1; i < masterRows.length; i++) {
        var masterProduct = (masterRows[i][0] || '') + ' ' + (masterRows[i][1] || '');
        var masterLower = masterProduct.toLowerCase().replace(/[^a-z0-9]/g, '');

        var score = similarity(inputLower, masterLower);
        if (score > best.score) {
            best = { product: masterProduct, score: score, row: masterRows[i] };
        }
    }
    return best;
}

function similarity(s1, s2) {
    if (s1 === s2) return 100;
    if (s1.length === 0 || s2.length === 0) return 0;

    // Simple contains check
    if (s1.indexOf(s2) !== -1 || s2.indexOf(s1) !== -1) return 85;

    // Word matching
    var words1 = s1.match(/[a-z0-9]+/g) || [];
    var words2 = s2.match(/[a-z0-9]+/g) || [];
    var matches = 0;
    for (var i = 0; i < words1.length; i++) {
        for (var j = 0; j < words2.length; j++) {
            if (words1[i] === words2[j] || words1[i].indexOf(words2[j]) !== -1 || words2[j].indexOf(words1[i]) !== -1) {
                matches++;
                break;
            }
        }
    }
    return Math.round((matches / Math.max(words1.length, words2.length)) * 100);
}

function displayMatchResults() {
    var container = document.getElementById('match-results');
    if (matchResults.length === 0) {
        container.innerHTML = '<div style="color:var(--text-dim);text-align:center;padding:20px;">No results</div>';
        return;
    }

    var html = '';
    for (var i = 0; i < matchResults.length; i++) {
        var r = matchResults[i];
        var scoreClass = r.score >= 80 ? 'high' : (r.score >= 50 ? 'medium' : 'low');
        html += '<div class="match-result ' + scoreClass + '">';
        html += '<span class="match-score ' + scoreClass + '">' + r.score + '%</span>';
        html += '<div style="font-size:9px;color:var(--text-dim);">Original:</div>';
        html += '<div style="font-size:10px;margin-bottom:4px;">' + r.original + '</div>';
        html += '<div style="font-size:9px;color:var(--text-dim);">Matched:</div>';
        html += '<div style="font-size:10px;color:var(--primary);">' + r.matched + '</div>';
        html += '</div>';
    }
    container.innerHTML = html;
}

function exportMatchedCSV() {
    if (matchResults.length === 0) {
        alert('No match results to export');
        return;
    }

    var csvContent = 'Original,Matched,Score,Brand,Model,Storage,Price\n';
    for (var i = 0; i < matchResults.length; i++) {
        var r = matchResults[i];
        var row = r.masterRow || [];
        csvContent += '"' + r.original + '","' + r.matched + '",' + r.score;
        csvContent += ',"' + (row[0] || '') + '","' + (row[1] || '') + '","' + (row[2] || '') + '","' + (row[3] || '') + '"\n';
    }

    csInterface.evalScript('selectFolderDialog()', function (folder) {
        if (folder && folder !== 'null') {
            var filePath = folder.replace(/\\/g, '/') + '/matched_products.csv';
            csInterface.evalScript('saveTextFile("' + filePath + '", \'' + csvContent.replace(/'/g, "\\'") + '\')', function (result) {
                if (result === 'ok') {
                    alert('Exported to: ' + filePath);
                } else {
                    alert('Export failed');
                }
            });
        }
    });
}

// ========== CSV EDITOR ==========
function loadCSVForEdit() {
    csInterface.evalScript('selectFileDialog("*.csv")', function (filePath) {
        if (filePath && filePath !== 'null') {
            csInterface.evalScript('readTextFile("' + filePath.replace(/\\/g, '/') + '")', function (data) {
                if (data && data !== 'null') {
                    csvData = parseCSV(data);
                    csvData.filePath = filePath;
                    renderCSVTable();
                }
            });
        }
    });
}

function renderCSVTable() {
    var tbody = document.getElementById('csv-edit-body');
    if (csvData.length < 2) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-dim);padding:20px;">No data</td></tr>';
        return;
    }

    var html = '';
    for (var i = 1; i < csvData.length; i++) {
        var row = csvData[i];
        html += '<tr data-row="' + i + '">';
        html += '<td>' + i + '</td>';
        for (var j = 0; j < 5; j++) {
            html += '<td><input type="text" value="' + (row[j] || '').replace(/"/g, '&quot;') + '" onchange="updateCSVCell(' + i + ',' + j + ',this.value)"></td>';
        }
        html += '<td><button onclick="deleteCSVRow(' + i + ')" style="background:var(--error);border:none;color:white;padding:2px 6px;border-radius:3px;cursor:pointer;">×</button></td>';
        html += '</tr>';
    }
    tbody.innerHTML = html;
}

function updateCSVCell(row, col, value) {
    if (csvData[row]) csvData[row][col] = value;
}

function addCSVRow() {
    csvData.push(['', '', '', '', '']);
    renderCSVTable();
}

function deleteCSVRow(row) {
    csvData.splice(row, 1);
    renderCSVTable();
}

function saveCSVEdits() {
    if (!csvData.filePath) {
        csInterface.evalScript('selectFolderDialog()', function (folder) {
            if (folder && folder !== 'null') {
                csvData.filePath = folder + '/edited.csv';
                doSaveCSV();
            }
        });
    } else {
        doSaveCSV();
    }
}

function doSaveCSV() {
    var content = '';
    for (var i = 0; i < csvData.length; i++) {
        var row = csvData[i];
        var line = '';
        for (var j = 0; j < row.length; j++) {
            if (j > 0) line += ',';
            var val = row[j] || '';
            if (val.indexOf(',') !== -1 || val.indexOf('"') !== -1) {
                line += '"' + val.replace(/"/g, '""') + '"';
            } else {
                line += val;
            }
        }
        content += line + '\n';
    }

    csInterface.evalScript('saveTextFile("' + csvData.filePath.replace(/\\/g, '/') + '", \'' + content.replace(/'/g, "\\'") + '\')', function (result) {
        if (result === 'ok') {
            alert('Saved successfully!');
        } else {
            alert('Save failed');
        }
    });
}

// ========== BULK RESIZE ==========
function runBulkResize() {
    var inputFolder = paths['resize-input'];
    var outputFolder = paths['resize-output'];
    var maxW = parseInt(getVal('resize-width')) || 800;
    var maxH = parseInt(getVal('resize-height')) || 800;

    if (!inputFolder || !outputFolder) {
        alert('Please select input and output folders');
        return;
    }

    var config = {
        input: inputFolder.replace(/\\/g, '/'),
        output: outputFolder.replace(/\\/g, '/'),
        maxWidth: maxW,
        maxHeight: maxH
    };

    csInterface.evalScript('runBulkResize(\'' + JSON.stringify(config).replace(/'/g, "\\'") + '\')', function (result) {
        try {
            var r = JSON.parse(result);
            if (r.error) {
                alert('Error: ' + r.error);
            } else {
                alert('Resized ' + r.count + ' images!');
            }
        } catch (e) {
            alert('Completed');
        }
    });
}

// ========== STATS ==========
function updateStatsDisplay() {
    try {
        var totalEl = document.getElementById('stat-total');
        var successEl = document.getElementById('stat-success');
        var failedEl = document.getElementById('stat-failed');
        var timeEl = document.getElementById('stat-time');

        if (totalEl) totalEl.textContent = stats.total || 0;
        if (successEl) successEl.textContent = stats.success || 0;
        if (failedEl) failedEl.textContent = stats.failed || 0;

        if (stats.startTime && timeEl) {
            var elapsed = Math.round((Date.now() - stats.startTime) / 1000);
            timeEl.textContent = elapsed + 's';
        }
    } catch (e) { console.log('Stats error:', e); }
}

function addSessionHistory(count, time) {
    var session = {
        date: new Date().toLocaleString(),
        count: count,
        time: time
    };
    stats.sessions.unshift(session);
    // Limit to last 100 sessions to prevent performance issues
    if (stats.sessions.length > 100) stats.sessions = stats.sessions.slice(0, 100);
    saveStats();
    renderSessionHistory();
}

function renderSessionHistory() {
    var container = document.getElementById('session-history');
    var countEl = document.getElementById('session-count');

    // Update session count badge
    if (countEl) countEl.textContent = stats.sessions.length;

    if (!stats.sessions || stats.sessions.length === 0) {
        container.innerHTML = '<div style="color:var(--text-3);text-align:center;padding:20px;font-size:9px;">No sessions yet</div>';
        return;
    }

    var html = '';
    // Only show last 50 sessions in the UI for performance
    var displaySessions = stats.sessions.slice(0, 50);
    for (var i = 0; i < displaySessions.length; i++) {
        var s = displaySessions[i];
        html += '<div class="session-item">';
        html += '<span class="count">' + s.count + ' images</span> in ' + s.time + 's';
        html += '<span class="time">' + s.date + '</span>';
        html += '</div>';
    }

    // If there are more sessions than displayed, show a note
    if (stats.sessions.length > 50) {
        html += '<div style="text-align:center;font-size:8px;color:var(--text-3);padding:8px;border-top:1px dashed var(--border);">Showing 50 of ' + stats.sessions.length + ' sessions</div>';
    }

    container.innerHTML = html;
}

// Clear ONLY session history, keep stats numbers
function clearSessionHistory() {
    if (stats.sessions.length === 0) return;

    stats.sessions = [];
    saveStats();
    renderSessionHistory();

    // Show confirmation
    var countEl = document.getElementById('session-count');
    if (countEl) countEl.textContent = '0';
}

function clearStats() {
    stats = { total: 0, success: 0, failed: 0, startTime: 0, sessions: [] };
    saveStats();
    updateStatsDisplay();
    renderSessionHistory();
}

function loadStats() {
    try {
        var saved = localStorage.getItem('listmatic_v2_stats');
        console.log('Loading stats:', saved);
        if (saved) {
            var parsed = JSON.parse(saved);
            stats.total = parsed.total || 0;
            stats.success = parsed.success || 0;
            stats.failed = parsed.failed || 0;
            stats.sessions = parsed.sessions || [];
        }
    } catch (e) { console.log('Load stats error:', e); }
    updateStatsDisplay();
    renderSessionHistory();
}

function saveStats() {
    try {
        console.log('Saving stats:', stats);
        localStorage.setItem('listmatic_v2_stats', JSON.stringify({
            total: stats.total,
            success: stats.success,
            failed: stats.failed,
            sessions: stats.sessions
        }));
    } catch (e) { console.log('Save stats error:', e); }
}

// ========== PRESETS ==========
function loadPresets() {
    try {
        var saved = localStorage.getItem('miami_presets');
        if (saved) presets = JSON.parse(saved);
        renderPresets();
    } catch (e) { }
}

function savePresetsStorage() {
    try {
        localStorage.setItem('miami_presets', JSON.stringify(presets));
    } catch (e) { }
}

function renderPresets() {
    var container = document.getElementById('preset-list');
    var html = '<div class="preset-item" onclick="applyPreset(\'mobile\')">📱 Mobile</div>';
    html += '<div class="preset-item" onclick="applyPreset(\'laptop\')">💻 Laptop</div>';
    html += '<div class="preset-item" onclick="applyPreset(\'accessory\')">🎧 Accessories</div>';

    for (var name in presets) {
        html += '<div class="preset-item" onclick="applyPreset(\'' + name + '\')">' + name + '</div>';
    }
    container.innerHTML = html;
}

function createPreset() {
    var name = getVal('new-preset-name');
    if (!name) {
        alert('Enter a preset name');
        return;
    }

    presets[name] = {
        scale: getVal('scale'),
        color: getVal('color'),
        jpgQuality: getVal('jpg-quality'),
        expPSD: getChecked('exp-psd'),
        expJPG: getChecked('exp-jpg'),
        expPNG: getChecked('exp-png'),
        mapBrand: getVal('map-brand'),
        mapModel: getVal('map-model'),
        mapStorage: getVal('map-storage'),
        mapPrice: getVal('map-price'),
        mapImage: getVal('map-image')
    };

    savePresetsStorage();
    renderPresets();
    document.getElementById('new-preset-name').value = '';
    alert('Preset "' + name + '" created!');
}

function applyPreset(name) {
    var p = presets[name];
    if (!p) {
        // Default presets
        if (name === 'mobile') p = { scale: 100, color: '#FF0000' };
        else if (name === 'laptop') p = { scale: 80, color: '#0080FF' };
        else if (name === 'accessory') p = { scale: 90, color: '#00CED1' };
        else return;
    }

    if (p.scale) document.getElementById('scale').value = p.scale;
    if (p.color) document.getElementById('color').value = p.color;
    if (p.jpgQuality) document.getElementById('jpg-quality').value = p.jpgQuality;
    if (p.expPSD !== undefined) document.getElementById('exp-psd').checked = p.expPSD;
    if (p.expJPG !== undefined) document.getElementById('exp-jpg').checked = p.expJPG;
    if (p.expPNG !== undefined) document.getElementById('exp-png').checked = p.expPNG;
    if (p.mapBrand) document.getElementById('map-brand').value = p.mapBrand;
    if (p.mapModel) document.getElementById('map-model').value = p.mapModel;
    if (p.mapStorage) document.getElementById('map-storage').value = p.mapStorage;
    if (p.mapPrice) document.getElementById('map-price').value = p.mapPrice;
    if (p.mapImage) document.getElementById('map-image').value = p.mapImage;
}

function loadPreset() {
    csInterface.evalScript('loadPreferencesJSON()', function (result) {
        if (result && result !== 'null') {
            try {
                var p = JSON.parse(result);
                applyPreset(p);
            } catch (e) { }
        }
    });
}

function savePreset() {
    var current = {
        scale: getVal('scale'),
        color: getVal('color'),
        jpgQuality: getVal('jpg-quality'),
        expPSD: getChecked('exp-psd'),
        expJPG: getChecked('exp-jpg'),
        expPNG: getChecked('exp-png')
    };
    csInterface.evalScript('savePreferencesJSON(\'' + JSON.stringify(current) + '\')');
    alert('Settings saved!');
}

function loadSavedPrefs() {
    csInterface.evalScript('loadPreferencesJSON()', function (result) {
        if (result && result !== 'null') {
            try {
                var p = JSON.parse(result);
                if (p.scale) document.getElementById('scale').value = p.scale;
                if (p.color) document.getElementById('color').value = p.color;
                if (p.jpgQuality) document.getElementById('jpg-quality').value = p.jpgQuality;
            } catch (e) { }
        }
    });
}

// ==================== SMART MATCHER ====================

var masterData = [];
var matchResults = [];
var corrections = {};

// Load corrections from localStorage
try {
    corrections = JSON.parse(localStorage.getItem('hager_corrections') || '{}');
} catch (e) { corrections = {}; }

// Text normalization
function normalize(text) {
    return String(text || '').toLowerCase()
        .replace(/[–—-]/g, ' ')
        .replace(/[^a-z0-9\u0600-\u06FF\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function tokenize(text) {
    return normalize(text).split(' ').filter(function (t) { return t.length >= 1; });
}

// Parse product from unstructured text
function parseProduct(line) {
    var original = line.trim();
    var text = original.replace(/\s*(EGP|LE|جنيه)\s*$/i, '');

    // Try structured format: "Product - Storage - Price"
    var structuredMatch = text.match(/^(.+?)\s*[–—-]\s*(\d+)\s*[–—-]\s*(\d+)\s*$/);
    if (structuredMatch) {
        return {
            original: original,
            name: structuredMatch[1].trim(),
            storage: structuredMatch[2] + 'GB',
            price: parseInt(structuredMatch[3])
        };
    }

    // Extract price from end
    var priceMatch = text.match(/(\d{3,5})\s*$/);
    var price = 0;
    if (priceMatch) {
        price = parseInt(priceMatch[1]);
        text = text.slice(0, priceMatch.index).trim();
    }

    // Extract storage
    var storage = '';
    var storageMatch = text.match(/(\d{2,4})\s*GB?/i);
    if (storageMatch) storage = storageMatch[1] + 'GB';

    return { original: original, name: text, storage: storage, price: price };
}

// Split concatenated products
function splitProducts(input) {
    var lines = input.split(/[\n\r]+/).map(function (l) { return l.trim(); }).filter(function (l) { return l; });

    if (lines.length === 1 && lines[0].length > 50) {
        var text = lines[0];
        var products = [];
        var pattern = /(\d{3,5})(?=[A-Z]|$)/g;
        var lastEnd = 0, match;
        while ((match = pattern.exec(text)) !== null) {
            var priceEnd = match.index + match[1].length;
            var chunk = text.slice(lastEnd, priceEnd).trim();
            if (chunk) products.push(chunk);
            lastEnd = priceEnd;
        }
        if (lastEnd < text.length) {
            var rem = text.slice(lastEnd).trim();
            if (rem.length > 5) products.push(rem);
        }
        if (products.length > 1) return products;
    }
    return lines;
}

// Variant keywords
var VARIANT_KEYWORDS = ['pro max', 'pro', 'plus', 'ultra', 'max', 'air', 'lite', 'fe', 'mini', 'se'];

function extractVariant(text) {
    var n = normalize(text);
    for (var i = 0; i < VARIANT_KEYWORDS.length; i++) {
        if (n.includes(VARIANT_KEYWORDS[i])) return VARIANT_KEYWORDS[i];
    }
    return '';
}

function extractModelNumber(text) {
    var n = normalize(text);
    var m = n.match(/(?:iphone|galaxy|redmi|note|ipad|tab|watch|s|a|m|x)\s*(\d+)/i);
    if (m) return m[1];
    var any = n.match(/\b(\d{1,2})\b/);
    return any ? any[1] : '';
}

// Calculate match score
function calculateMatchScore(inputTokens, masterTokens, masterStr, inputText, masterText) {
    if (!inputTokens.length || !masterTokens.length) return 0;
    var score = 0;

    var iv = extractVariant(inputText), mv = extractVariant(masterText);
    if (iv && mv) {
        if (iv === mv) score += 30;
        else return 0;
    } else if (iv && !mv) return 0;
    else if (!iv && mv) score -= 10;

    var im = extractModelNumber(inputText), mm = extractModelNumber(masterText);
    if (im && mm) {
        if (im === mm) score += 40;
        else return 0;
    }

    var matched = 0;
    for (var i = 0; i < inputTokens.length; i++) {
        var t = inputTokens[i];
        if (masterTokens.indexOf(t) >= 0) { score += 15; matched++; }
        else if (masterStr.indexOf(t) >= 0) { score += 10; matched++; }
    }

    for (var j = 0; j < masterTokens.length; j++) {
        var mt = masterTokens[j];
        if (mt.length >= 2 && inputTokens.indexOf(mt) < 0 && normalize(inputText).indexOf(mt) >= 0) {
            score += 5;
        }
    }

    if (inputTokens.length > 0) score += (matched / inputTokens.length) * 15;

    return Math.min(100, Math.max(0, Math.round(score)));
}

// Find best match
function findBestMatch(productName, inputStorage) {
    // Check corrections first
    var key = normalize(productName);
    if (corrections[key]) {
        return { match: corrections[key], score: 100, fromCorrection: true };
    }

    var inputTokens = tokenize(productName);
    if (!inputTokens.length || !masterData.length) return { match: null, score: 0 };

    var bestMatch = null, bestScore = 0;
    for (var i = 0; i < masterData.length; i++) {
        var master = masterData[i];
        var score = calculateMatchScore(inputTokens, master.tokens, master.normalized, productName, master.fullName);

        if (inputStorage && master.storage) {
            var iS = inputStorage.replace(/[^\d]/g, '');
            var mS = master.storage.replace(/[^\d]/g, '');
            if (iS === mS) score = Math.min(100, score + 5);
        }

        if (score > bestScore) {
            bestScore = score;
            bestMatch = master;
        }
    }

    return { match: bestMatch, score: bestScore };
}

// Run Smart Matcher
function runSmartMatcher() {
    var inputText = document.getElementById('input-data').value.trim();
    if (!inputText) {
        alert('Please paste product data');
        return;
    }

    // If no master data, try to load from CSV path
    if (!masterData.length && !paths.master) {
        alert('Please select a Master CSV file first');
        return;
    }

    // Load master if path exists but data not loaded
    if (!masterData.length && paths.master) {
        loadMasterFromPath(paths.master, function () {
            processSmartMatch(inputText);
        });
        return;
    }

    processSmartMatch(inputText);
}

function loadMasterFromPath(csvPath, callback) {
    csInterface.evalScript('readTextFile("' + csvPath.replace(/\\/g, '\\\\') + '")', function (result) {
        if (!result || result === 'null') {
            alert('Could not read master file');
            return;
        }

        var lines = result.split(/[\r\n]+/);
        if (lines.length < 2) {
            alert('Master file is empty');
            return;
        }

        var headers = lines[0].split(',').map(function (h) { return h.replace(/"/g, '').trim().toUpperCase(); });
        var brandIdx = headers.indexOf('BRAND');
        var modelIdx = headers.indexOf('MODEL');
        var storageIdx = headers.indexOf('STORAGE');
        var priceIdx = headers.indexOf('PRICE');
        var imageIdx = Math.max(headers.indexOf('IMAGE'), headers.indexOf('IMG'));

        masterData = [];
        for (var i = 1; i < lines.length; i++) {
            var cols = lines[i].split(',').map(function (c) { return c.replace(/"/g, '').trim(); });
            var brand = brandIdx >= 0 ? cols[brandIdx] || '' : '';
            var model = modelIdx >= 0 ? cols[modelIdx] || '' : '';
            var storage = storageIdx >= 0 ? cols[storageIdx] || '' : '';
            var price = priceIdx >= 0 ? cols[priceIdx] || '' : '';
            var image = imageIdx >= 0 ? cols[imageIdx] || '' : '';

            if (brand || model) {
                var fullName = (brand + ' ' + model).trim();
                masterData.push({
                    brand: brand,
                    model: model,
                    storage: storage,
                    price: price,
                    image: image,
                    fullName: fullName,
                    normalized: normalize(fullName),
                    tokens: tokenize(fullName)
                });
            }
        }

        document.getElementById('master-status').style.display = 'block';
        document.getElementById('master-count').textContent = masterData.length;

        if (callback) callback();
    });
}

function processSmartMatch(inputText) {
    var divisor = parseFloat(document.getElementById('divisor').value) || 1;
    var profitMargin = parseFloat(document.getElementById('profit-margin').value) || 0;
    var threshold = parseInt(document.getElementById('match-threshold').value) || 20;

    var products = splitProducts(inputText);
    matchResults = [];

    for (var i = 0; i < products.length; i++) {
        var parsed = parseProduct(products[i]);
        var result = findBestMatch(parsed.name, parsed.storage);

        var finalPrice = Math.ceil(parsed.price / divisor);
        if (profitMargin > 0) finalPrice = Math.ceil(finalPrice * (1 + profitMargin / 100));

        var finalStorage = parsed.storage || (result.match ? result.match.storage : '-') || '-';

        if (result.match && result.score >= threshold) {
            matchResults.push({
                idx: i,
                original: products[i],
                brand: result.match.brand,
                model: result.match.model,
                storage: finalStorage,
                price: finalPrice,
                image: result.match.image || '',
                score: result.score,
                matched: true
            });
        } else {
            matchResults.push({
                idx: i,
                original: products[i],
                brand: '?',
                model: parsed.name,
                storage: finalStorage,
                price: finalPrice,
                image: '',
                score: result.score,
                matched: false
            });
        }
    }

    renderMatchResults();
    updateMatcherStats();
}

function renderMatchResults() {
    var container = document.getElementById('match-results');

    if (!matchResults.length) {
        container.innerHTML = '<div style="text-align:center;color:var(--text-3);padding:30px;">No results</div>';
        return;
    }

    var html = '';
    for (var i = 0; i < matchResults.length; i++) {
        var r = matchResults[i];
        var scoreClass = r.score >= 80 ? 'score-high' : (r.score >= 50 ? 'score-medium' : 'score-low');
        var rowClass = r.matched ? 'matched' : 'unmatched';

        html += '<div class="match-row ' + rowClass + '">';
        html += '<div class="match-num">#' + (i + 1) + '</div>';
        html += '<div class="match-content">';
        html += '<span class="match-brand">' + r.brand + '</span> ';
        html += '<span class="match-model">' + r.model + '</span>';
        html += '<div class="match-details">' + r.storage + ' | ' + r.price + ' EGP</div>';
        html += '</div>';
        html += '<span class="match-score ' + scoreClass + '">' + r.score + '%</span>';
        html += '<button class="match-edit" onclick="editMatch(' + i + ')">✏</button>';
        html += '</div>';
    }

    container.innerHTML = html;
}

function updateMatcherStats() {
    var total = matchResults.length;
    var matched = matchResults.filter(function (r) { return r.matched; }).length;
    var unmatched = total - matched;

    document.getElementById('matcher-stats').style.display = 'grid';
    document.getElementById('m-total').textContent = total;
    document.getElementById('m-matched').textContent = matched;
    document.getElementById('m-unmatched').textContent = unmatched;
}

function editMatch(idx) {
    var r = matchResults[idx];
    var newBrand = prompt('Brand:', r.brand);
    if (newBrand === null) return;

    var newModel = prompt('Model:', r.model);
    if (newModel === null) return;

    matchResults[idx].brand = newBrand;
    matchResults[idx].model = newModel;
    matchResults[idx].matched = true;
    matchResults[idx].score = 100;

    // Save correction
    var key = normalize(r.original);
    corrections[key] = { brand: newBrand, model: newModel, storage: r.storage, image: r.image };
    localStorage.setItem('hager_corrections', JSON.stringify(corrections));

    renderMatchResults();
    updateMatcherStats();
}

function exportMatchedCSV() {
    if (!matchResults.length) {
        alert('No results to export');
        return;
    }

    var csv = 'Brand,Model,Storage,Price,Image\n';
    for (var i = 0; i < matchResults.length; i++) {
        var r = matchResults[i];
        csv += '"' + r.brand + '","' + r.model + '","' + r.storage + '","' + r.price + '","' + r.image + '"\n';
    }

    // Save to file
    if (paths.save) {
        var filePath = paths.save + '/matched_products.csv';
        csInterface.evalScript('saveTextFile("' + filePath.replace(/\\/g, '\\\\') + '", \'' + csv.replace(/'/g, "\\'").replace(/\n/g, "\\n") + '\')');
        alert('Saved to: ' + filePath);
    } else {
        alert('Please select a Save folder first');
    }
}

// ==================== USE MATCH RESULTS FOR PROCESS ====================

function useMatchResultsForProcess() {
    if (!matchResults.length) {
        alert('No match results! Run Smart Match first.');
        return;
    }

    if (!paths.save) {
        alert('Please select a Save folder in Main tab first');
        return;
    }

    if (!paths.fb && !paths.ig && !paths.tpl) {
        alert('Please select at least one PSD template in Main tab first');
        return;
    }

    // Create a temporary CSV from match results
    var csvContent = 'Brand,Model,Storage,Price,Image\n';
    for (var i = 0; i < matchResults.length; i++) {
        var r = matchResults[i];
        if (r.matched) {  // Only use matched products
            csvContent += r.brand + ',' + r.model + ',' + r.storage + ',' + r.price + ',' + r.image + '\n';
        }
    }

    // Save temp CSV
    var tempCsvPath = paths.save + '/_temp_matched.csv';
    csInterface.evalScript('saveTextFile("' + tempCsvPath.replace(/\\/g, '\\\\') + '", \'' + csvContent.replace(/'/g, "\\'").replace(/\n/g, "\\n") + '\')', function () {

        // Set the temp CSV as the current CSV
        paths.csv = tempCsvPath;
        document.getElementById('lbl-csv').textContent = '_temp_matched.csv (from Matcher)';
        document.getElementById('lbl-csv').classList.add('selected');

        // Switch to Main tab
        showTabById('main');

        // Show message
        alert('Match results loaded! (' + matchResults.filter(function (r) { return r.matched; }).length + ' products)\n\nClick "Run & Process" to start.');
    });
}

function showTabById(tabId) {
    document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('active'); });
    document.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active'); });

    // Find and activate the correct tab
    var tabs = document.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
        if (tabs[i].textContent.toLowerCase().indexOf(tabId) >= 0) {
            tabs[i].classList.add('active');
            break;
        }
    }

    document.getElementById('tab-' + tabId).classList.add('active');
}

// ==================== OPEN WEB MATCHER ====================

function openWebMatcher() {
    // Get the extension folder path
    var extPath = csInterface.getSystemPath(SystemPath.EXTENSION);
    var matcherPath = extPath + '/client/smart-matcher.html';

    // Try multiple methods to open the file
    try {
        // Method 1: openURLInDefaultBrowser
        var url = 'file:///' + matcherPath.replace(/\\/g, '/').replace(/ /g, '%20');
        csInterface.openURLInDefaultBrowser(url);
    } catch (e) {
        // Method 2: Use ExtendScript to open
        csInterface.evalScript('openInBrowser("' + matcherPath.replace(/\\/g, '\\\\') + '")');
    }
}

// ==================== FULLY DYNAMIC COLUMN-LAYER MAPPING v3 ====================

var mappingCounter = 0;
var DEFAULT_MAPPINGS = [
    { csvCol: 'Brand', layerName: 'Brand' },
    { csvCol: 'Model', layerName: 'Model' },
    { csvCol: 'Storage', layerName: 'Storage' },
    { csvCol: 'Price', layerName: 'Price' },
    { csvCol: 'Image', layerName: 'Image' }
];

function addMapping(csvCol, layerName) {
    mappingCounter++;
    var container = document.getElementById('all-mappings-container');
    if (!container) return;

    var row = document.createElement('div');
    row.className = 'mapping-row';
    row.id = 'mapping-' + mappingCounter;
    row.innerHTML = `
        <input type="text" class="csv-col" value="${csvCol || ''}" placeholder="CSV Column Name">
        <span class="arrow">→</span>
        <input type="text" class="layer-name" value="${layerName || ''}" placeholder="PSD Layer Name">
        <span class="remove-btn" onclick="removeMapping(${mappingCounter})">🗑️</span>
    `;

    container.appendChild(row);

    // Add change listeners
    row.querySelector('.csv-col').addEventListener('change', saveMappings);
    row.querySelector('.layer-name').addEventListener('change', saveMappings);

    // Focus if empty
    if (!csvCol) {
        row.querySelector('.csv-col').focus();
    }

    saveMappings();
}

function removeMapping(id) {
    var row = document.getElementById('mapping-' + id);
    if (row) {
        row.remove();
        saveMappings();
    }
}

function getAllMappings() {
    var mappings = [];
    var container = document.getElementById('all-mappings-container');

    if (container) {
        var rows = container.querySelectorAll('.mapping-row');
        rows.forEach(function (row) {
            var csvCol = row.querySelector('.csv-col').value.trim();
            var layerName = row.querySelector('.layer-name').value.trim();
            if (csvCol && layerName) {
                mappings.push({
                    csvColumn: csvCol,
                    layerName: layerName
                });
            }
        });
    }

    return mappings;
}

function saveMappings() {
    var container = document.getElementById('all-mappings-container');
    var mappings = [];

    if (container) {
        var rows = container.querySelectorAll('.mapping-row');
        rows.forEach(function (row) {
            mappings.push({
                csvCol: row.querySelector('.csv-col').value,
                layerName: row.querySelector('.layer-name').value
            });
        });
    }

    localStorage.setItem('listmatic_mappings_v3', JSON.stringify(mappings));
}

function loadMappings() {
    var container = document.getElementById('all-mappings-container');
    if (!container) return;

    // Clear container
    container.innerHTML = '';
    mappingCounter = 0;

    try {
        var saved = JSON.parse(localStorage.getItem('listmatic_mappings_v3'));

        if (saved && saved.length > 0) {
            // Load saved mappings
            saved.forEach(function (mapping) {
                addMapping(mapping.csvCol, mapping.layerName);
            });
        } else {
            // Load defaults
            resetMappingsToDefault();
        }
    } catch (e) {
        // Load defaults on error
        resetMappingsToDefault();
    }
}

function resetMappingsToDefault() {
    var container = document.getElementById('all-mappings-container');
    if (!container) return;

    // Clear container
    container.innerHTML = '';
    mappingCounter = 0;

    // Add default mappings
    DEFAULT_MAPPINGS.forEach(function (mapping) {
        addMapping(mapping.csvCol, mapping.layerName);
    });

    saveMappings();
}

// Initialize mappings on page load
document.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
        loadMappings();
        initMetadataToggle();
        loadMetadataSettings();
    }, 600);
});

// ==================== METADATA INJECTION ====================

function initMetadataToggle() {
    var toggle = document.getElementById('enable-metadata');
    var fields = document.getElementById('metadata-fields');

    if (toggle && fields) {
        toggle.addEventListener('change', function () {
            fields.style.display = toggle.checked ? 'block' : 'none';
            saveMetadataSettings();
        });
    }
}

function getMetadataConfig() {
    var enabled = document.getElementById('enable-metadata');
    if (!enabled || !enabled.checked) {
        return null;
    }

    return {
        enabled: true,
        descriptionCol: getVal('meta-description-col') || 'Description',
        keywordsCol: getVal('meta-keywords-col') || 'Keywords',
        titleTemplate: getVal('meta-title-template') || '{Brand} {Model}',
        author: getVal('meta-author') || ''
    };
}

function saveMetadataSettings() {
    var settings = {
        enabled: document.getElementById('enable-metadata').checked,
        descriptionCol: getVal('meta-description-col'),
        keywordsCol: getVal('meta-keywords-col'),
        titleTemplate: getVal('meta-title-template'),
        author: getVal('meta-author')
    };
    localStorage.setItem('listmatic_metadata', JSON.stringify(settings));
}

function loadMetadataSettings() {
    try {
        var saved = JSON.parse(localStorage.getItem('listmatic_metadata'));
        if (saved) {
            var toggle = document.getElementById('enable-metadata');
            var fields = document.getElementById('metadata-fields');

            if (toggle) toggle.checked = saved.enabled;
            if (fields) fields.style.display = saved.enabled ? 'block' : 'none';

            if (saved.descriptionCol) document.getElementById('meta-description-col').value = saved.descriptionCol;
            if (saved.keywordsCol) document.getElementById('meta-keywords-col').value = saved.keywordsCol;
            if (saved.titleTemplate) document.getElementById('meta-title-template').value = saved.titleTemplate;
            if (saved.author) document.getElementById('meta-author').value = saved.author;
        }
    } catch (e) { }

    // Add change listeners for auto-save
    ['meta-description-col', 'meta-keywords-col', 'meta-title-template', 'meta-author'].forEach(function (id) {
        var el = document.getElementById(id);
        if (el) el.addEventListener('change', saveMetadataSettings);
    });
}
