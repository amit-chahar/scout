/**
 * Created by Amit-Chahar on 11-04-2017.
 */
const TAG = "Dfu Main: ";

const firebaseUtils = require('../firebaseUtils');
const firebaseDb = firebaseUtils.firebaseDb();
const firebasePaths = require("../firebasePaths");
const firebaseDbKeys = require("../firebaseDatabaseKeys");

var DfuService = require("./DfuService");
var logger = require("../Logger.js");
var nrfGlobals = require('./NrfGlobals');
const eventEmitter = nrfGlobals.eventEmitter;
const dfuStarter = require("./dfuStarter");
const eventNames = require("./eventNames");
const download = require('download');
const path = require('path');
const nrfDfuConfig = require('./nrfDfuConfig');
const Promise = require('bluebird');

var taskInProgress = false;

const pendingDfuTasksRef = firebaseDb.ref(firebasePaths.firebasePendingDfuTasksPath),
    currentDfuTaskRef = firebaseDb.ref(firebasePaths.firebaseCurrentDfuTaskPath),
    completedDfuTasksRef = firebaseDb.ref(firebasePaths.firebaseCompletedDfuTasksPath),
    failedDfuTasksRef = firebaseDb.ref(firebasePaths.firebaseFailedDfuTasksPath),
    dfuModeFlagRef = firebaseDb.ref(firebasePaths.firebaseDfuModeFlagPath);

const dfuTasksArr = [];

function startNrfDfuService() {

    firebaseDb.ref(firebasePaths.firebaseScannerPath + "/" + firebaseDbKeys.SCANNER_ENABLE).on('value', function (snapshot) {
        if(!snapshot.val() && !taskInProgress) {
            taskInProgress = true;
            firebaseDb.ref(firebasePaths.firebaseCurrentDfuTaskPath).once('value')
                .then(function (snapshot) {
                    if (snapshot.exists()) {
                        logger.verbose(TAG + "unfinished current task: ", snapshot.val());
                        restartDeviceInDfuMode(snapshot.val());
                    } else {
                        finishPendingDfuTasks();
                    }
                });
        }
    })
}

function initialize(){
    dfuModeFlagRef.on('value', function (snapshot) {
        if(snapshot.exists() && snapshot.val()){
            logger.info(TAG + "DFU mode ON");
            getDfuTasks();
        }
    });
}

function getDfuTasks(){
    currentDfuTaskRef.once('value')
        .then(function(snapshot){
            if(snapshot.exists()){
                logger.verbose(TAG + "found an unfinished current DFU task, pushed into tasks array: " + snapshot.val()[firebaseDbKeys.BT_DEVICE_ADDRESS]);
                dfuTasksArr.push(snapshot.val());
            }
        })
        .then(function () {
            return pendingDfuTasksRef.once('value');
        })
        .then(function (snapshot) {
            snapshot.forEach(function (dfuTaskSnapshot) {
                dfuTasksArr.push(dfuTaskSnapshot.val());
                logger.verbose(TAG + "pending task added to tasks array: " + dfuTaskSnapshot.key);
            });
        })
        .then(function () {
            finishPendingDfuTasks();
        })
        .catch(function (error) {
            logger.error(TAG + "unable to get dfu tasks from server.");
            setTimeout(function () {
                logger.info(TAG + "Retrying to connect to server");
                getDfuTasks();
            }, nrfDfuConfig.CONNECTION_RETRY_INTERVAL);
        });
}

function finishPendingDfuTasks() {
    if(dfuTasksArr.length === 0){
        logger.info(TAG + "no pending dfu tasks, exiting dfu mode");
        dfuModeFlagRef.set(false);
        return;
    }
    const dfuTask = dfuTasksArr.shift();
    startPendingDfuTask(dfuTask);
}

function startPendingDfuTask(dfuTask) {
    pendingDfuTasksRef.child("/" + dfuTask[firebaseDbKeys.BT_DEVICE_ADDRESS]).remove()
        .then(function () {
            logger.verbose(TAG + "dfu task removed from pending tasks list: " + dfuTask[firebaseDbKeys.BT_DEVICE_ADDRESS]);
            dfuTask[firebaseDbKeys.DFU_PROGRESS] = 0;
            logger.verbose(TAG + "initializing progress of current task to 0");
            return currentDfuTaskRef.set(dfuTask)
        })
        .then(function () {
            restartDeviceInDfuMode(dfuTask);
        })
        .catch(function (error) {
            logger.error(TAG + "adding current DFU task: ", dfuTask[firebaseDbKeys.BT_DEVICE_ADDRESS]);
            setTimeout(function () {
                logger.verbose(TAG + "retrying to update current task");
                startPendingDfuTask(dfuTask);
            })
        })
}

function restartDeviceInDfuMode(dfuTask) {
    var processRunning = true;
    var devicedRestartedInBootloaderMode = false;
    const dfuStarterProcessTimeout = nrfDfuConfig.DFU_STARTER_SCAN_TIMEOUT + 5000;
    const modulePath = path.join(__dirname, "dfuStarterProcess.js");
    const args = [dfuTask[firebaseDbKeys.BT_DEVICE_ADDRESS]];
    const dfuStarterProcess = fork(modulePath, args);

    dfuStarterProcess.on('message', function (btDevice) {
        logger.info(TAG + "device restarted in bootloader mode");
        devicedRestartedInBootloaderMode = true;
    })

    dfuStarterProcess.on('close', function (code) {
        processRunning = false;
        if(devicedRestartedInBootloaderMode){
            downloadFirmwareFileFromCloud(dfuTask)
        } else {
            currentDfuTaskFailed(dfuTask);
        }
        logger.verbose("turning off firebase scanner");
        firebaseDb.ref(firebasePaths.firebaseScannerPath + "/enable").set(false);
    })

    setTimeout(function () {
        if(processRunning) {
            logger.verbose(TAG + "scanner process timed out, sending kill signal");
            dfuStarterProcess.kill('SIGHUP');
        }
    }, dfuStarterProcessTimeout);
}

function currentDfuTaskFailed(dfuTask) {
    currentDfuTaskRef.set({})
        .then(function () {
            logger.info(TAG + "current DFU task failed: " + dfuTask[firebaseDbKeys.BT_DEVICE_ADDRESS]);
            return failedDfuTasksRef.child("/" + dfuTask[firebaseDbKeys.BT_DEVICE_ADDRESS]).set(dfuTask)
        })
        .then(function () {
            finishPendingDfuTasks();
        })
        .catch(function (error) {
            logger.error(TAG + "adding DFU task to failed tasks list");
            setTimeout(function () {
                logger.info(TAG + "retrying add DFU task to failed tasks list");
                currentDfuTaskFailed(dfuTask);
            }, nrfDfuConfig.CONNECTION_RETRY_INTERVAL);
        });
}

function downloadFirmwareFileFromCloud(dfuTask) {
    const downloadUrl = dfuTask[firebaseDbKeys.FIRMWARE_DOWNLOAD_URL];
    const firmwareFileName = dfuTask[firebaseDbKeys.FIRMWARE_FILE_NAME];
    const downloadDestination = path.join(__dirname, "firmwares", "zipped");
    download(downloadUrl, downloadDestination)
        .then(function () {
            logger.info("firmware file %s downloaded" + firmwareFileName);
            doDfu(dfuTask);
        })
}

function doDfu(dfuTask) {
    // var initFileSent = false;
    // var firmwareFileSent = false;
    // var dfufinished = false;



    // const btDeviceAddress = dfuTask[firebaseDbKeys.BT_DEVICE_ADDRESS];
    // const firmwareFileName = dfuTask[firebaseDbKeys.FIRMWARE_FILE_NAME];
    // logger.verbose(TAG + "starting Dfu task: ", btDeviceAddress);
    // logger.info("starting DFU process: firmware: " + firmwareFileName);
    //
    // removeAllEventListeners();
    //
    // eventEmitter.once(eventNames.DFU_TASK_FAILED, function () {
    //     currentDfuTaskFailed(dfuTask);
    // });
    //
    // eventEmitter.once(eventNames.DFU_TASK_INIT_PACKET_SENT, function () {
    //     updateCurrentTaskProgress(30);
    //     noActivity = false;
    // });
    //
    // eventEmitter.once(eventNames.DFU_TASK_FIRMWARE_FILE_SENT, function () {
    //     updateCurrentTaskProgress(80);
    // });
    //
    // eventEmitter.once(eventNames.DFU_TASK_COMPLETED, function () {
    //     updateCurrentTaskProgress(100);
    //     currentTaskCompleted(dfuTask);
    // })
    //
    // DfuService.initializeAndStart(firmwareFileName);
}

function updateCurrentTaskProgress(percent) {
    // var updates = {};
    // updates["/" + firebaseDbKeys.DFU_PROGRESS] = percent;
    currentDfuTaskRef.child("/" + firebaseDbKeys.DFU_PROGRESS).set(percent)
        .then(function () {
            logger.verbose(TAG + "progress update successfully: ", percent);
        })
        .catch(function (error) {
            logger.error(TAG + "updating progress");
        })
}

function currentTaskCompleted(dfuTask) {
    completedDfuTasksRef.child("/" + dfuTask[firebaseDbKeys.BT_DEVICE_ADDRESS]).set(dfuTask)
        .then(function () {
            logger.info(TAG + "DFU task completed: " + dfuTask[firebaseDbKeys.BT_DEVICE_ADDRESS]);
        })
        .catch(function (error) {
            logger.error(TAG + "unable to update completed task: " + dfuTask[firebaseDbKeys.BT_DEVICE_ADDRESS]);
        })
}

function removeAllEventListeners() {
    eventEmitter.removeAllListeners(eventNames.DFU_TASK_FAILED);
    eventEmitter.removeAllListeners(eventNames.DEVICE_NOT_FOUND);
    eventEmitter.removeAllListeners(eventNames.DEVICE_RESTARTED_IN_BOOTLOADER_MODE);
    eventEmitter.removeAllListeners(eventNames.DFU_TASK_COMPLETED);
    eventEmitter.removeAllListeners(eventNames.DFU_TASK_INIT_PACKET_SENT);
    eventEmitter.removeAllListeners(eventNames.DFU_TASK_FIRMWARE_FILE_SENT);
}

module.exports.startNrfDfuService = startNrfDfuService;
