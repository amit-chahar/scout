/**
 * Created by Amit-Chahar on 10-04-2017.
 */
const TAG = "Notification Handler: ";

var logger = require('../Logger');
var helpers = require('./Helpers');
var constants = require('./DfuConstants');
var fs = require('fs');
var crc = require('crc');
var CRC32 = require('crc-32');
var nrfGlobals = require("./NrfGlobals");
var perDfuCache = nrfGlobals.perDfuCache;
var dfuService = require('./DfuService');
const eventEmitter = nrfGlobals.eventEmitter;
const eventNames = require('./eventNames');

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
                        logger.error("Unable to send set PRN command");
                        dfuService.taskFailed();
                        return;
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
                            // throw error;
                            dfuService.taskFailed();
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
                        // throw error;
                        dfuService.taskFailed();
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
                        logger.error("sending create object command for init packet");
                        dfuService.taskFailed();
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
        eventEmitter.emit(eventNames.DFU_TASK_INIT_PACKET_SENT);
        controlPointCharacteristic.on('data', function (response, isNotification) {
            firmwareDataTransferHandler(pData, response, isNotification);
        });
    });

    controlPointCharacteristic.once('newListener', function (event, listener) {
        logger.debug("added control point characteristic listener");
        var buf = Buffer.alloc(2);
        buf.writeUInt8(constants.CONTROL_OPCODES.SELECT, 0);
        buf.writeUInt8(constants.CONTROL_PARAMETERS.DATA_OBJECT, 1);
        logger.info("starting sending firmware bin file");
        helpers.writeDataToCharacteristic(controlPointCharacteristic, buf, false)
            .catch(function (error) {
                // throw error;
                dfuService.taskFailed();
            });
    });
}

function firmwareDataTransferHandler(pData, response, isNotification) {
    const TAG = "BIN: ";
    const parsedResponse = helpers.parseResponse(response);
    const requestOpCode = parsedResponse.requestOpCode;

    logger.debug(TAG + ": parsed response: ", parsedResponse);

    switch (requestOpCode) {
        case constants.CONTROL_OPCODES.CREATE:
            logger.debug(TAG + 'CREATE response received');
            sendFirmwareObject(pData);
            break;
        case constants.CONTROL_OPCODES.SET_PRN:
            logger.debug(TAG + "SET PRN response received");
            break;
        case constants.CONTROL_OPCODES.CALCULATE_CHECKSUM:
            logger.verbose(TAG + 'CALCULATE CHECKSUM response received');
            // TODO: Check if offset and crc is correct before executing.
            checkFirmwareObjectCrc(pData, parsedResponse);
            break;
        case constants.CONTROL_OPCODES.EXECUTE:
            logger.verbose(TAG + 'EXECUTE response received');
            continueSending(pData);
            break;
        case constants.CONTROL_OPCODES.SELECT:
            logger.verbose(TAG + 'SELECT response received');
            initializeDefaultsForBinFileTransfer(pData, parsedResponse);
            sendCreateCommand(pData);
            break;
        default:
            throw new Error("Unknown request OpCode received: " + helpers.controlOpCodeToString(requestOpCode));
    }
}

function initializeDefaultsForBinFileTransfer(pData, parsedResponse) {
    // TODO: Some logic to determine if a new object should be created or not.
    var stats = fs.statSync(pData[constants.FIRMWARE_BIN_FILE]);
    perDfuCache.set(constants.FIRMWARE_BIN_FILE_SIZE, stats.size);
    perDfuCache.set(constants.FIRMWARE_BIN_FILE_OFFSET, 0);
    perDfuCache.set(constants.FIRMWARE_BIN_FILE_CHUNK_EXPECTED_CRC, 0);
    logger.debug("maximum object size: " + parsedResponse['data']['maximumSize']);
    perDfuCache.set(constants.FIRMWARE_BIN_FILE_CREATE_OBJECT_MAX_SIZE, parsedResponse['data']['maximumSize']);
}

function sendCreateCommand(pData) {
    const controlPointCharacteristic = pData[constants.SECURE_DFU_CONTROL_POINT_CHARACTERISTIC];
    const binFileSize = perDfuCache.get(constants.FIRMWARE_BIN_FILE_SIZE);
    const offset = perDfuCache.get(constants.FIRMWARE_BIN_FILE_OFFSET);
    const maxObjectSize = perDfuCache.get(constants.FIRMWARE_BIN_FILE_CREATE_OBJECT_MAX_SIZE);
    var objectSize;
    if (binFileSize >= offset + maxObjectSize) {
        objectSize = maxObjectSize;
    } else {
        objectSize = binFileSize - offset;
    }
    var buf = Buffer.alloc(6);
    buf.writeUInt8(constants.CONTROL_OPCODES.CREATE, 0);
    buf.writeUInt8(constants.CONTROL_PARAMETERS.DATA_OBJECT, 1);
    buf.writeUInt32LE(objectSize, 2);
    logger.verbose("sending create object command");
    logger.debug("size of the object to be created: " + objectSize);
    helpers.writeDataToCharacteristic(controlPointCharacteristic, buf, false)
        .then(function () {
            logger.verbose("create command sent successfully");
        })
        .catch(function (error) {
            logger.error("sending create command");
            throw error;
        });
}

function sendFirmwareObject(pData) {
    const packetCharacteristic = pData[constants.SECURE_DFU_PACKET_CHARACTERISTIC];
    var binFilePath = pData[constants.FIRMWARE_BIN_FILE];
    helpers.parseBinaryFile(binFilePath)
        .then(function (result) {
            const createObjectMaxSize = perDfuCache.get(constants.FIRMWARE_BIN_FILE_CREATE_OBJECT_MAX_SIZE);
            const offset = perDfuCache.get(constants.FIRMWARE_BIN_FILE_OFFSET);
            const newOffset = offset + createObjectMaxSize;
            var dataToSend = result.slice(offset, newOffset);
            perDfuCache.set(constants.FIRMWARE_BIN_FILE_OFFSET, newOffset);
            if (newOffset >= result.length) {
                //bin file sent successfully
                perDfuCache.set(constants.FIRMWARE_BIN_FILE_SENT_SUCCESSFULLY, true);
            }

            var seed = perDfuCache.get(constants.FIRMWARE_BIN_FILE_CHUNK_EXPECTED_CRC);
            const expectedCrc = CRC32.buf(dataToSend, seed);
            perDfuCache.set(constants.FIRMWARE_BIN_FILE_CHUNK_EXPECTED_CRC, expectedCrc);
            logger.info("data packet sent: last offset: %s: new offset: %s", offset, newOffset);
            return helpers.sendData(packetCharacteristic, dataToSend);
        })
        .then(function () {
            var controlPointCharacteristic = pData[constants.SECURE_DFU_CONTROL_POINT_CHARACTERISTIC];
            var buf = Buffer.alloc(1);
            buf.writeUInt8(constants.CONTROL_OPCODES.CALCULATE_CHECKSUM, 0);
            logger.debug("sending calculate checksum command: ", buf);
            return helpers.writeDataToCharacteristic(controlPointCharacteristic, buf, false);
        })
        .catch(function (error) {
            throw error;
        });
}

function checkFirmwareObjectCrc(pData, parsedResponse) {
    const controlPointCharacteristic = pData[constants.SECURE_DFU_CONTROL_POINT_CHARACTERISTIC];
    const expectedCrc = perDfuCache.get(constants.FIRMWARE_BIN_FILE_CHUNK_EXPECTED_CRC);
    const actualCrc = parsedResponse['data']['crc32'];
    logger.debug("expected CRC: %s, actual CRC: %s", expectedCrc, actualCrc);
    var buf = Buffer.alloc(1);
    buf.writeUInt8(constants.CONTROL_OPCODES.EXECUTE);
    logger.debug("sending execute command: ", buf);
    helpers.writeDataToCharacteristic(controlPointCharacteristic, buf, false)
        .catch(function (error) {
            throw error;
        });
}

function continueSending(pData) {
    const binFileSize = perDfuCache.get(constants.FIRMWARE_BIN_FILE_SIZE);
    const offset = perDfuCache.get(constants.FIRMWARE_BIN_FILE_OFFSET);
    if(offset >= binFileSize){
        logger.info("bin file sent successfully");
        eventEmitter.emit(eventNames.DFU_TASK_FIRMWARE_FILE_SENT);
        perDfuCache.set(constants.FIRMWARE_SENT_SUCCESSFULLY, true);
    } else {
        sendCreateCommand(pData);
    }
}

module.exports.controlPointNotificationHandler = controlPointNotificationHandler;
