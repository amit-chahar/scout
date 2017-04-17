/**
 * Created by Amit-Chahar on 16-04-2017.
 */

const TAG = "Utils: ";
const config = require('./Config');
const logger = require('./Logger');
const execSync = require('child_process').execSync;

function getUserEmail() {
    const gatewayIdParts = config.GATEWAY_ID.split(".");
    const userEmail = gatewayIdParts.splice(1, gatewayIdParts.length).join(".");
    return userEmail;
}

function getGatewayName() {
    const gatewayName = config.GATEWAY_ID.split(".")[0];
    return gatewayName;
}



function nobleRemoveAllListeners(noble){
    noble.removeAllListeners('stateChange');
    noble.removeAllListeners('scanStart');
    noble.removeAllListeners('scanStop');
    noble.removeAllListeners('discover');
}

module.exports.getUserEmail = getUserEmail;
module.exports.getGatewayName = getGatewayName;
module.exports.nobleRemoveAllListeners = nobleRemoveAllListeners;