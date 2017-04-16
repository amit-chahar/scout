/**
 * Created by Amit-Chahar on 13-04-2017.
 */
var globals = require('./Globals');
var noble = globals.noble;
const firebaseDb = globals.firebaseDatabase;
const firebasePaths = require('./firebasePaths');
const utils = require('./Utils');
const logger = require('./Logger');

var scanning = false;
var scanTime;

function initializeAndStartScanner() {
    logger.verbose("scanner initialized");
    noble.on('stateChange', function (state) {
        if (state === 'poweredOn') {
            getFirebaseScanSettingAndStartScan();
        } else {
            logger.error("invalid scanner state");
            noble.stopScanning();
            return;
        }
    });
}

function getFirebaseScanSettingAndStartScan() {
    logger.debug("firebase scanner settings path: " + firebasePaths.firebaseScannerPath);
    firebaseDb.ref(firebasePaths.firebaseScannerPath).on('value', function (snapshot) {
        var scanSettings = snapshot.val();
        scanTime = scanSettings["scanTime"];
        logger.info("starting scan for " + scanTime + " ms");
        prepareToScan();
        setTimeout(function () {
            stopScan();
        }, scanTime);
    })
}

function prepareToScan() {
    if (scanning) {
        restartScan();
    } else {
        noble.once('scanStart', function (error) {
            if (error) {
                logger.error("error starting scan, restarting now");
                restartScan();
            } else {
                logger.verbose("scan started successfully");
            }
        });
        noble.startScanning();
    }
}

function restartScan() {
    verbose.info("restarting noble scan");
    noble.once('scanStop', function (error) {
        if (error) {
            logger.error("error stopping scan which restarting scan");
            utils.restartBluetoothService();
        }
        scanning = false;
        prepareToScan();
    });
    noble.stopScanning();
}

function stopScan() {
    logger.verbose("stopping noble scan");
    noble.once('scanStop', function (error) {
        if (error) {
            logger.error("error stopping scan");
            utils.restartBluetoothService();
        }
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
    if(btDevName === undefined){
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

module.exports.initializeAndStartScanner = initializeAndStartScanner();