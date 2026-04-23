// store.js - State management wrapper around localStorage

const DEFAULT_STATE = {
    settings: {
        sportName: 'Cricket',
        roles: ['Batsman', 'Bowler', 'All Rounder', 'Wicket Keeper'],
        overlayMode: 'fullscreen', // fullscreen or lower-third
        activeScreen: 'auction', // 'auction' or 'teams'
        currency: '₹' // custom currency or points
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
        this.state = this.loadState();
        
        // Listen to native storage events (from other tabs)
        window.addEventListener('storage', (e) => {
            if (e.key === 'auction_app_state') {
                this.state = JSON.parse(e.newValue);
                this.emit('stateChanged', this.state);
            }
        });
    }

    loadState() {
        const stored = localStorage.getItem('auction_app_state');
        if (stored) {
            return JSON.parse(stored);
        }
        return JSON.parse(JSON.stringify(DEFAULT_STATE)); // Deep copy default
    }

    saveState() {
        localStorage.setItem('auction_app_state', JSON.stringify(this.state));
        this.emit('stateChanged', this.state);
    }

    // Simple event emitter
    listeners = {};
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
    updateSettings(sportName, rolesStr, overlayMode, activeScreen = 'auction', currency = '₹') {
        this.state.settings.sportName = sportName;
        this.state.settings.roles = rolesStr.split(',').map(s => s.trim()).filter(s => s);
        this.state.settings.overlayMode = overlayMode;
        this.state.settings.activeScreen = activeScreen;
        this.state.settings.currency = currency;
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
        // Prevent duplicates by checking case-insensitive names
        const existingNames = new Set(this.state.players.map(p => p.name.trim().toLowerCase()));
        
        const uniqueNewPlayers = playersArr.filter(p => {
            const nameKey = p.name.trim().toLowerCase();
            if (existingNames.has(nameKey)) return false;
            
            existingNames.add(nameKey); // Prevent duplicates inside the imported array itself
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

        // Validation - prevent overspending
        if (team.budget - team.spent < amount) {
            alert(`Team ${team.name} doesn't have enough budget!`);
            return;
        }
        
        // Set state to active if bidding starts
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

        // Update Player
        const pIdx = this.state.players.findIndex(p => p.id === playerId);
        if (pIdx > -1) {
            this.state.players[pIdx].status = 'sold';
            this.state.players[pIdx].soldTo = teamId;
            this.state.players[pIdx].soldPrice = price;
        }

        // Update Team Budget
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
            // Refund Team
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

        // Reset Player
        this.state.players[pIdx].status = 'pending';
        this.state.players[pIdx].soldTo = null;
        this.state.players[pIdx].soldPrice = null;

        // Reset Auction State to active
        this.state.auctionState.status = 'active';
        this.state.auctionState.stampTrigger = null; 
        this.state.auctionState.triggerAnimation = Date.now(); // Re-trigger entry animation
        
        this.saveState();
    }

    updateTimer(seconds) {
        this.state.auctionState.timer = seconds;
        this.saveState();
    }

    resetApp() {
        // Keeps teams, wipes players and history, clears auction state
        if(confirm("Are you sure you want to reset everything? Players and Auction History will be deleted.")) {
            this.state = JSON.parse(JSON.stringify(DEFAULT_STATE));
            this.saveState();
            location.reload();
        }
    }
}

// Global instance
window.store = new Store();
