/**
 * Created by Amit-Chahar on 16-04-2017.
 */

const TAG = "Utils: ";
const globals = require('./Globals');
const noble = globals.noble;
const config = require('./Config');
const logger = require('./Logger');
const execSync = require('child_process').execSync;
const firebase = require('firebase');

function getUserEmail() {
    const gatewayIdParts = config.GATEWAY_ID.split(".");
    const userEmail = gatewayIdParts.splice(1, gatewayIdParts.length).join(".");
    return userEmail;
}

function getGatewayName() {
    const gatewayName = config.GATEWAY_ID.split(".")[0];
    return gatewayName;
}

function getValidFirebaseGatewayName() {
    const gatewayName = getValidFirebseName(getGatewayName());
    return gatewayName;
}

function getUserKey() {
    const userKey = getValidFirebseName(getUserEmail());
    return userKey;
}

function getValidFirebseName(name) {
    return name.split(".").join(",");
}

function restartBluetoothService() {
    const command = "sudo service bluetooth restart";
    logger.verbose(TAG + "Restarting bluetooth service");
    try {
        execSync(command);
        logger.verbose(TAG + "bluetooth service restarted successfully");
        return true;
    } catch (error) {
        logger.verbose(TAG + "unable to restart bluetooth service, error: ", error);
        return false;
    }
}

function initializeFirebase() {
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

function nobleRemoveAllListeners(){
    noble.removeAllListeners('stateChange');
    noble.removeAllListeners('scanStart');
    noble.removeAllListeners('scanStop');
    noble.removeAllListeners('discover');
}

module.exports.initializeFirebase = initializeFirebase;
module.exports.getUserEmail = getUserEmail;
module.exports.getGatewayName = getGatewayName;
module.exports.getValidFirebaseGatewayName = getValidFirebaseGatewayName;
module.exports.getUserKey = getUserKey;
module.exports.getValidFirebaseName = getValidFirebseName;
module.exports.restartBluetoothService = restartBluetoothService;
module.exports.nobleRemoveAllListeners = nobleRemoveAllListeners;