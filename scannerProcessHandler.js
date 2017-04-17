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

module.exports = function () {
    logger.debug(TAG + "firebase scanner settings path: " + firebasePaths.firebaseScannerPath);
    firebaseDb.ref(firebasePaths.firebaseScannerPath).on('value', function (snapshot) {
        if (snapshot.exists()) {
            var scanSettings = snapshot.val();
            if (scanSettings[firebaseDbKeys.SCANNER_ENABLE] === true) {
                const scanTime = scanSettings[firebaseDbKeys.SCANNER_SCAN_TIME];
                logger.info(TAG + "starting scan for " + scanTime + " ms");
                startScanning(scanTime);
                setTimeout(function () {
                    stopScan();
                }, scanTime);
            }
        }
    });

    function startScanning(scanTime) {
        const modulePath = path.join(__dirname, "scannerProcess.js", [scanTime.toString()]);
        const scannerProcess = fork(modulePath);

        scannerProcess.on('message', function(btDevice){
            logger.debug(TAG + "firebase new peripheral: ", btDevice);
            const newScannedDevicePath = firebasePaths.firebaseScannedDevicesPath + "/" + btDevice[firebaseDbKeys.BT_DEVICE_ADDRESS];
            firebaseDb.ref(newScannedDevicePath).set(btDevice);
        })

        scannerProcess.on('close', function (code) {
            logger.verbose("turning off firebase scanner");
            firebaseDb.ref(firebasePaths.firebaseScannerPath + "/enable").set(false);
        })
    }
}