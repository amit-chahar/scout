/**
 * Created by Amit-Chahar on 20-04-2017.
 */
const TAG = "DFU Process Utils: ";
const logger = require('../Logger');
const dfuCache = require('./dfuCache');
const dfuProcessMessage = require('./dfuServiceMessage');
const dfuConstants = require('./DfuConstants');

function terminate(){
    const taskSuccessful = dfuCache.get(dfuConstants.FIRMWARE_BIN_FILE_SENT_SUCCESSFULLY);
    var message = {};
    if (taskSuccessful) {
        message[dfuProcessMessage.STATUS] = dfuProcessMessage.STATUS_COMPLETED;
        message[dfuProcessMessage.PERCENT] = dfuProcessMessage.FIRMWARE_UPDATED_PERCENT;
        message[dfuProcessMessage.MESSAGE] = dfuProcessMessage.FIRMWARE_UPDATED_MESSAGE;
    } else {
        message[dfuProcessMessage.STATUS] = dfuProcessMessage.STATUS_FAILED;
    }
    process.send(message);
    process.exit(0);
}

function sendProgress(progressPercent, progressMessage){
    var message = {};
    message[dfuProcessMessage.STATUS] = dfuProcessMessage.STATUS_RUNNING;
    message[dfuProcessMessage.PERCENT] = progressPercent;
    message[dfuProcessMessage.MESSAGE] = progressMessage;
    process.send(message);
}

process.on('uncaughtException', function(error){
    logger.error(error);
    logger.error(TAG + "process exiting");
    process.exit(0);
})

module.exports.terminate = terminate;
module.exports.sendProgress = sendProgress;