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
const firebaseDbKeys = require('./firebaseDatabaseKeys');

var scanning = false;
var scanTime;

function initializeAndStartScanner() {
    logger.verbose(TAG + "scanner initialized");
    getFirebaseScanSettingAndStartScan();
    noble.on('stateChange', function (state) {
        if (state != 'poweredOn') {
            logger.error(TAG + "scanner state: " + state);
        }
    });
}

function getFirebaseScanSettingAndStartScan() {
    logger.debug(TAG + "firebase scanner settings path: " + firebasePaths.firebaseScannerPath);
    firebaseDb.ref(firebasePaths.firebaseScannerPath).on('value', function (snapshot) {
        if (snapshot.exists()) {
            var scanSettings = snapshot.val();
            if(scanSettings[firebaseDbKeys.SCANNER_ENABLE] === true) {
                scanTime = scanSettings[firebaseDbKeys.SCANNER_SCAN_TIME];
                logger.info(TAG + "starting scan for " + scanTime + " ms");
                prepareToScan();
                setTimeout(function () {
                    stopScan();
                }, scanTime);
            }
        }
    })
}

function prepareToScan() {
    if (scanning) {
        restartScan();
    } else {
        noble.once('scanStart', function () {
            scanning = true;
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
    if(scanning) {
        noble.once('scanStop', function () {
            utils.restartBluetoothService();
            logger.verbose(TAG + "scan stopped successfullly");
            scanning = false;
            turnOffFirebaseScanner();
        });
        noble.stopScanning();
    } else {
        turnOffFirebaseScanner();
    }
}

function turnOffFirebaseScanner(){
    logger.verbose("turning off firebase scanner");
    firebaseDb.ref(firebasePaths.firebaseScannerPath + "/enable").set(false);
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

    var btDevice = {};
    btDevice[firebaseDbKeys.SCANNED_DEVICES_BT_DEVICE_ADDRESS] = btDevAddress;
    btDevice[firebaseDbKeys.SCANNED_DEVICES_BT_DEVICE_NAME] = btDevName;

    logger.debug(TAG + "firebase new scanned peripheral path: " + newScannedDevicePath);
    logger.debug(TAG + "firebase new peripheral: ", btDevice);
    firebaseDb.ref(newScannedDevicePath).set(btDevice);
});

module.exports.initializeAndStartScanner = initializeAndStartScanner;