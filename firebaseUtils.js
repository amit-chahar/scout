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

function getUserEmail() {
    const gatewayIdParts = config.GATEWAY_ID.split(".");
    const userEmail = gatewayIdParts.splice(1, gatewayIdParts.length).join(".");
    return userEmail;
}

function getGatewayName() {
    const gatewayName = config.GATEWAY_ID.split(".")[0];
    return gatewayName;
}

function getGatewayNameAsKey() {
    return getValidFirebseName(getGatewayName());
}

function getUserEmailAsKey() {
    const userEmailAsKey = getValidFirebseName(getUserEmail());
    return userEmailAsKey;
}

function getValidFirebseName(name) {
    return name.split(".").join(",");
}

module.exports.userEmail = getUserEmail();
module.exports.gatewayName = getGatewayName();
module.exports.gatewayNameAsKey = getGatewayNameAsKey();
module.exports.userEmailAsKey = getUserEmailAsKey();

module.exports.initializeFirebase = initializeFirebase;
module.exports.firebaseDb = getFirebaseDb;
module.exports.getValidFirebaseName = getValidFirebseName;