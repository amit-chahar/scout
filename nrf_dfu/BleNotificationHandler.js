/**
 * Created by Amit-Chahar on 10-04-2017.
 */
var logger = require('../Logger');
var helpers = require('./Helpers');
var constants = require('./DfuConstants');
var fs = require('fs');
var crc = require('crc');

function controlPointNotificationHandler(pData, response, isNotification) {
    var controlPointCharacteristic = pData[constants.SECURE_DFU_CONTROL_POINT_CHARACTERISTIC];
    var packetCharacteristic = pData[constants.SECURE_DFU_PACKET_CHARACTERISTIC];

    if (isNotification) {
        const parsedResponse = helpers.parseResponse(response);
        const requestOpCode = parsedResponse.requestOpCode;

        logger.info(parsedResponse);

        switch (requestOpCode) {
            case constants.CONTROL_OPCODES.CREATE:
                logger.debug('CREATE');
                //setting PRN to zero
                var command = new Buffer([constants.CONTROL_OPCODES.SET_PRN, 0x00, 0x00]);
                controlPointCharacteristic.write(command, false, function (error) {
                    if (error) {
                        throw new error("Unable to send set PRN command");
                    }
                    logger.info("set PRN command sent");
                });
                break;
            case constants.CONTROL_OPCODES.SET_PRN:
                logger.debug('SET_PRN');
                var datFilePath = pData[constants.FIRMWARE_DAT_FILE];
                helpers.parseBinaryFile(datFilePath)
                    .then(function (result) {
                            pData[constants.FIRMWARE_DAT_FILE_EXPECTED_CRC] = crc.crc32(result);
                            logger.debug("expected crc of dat file: ", pData[constants.FIRMWARE_DAT_FILE_EXPECTED_CRC]);
                            return helpers.sendData(packetCharacteristic, result);
                        }
                    )
                    .then(function () {
                        var buf = Buffer.alloc(1);
                        buf.writeUInt8(constants.CONTROL_OPCODES.CALCULATE_CHECKSUM, 0);
                        return helpers.writeDataToCharacteristic(controlPointCharacteristic, buf, false);
                    })
                    .catch(function (error) {
                            throw error;
                        }
                    );
                break;
            case constants.CONTROL_OPCODES.CALCULATE_CHECKSUM:
                logger.debug('CALCULATE_CHECKSUM');
                // TODO: Check if offset and crc is correct before executing.

                var buf = Buffer.alloc(1);
                buf.writeUInt8(constants.CONTROL_OPCODES.EXECUTE, 0);
                helpers.writeDataToCharacteristic(controlPointCharacteristic, buf, false)
                    .catch(function (error) {
                        throw error;
                    });
                break;
            case constants.CONTROL_OPCODES.EXECUTE:
                logger.debug('EXECUTE');
                logger.info("init packet sent");
                logger.info("starting sending firmware file");
                logger.debug("changing control point characteristic listeners");
                setupToChangeListener(pData);
                controlPointCharacteristic.removeAllListeners("data");
                break;
            case constants.CONTROL_OPCODES.SELECT:
                logger.debug('SELECT');
                // TODO: Some logic to determine if a new object should be created or not.
                //check the size of the dat file
                const initFilePath = pData[constants.FIRMWARE_DAT_FILE];
                logger.debug("init file path: ", initFilePath);
                const stats = fs.statSync(initFilePath);
                const fileSize = stats.size;
                logger.debug("init packet size in bytes: ", fileSize);
                var command = new Buffer(6);
                command.writeUInt8(constants.CONTROL_OPCODES.CREATE, 0);
                command.writeUInt8(constants.CONTROL_PARAMETERS.COMMAND_OBJECT, 1);
                command.writeUInt32LE(fileSize, 2);
                controlPointCharacteristic.write(command, false, function (error) {
                    if (error) {
                        throw new Error("sending create object command for init packet");
                    }
                    logger.debug("create object command sent: ", command);
                })
                ;
                break;
            default:
                throw new Error("Unknown response op-code received: " + helpers.controlOpCodeToString(requestOpCode));
        }
    }
}

function setupToChangeListener(pData) {
    var controlPointCharacteristic = pData[constants.SECURE_DFU_CONTROL_POINT_CHARACTERISTIC];
    controlPointCharacteristic.once('removeListener', function (event, listener) {
        logger.debug("removed control point characteristic listener");
        logger.debug("control point characteristic listener count: ", controlPointCharacteristic.listenerCount('data'));
        controlPointCharacteristic.on('data', function (response, isNotification) {
            firmwareDataTransferHandler(pData, response, isNotification);
        });
    });

    controlPointCharacteristic.once('newListener', function (event, listener) {
        logger.debug("added control point characteristic listener");
        logger.debug("control point characteristic listener count: ", controlPointCharacteristic.listenerCount('data'));
        var buf = Buffer.alloc(2);
        buf.writeUInt8(constants.CONTROL_OPCODES.SELECT, 0);
        buf.writeUInt8(constants.CONTROL_PARAMETERS.DATA_OBJECT, 1);
        logger.info("starting sending firmware bin file");
        helpers.writeDataToCharacteristic(controlPointCharacteristic, buf, false)
            .catch(function (error) {
                throw error;
            });
    });
}

function firmwareDataTransferHandler(pData, response, isNotification) {
    const TAG = "firmwareDataTransferHandler";
    const parsedResponse = helpers.parseResponse(response);
    const requestOpCode = parsedResponse.responseOpCode;

    const controlPointCharacteristic = pData[constants.SECURE_DFU_CONTROL_POINT_CHARACTERISTIC];
    const packetCharacteristic = pData[constants.SECURE_DFU_PACKET_CHARACTERISTIC];

    logger.debug(TAG + ": parsed respnse: ", parsedResponse);

    switch (requestOpCode) {
        case constants.CONTROL_OPCODES.CREATE:
            console.log('CREATE');
            var buf = Buffer.alloc(3);
            buf.writeUInt8(constants.CONTROL_OPCODES.SET_PRN, 0);
            buf.writeUInt16BE(0x0000, 1);
            helpers.writeDataToCharacteristic(controlPointCharacteristic, buf, false)
                .catch(function (error) {
                    throw error;
                });
            break;
        case constants.CONTROL_OPCODES.SET_PRN:
            console.log('SET_PRN');
            var binFilePath = pData[constants.FIRMWARE_BIN_FILE];
            helpers.parseBinaryFile(binFilePath)
                .then(function (result) {
                    const expectedCrc = crc.crc32(result);
                    logger.debug("Firmware bin file expected CRC: ", expectedCrc);
                    pData[constants.FIRMWARE_BIN_FILE_EXPECTED_CRC] = expectedCrc;
                    return helpers.sendData(packetCharacteristic, result);
                })
                .then(function () {
                    var buf = Buffer.alloc(1);
                    buf.writeUInt8(constants.CONTROL_OPCODES.CALCULATE_CHECKSUM, 0);
                    logger.debug("sending calculate checksum command: ", buf);
                    return helpers.writeDataToCharacteristic(controlPointCharacteristic, buf, false);
                })
                .catch(function (error) {
                    throw error;
                });
            break;
        case constants.CONTROL_OPCODES.CALCULATE_CHECKSUM:
            console.log('CALCULATE_CHECKSUM');
            // TODO: Check if offset and crc is correct before executing.
            var buf = Buffer.alloc(1);
            buf.writeUInt8(constants.CONTROL_OPCODES.EXECUTE);
            logger.debug("sending execute command: ", buf);
            helpers.writeDataToCharacteristic(controlPointCharacteristic, buf, false)
                .catch(function (error) {
                    throw error;
                });
            break;
        case constants.CONTROL_OPCODES.EXECUTE:
            console.log('EXECUTE');
            logger.info("firmware transfer completed");
            break;
        case constants.CONTROL_OPCODES.SELECT:
            console.log('SELECT');
            // TODO: Some logic to determine if a new object should be created or not.
            var stats = fs.statSync(pData[constants.FIRMWARE_BIN_FILE]);
            var buf = Buffer.alloc(6);
            buf.writeUInt8(constants.CONTROL_OPCODES.CREATE, 0);
            buf.writeUInt8(constants.CONTROL_PARAMETERS.COMMAND_OBJECT, 1);
            buf.writeUInt32LE(stats.size, 2);
            logger.debug("sending command to select firmware file: ", buf);
            helpers.writeDataToCharacteristic(controlPointCharacteristic, buf, false)
                .catch(function (error) {
                    throw error;
                });
            break;
        default:
            throw new Error("Unknown response opcode received: " + helpers.controlOpCodeToString(requestOpCode));
    }
}

module.exports.controlPointNotificationHandler = controlPointNotificationHandler;
