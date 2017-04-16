/**
 * Created by Amit-Chahar on 13-04-2017.
 */
const TAG = "Scanner: ";
var globals = require('./Globals');
var noble = globals.noble;
const firebaseDb = globals.firebaseDatabase;
const firebasePaths = require('./firebasePaths');
const utils = require('./Utils');
const logger = require('./Logger');
const config = require('./Config');

var scanning = false;
var scanTime;

function initializeAndStartScanner() {
    logger.verbose(TAG + "scanner initialized");
    getFirebaseScanSettingAndStartScan();
    noble.on('stateChange', function (state) {
        if (state != 'poweredOn') {
            logger.error(TAG + "invalid scanner state");
            noble.stopScanning();
        }
    });
}

function getFirebaseScanSettingAndStartScan() {
    logger.debug(TAG + "firebase scanner settings path: " + firebasePaths.firebaseScannerPath);
    firebaseDb.ref(firebasePaths.firebaseScannerPath).on('value', function (snapshot) {
        if (snapshot.exists()) {
            var scanSettings = snapshot.val();
            scanTime = scanSettings["scanTime"];
            logger.info(TAG + "starting scan for " + scanTime + " ms");
            prepareToScan();
            setTimeout(function () {
                stopScan();
            }, scanTime);
        }
    })
}

function prepareToScan() {
    if (scanning) {
        restartScan();
    } else {
        noble.once('scanStart', function () {
            logger.verbose(TAG + "scan started successfully");
        });
        noble.startScanning();
    }
}

function restartScan() {
    logger.verbose(TAG + "restarting noble scan");
    noble.once('scanStop', function () {
        utils.restartBluetoothService();
        scanning = false;
        setTimeout(function () {
            prepareToScan();
        }, config.TIMEOUT_AFTER_BLUETOOTH_SERVICE_RESTART);

    });
    noble.stopScanning();
}

function stopScan() {
    logger.verbose(TAG + "stopping noble scan");
    noble.once('scanStop', function () {
        utils.restartBluetoothService();
        logger.verbose(TAG + "scan stopped successfullly");
        scanning = false;
    });
    noble.stopScanning();
}

noble.on('discover', function (peripheral) {
    console.log(TAG + "Peripheral found");
    const newScannedDevicePath = firebasePaths.firebaseScannedDevicesPath + "/" + peripheral.id;
    const btDevAddress = peripheral.address;
    var btDevName = peripheral.advertisement.localName;
    if (btDevName === undefined) {
        btDevName = "unknown";
    }
    logger.info(TAG + "peripheral found, address: %s, name: %s", btDevAddress, btDevName);

    var btDevice = {
        "btDevAddress": btDevAddress,
        "btDevName": btDevName
    };
    logger.debug(TAG + "firebase new scanned peripheral path: " + newScannedDevicePath);
    logger.debug(TAG + "firebase new peripheral: ", btDevice);
    firebaseDb.ref(newScannedDevicePath).set(btDevice);
});

module.exports.initializeAndStartScanner = initializeAndStartScanner;