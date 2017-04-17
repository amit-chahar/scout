/**
 * Created by Amit-Chahar on 11-04-2017.
 */
const TAG = "Dfu Main: ";

var DfuService = require("./DfuService");
var logger = require("../Logger.js");
var nrfGlobals = require('./NrfGlobals');
const eventEmitter = nrfGlobals.eventEmitter;
const globals = require("../Globals");
const firebaseDb = globals.firebaseDatabase;
const firebasePaths = require("../firebasePaths");
const firebaseDbKeys = require("../firebaseDatabaseKeys");
const dfuStarter = require("./dfuStarter");
const eventNames = require("./eventNames");
const download = require('download');
const path = require('path');

var taskInProgress = false;

const pendingDfuTasksRef = firebaseDb.ref(firebasePaths.firebasePendingDfuTasksPath),
    currentDfuTaskRef = firebaseDb.ref(firebasePaths.firebaseCurrentDfuTaskPath),
    completedDfuTasksRef = firebaseDb.ref(firebasePaths.firebaseCompletedDfuTasksPath),
    failedDfuTasksRef = firebaseDb.ref(firebasePaths.firebaseFailedDfuTasksPath);

function startNrfDfuService(){

    firebaseDb.ref(firebasePaths.firebaseCurrentDfuTaskPath).once('value')
        .then(function (snapshot) {
            logger.verbose(TAG + "unfinished current task: ", snapshot.val());
            if(snapshot.exists()){
                doDfu(snapshot.val());
            } else {
                finishPendingDfuTasks();
            }
        })
}

function finishPendingDfuTasks() {
    pendingDfuTasksRef.limitToFirst(1).on('value', onTaskAdded)
}

function onTaskAdded(snapshot){
    if(snapshot.exists()) {
        pendingDfuTasksRef.off('value', onTaskAdded);
        var dfuTask = snapshot.val();
        pendingDfuTasksRef.child("/" + snapshot.key).remove()
            .then(function () {
                logger.verbose(TAG + "dfu task removed from pending tasks list");
                dfuTask[firebaseDbKeys.DFU_PROGRESS] = 0;
                return currentDfuTaskRef.set(dfuTask)
            })
            .then(function () {
                logger.info(TAG + "current DFU task: ", dfuTask);
                eventEmitter.removeAllListeners(eventNames.DEVICE_NOT_FOUND);
                eventEmitter.removeAllListeners(eventNames.DEVICE_RESTARTED_IN_BOOTLOADER_MODE);
                restartDeviceInDfuMode(dfuTask);
            })
            .catch(function (error) {
                logger.error(TAG + "adding current DFU task: ", dfuTask);
            })
    }

}

function restartDeviceInDfuMode(dfuTask) {
    eventEmitter.once(eventNames.DEVICE_NOT_FOUND, function () {
        currentDfuTaskRef.set({})
            .then(function () {
                return failedDfuTasksRef.child("/" + dfuTask[firebaseDbKeys.BT_DEVICE_ADDRESS]).set(dfuTask)
            })
            .then(function () {
                logger.info(TAG + "current DFU task failed");
            })
            .catch(function (error) {
                logger.error(TAG + "adding DFU task to failed tasks list");
            })
    });

    eventEmitter.once(eventNames.DEVICE_RESTARTED_IN_BOOTLOADER_MODE, function () {
        logger.info(TAG + "device restarted in bootloader mode");
        downloadFirmwareFileFromCloud(dfuTask);
    })
    dfuStarter.restartDeviceInBootloaderMode();
}

function downloadFirmwareFileFromCloud(dfuTask){
    const downloadUrl = dfuTask[firebaseDbKeys.FIRMWARE_DOWNLOAD_URL];
    const downloadDestination = path.join(__dirname, "firmwares", "zipped");
    download(downloadUrl, downloadDestination)
        .then(function () {
            logger.info("firmware file %s downloaded", dfuTask[firebaseDbKeys.FIRMWARE_FILE_NAME]);
            doDfu(dfuTask);
        })
}

function doDfu(dfuTask){
    logger.verbose(TAG + "starting Dfu task: ", dfuTask);
    dfuTask = JSON.parse(dfuTask);
    const firmwareFileName = dfuTask["firmwareFileName"];
    logger.info("starting DFU process: firmware: " + firmwareFileName);
    DfuService.initializeAndStart(firmwareFileName);
}

module.exports.startNrfDfuService = startNrfDfuService;
