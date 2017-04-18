/**
 * Created by Amit-Chahar on 12-04-2017.
 */
const TAG = "BLE Utils: ";
const Promise = require('bluebird');
const logger = require('../Logger');
const dfuConstants = require('./DfuConstants');

function connectToPeripheral(peripheral) {
    logger.debug(TAG + "connecting to peripheral");
    if (peripheral === undefined) {
        logger.error(TAG + "peripheral undefined");
        throw new Error();
    }
    return new Promise(function (resolve, reject) {
        peripheral.connect(function (error) {
            if (error) {
                logger.error(TAG + "connecting peripheral: " + peripheral.address);
                reject(error);
            }
            logger.verbose(TAG + "connected to peripheral: " + peripheral.address);
            resolve(peripheral);
        })
    })
}

function discoverServices(peripheral) {
    logger.debug(TAG + "discovering services");
    if (peripheral === undefined) {
        logger.error(TAG + "peripheral undefined");
        throw new Error();
    }
    return new Promise(function (resolve, reject) {
        peripheral.discoverServices([], function (error, services) {
            if (error) {
                logger.error(TAG + "discovering services");
                reject(error);
            }
            logger.debug(TAG + "discovered services");
            resolve(services);
        })
    })
}

function discoverCharacteristics(service) {
    logger.verbose(TAG + "discovering characteristics");
    if (service === undefined) {
        logger.verbose(TAG + "service undefined");
        throw new Error();
    }
    return new Promise(function (resolve, reject) {
        service.discoverCharacteristics([], function (error, characteristics) {
            if (error) {
                logger.error(TAG + "discovering characteristics");
                reject(error);
            }
            logger.verbose(TAG + "discovered characteristics");
            resolve(characteristics);
        })
    });
}

function writeCharacteristic(characteristic, data, withoutResponse){
    logger.verbose(TAG + "writing to characteristic");
    if(characteristic === undefined){
        logger.error(TAG + "characteristic is undefined");
        throw new Error();
    }
    new Promise(function (resolve, reject) {
        characteristic.write(data, withoutResponse, function (error) {
            if (error) {
                logger.error(TAG + "writing characteristic");
                reject(error);
            }
            logger.verbose(TAG + "characteristic written successfully");
            resolve(characteristic);
        })
    })
}

function discoverDescriptors(characteristic) {
    logger.verbose(TAG + "discovering descriptors");
    if (characteristic === undefined) {
        logger.error(TAG + "characteristic undefined");
        throw new Error();
    }

    return new Promise(function (resolve, reject) {
        characteristic.discoverDescriptors(function (error, descriptors) {
            if (error) {
                logger.error(TAG + "discovering descriptors: ");
                reject(error);
            }
            logger.verbose(TAG + "discovered descriptors");
            resolve(descriptors);
        })
    });
}

function discoverCCCD(descriptors) {
    logger.verbose(TAG + "discovering CCCD");
    if (descriptors === undefined || descriptors.length === 0) {
        logger.error(TAG + "no descriptors found");
        throw new Error();
    }

    var mDescriptor;
    return Promise.map(descriptors, function (descriptor) {
        if (descriptor.uuid === '2902') {
            mDescriptor = descriptor;
        }
    }).then(function () {
        if (mDescriptor === undefined) {
            logger.error(TAG + "CCCD not found");
            throw new Error();
        }
        logger.verbose(TAG + "CCCD found");
        return mDescriptor;
    })
}

function writeValueToDescriptor(descriptor, data) {
    logger.verbose(TAG + "writing value to descriptor");
    if(descriptor === undefined){
        logger.error(TAG + "descriptor is undefined");
        throw new Error();
    }
    return new Promise(function (resolve, reject) {
        descriptor.writeValue(data, function (error) {
            if (error) {
                logger.error(TAG + "writing descriptor");
                reject(error);
            }
            logger.verbose(TAG + "descriptor written successfully");
            resolve(descriptor);
        })
    })
}

function discoverAppDfuService(services) {
    logger.verbose(TAG + "discovering application DFU service");
    if (services.length === 0) {
        logger.error(TAG + "no services found");
        throw new Error();
    }

    var mService;
    return Promise.map(services, function (service) {
        if (service.uuid === dfuConstants.APPLICATION_DFU_SERVICE_UUID) {
            mService = service;
        }
    }).then(function () {
        if (mService === undefined) {
            logger.error(TAG + "application DFU service not found");
            throw new Error();
        }
        logger.debug(TAG + "application DFU service found");
        return mService;
    })
}

function discoverAppDfuCharacteristic(characteristics) {
    logger.verbose(TAG + "discovering application DFU characteristic");
    if (characteristics === undefined) {
        logger.error(TAG + "no characteristics found");
        throw new Error();
    }

    var mCharacteristic;
    return Promise.map(characteristics, function (characteristic) {
        if (characteristic.uuid === dfuConstants.APPLICATION_DFU_CHAR_UUID) {
            mCharacteristic = characteristic;
        }
    }).then(function () {
        if (mCharacteristic === undefined) {
            logger.error(TAG + "application DFU characteristic not found");
            throw new Error();
        }
        logger.verbose(TAG + "application DFU characteristic found");
        return mCharacteristic;
    })
}

function enableNotificationsOnBleServer(descriptor) {
    logger.verbose(TAG + "enabling notifications on BLE server");
    if(descriptor === undefined){
        logger.error(TAG + "descriptor is undefined");
        throw new Error();
    }
    logger.verbose(TAG + "enabling notifications on BLE server");
    var data = new Buffer(2);
    data.writeUInt8(0x01, 0);
    data.writeUInt8(0x00, 1);
    return writeValueToDescriptor(descriptor, data).delay(1000);
}

function enableNotificationsOnBleClient(characteristic) {
    logger.verbose(TAG + "enabling notifications on BLE client");
    if(characteristic === undefined){
        logger.error(TAG + "characteristic is undefined");
        throw new Error();
    }
    return new Promise(function (resolve, reject) {
        characteristic.notify(true, function (error) {
            if (error) {
                logger.error(TAG + "enabling notifications");
                reject(error);
            }
            logger.verbose(TAG + "enabled notifications on BLE client");
            resolve(characteristic);
        });
    })
}

function enableNotifications(mCharacteristic){
    logger.verbose(TAG + "enable notifications");
    if(mCharacteristic === undefined){
        logger.error(TAG + "characteristic is undefined");
        throw new Error();
    }
    return discoverDescriptors(mCharacteristic)
        .then(discoverCCCD)
        .then(enableNotificationsOnBleServer)
        .then(function(){
            return enableNotificationsOnBleClient(mCharacteristic);
        })
        .then(function (characteristic) {
            logger.verbose(TAG + "notifications enabled");
            return characteristic;
        })
}

module.exports.connectToPeripheral = connectToPeripheral;
module.exports.discoverServices = discoverServices;
module.exports.discoverCharacteristics = discoverCharacteristics;
module.exports.writeCharacteristic = writeCharacteristic;
module.exports.discoverDescriptors = discoverDescriptors;
module.exports.discoverCCCD = discoverCCCD;
module.exports.enableNotifications = enableNotifications;

module.exports.discoverAppDfuService = discoverAppDfuService;
module.exports.discoverAppDfuCharacteristic = discoverAppDfuCharacteristic;