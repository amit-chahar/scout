/**
 * Created by Amit-Chahar on 20-04-2017.
 */
const TAG = "DFU test: ";
const logger = require('../Logger');
const nrfDfuConfig = require('./nrfDfuConfig');
const fork = require('child_process').fork;
const path = require('path');

restartDeviceInDfuMode();

function restartDeviceInDfuMode(dfuTask) {
    var processRunning = true;
    var devicedRestartedInBootloaderMode = false;
    const dfuStarterProcessTimeout = nrfDfuConfig.DFU_STARTER_SCAN_TIMEOUT + 5000;
    const modulePath = path.join(__dirname, "dfuStarterProcess.js");
    const args = ["08:66:98:c5:9a:e0"];
    const dfuStarterProcess = fork(modulePath, args);

    dfuStarterProcess.on('message', function (btDevice) {
        logger.info(TAG + "device restarted in bootloader mode");
        devicedRestartedInBootloaderMode = true;
    });

    dfuStarterProcess.on('close', function (code) {
        processRunning = false;
        if (devicedRestartedInBootloaderMode) {
            logger.info(TAG + "closing starter process");
            logger.info(TAG + "start sending firmware");
            sendFirmware();
        } else {
            logger.info(TAG + "restarting device failed");
        }
    });

    setTimeout(function () {
        if (processRunning) {
            logger.verbose(TAG + "starter process timed out, sending kill signal");
            dfuStarterProcess.kill('SIGHUP');
        }
    }, dfuStarterProcessTimeout);
}

function sendFirmware() {
    var processRunning = true;
    const dfuMainProcessTimeout = nrfDfuConfig.DFU_MAIN_PROCESS_TIMEOUT;
    const modulePath = path.join(__dirname, "dfuServiceProcess.js");
    const args = ["fv1.1.zip"];
    const dfuMainProcess = fork(modulePath, args);

    dfuMainProcess.on('message', function (message) {
        logger.info(TAG + "Main process message received: ", message);
    });

    dfuMainProcess.on('close', function (code) {
        processRunning = false;
        logger.info(TAG + "closing main process");
    });

    setTimeout(function () {
        if (processRunning) {
            logger.info(TAG + "starter process timed out, sending kill signal");
            dfuMainProcess.kill('SIGHUP');
        }
    }, dfuMainProcessTimeout);
}