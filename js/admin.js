// admin.js - Logic for Admin Dashboard 

document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const els = {
        sportName: document.getElementById('setting-sport'),
        roles: document.getElementById('setting-roles'),
        overlayMode: document.getElementById('setting-overlay-mode'),
        activeScreen: document.getElementById('setting-active-screen'),
        currency: document.getElementById('setting-currency'),
        saveSettings: document.getElementById('btn-save-settings'),

        formTeam: document.getElementById('form-add-team'),
        teamName: document.getElementById('team-name'),
        teamBudget: document.getElementById('team-budget'),
        listTeams: document.getElementById('list-teams'),

        formPlayer: document.getElementById('form-add-player'),
        playerName: document.getElementById('player-name'),
        playerRole: document.getElementById('player-role'),
        playerBasePrice: document.getElementById('player-base-price'),
        playerStats: document.getElementById('player-stats'),
        playerImage: document.getElementById('player-image'),

        filterStatus: document.getElementById('filter-status'),
        tablePlayers: document.getElementById('table-players'),
        poolCount: document.getElementById('pool-count'),
        historyLog: document.getElementById('history-log'),
        
        btnExport: document.getElementById('btn-export'),
        importFile: document.getElementById('import-file'),
        btnReset: document.getElementById('btn-reset-app'),

        // Auction selects
        selectBidTeam: document.getElementById('select-bid-team')
    };

    // 1. Render functions
    function renderSettings(state) {
        if(document.activeElement !== els.sportName) els.sportName.value = state.settings.sportName;
        if(document.activeElement !== els.roles) els.roles.value = state.settings.roles.join(', ');
        if(document.activeElement !== els.overlayMode) els.overlayMode.value = state.settings.overlayMode;
        if(document.activeElement !== els.activeScreen) els.activeScreen.value = state.settings.activeScreen || 'auction';
        if(document.activeElement !== els.currency) els.currency.value = state.settings.currency || '₹';
        
        // Update role dropdown
        const currentSelectedRole = els.playerRole.value;
        els.playerRole.innerHTML = state.settings.roles.map(r => `<option value="${r}">${r}</option>`).join('');
        if(state.settings.roles.includes(currentSelectedRole)) els.playerRole.value = currentSelectedRole;
    }

    function renderTeams(state) {
        const curr = state.settings.currency || '₹';
        els.listTeams.innerHTML = state.teams.map(t => {
            const remaining = t.budget - t.spent;
            return `
                <div class="list-item">
                    <span><strong>${t.name}</strong></span>
                    <span>Rem: ${curr}${remaining} <small>(Bug: ${curr}${t.budget})</small></span>
                </div>
            `;
        }).join('');

        // Update select team dropdown for bidding
        const currentSel = els.selectBidTeam.value;
        els.selectBidTeam.innerHTML = '<option value="">Select Team...</option>' + 
            state.teams.map(t => `<option value="${t.id}">${t.name} (Rem: ${curr}${t.budget - t.spent})</option>`).join('');
        if(state.teams.find(t=>t.id===currentSel)) els.selectBidTeam.value = currentSel;
    }

    function renderPlayers(state) {
        const filter = els.filterStatus.value;
        const filtered = state.players.filter(p => filter === 'all' || p.status === filter);
        
        els.poolCount.innerText = state.players.length;

        const curr = state.settings.currency || '₹';
        els.tablePlayers.innerHTML = filtered.map(p => {
            let actionBtn = '';
            if (p.status === 'pending' && state.auctionState.currentPlayerId !== p.id) {
                actionBtn = `<button class="btn btn-secondary btn-sm" onclick="window.store.setCurrentPlayer('${p.id}')">Auction</button>`;
            } else if (state.auctionState.currentPlayerId === p.id) {
                actionBtn = `<span style="color:var(--accent-neon)">In Auction</span>`;
            }

            return `
                <tr>
                    <td>${p.name}</td>
                    <td>${p.role}</td>
                    <td>${curr}${p.basePrice}</td>
                    <td><span class="badge badge-${p.status}">${p.status.toUpperCase()}</span></td>
                    <td>${actionBtn}</td>
                </tr>
            `;
        }).join('');
    }

    function renderHistory(state) {
        els.historyLog.innerHTML = state.history.map(h => `
            <div class="log-entry">
                <span class="log-time">[${h.time}]</span>
                <span class="log-action">${h.action}</span>
            </div>
        `).join('');
    }

    function fullRender(state) {
        renderSettings(state);
        renderTeams(state);
        renderPlayers(state);
        renderHistory(state);
    }

    // Init Render
    fullRender(window.store.state);
    
    // Subscribe to changes
    window.store.on('stateChanged', fullRender);

    // 2. DOM Events
    els.saveSettings.addEventListener('click', () => {
        window.store.updateSettings(
            els.sportName.value, 
            els.roles.value, 
            els.overlayMode.value,
            els.activeScreen.value,
            els.currency.value || '₹'
        );
    });

    els.formTeam.addEventListener('submit', (e) => {
        e.preventDefault();
        window.store.addTeam(els.teamName.value, els.teamBudget.value);
        els.teamName.value = '';
        els.teamBudget.value = '';
    });

    els.formPlayer.addEventListener('submit', (e) => {
        e.preventDefault();
        window.store.addPlayer(
            els.playerName.value,
            els.playerRole.value,
            els.playerBasePrice.value,
            els.playerImage.value,
            els.playerStats.value
        );
        els.playerName.value = '';
        els.playerBasePrice.value = '';
        els.playerImage.value = '';
        els.playerStats.value = '';
    });

    els.filterStatus.addEventListener('change', () => {
        renderPlayers(window.store.state);
    });

    // Import/Export
    els.btnExport.addEventListener('click', () => {
        // Export the full application state to allow complete backup and restore
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.store.state, null, 2));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", "auction_full_backup.json");
        dlAnchorElem.click();
    });

    els.importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if(!file) return;
        const ext = file.name.split('.').pop().toLowerCase();
        
        const reader = new FileReader();
        
        reader.onload = function(evt) {
            try {
                if(ext === 'xlsx' || ext === 'xls') {
                    // Parse Excel
                    const data = new Uint8Array(evt.target.result);
                    const workbook = XLSX.read(data, {type: 'array'});
                    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                    const rows = XLSX.utils.sheet_to_json(firstSheet, {header: 1});
                    
                    const newPlayers = [];
                    // Skip header row
                    for(let i=1; i<rows.length; i++) {
                        const r = rows[i];
                        if(r && r[0]) {
                            newPlayers.push({
                                id: 'p_xls_' + Date.now() + '_' + i,
                                name: String(r[0]).trim(),
                                role: String(r[1]).trim(),
                                basePrice: parseInt(r[2], 10) || 0,
                                image: r[3] ? String(r[3]).trim() : 'https://via.placeholder.com/400',
                                stats: r[4] ? String(r[4]).trim() : '',
                                status: 'pending',
                                soldTo: null,
                                soldPrice: null
                            });
                        }
                    }
                    const added = window.store.importPlayersData(newPlayers);
                    alert(`Successfully imported ${added} new unique players from Excel! (Duplicates were skipped)`);
                } else if(ext === 'json') {
                    const parsed = JSON.parse(evt.target.result);
                    if(Array.isArray(parsed)) {
                        const added = window.store.importPlayersData(parsed);
                        alert(`Successfully imported ${added} new unique players from JSON! (Duplicates were skipped)`);
                    } else if (parsed && parsed.players && parsed.teams && parsed.settings) {
                        // Full state restore
                        window.store.state = parsed;
                        window.store.saveState();
                        alert('Full Application Backup Restored Successfully!');
                        location.reload(); // Refresh to rebuild all UI
                    } else {
                        alert('Unrecognized JSON format.');
                    }
                } else if(ext === 'csv') {
                    const lines = evt.target.result.split('\n');
                    const importedPlayers = [];
                    // Skip header line
                    for(let i=1; i<lines.length; i++) {
                        const parts = lines[i].split(',');
                        if(parts.length >= 3 && parts[0].trim() !== '') {
                            importedPlayers.push({
                                id: 'p_csv_' + Date.now() + '_' + i,
                                name: parts[0].trim(),
                                role: parts[1].trim(),
                                basePrice: parseInt(parts[2], 10) || 0,
                                image: parts[3] ? parts[3].trim() : 'https://via.placeholder.com/400',
                                stats: parts[4] ? parts[4].trim() : '',
                                status: 'pending',
                                soldTo: null,
                                soldPrice: null
                            });
                        }
                    }
                    const added = window.store.importPlayersData(importedPlayers);
                    alert(`Successfully imported ${added} new unique players from CSV! (Duplicates were skipped)`);
                } else {
                    alert('Please upload a .json, .csv, or .xlsx file');
                }
            } catch(err) {
                alert('Error parsing file!');
                console.error(err);
            }
        };

        // Determine how to read the file based on format
        if(ext === 'xlsx' || ext === 'xls') {
            reader.readAsArrayBuffer(file);
        } else {
            reader.readAsText(file);
        }
        
        // Reset input logic
        e.target.value = '';
    });

    els.btnReset.addEventListener('click', () => {
        window.store.resetApp();
    });

});
