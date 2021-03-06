/**
 * Created by Amit-Chahar on 18-04-2017.
 */
const TAG = "Scanner Process Handler: ";
const logger = require('./Logger');
const firebaseUtils = require('./firebaseUtils');
const firebaseDb = firebaseUtils.firebaseDb();
const firebasePaths = require('./firebasePaths');
const firebaseDbKeys = require('./firebaseDatabaseKeys');
const fork = require('child_process').fork;
const path = require('path');
const config = require('./Config');

module.exports = function () {
    logger.debug(TAG + "firebase scanner settings path: " + firebasePaths.firebaseScannerPath);
    firebaseDb.ref(firebasePaths.firebaseScannerPath).on('value', function (snapshot) {
        if (snapshot.exists()) {
            var scanSettings = snapshot.val();
            if (scanSettings[firebaseDbKeys.SCANNER_ENABLE] === true) {
                const scanTime = scanSettings[firebaseDbKeys.SCANNER_SCAN_TIME];
                logger.info(TAG + "starting scan for " + scanTime + " ms");
                startScanning(scanTime);
            }
        }
    });

    function startScanning(scanTime) {
        var processRunning = true;
        const scannerProcessTimeout = scanTime + 5000;
        const modulePath = path.join(__dirname, "scannerProcess.js");
        const args = [scanTime.toString()];
        const scannerProcess = fork(modulePath, args);

        scannerProcess.on('message', function (btDevice) {
            logger.debug(TAG + "firebase new peripheral: ", btDevice);
            const newScannedDevicePath = firebasePaths.firebaseScannedDevicesPath + "/" + btDevice[firebaseDbKeys.BT_DEVICE_ADDRESS];
            firebaseDb.ref(newScannedDevicePath).set(btDevice);
        })

        scannerProcess.on('close', function (code) {
            processRunning = false;
            logger.verbose("turning off firebase scanner");
            firebaseDb.ref(firebasePaths.firebaseScannerPath + "/enable").set(false);
        })

        setTimeout(function () {
            if(processRunning) {
                logger.verbose(TAG + "scanner process timed out, sending kill signal");
                scannerProcess.kill();
            }
        }, scannerProcessTimeout);
    }
}