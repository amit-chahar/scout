/**
 * Created by Amit-Chahar on 19-04-2017.
 */
const TAG = "NRF DFU Utils: ";
const logger = require('../Logger');
const dfuConstants = require('./DfuConstants');
const bleUtils = require('./bleUtils');

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

function sendInitPacketSelectCommand(controlPointCharacteristic) {
    logger.verbose(TAG + "sending init packet select command");
    if(controlPointCharacteristic === undefined){
        logger.error(TAG + "control point characteristic is undefined");
        throw new Error();
    }

    var command = new Buffer([dfuConstants.CONTROL_OPCODES.SELECT, dfuConstants.CONTROL_PARAMETERS.COMMAND_OBJECT]);
    logger.debug("writing select command to control characteristic: ", command);
    return bleUtils.writeCharacteristic(controlPointCharacteristic, command, false)
        .then(function () {
            logger.verbose("init packet select command sent");
            return controlPointCharacteristic;
        })
}

module.exports.discoverBootloaderDfuService = discoverBootloaderDfuService;
module.exports.discoverControlPointAndPacketCharacteristics = discoverControlPointAndPacketCharacteristics;
module.exports.sendInitPacketSelectCommand = sendInitPacketSelectCommand;