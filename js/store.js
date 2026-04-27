// store.js - State management via Firebase Realtime Database

const DEFAULT_STATE = {
    settings: {
        sportName: 'Cricket',
        roles: ['Batsman', 'Bowler', 'All Rounder', 'Wicket Keeper'],
        overlayMode: 'fullscreen', // fullscreen or lower-third
        activeScreen: 'auction', // 'auction' or 'teams'
        currency: '₹', // custom currency or points
        showTimer: true // toggle for displaying timer on overlay
    },
    teams: [],
    players: [],
    auctionState: {
        currentPlayerId: null,
        currentBid: 0,
        currentBidderId: null,
        status: 'waiting', // waiting, active, paused, sold, unsold
        timer: 30, // seconds remaining
        triggerAnimation: null, // used to tell overlay to replay animations e.g. Date.now()
        stampTrigger: null // { type: 'sold'|'unsold', ts: Date.now() }
    },
    history: []
};

class Store {
    constructor() {
        this.tournamentId = this.getTournamentId();
        
        if (!this.tournamentId) {
            // Redirect to gateway if no tournament ID is found and we are not already on index.html
            if (!window.location.pathname.endsWith('index.html') && window.location.pathname !== '/') {
                window.location.href = 'index.html';
            }
            return;
        }

        this.dbRef = window.firebaseDb.ref('tournaments/' + this.tournamentId);
        this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
        this.listeners = {};
        
        // Listen to Firebase real-time updates
        this.dbRef.on('value', (snapshot) => {
            const data = snapshot.val();
            if (data) {
                // Merge arrays properly (Firebase might remove empty arrays)
                this.state = {
                    ...DEFAULT_STATE,
                    ...data,
                    teams: data.teams || [],
                    players: data.players || [],
                    history: data.history || []
                };
            } else {
                // If tournament doesn't exist yet, initialize it
                this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
                this.saveState();
            }
            this.emit('stateChanged', this.state);
        });
    }

    getTournamentId() {
        // Try to get from URL parameter first (important for overlay)
        const urlParams = new URLSearchParams(window.location.search);
        const urlTid = urlParams.get('t');
        if (urlTid) return urlTid.toUpperCase();

        // Fallback to localStorage (mostly for admin)
        const lsTid = localStorage.getItem('active_tournament');
        if (lsTid) return lsTid.toUpperCase();

        return null;
    }

    saveState() {
        // Push state to Firebase
        this.dbRef.set(this.state);
    }

    // Simple event emitter
    on(event, callback) {
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }
    emit(event, data) {
        if (this.listeners[event]) {
            this.listeners[event].forEach(cb => cb(data));
        }
    }

    /* --- Actions --- */
    updateSettings(sportName, rolesStr, overlayMode, activeScreen = 'auction', currency = '₹', showTimer = true) {
        this.state.settings.sportName = sportName;
        this.state.settings.roles = rolesStr.split(',').map(s => s.trim()).filter(s => s);
        this.state.settings.overlayMode = overlayMode;
        this.state.settings.activeScreen = activeScreen;
        this.state.settings.currency = currency;
        this.state.settings.showTimer = showTimer;
        this.saveState();
    }

    addTeam(teamName, budget) {
        const newTeam = {
            id: 't_' + Date.now(),
            name: teamName,
            budget: parseInt(budget, 10),
            spent: 0
        };
        this.state.teams.push(newTeam);
        this.saveState();
    }

    addPlayer(name, role, basePrice, image, stats = '') {
        const newPlayer = {
            id: 'p_' + Date.now(),
            name,
            role,
            basePrice: parseInt(basePrice, 10),
            image: image || 'https://via.placeholder.com/400',
            stats,
            status: 'pending', // pending, sold, unsold
            soldTo: null,
            soldPrice: null
        };
        this.state.players.push(newPlayer);
        this.saveState();
    }
    
    importPlayersData(playersArr) {
        const existingNames = new Set(this.state.players.map(p => p.name.trim().toLowerCase()));
        
        const uniqueNewPlayers = playersArr.filter(p => {
            const nameKey = p.name.trim().toLowerCase();
            if (existingNames.has(nameKey)) return false;
            
            existingNames.add(nameKey); 
            return true;
        });

        this.state.players = this.state.players.concat(uniqueNewPlayers);
        this.saveState();
        return uniqueNewPlayers.length;
    }

    logHistory(action) {
        this.state.history.unshift({
            time: new Date().toLocaleTimeString(),
            action
        });
        if (this.state.history.length > 50) this.state.history.pop();
    }

    // Auction Specific Actions
    setCurrentPlayer(playerId) {
        const player = this.state.players.find(p => p.id === playerId);
        if (player) {
            this.state.auctionState = {
                currentPlayerId: playerId,
                currentBid: player.basePrice,
                currentBidderId: null,
                status: 'waiting',
                timer: 30,
                triggerAnimation: Date.now(),
                stampTrigger: null
            };
            this.logHistory(`Selected ${player.name} for auction. Base: ${this.state.settings.currency}${player.basePrice}`);
            this.saveState();
        }
    }

    placeBid(teamId, amount) {
        if (this.state.auctionState.status === 'sold' || this.state.auctionState.status === 'unsold') return;
        
        const team = this.state.teams.find(t => t.id === teamId);
        const player = this.state.players.find(p => p.id === this.state.auctionState.currentPlayerId);
        if (!team || !player) return;

        if (team.budget - team.spent < amount) {
            alert(`Team ${team.name} doesn't have enough budget!`);
            return;
        }
        
        if(this.state.auctionState.status === 'waiting') {
            this.state.auctionState.status = 'active';
        }

        this.state.auctionState.currentBid = amount;
        this.state.auctionState.currentBidderId = teamId;
        this.logHistory(`${team.name} bid ${this.state.settings.currency}${amount} on ${player.name}`);
        this.saveState();
    }

    markSold() {
        if (!this.state.auctionState.currentPlayerId || !this.state.auctionState.currentBidderId) return;
        
        const playerId = this.state.auctionState.currentPlayerId;
        const teamId = this.state.auctionState.currentBidderId;
        const price = this.state.auctionState.currentBid;

        const pIdx = this.state.players.findIndex(p => p.id === playerId);
        if (pIdx > -1) {
            this.state.players[pIdx].status = 'sold';
            this.state.players[pIdx].soldTo = teamId;
            this.state.players[pIdx].soldPrice = price;
        }

        const tIdx = this.state.teams.findIndex(t => t.id === teamId);
        if (tIdx > -1) {
            this.state.teams[tIdx].spent += price;
        }

        this.state.auctionState.status = 'sold';
        this.state.auctionState.stampTrigger = { type: 'sold', ts: Date.now() };
        this.logHistory(`SOLD! ${this.state.players[pIdx].name} to ${this.state.teams[tIdx].name} for ${this.state.settings.currency}${price}`);
        this.saveState();
    }

    markUnsold() {
        if (!this.state.auctionState.currentPlayerId) return;
        
        const playerId = this.state.auctionState.currentPlayerId;
        const pIdx = this.state.players.findIndex(p => p.id === playerId);
        
        if (pIdx > -1) {
            this.state.players[pIdx].status = 'unsold';
            this.logHistory(`UNSOLD! ${this.state.players[pIdx].name}`);
        }

        this.state.auctionState.status = 'unsold';
        this.state.auctionState.stampTrigger = { type: 'unsold', ts: Date.now() };
        this.saveState();
    }

    undoAuction() {
        if (!this.state.auctionState.currentPlayerId) return;
        
        const playerId = this.state.auctionState.currentPlayerId;
        const pIdx = this.state.players.findIndex(p => p.id === playerId);
        if (pIdx === -1) return;

        const player = this.state.players[pIdx];

        if (player.status === 'sold') {
            const tIdx = this.state.teams.findIndex(t => t.id === player.soldTo);
            if (tIdx > -1) {
                this.state.teams[tIdx].spent -= player.soldPrice;
            }
            this.logHistory(`UNDO: Reverted sale of ${player.name}`);
        } else if (player.status === 'unsold') {
            this.logHistory(`UNDO: Reverted unsold status of ${player.name}`);
        } else {
            alert("No action to undo on this player.");
            return; 
        }

        this.state.players[pIdx].status = 'pending';
        this.state.players[pIdx].soldTo = null;
        this.state.players[pIdx].soldPrice = null;

        this.state.auctionState.status = 'active';
        this.state.auctionState.stampTrigger = null; 
        this.state.auctionState.triggerAnimation = Date.now(); 
        
        this.saveState();
    }

    updateTimer(seconds) {
        this.state.auctionState.timer = seconds;
        this.saveState();
    }

    resetApp() {
        if(window.confirm("WARNING: Are you sure you want to completely wipe all players, teams, and settings for this tournament? This cannot be undone.")) {
            // Hard reset the state
            const freshState = JSON.parse(JSON.stringify(DEFAULT_STATE));
            this.state = freshState;
            
            // Push to Firebase and immediately refresh the browser
            if (this.dbRef) {
                this.dbRef.set(freshState).then(() => {
                    window.location.reload(true);
                }).catch(err => {
                    console.error("Firebase reset failed:", err);
                    window.location.reload(true);
                });
            } else {
                window.location.reload(true);
            }
        }
    }
}

// Check if we are on the gateway page, if so don't instantiate store yet
if (window.location.pathname.endsWith('index.html') || window.location.pathname === '/') {
    // We are on gateway, do nothing here.
} else {
    // Only init if config is provided
    if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
        window.store = new Store();
    } else {
        alert("Firebase is not configured! Please open js/firebase-config.js and add your keys.");
    }
}
