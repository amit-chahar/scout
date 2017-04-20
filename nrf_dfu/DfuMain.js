/**
 * Created by Amit-Chahar on 11-04-2017.
 */
const TAG = "Dfu Main: ";

const firebaseUtils = require('../firebaseUtils');
const firebaseDb = firebaseUtils.firebaseDb();
const firebasePaths = require("../firebasePaths");
const firebaseDbKeys = require("../firebaseDatabaseKeys");

var logger = require("../Logger.js");
const path = require('path');
const nrfDfuConfig = require('./nrfDfuConfig');
const Promise = require('bluebird');
const fork = require('child_process').fork;
const dfuServiceMessage = require('./dfuServiceMessage');
const dfuUtils = require('./dfuUtils');

var taskInProgress = false;

const pendingDfuTasksRef = firebaseDb.ref(firebasePaths.firebasePendingDfuTasksPath),
    currentDfuTaskRef = firebaseDb.ref(firebasePaths.firebaseCurrentDfuTaskPath),
    completedDfuTasksRef = firebaseDb.ref(firebasePaths.firebaseCompletedDfuTasksPath),
    failedDfuTasksRef = firebaseDb.ref(firebasePaths.firebaseFailedDfuTasksPath),
    dfuModeFlagRef = firebaseDb.ref(firebasePaths.firebaseDfuModeFlagPath);

const dfuTasksArr = [];

function startNrfDfuService() {

    firebaseDb.ref(firebasePaths.firebaseScannerPath + "/" + firebaseDbKeys.SCANNER_ENABLE).on('value', function (snapshot) {
        if (!snapshot.val() && !taskInProgress) {
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

function initialize() {
    dfuModeFlagRef.on('value', function (snapshot) {
        if (snapshot.exists() && snapshot.val()) {
            logger.info(TAG + "DFU mode ON");
            getDfuTasks();
        }
    });
}

function getDfuTasks() {
    currentDfuTaskRef.once('value')
        .then(function (snapshot) {
            if (snapshot.exists()) {
                logger.verbose(TAG + "found an unfinished current DFU task, pushed into tasks array: " + JSON.stringify(snapshot.val()));
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
            logger.error(error);
            setTimeout(function () {
                logger.info(TAG + "Retrying to connect to server");
                getDfuTasks();
            }, nrfDfuConfig.CONNECTION_RETRY_INTERVAL);
        });
}

function finishPendingDfuTasks() {
    if (dfuTasksArr.length === 0) {
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
            logger.debug(TAG + "current dfu task", dfuTask);
            return currentDfuTaskRef.set(dfuTask)
        })
        .then(function () {
            restartDeviceInDfuMode(dfuTask);
        })
        .catch(function (error) {
            logger.error(TAG + "adding current DFU task: ", dfuTask[firebaseDbKeys.BT_DEVICE_ADDRESS]);
            logger.error(error);
            setTimeout(function () {
                logger.verbose(TAG + "retrying to update current task");
                startPendingDfuTask(dfuTask);
            }, nrfDfuConfig.CONNECTION_RETRY_INTERVAL);
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
        if (devicedRestartedInBootloaderMode) {
            downloadFirmwareFileFromCloud(dfuTask)
        } else {
            currentDfuTaskFailed(dfuTask)
                .then(function () {
                    return finishPendingDfuTasks()
                });
        }
    })

    setTimeout(function () {
        if (processRunning) {
            logger.verbose(TAG + "starter process timed out, sending kill signal");
            dfuStarterProcess.kill('SIGHUP');
        }
    }, dfuStarterProcessTimeout);
}

function currentDfuTaskFailed(dfuTask) {
    return currentDfuTaskRef.set({})
        .then(function () {
            logger.info(TAG + "current DFU task failed: " + dfuTask[firebaseDbKeys.BT_DEVICE_ADDRESS]);
            return failedDfuTasksRef.child("/" + dfuTask[firebaseDbKeys.BT_DEVICE_ADDRESS]).set(dfuTask)
        })
        .then(function () {
            logger.verbose(TAG + "added failed task to failed tasks list");
            return dfuTask;
        })
        .catch(function (error) {
            logger.error(TAG + "adding DFU task to failed tasks list");
            logger.error(error);
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

    var options = {
        directory: downloadDestination,
        filename: firmwareFileName
    };

    dfuUtils.downloadFile(downloadUrl, options)
        .then(function () {
            logger.info("firmware file %s downloaded" + firmwareFileName);
            doDfu(dfuTask);
        })
        .catch(function (error) {
            logger.error(TAG + "downloading firmware file");
            logger.error(error);
            currentDfuTaskFailed(dfuTask)
                .then(function () {
                    return finishPendingDfuTasks();
                });
        })
}

function doDfu(dfuTask) {
    logger.info(TAG + "starting main DFU process");
    var processRunning = true;
    var dfuDone = false;
    const dfuMainProcessTimeout = nrfDfuConfig.DFU_MAIN_PROCESS_TIMEOUT;
    const modulePath = path.join(__dirname, "dfuServiceProcess.js");
    const args = [dfuTask[firebaseDbKeys.FIRMWARE_FILE_NAME]];
    const dfuMainProcess = fork(modulePath, args);

    dfuMainProcess.on('message', function (message) {
        logger.info(TAG + "Main process message received: ", message);
        switch (message[dfuServiceMessage.STATUS]) {
            case dfuServiceMessage.STATUS_COMPLETED:
                logger.info(TAG + "update completed");
                dfuDone = true;
                updateCurrentTaskProgress(100)
                    .then(function () {
                        return currentTaskCompleted(dfuTask);
                    })
                    .then(function () {
                        return finishPendingDfuTasks();
                    });
                break;
            case dfuServiceMessage.STATUS_RUNNING:
                const progressPercent = message[dfuServiceMessage.PERCENT];
                const progressMessage = message[dfuServiceMessage.MESSAGE];
                logger.info(TAG + "progress: %s, message: %s", progressPercent, progressMessage);
                updateCurrentTaskProgress(progressPercent);
                break;
            default:
                logger.info(TAG + "invalid progress message received: ", message);
        }
    });

    dfuMainProcess.on('close', function (code) {
        processRunning = false;
        logger.info(TAG + "closing main process");
        if (!dfuDone) {
            currentDfuTaskFailed(dfuTask)
                .then(function () {
                    return finishPendingDfuTasks();
                })
        }
    });

    setTimeout(function () {
        if (processRunning) {
            logger.info(TAG + "main process timed out, sending kill signal");
            dfuMainProcess.kill('SIGHUP');
        }
    }, dfuMainProcessTimeout);
}

function updateCurrentTaskProgress(percent) {
    return currentDfuTaskRef.child("/" + firebaseDbKeys.DFU_PROGRESS).set(percent)
        .then(function () {
            logger.verbose(TAG + "progress update successfully: ", percent);
        })
        .catch(function (error) {
            logger.error(TAG + "updating progress");
            logger.error(error);
        })
}

function currentTaskCompleted(dfuTask) {
    dfuTask[firebaseDbKeys.DFU_PROGRESS] = 100;
    return completedDfuTasksRef.child("/" + dfuTask[firebaseDbKeys.BT_DEVICE_ADDRESS]).set(dfuTask)
        .then(function () {
            logger.info(TAG + "DFU task completed: " + dfuTask[firebaseDbKeys.BT_DEVICE_ADDRESS]);
            return currentDfuTaskRef.set(null)
        })
        .then(function () {
            logger.debug(TAG + "current task set to null");
            return dfuTask;
        })
        .catch(function (error) {
            logger.error(TAG + "unable to update completed task: " + dfuTask[firebaseDbKeys.BT_DEVICE_ADDRESS]);
            logger.error(error);
            setTimeout(function () {
                logger.verbose(TAG + "retrying to add completed task");
                currentTaskCompleted(dfuTask);
            }, nrfDfuConfig.CONNECTION_RETRY_INTERVAL);
        })
}

module.exports.initialize = initialize;
