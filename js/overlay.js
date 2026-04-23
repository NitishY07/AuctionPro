// overlay.js - Handles DOM manipulation for OBS Graphics

document.addEventListener('DOMContentLoaded', () => {
    
    const els = {
        container: document.getElementById('overlay-container'),
        img: document.getElementById('ov-player-img'),
        sport: document.getElementById('ov-sport-name'),
        name: document.getElementById('ov-player-name'),
        role: document.getElementById('ov-player-role'),
        stats: document.getElementById('ov-player-stats'),
        basePrice: document.getElementById('ov-base-price'),
        curBid: document.getElementById('ov-current-bid'),
        currency: document.getElementById('ov-currency'),
        bidder: document.getElementById('ov-team-name'),
        timerBox: document.getElementById('ov-timer-box'),
        timerVal: document.getElementById('ov-timer-val'),
        stampOverlay: document.getElementById('ov-stamp'),
        stampText: document.getElementById('ov-stamp-text'),
        
        teamsScreen: document.getElementById('teams-screen'),
        tsGrid: document.getElementById('ts-grid')
    };

    let lastPlayerId = null;
    let lastStampTs = null;
    let lastAnimationTs = null;

    function renderOverlay(state) {
        const as = state.auctionState;
        const set = state.settings;

        // Overlay Mode Class
        els.container.className = 'overlay-wrapper';
        if (set.overlayMode === 'fullscreen') els.container.classList.add('mode-fullscreen');
        else els.container.classList.add('mode-lower-third');

        els.sport.innerText = set.sportName;

        // Route based on active screen
        if (set.activeScreen === 'teams') {
            els.container.style.display = 'none';
            els.teamsScreen.style.display = 'flex';
            els.teamsScreen.style.opacity = '1';
            
            // Render Teams
            els.tsGrid.innerHTML = state.teams.map(t => {
                const remainingPurse = t.budget - t.spent;
                const roster = state.players.filter(p => p.soldTo === t.id);
                
                const curr = set.currency || '₹';
                
                const playersHtml = roster.map(p => `
                    <div class="ts-player-item">
                        <span class="name">${p.name}</span>
                        <span class="price">${curr}${p.soldPrice.toLocaleString()}</span>
                    </div>
                `).join('');
                
                return `
                    <div class="ts-team-card">
                        <div class="ts-team-name">${t.name}</div>
                        <div class="ts-team-purse">
                            <span class="label">REMAINING PURSE</span>
                            <span class="value">${curr}${remainingPurse.toLocaleString()}</span>
                        </div>
                        <div class="ts-players-list">
                            ${playersHtml || '<div class="empty-state" style="text-align:center;color:#8b949e;">No players bought yet</div>'}
                        </div>
                    </div>
                `;
            }).join('');
            
            return; // Skip auction render
        } else {
            els.teamsScreen.style.display = 'none';
            els.container.style.display = 'flex';
            
            if (!as.currentPlayerId) {
                els.container.style.opacity = '0';
                return;
            } else {
                els.container.style.opacity = '1';
            }
        }

        const player = state.players.find(p => p.id === as.currentPlayerId);
        const bidder = state.teams.find(t => t.id === as.currentBidderId);
        
        // Update currency symbol
        els.currency.innerText = set.currency || '₹';

        if (player) {
            els.name.innerText = player.name;
            els.role.innerText = player.role;
            els.basePrice.innerText = player.basePrice.toLocaleString();
            
            // Set Stats Text
            if (player.stats && player.stats.trim() !== '') {
                els.stats.innerText = player.stats;
                els.stats.style.display = 'block';
            } else {
                els.stats.style.display = 'none';
            }
            
            // Image change logic
            if (player.image && els.img.src !== player.image) {
                els.img.src = player.image;
            }
        }

        // Timer
        if (as.timer > 0 && as.status === 'active') {
            els.timerBox.style.display = 'block';
            els.timerVal.innerText = as.timer;
            if (as.timer <= 5) els.timerBox.classList.add('warning');
            else els.timerBox.classList.remove('warning');
        } else {
            els.timerBox.style.display = 'none';
        }

        // Bid updates with animation replay
        const formattedBid = as.currentBid.toLocaleString();
        if (els.curBid.innerText !== formattedBid) {
            els.curBid.innerText = formattedBid;
            // animate
            els.curBid.classList.remove('animate-value');
            void els.curBid.offsetWidth; // trigger reflow
            els.curBid.classList.add('animate-value');
        }

        els.bidder.innerText = bidder ? bidder.name : '-';

        // Check if new player triggered
        if (as.triggerAnimation && as.triggerAnimation !== lastAnimationTs) {
            lastAnimationTs = as.triggerAnimation;
            
            // Reset stamps
            els.stampOverlay.style.display = 'none';
            els.stampOverlay.className = 'stamp-overlay';
            
            // Replay slideIn animation
            const content = els.container.querySelector('.content-grid');
            content.style.animation = 'none';
            void content.offsetWidth; // reflow
            if(set.overlayMode === 'fullscreen'){
                 content.style.animation = 'slideInRight 0.8s forwards cubic-bezier(0.2, 0.8, 0.2, 1)';
            } else {
                 content.style.animation = 'slideInUp 0.8s forwards cubic-bezier(0.2, 0.8, 0.2, 1)';
            }
        }

        // Check for sold/unsold stamps
        if (as.stampTrigger && as.stampTrigger.ts !== lastStampTs) {
            lastStampTs = as.stampTrigger.ts;
            els.stampOverlay.style.display = 'block';
            
            if (as.stampTrigger.type === 'sold') {
                els.stampOverlay.className = 'stamp-overlay stamp-sold';
                els.stampText.innerText = 'SOLD';
            } else {
                els.stampOverlay.className = 'stamp-overlay stamp-unsold';
                els.stampText.innerText = 'UNSOLD';
            }
        }
    }

    window.store.on('stateChanged', renderOverlay);
    renderOverlay(window.store.state);
});
