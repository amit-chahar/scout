/**
 * Created by Amit-Chahar on 19-04-2017.
 */
const TAG = "NRF DFU Utils: ";
const logger = require('../Logger');
const dfuConstants = require('./DfuConstants');
const bleUtils = require('./bleUtils');
const Promise = require('bluebird');

function discoverBootloaderDfuService(services) {
    logger.verbose(TAG + "discovering bootloader DFU service");
    if (services === undefined) {
        logger.error(TAG + "services are undefined");
        throw new Error();
    }

    var mService;
    return Promise.map(services, function (service) {
        if (service.uuid === dfuConstants.SECURE_DFU_SERVICE_SHORT_UUID) {
            mService = service;
        }
    }).then(function () {
        if (mService === undefined) {
            logger.error(TAG + "secure DFU service not found");
            throw new Error();
        }
        logger.verbose(TAG + "secure DFU service found");
        return mService;
    })
}

function discoverControlPointAndPacketCharacteristics(characteristics) {
    logger.verbose(TAG + "discovering control point and packet characteristic");
    if (characteristics === undefined) {
        logger.error(TAG + "characteristics are undefined");
        throw new Error();
    }

    var mControlPointCharacteristic, mPacketCharacteristic;
    return Promise.map(characteristics, function (characteristic) {
        if (characteristic.uuid === dfuConstants.SECURE_DFU_CONTROL_POINT_CHARACTERISTIC_UUID) {
            mControlPointCharacteristic = characteristic;
            logger.info("found DFU control point characteristic");
        } else if (characteristic.uuid == constants.SECURE_DFU_PACKET_CHARACTERISTIC_UUID) {
            mPacketCharacteristic = characteristic;
            logger.info("found DFU packet characteristic");
        }
    }).then(function () {
        if (mControlPointCharacteristic === undefined || mPacketCharacteristic === undefined) {
            logger.error(TAG + "control point or packet characteristic not found");
            throw new Error();
        }
        var dfuCharacteristics = {};
        dfuCharacteristics[dfuConstants.SECURE_DFU_CONTROL_POINT_CHARACTERISTIC] = mControlPointCharacteristic;
        dfuCharacteristics[dfuConstants.SECURE_DFU_PACKET_CHARACTERISTIC] = mPacketCharacteristic;
        return dfuCharacteristics;
    });
}

function sendSelectCommand(controlPointCharacteristic, objectType) {
    logger.verbose(TAG + "sending select command");
    if (controlPointCharacteristic === undefined) {
        logger.error(TAG + "control point characteristic is undefined");
        throw new Error();
    }

    var command = Buffer.from([dfuConstants.CONTROL_OPCODES.SELECT, objectType]);
    logger.debug("writing select command to control characteristic: ", command);
    return bleUtils.writeCharacteristic(controlPointCharacteristic, command, false)
        .then(function () {
            logger.verbose("select command sent");
            return controlPointCharacteristic;
        })
        .catch(function (error) {
            logger.error(TAG + "select command not sent");
            throw error;
        })
}

function streamData(characteristic, buffer) {
    return new Promise(function (resolve, reject) {
        if (buffer.length <= 0) {
            resolve();
        }
        else {
            bleUtils.writeCharacteristic(characteristic, buffer.slice(0, dfuConstants.BLE_PACKET_SIZE), false)
                .then(function () {
                    return streamData(characteristic, buffer.slice(dfuConstants.BLE_PACKET_SIZE))
                })
                .then(function () {
                    logger.verbose(TAG + "data sent successfully");
                    resolve();
                })
                .catch(function (error) {
                    reject(error);
                });
        }
    });
}

function sendCalculateChecksumCommand(controlPointCharacteristic) {
    var buf = Buffer.from([dfuConstants.CONTROL_OPCODES.CALCULATE_CHECKSUM]);
    logger.debug("sending calculate checksum command: ", buf);
    if (controlPointCharacteristic === undefined) {
        throw new Error(TAG + "control point characteristic is undefined");
    }
    return bleUtils.writeCharacteristic(controlPointCharacteristic, buf, false)
        .then(function () {
            logger.verbose(TAG + "calculate checksum command sent successfully");
        })
        .catch(function (error) {
            logger.error(TAG + "calculate checksum command not sent");
            throw error;
        })
}

function sendExecuteCommand(controlPointCharacteristic) {
    var buf = Buffer.from([dfuConstants.CONTROL_OPCODES.EXECUTE]);
    logger.debug("sending execute data object command: ", buf);
    if (controlPointCharacteristic === undefined) {
        throw new Error(TAG + "control point characteristic is undefined");
    }
    bleUtils.writeCharacteristic(controlPointCharacteristic, buf, false)
        .then(function () {
            logger.verbose(TAG + "execute command sent successfully");
        })
        .catch(function (error) {
            logger.error(TAG + "execute command not sent");
            throw error;
        });
}

module.exports.discoverBootloaderDfuService = discoverBootloaderDfuService;
module.exports.discoverControlPointAndPacketCharacteristics = discoverControlPointAndPacketCharacteristics;
module.exports.sendSelectCommand = sendSelectCommand;
module.exports.streamData = streamData;
module.exports.sendCalculateChecksumCommand = sendCalculateChecksumCommand;
module.exports.sendExecuteCommand = sendExecuteCommand;