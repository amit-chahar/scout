/**
 * Created by Amit-Chahar on 18-04-2017.
 */
const TAG = "DFU Starter Process: ";

const bleUtils = require('./bleUtils');
const noble = require('noble');
const dfuConfig = require('./nrfDfuConfig');
const logger = require('../Logger');
const systemUtils = require('../systemUtils');

const mPeripheralAddress = process.argv[2];
//const mPeripheralAddress = "08:66:98:c5:9a:e0";
var scanning = false;
var deviceFound = false;

noble.on('stateChange', function (state) {
    logger.verbose(TAG + "noble state: " + state);
    if (state === 'poweredOn') {
        startScan();
    }
});

function startScan() {
    logger.verbose(TAG + "starting scan");
    noble.once('scanStart', function () {
        scanning = true;
        logger.verbose(TAG + "scan started successfully");
    });
    noble.startScanning();
    setTimeout(function () {
        stopScan();
    }, dfuConfig.DFU_STARTER_SCAN_TIMEOUT);
}

function stopScan() {
    logger.verbose(TAG + "stopping scan");
    if (scanning) {
        noble.once('scanStop', function () {
            logger.verbose(TAG + "scan stopped successfullly");
            scanning = false;
        });
        noble.stopScanning();
    }

    //if no device is found and scan stopped, then terminate
    if(!deviceFound) {
        terminate();
    }
}

function terminate(){
    process.exit(0);
}

noble.on('discover', function (peripheral) {
    if (peripheral.address === mPeripheralAddress) {
        logger.debug(TAG + "peripheral with address %s found", mPeripheralAddress);
        deviceFound = true;
        stopScan();

        peripheral.once('disconnect', function () {
            logger.verbose(TAG + "Peripheral disconnected");
            terminate();
        });

        bleUtils.connectToPeripheral(peripheral)
            .then(bleUtils.discoverServices)
            .then(bleUtils.discoverAppDfuService)
            .then(bleUtils.discoverCharacteristics)
            .then(bleUtils.discoverAppDfuCharacteristic)
            .then(startListeningForNotificationsOnCharacteristic)
            .then(startListeningForNotifyEvent)
            .then(bleUtils.enableNotifications)
            .catch(function (error) {
                terminate();
            });
    }
});

function startListeningForNotificationsOnCharacteristic(characteristic) {
    logger.verbose(TAG + "Start listening for notifications on charcteristic");
    if (characteristic === undefined) {
        logger.error(TAG + "characteristic undefined");
        throw new Error();
    }

    characteristic.on("data", function (data, isNotification) {
        if (isNotification) {
            logger.verbose(TAG + "Notification on characteristic: ", data);
        }
    });

    return characteristic;
}

function startListeningForNotifyEvent(characteristic) {
    characteristic.once("notify", function (state) {
        logger.verbose(TAG + "Notify event");
        if (state) {
            logger.verbose(TAG + "notifications enabled successfully");
            var data = Buffer.from([0x01]);
            bleUtils.writeCharacteristic(characteristic, data, false)
                .then(function () {
                    process.send(true);
                })
                .catch(function (error) {
                    terminate();
                })
        }
    });
    return characteristic;
}
