/**
 * Created by Amit-Chahar on 17-04-2017.
 */
const TAG = "Scanner process: ";
const noble = require('noble');
const systemUtils = require('./systemUtils');
const logger = require('./Logger');
const firebaseDbKeys = require('./firebaseDatabaseKeys');

var startedScanning = false;
var scanning = false;
const scanTime = parseInt(process.argv[2]);
logger.verbose(TAG + "scanner process initialized: scan time: " + scanTime);

noble.on('stateChange', function (state) {
    if (state === 'poweredOn') {
        startScan();
    }
    logger.verbose(TAG + "scanner state: " + state);
});
systemUtils.restartBluetoothService();
setTimeout(function () {
    if (!startedScanning) {
        startScan();
    }
}, 2000);

function startScan() {
    logger.verbose(TAG + "starting scan")
    noble.once('scanStart', function () {
        scanning = true;
        logger.verbose(TAG + "scan started successfully");
    });
    noble.startScanning();
    setTimeout(function () {
        stopScan();
    }, scanTime);
}
function stopScan() {
    logger.verbose(TAG + "stopping scan");
    if (scanning) {
        noble.once('scanStop', function () {
            // systemUtils.restartBluetoothService();
            logger.verbose(TAG + "scan stopped successfullly");
            scanning = false;
        });
        noble.stopScanning();
    }
    process.exit(0);
}

noble.on('discover', function (peripheral) {
    logger.verbose(TAG + "Peripheral found");
    const btDevAddress = peripheral.address;
    var btDevName = peripheral.advertisement.localName;
    if (btDevName === undefined) {
        btDevName = "unknown";
    }
    logger.info(TAG + "peripheral found, address: %s, name: %s", btDevAddress, btDevName);

    var btDevice = {};
    btDevice[firebaseDbKeys.BT_DEVICE_ADDRESS] = btDevAddress;
    btDevice[firebaseDbKeys.BT_DEVICE_NAME] = btDevName;
    process.send(btDevice);
});
