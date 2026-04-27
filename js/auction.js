// auction.js - Logic for Auction Bidding & Timer

document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const cardContainer = document.getElementById('current-player-card');
    
    // Bidding
    const bidButtons = document.querySelectorAll('.btn-bid');
    const customBidBtn = document.getElementById('btn-custom-bid');
    const customBidVal = document.getElementById('custom-bid-val');
    const selectTeam = document.getElementById('select-bid-team');
    const btnSell = document.getElementById('btn-sell');
    const btnUnsold = document.getElementById('btn-unsold');
    const btnUndo = document.getElementById('btn-undo');

    // Timer Elements
    const timerInput = document.getElementById('timer-input');
    const btnTimerStart = document.getElementById('btn-timer-start');
    const btnTimerPause = document.getElementById('btn-timer-pause');
    const btnTimerReset = document.getElementById('btn-timer-reset');
    const countdownDisplay = document.getElementById('countdown-display');

    let timerInterval = null;

    function renderAuctionConsole(state) {
        const { currentPlayerId, currentBid, currentBidderId, status, timer } = state.auctionState;

        if (!currentPlayerId) {
            cardContainer.innerHTML = '<div class="empty-state">No Player Selected for Auction</div>';
            return;
        }

        const player = state.players.find(p => p.id === currentPlayerId);
        const bidder = state.teams.find(t => t.id === currentBidderId);

        const curr = state.settings.currency || '₹';
        
        if (player) {
            cardContainer.innerHTML = `
                <img src="${player.image}" alt="Player" class="player-photo">
                <div class="player-details">
                    <h3>${player.name}</h3>
                    <div class="pd-role">${player.role} | Base: ${curr}${player.basePrice}</div>
                    
                    <div class="pd-bid-info">
                        <div class="pd-box">
                            <div class="label">CURRENT BID</div>
                            <div class="value animate-value">${curr}${currentBid}</div>
                        </div>
                        <div class="pd-box">
                            <div class="label">HIGHEST BIDDER</div>
                            <div class="value">${bidder ? bidder.name : 'Waiting...'}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        // Action Buttons Visibility
        if (status === 'sold' || status === 'unsold') {
            btnSell.style.display = 'none';
            btnUnsold.style.display = 'none';
            btnUndo.style.display = 'block';
        } else {
            btnSell.style.display = 'block';
            btnUnsold.style.display = 'block';
            btnUndo.style.display = 'none';
        }

        // Update Timer Display
        countdownDisplay.innerText = timer + 's';
        if (timer <= 5 && timer > 0) {
            countdownDisplay.classList.add('danger');
        } else {
            countdownDisplay.classList.remove('danger');
        }
    }

    // Subscribe to state change
    window.store.on('stateChanged', renderAuctionConsole);
    renderAuctionConsole(window.store.state);

    // --- Bidding Logic --- 
    let activeIncrement = 1000; // Default increment

    function updateIncrementHighlight() {
        bidButtons.forEach(btn => {
            if (parseInt(btn.dataset.inc, 10) === activeIncrement) {
                btn.classList.add('active-inc');
            } else {
                btn.classList.remove('active-inc');
            }
        });
    }
    updateIncrementHighlight();

    function handleBid(amountToAdd, teamId = null) {
        const finalTeamId = teamId || selectTeam.value;
        if (!finalTeamId) {
            if (!teamId) alert('Please select a team to assign the bid!');
            return;
        }
        
        const state = window.store.state.auctionState;
        if (!state.currentPlayerId) return;

        let newBid = state.currentBid;
        // If there's no bidder yet, the first bid might just be the base price.
        if (!state.currentBidderId && state.currentBid > 0) {
           newBid = state.currentBid; 
        } else {
           newBid += amountToAdd;
        }

        window.store.placeBid(finalTeamId, newBid);

        // Auto reset timer on bid
        const resetVal = parseInt(timerInput.value, 10);
        window.store.updateTimer(resetVal);
        startTimer();
    }

    // Expose this for team buttons in admin.js
    window.placeBidForTeam = (teamId) => {
        handleBid(activeIncrement, teamId);
    };

    bidButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const inc = parseInt(e.target.dataset.inc, 10);
            activeIncrement = inc;
            updateIncrementHighlight();
            handleBid(inc);
        });
    });

    customBidBtn.addEventListener('click', () => {
        const customValue = parseInt(customBidVal.value, 10);
        if(!isNaN(customValue) && customValue > 0) {
           const teamId = selectTeam.value;
           if (!teamId) {
               alert('Please select a team!');
               return;
           }
           // Custom bid now ADDS to current bid
           const state = window.store.state.auctionState;
           const newBid = (state.currentBid || 0) + customValue;
           window.store.placeBid(teamId, newBid);
           customBidVal.value = '';
        }
    });

    btnSell.addEventListener('click', () => {
        pauseTimer();
        window.store.markSold();
    });

    btnUnsold.addEventListener('click', () => {
        pauseTimer();
        window.store.markUnsold();
    });
    
    btnUndo.addEventListener('click', () => {
        window.store.undoAuction();
    });

    // --- Timer Logic ---
    function startTimer() {
        if(timerInterval) clearInterval(timerInterval);
        
        timerInterval = setInterval(() => {
            let currentTimer = window.store.state.auctionState.timer;
            if (currentTimer > 0) {
                currentTimer -= 1;
                window.store.updateTimer(currentTimer);
            } else {
                pauseTimer();
            }
        }, 1000);
    }

    function pauseTimer() {
        if(timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
    }

    btnTimerStart.addEventListener('click', startTimer);
    btnTimerPause.addEventListener('click', pauseTimer);
    btnTimerReset.addEventListener('click', () => {
        pauseTimer();
        const resetVal = parseInt(timerInput.value, 10) || 30;
        window.store.updateTimer(resetVal);
    });
});
