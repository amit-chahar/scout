/**
 * Created by Amit-Chahar on 13-04-2017.
 */
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
    logger.verbose("scanner initialized");
    getFirebaseScanSettingAndStartScan();
    noble.on('stateChange', function (state) {
        if (state != 'poweredOn') {
            logger.error("invalid scanner state");
            noble.stopScanning();
        }
    });
}

function getFirebaseScanSettingAndStartScan() {
    logger.debug("firebase scanner settings path: " + firebasePaths.firebaseScannerPath);
    firebaseDb.ref(firebasePaths.firebaseScannerPath).on('value', function (snapshot) {
        if (snapshot.exists()) {
            var scanSettings = snapshot.val();
            scanTime = scanSettings["scanTime"];
            logger.info("starting scan for " + scanTime + " ms");
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
            logger.verbose("scan started successfully");
        });
        noble.startScanning();
    }
}

function restartScan() {
    logger.verbose("restarting noble scan");
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
    logger.verbose("stopping noble scan");
    noble.once('scanStop', function () {
        utils.restartBluetoothService();
        logger.verbose("scan stopped successfullly");
        scanning = false;
    });
    noble.stopScanning();
}

noble.on('discover', function (peripheral) {
    console.log("Peripheral found");
    const newScannedDevicePath = firebasePaths.firebaseScannedDevicesPath + "/" + peripheral.id;
    const btDevAddress = peripheral.address;
    var btDevName = peripheral.advertisement.localName;
    if (btDevName === undefined) {
        btDevName = "unknown";
    }
    logger.info("peripheral found, address: %s, name: %s", btDevAddress, btDevName);

    var btDevice = {
        "btDevAddress": btDevAddress,
        "btDevName": btDevName
    };
    logger.debug("firebase new scanned peripheral path: " + newScannedDevicePath);
    logger.debug("firebase new peripheral: ", btDevice);
    firebaseDb.ref(newScannedDevicePath).set(btDevice);
});

module.exports.initializeAndStartScanner = initializeAndStartScanner;