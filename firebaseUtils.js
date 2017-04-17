/**
 * Created by Amit-Chahar on 18-04-2017.
 */
const TAG = "Firebase Utils: ";
const config = require('./Config');
const logger = require('./Logger');
const firebase = require('firebase');

function initializeFirebase(){
    if (config.Build.DEBUG === true) {
        logger.debug(TAG + "firebase debug configuration selected");
        const firebaseConfig = {
            apiKey: "AIzaSyBB4ArjQhGkK_5GCCmNqNZkNsK8eyowJBs",
            authDomain: "wispero-patrol-debug.firebaseapp.com",
            databaseURL: "https://wispero-patrol-debug.firebaseio.com",
            projectId: "wispero-patrol-debug",
            storageBucket: "wispero-patrol-debug.appspot.com",
            messagingSenderId: "500145202622"
        }
        firebase.initializeApp(firebaseConfig);
    } else {
        logger.debug(TAG + "firebase release configuration selected");
        const config = {
            apiKey: "AIzaSyD8JSTNZEumi28aW-Z-IldzC4ty078kuTg",
            authDomain: "wispero-patrol.firebaseapp.com",
            databaseURL: "https://wispero-patrol.firebaseio.com",
            projectId: "wispero-patrol",
            storageBucket: "wispero-patrol.appspot.com",
            messagingSenderId: "460959009015"
        };
        firebase.initializeApp(config);
    }
}

function getFirebaseDb(){
    return firebase.database();
}

module.exports.firebaseDb = getFirebaseDb();

module.exports.initializeFirebase = initializeFirebase;
