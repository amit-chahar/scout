const TAG = "DFU starter: ";

var globals = require('../Globals');
var nrfGlobals = require('./NrfGlobals');
var eventEmitter = nrfGlobals.eventEmitter;
var eventNames = require('./eventNames');
var noble = globals.noble;
var Promise = require('bluebird');
var utils = require('../Utils');
const nrfDfuConfig = require('./nrfDfuConfig');
const logger = require('../Logger');

const dfu_service_uuid = "8e400001f3154f609fb8838830daea50";
const dfu_char_uuid = "8e400001f3154f609fb8838830daea50";
const dfu_cccd_uuid = "00000290200001000800000805f9b34fb";

var mPeripheralAddress, mPeripheral, mService, mCharacteristic, mDescriptor;
var deviceFound = false;
var scanningFirstTime = true;

// restartDeviceInBootloaderMode("08:66:98:c5:9a:e0");

function restartDeviceInBootloaderMode(peripheralAddress) {
    addDiscoverListener();
    addScanStartStopListener();
    mPeripheralAddress = peripheralAddress;
    noble.on('stateChange', listenerStateChange);
    utils.restartBluetoothService();
    setTimeout(function () {
        noble.stopScanning();
        logger.verbose(TAG + "peripheral not found");
    }, nrfDfuConfig.DFU_STARTER_SCAN_TIMEOUT)
}

function listenerStateChange(state) {
    logger.verbose(TAG + "noble state: " + state);
    if(state === 'poweredOn' && scanningFirstTime){
        noble.startScanning();
    }
}

function addScanStartStopListener(){
    noble.on('scanStart', listenerScanStart)
    function listenerScanStart() {
        logger.verbose(TAG + "scan started");
    }

    noble.on('scanStop', listenerScanStop);
    function listenerScanStop() {
        logger.verbose(TAG + "scan stopped");
        if(!deviceFound) {
            invalidPeripheral();
        }
    }
}

function invalidPeripheral(){
    utils.nobleRemoveAllListeners(noble);
    scanningFirstTime = false;
    utils.restartBluetoothService();
    eventEmitter.emit(eventNames.DEVICE_NOT_FOUND);
}

function validPeripheral(){
    utils.nobleRemoveAllListeners(noble);
    scanningFirstTime = false;
    mPeripheral.disconnect();
    utils.restartBluetoothService();
    eventEmitter.emit(eventNames.DEVICE_RESTARTED_IN_BOOTLOADER_MODE);
}

function addDiscoverListener() {
    noble.on('discover', listenerDiscover);
    function listenerDiscover(peripheral) {
        if (peripheral.address === mPeripheralAddress) {
            logger.debug(TAG + "peripheral with address %s found", mPeripheralAddress);
            deviceFound = true;
            noble.stopScanning();

            mPeripheral = peripheral;
            explore(peripheral);
        }
    }
}

function explore(peripheral) {
    logger.verbose(TAG + "exploring peripheral");

    peripheral.once('disconnect', function () {
        logger.verbose(TAG + "Peripheral disconnected");
    });

    peripheral.connect(function (error) {
        if (error) {
            logger.error(TAG + "connecting peripheral");
            invalidPeripheral();
            return;
        }
        exploreServices(peripheral);
    })
}

function exploreServices(peripheral) {
    logger.verbose(TAG + "exploring services");
    peripheral.discoverServices([], function (error, services) {
        if (error) {
            logger.error(TAG + "discovering DFU service");
            invalidPeripheral();
            return;
        }
        services.forEach(function (service) {
            if (service.uuid === dfu_service_uuid) {
                mService = service;
                exploreCharacteristics(service);
            }
        })
    })
}

function exploreCharacteristics(service) {
    logger.verbose(TAG + "exploring characteristics");
    service.discoverCharacteristics([], function (error, characteristics) {
        if (error) {
            logger.error(TAG + "exploring characteristics");
            invalidPeripheral();
            return;
        }
        characteristics.forEach(function (characteristic) {
            if (characteristic.uuid === dfu_char_uuid) {
                logger.verbose(TAG + "DFU characteristic found");

                characteristic.on("data", function (data, isNotification) {
                    if (isNotification) {
                        logger.verbose(TAG + "Notification on characteristic: ", data);
                    }
                })

                mCharacteristic = characteristic;
                exploreDescriptors(characteristic);
            }
        })
    });
}

function exploreDescriptors(characteristic) {
    logger.verbose(TAG + "exploring descriptors");
    characteristic.discoverDescriptors(function (error, descriptors) {
        descriptors.forEach(function (descriptor) {
            if (descriptor.uuid === '2902') {
                logger.verbose(TAG + "CCCD found");
                mDescriptor = descriptor;
                writeCCCD(descriptor);
            }
        })
    });
}

function writeCCCD(descriptor) {
    var data = new Buffer(2);
    data.writeUInt8(0x01, 0);
    data.writeUInt8(0x00, 1);
    descriptor.writeValue(data, function (error) {
        if (error) {
            logger.error(TAG + "writing descriptor");
            invalidPeripheral();
            return;
        }
        logger.verbose(TAG + "descriptor written successfully");

        setTimeout(function () {
            enableNotifications();
        }, 2000);
    })
}

function enableNotifications() {
    mCharacteristic.once("notify", function (state) {
        logger.verbose(TAG + "Notify event");
        if (state) {
            var data = new Buffer(1);
            data.writeUInt8(0x01, 0);
            console.log("data: ", data);
            mCharacteristic.write(data, false, function (error) {
                if (error) {
                    logger.error(TAG + "writing characteristic after enabling notifications");
                    invalidPeripheral();
                    return;
                }
                logger.verbose(TAG + "characteristic written successfully to restart");
                validPeripheral();
            })
        }
    })

    mCharacteristic.notify(true, function (error) {
        if (error) {
            logger.error(TAG + "enabling notifications");
            invalidPeripheral();
            return;
        }
        logger.verbose(TAG + "enabling notifications");
    });
}

module.exports.restartDeviceInBootloaderMode = restartDeviceInBootloaderMode;