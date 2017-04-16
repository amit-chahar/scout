/**
 * Created by Amit-Chahar on 16-04-2017.
 */

const config = require('./Config');
const logger = require('./Logger');
const exec = require('child_process').exec;
function getUserEmail(){
    const gatewayIdParts = config.GATEWAY_ID.split(".");
    const userEmail = gatewayIdParts.splice(1, gatewayIdParts.length).join(".");
    return userEmail;
}

function getGatewayName(){
    const gatewayName = config.GATEWAY_ID.split(".")[0];
    return gatewayName;
}

function getValidFirebaseGatewayName(){
    const gatewayName = getValidFirebseName(getGatewayName());
    return gatewayName;
}

function getUserKey(){
    const userKey = getValidFirebseName(getUserEmail());
    return userKey;
}

function getValidFirebseName(name){
    return name.split(".").join(",");
}

function restartBluetoothService(){
    const command = "sudo service bluetooth restart";
    logger.verbose("Restarting bluetooth service");
    var returnCode = execSync(command);
    if(returnCode === 0){
        logger.verbose("bluetooth service restarted successfully");
        return true;
    } else {
        logger.verbose("unable to restart bluetooth service");
    }
    return false;
}

module.exports.getUserEmail = getUserEmail;
module.exports.getGatewayName = getGatewayName;
module.exports.getValidFirebaseGatewayName = getValidFirebaseGatewayName;
module.exports. getUserKey = getUserKey;
module.exports.getValidFirebaseName = getValidFirebseName;
module.exports.restartBluetoothService = restartBluetoothService;