const firebaseConfig = {
  apiKey: "AIzaSyClD-5D24Bga5gF-Ft9qGRwRCmcaNNfHF4",
  authDomain: "auction-pro-database.firebaseapp.com",
  databaseURL: "https://auction-pro-database-default-rtdb.firebaseio.com",
  projectId: "auction-pro-database",
  storageBucket: "auction-pro-database.firebasestorage.app",
  messagingSenderId: "335648473019",
  appId: "1:335648473019:web:ccf055635108c3a9080e9e",
  measurementId: "G-FDNH9ZZQ85"
};

// Initialize Firebase using the Compat SDK (which we included in the HTML)
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
window.firebaseDb = database;