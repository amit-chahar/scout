/**
 * Created by Amit-Chahar on 16-04-2017.
 */
const utils = require('./Utils');

function getFirebaseGatewayPath(){
    return utils.getUserKey() + "/gateways/" + utils.getValidFirebaseGatewayName();
}

function getFirebaseGatewayBasePath(){
    return utils.getUserKey() + "/" + utils.getValidFirebaseGatewayName();
}

function getFirebaseScannerPath(){
    return getFirebaseGatewayBasePath() + "/scanner";
}

function getFirebaseScannedDevicesPath(){
    return getFirebaseGatewayBasePath() + "/scannedDevices";
}

function getFirebaseCurrentDfuTaskPath(){
    return getFirebaseGatewayBasePath() + "/currentDfuTask";
}

function getFirebasePendingDfuTasksPath(){
    return getFirebaseGatewayBasePath() + "/pendingDfuTasks";
}

function getFirebaseCompletedDfuTasksPath(){
    return getFirebaseGatewayBasePath() + "/completedDfuTasks";
}

function getFirebaseFailedDfuTasksPath(){
    return getFirebaseGatewayBasePath() + "/failedDfuTasks";
}

module.exports.firebaseGatewayPath = getFirebaseGatewayPath();
module.exports.firebaseScannerPath = getFirebaseScannerPath();
module.exports.firebaseScannedDevicesPath = getFirebaseScannedDevicesPath();
module.exports.firebaseCurrentDfuTaskPath = getFirebaseCurrentDfuTaskPath();
module.exports.firebasePendingDfuTasksPath = getFirebasePendingDfuTasksPath();
module.exports.firebaseCompletedDfuTasksPath = getFirebaseCompletedDfuTasksPath();
module.exports.firebaseFailedDfuTasksPath = getFirebaseFailedDfuTasksPath();
