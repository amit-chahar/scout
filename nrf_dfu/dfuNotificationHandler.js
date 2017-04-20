/**
 * Created by Amit-Chahar on 19-04-2017.
 */
const TAG = "DFU Notification Handler: ";

const logger = require('../Logger');
const dfuConfig = require('./nrfDfuConfig');
const bleUtils = require('./bleUtils');
const dfuBleUtils = require('./nrfDfuBleUtils');
var helpers = require('./dfuUtils');
var dfuConstants = require('./DfuConstants');
var fs = require('fs');
var crc = require('crc');
var CRC32 = require('crc-32');
var dfuCache = require("./dfuCache");
const dfuProcessUtils = require('./dfuProcessUtils');
const Promise = require('bluebird');

function setPrn(controlPointCharacteristic) {
    var command = Buffer.alloc(3)
    command.writeUInt8(dfuConstants.CONTROL_OPCODES.SET_PRN, 0);
    command.writeUInt16LE(dfuConfig.PACKET_RECEIPT_NOTIFICATION, 1);
    logger.debug(TAG + "sending set PRN command: ", command);
    return bleUtils.writeCharacteristic(controlPointCharacteristic, command, false)
        .then(function () {
            logger.verbose(TAG + "set PRN command sent successfully");
            return controlPointCharacteristic;
        })
        .catch(function (error) {
            logger.error(TAG + "set PRN command not sent");
            throw new Error(error)
        })
}

function initializeDefaultsForDatFileTransfer(parsedResponse) {
    logger.verbose(TAG + "initializing for init file transfer");
    // TODO: Some logic to determine if a new object should be created or not.
    var stats = fs.statSync(dfuCache.get(dfuConstants.FIRMWARE_DAT_FILE_PATH));
    logger.debug("init packet size in bytes: ", stats.size);
    dfuCache.set(dfuConstants.FIRMWARE_DAT_FILE_SIZE, stats.size);
    // TODO: set offset and expected crc
    const offset = parsedResponse[dfuConstants.RESPONSE_SPECIFIC_DATA][dfuConstants.OFFSET];
    logger.debug(TAG, "offset: ", offset);
    dfuCache.set(dfuConstants.FIRMWARE_DAT_FILE_OFFSET, 0);
    const expectedCrc = parsedResponse[dfuConstants.RESPONSE_SPECIFIC_DATA][dfuConstants.CRC_32];
    logger.debug(TAG, "expected CRC: ", expectedCrc);
    dfuCache.set(dfuConstants.FIRMWARE_DAT_FILE_CHUNK_EXPECTED_CRC, 0);
    const maximumSize = parsedResponse[dfuConstants.RESPONSE_SPECIFIC_DATA][dfuConstants.MAXIMUM_SIZE];
    logger.debug(TAG + "maximum object size for init file: ", maximumSize);
    dfuCache.set(dfuConstants.FIRMWARE_DAT_FILE_CREATE_OBJECT_MAX_SIZE, maximumSize);
}

function createCommandObject(controlPointCharacteristic, size) {
    const objectType = dfuConstants.CONTROL_PARAMETERS.COMMAND_OBJECT;
    logger.debug(TAG, "create command object: ", objectType);
    createObject(controlPointCharacteristic, objectType, size);
}

function createDataObject(controlPointCharacteristic, size) {
    const objectType = dfuConstants.CONTROL_PARAMETERS.DATA_OBJECT;
    logger.debug(TAG, "create data object: ", objectType);
    createObject(controlPointCharacteristic, objectType, size);
}

function createObject(controlPointCharacteristic, objectType, size) {
    var data = Buffer.alloc(6);
    data.writeUInt8(dfuConstants.CONTROL_OPCODES.CREATE, 0);
    data.writeUInt8(objectType, 1);
    data.writeUInt32LE(size, 2);
    logger.debug(TAG + "sending create object command: ", data);
    bleUtils.writeCharacteristic(controlPointCharacteristic, data, false)
        .then(function () {
            logger.debug(TAG + "create object command sent successfully");
        })
        .catch(function (error) {
            logger.error(TAG + "sending create object command not sent");
            logger.error(error);
            terminate();
        })
}

function sendCommandObject(controlPointCharacteristic, packetCharacteristic){
    var datFilePath = dfuCache.get(dfuConstants.FIRMWARE_DAT_FILE_PATH);
    helpers.parseBinaryFile(datFilePath)
        .then(function (result) {
                const expectedCrc = CRC32.buf(result);
                dfuCache.set(dfuConstants.FIRMWARE_DAT_FILE_EXPECTED_CRC, expectedCrc);
                logger.debug("expected crc of init file: ", expectedCrc);
                return dfuBleUtils.streamData(packetCharacteristic, result);
            }
        )
        .then(function () {
            logger.verbose(TAG + "data sent successfully");
            var buf = Buffer.from([dfuConstants.CONTROL_OPCODES.CALCULATE_CHECKSUM]);
            return bleUtils.writeCharacteristic(controlPointCharacteristic, buf, false);
        })
        .catch(function (error) {
                logger.error(TAG + "command object not sent");
                logger.error(error);
                terminate();
            }
        );
}

function checkCommandObjectCrc(controlPointCharacteristic, parsedResponse) {
    const expectedCrc = dfuCache.get(dfuConstants.FIRMWARE_DAT_FILE_CHUNK_EXPECTED_CRC);
    const actualCrc = parsedResponse[dfuConstants.RESPONSE_SPECIFIC_DATA][dfuConstants.CRC_32];
    logger.debug(TAG + "expected CRC: %s, actual CRC: %s", expectedCrc, actualCrc);
    var buf = Buffer.from([dfuConstants.CONTROL_OPCODES.EXECUTE]);
    logger.debug(TAG + "sending command object execute command: ", buf);
    bleUtils.writeCharacteristic(controlPointCharacteristic, buf, false)
        .catch(function (error) {
            logging.error(TAG + "sending execute command object command");
            logging.error(error);
            terminate();
        });
}

function initFileNotificationHandler(dfuCharacteristics, response, isNotification) {
    if (!isNotification) {
        return;
    }

    var controlPointCharacteristic = dfuCharacteristics[dfuConstants.SECURE_DFU_CONTROL_POINT_CHARACTERISTIC];
    var packetCharacteristic = dfuCharacteristics[dfuConstants.SECURE_DFU_PACKET_CHARACTERISTIC];

    const parsedResponse = helpers.parseResponse(response);
    const requestOpCode = parsedResponse[dfuConstants.REQUEST_OP_CODE];

    switch (requestOpCode) {
        case dfuConstants.CONTROL_OPCODES.CREATE:
            console.log();
            logger.verbose(TAG + "CREATE command object notification received");
            logger.debug(TAG + "Response received: " + parsedResponse);
            sendCommandObject(controlPointCharacteristic, packetCharacteristic);
            break;
        case dfuConstants.CONTROL_OPCODES.SET_PRN:
            console.log();
            logger.verbose(TAG + "SET_PRN notification received");
            logger.debug(TAG + "Response received: " + parsedResponse);
            dfuBleUtils.sendSelectCommand(controlPointCharacteristic, dfuConstants.CONTROL_PARAMETERS.COMMAND_OBJECT);
            break;
        case dfuConstants.CONTROL_OPCODES.CALCULATE_CHECKSUM:
            console.log();
            logger.verbose(TAG + "CALCULATE_CHECKSUM notification received");
            logger.debug(TAG + "Response received: " + parsedResponse);
            // TODO: Check if offset and crc is correct before executing.
            checkCommandObjectCrc(controlPointCharacteristic, parsedResponse);
            break;
        case dfuConstants.CONTROL_OPCODES.EXECUTE:
            console.log();
            logger.verbose(TAG + "EXECUTE command object notification received");
            logger.debug(TAG + "Response received: " + parsedResponse);
            logger.info(TAG + "init file sent, starting sending firmware data file");
            logger.verbose("changing control point characteristic listeners");
            setupToChangeListener(dfuCharacteristics);
            controlPointCharacteristic.removeAllListeners("data");
            break;
        case dfuConstants.CONTROL_OPCODES.SELECT:
            console.log();
            logger.verbose('SELECT command notification received');
            logger.debug(TAG + "Response received: " + parsedResponse);
            // TODO: Some logic to determine if a new object should be created or not.
            //TODO: retry logic
            initializeDefaultsForDatFileTransfer(parsedResponse);
            createCommandObject(controlPointCharacteristic, dfuCache.get(dfuConstants.FIRMWARE_DAT_FILE_SIZE));
            break;
        default:
            throw new Error(TAG + "Unknown response op-code received: " + helpers.controlOpCodeToString(requestOpCode));
    }
}

function setupToChangeListener(dfuCharacteristics) {
    const controlPointCharacteristic = dfuCharacteristics[dfuConstants.SECURE_DFU_CONTROL_POINT_CHARACTERISTIC];
    controlPointCharacteristic.once('removeListener', function (event, listener) {
        logger.debug(TAG + "removed control point characteristic listener");
        controlPointCharacteristic.on('data', function (response, isNotification) {
            firmwareDataTransferHandler(dfuCharacteristics, response, isNotification);
        });
    });

    controlPointCharacteristic.once('newListener', function (event, listener) {
        logger.debug("added control point characteristic listener");
        logger.info(TAG + "starting sending firmware bin file");
        logger.verbose(TAG + "sending select command for data object");
        dfuBleUtils.sendSelectCommand(controlPointCharacteristic, dfuConstants.CONTROL_PARAMETERS.DATA_OBJECT);
    });
}

function firmwareDataTransferHandler(dfuCharacteristics, response, isNotification) {
    if(!isNotification) {
        return;
    }
    const controlPointCharacteristic = dfuCharacteristics[dfuConstants.SECURE_DFU_CONTROL_POINT_CHARACTERISTIC];
    const parsedResponse = helpers.parseResponse(response);
    const requestOpCode = parsedResponse[dfuConstants.REQUEST_OP_CODE];

    switch (requestOpCode) {
        case dfuConstants.CONTROL_OPCODES.CREATE:
            console.log();
            logger.debug(TAG + 'CREATE response received');
            logger.debug(TAG + "Parsed response: ", parsedResponse);
            sendFirmwareObject(dfuCharacteristics);
            break;
        case dfuConstants.CONTROL_OPCODES.SET_PRN:
            console.log();
            logger.debug(TAG + "SET PRN response received");
            logger.debug(TAG + "Parsed response: ", parsedResponse);
            break;
        case dfuConstants.CONTROL_OPCODES.CALCULATE_CHECKSUM:
            console.log();
            logger.verbose(TAG + 'CALCULATE CHECKSUM response received');
            logger.debug(TAG + "Parsed response: ", parsedResponse);
            // TODO: Check if offset and crc is correct before executing.
            checkDataObjectCrc(parsedResponse)
                .then(function () {
                    return dfuBleUtils.sendExecuteCommand(controlPointCharacteristic);
                })
                .catch(function(error){
                    throw error();
                })
            break;
        case dfuConstants.CONTROL_OPCODES.EXECUTE:
            console.log();
            logger.verbose(TAG + 'EXECUTE response received');
            logger.debug(TAG + "Parsed response: ", parsedResponse);
            continueSending(dfuCharacteristics);
            break;
        case dfuConstants.CONTROL_OPCODES.SELECT:
            console.log();
            logger.verbose(TAG + 'SELECT response received');
            logger.debug(TAG + "Parsed response: ", parsedResponse);
            initializeDefaultsForBinFileTransfer(parsedResponse);
            sendCreateCommand(dfuCharacteristics);
            break;
        default:
            throw new Error("Unknown request OpCode received: " + helpers.controlOpCodeToString(requestOpCode));
    }
}

function initializeDefaultsForBinFileTransfer(parsedResponse) {
    // TODO: Some logic to determine if a new object should be created or not.
    var stats = fs.statSync(dfuCache.get(dfuConstants.FIRMWARE_BIN_FILE_PATH));
    logger.debug(TAG + "BIN file size: ", stats.size);
    dfuCache.set(dfuConstants.FIRMWARE_BIN_FILE_SIZE, stats.size);
    const offset = parsedResponse[dfuConstants.RESPONSE_SPECIFIC_DATA][dfuConstants.OFFSET];
    logger.debug(TAG + "bin file offset: " + offset);
    dfuCache.set(dfuConstants.FIRMWARE_BIN_FILE_OFFSET, 0);
    const crcReceived = parsedResponse[dfuConstants.RESPONSE_SPECIFIC_DATA][dfuConstants.CRC_32];
    logger.debug(TAG + "bin file CRC received for select command: ", crcReceived);
    dfuCache.set(dfuConstants.FIRMWARE_BIN_FILE_CHUNK_EXPECTED_CRC, 0);
    const maximumSize = parsedResponse[dfuConstants.RESPONSE_SPECIFIC_DATA][dfuConstants.MAXIMUM_SIZE];
    logger.debug("maximum object size: " + maximumSize);
    dfuCache.set(dfuConstants.FIRMWARE_BIN_FILE_CREATE_OBJECT_MAX_SIZE, maximumSize);
}

function sendCreateCommand(dfuCharacteristics) {
    const controlPointCharacteristic = dfuCharacteristics[dfuConstants.SECURE_DFU_CONTROL_POINT_CHARACTERISTIC];
    const binFileSize = dfuCache.get(dfuConstants.FIRMWARE_BIN_FILE_SIZE);
    const offset = dfuCache.get(dfuConstants.FIRMWARE_BIN_FILE_OFFSET);
    const maxObjectSize = dfuCache.get(dfuConstants.FIRMWARE_BIN_FILE_CREATE_OBJECT_MAX_SIZE);
    var objectSize;
    if (binFileSize >= offset + maxObjectSize) {
        objectSize = maxObjectSize;
    } else {
        objectSize = binFileSize - offset;
    }
    createDataObject(controlPointCharacteristic, objectSize);
}

function sendFirmwareObject(dfuCharacteristics) {
    const packetCharacteristic = dfuCharacteristics[dfuConstants.SECURE_DFU_PACKET_CHARACTERISTIC];
    var binFilePath = dfuCache.get(dfuConstants.FIRMWARE_BIN_FILE_PATH);
    helpers.parseBinaryFile(binFilePath)
        .then(function (result) {
            const createObjectMaxSize = dfuCache.get(dfuConstants.FIRMWARE_BIN_FILE_CREATE_OBJECT_MAX_SIZE);
            const offset = dfuCache.get(dfuConstants.FIRMWARE_BIN_FILE_OFFSET);
            const newOffset = offset + createObjectMaxSize;
            var dataToSend = result.slice(offset, newOffset);
            dfuCache.set(dfuConstants.FIRMWARE_BIN_FILE_OFFSET, newOffset);
            if (newOffset >= result.length) {
                //bin file sent successfully
                dfuCache.set(dfuConstants.FIRMWARE_BIN_FILE_SENT_SUCCESSFULLY, true);
            }

            var seed = dfuCache.get(dfuConstants.FIRMWARE_BIN_FILE_CHUNK_EXPECTED_CRC);
            const expectedCrc = (CRC32.buf(dataToSend, seed) & 0xFFFFFFFF).toString();
            dfuCache.set(dfuConstants.FIRMWARE_BIN_FILE_CHUNK_EXPECTED_CRC, expectedCrc);
            logger.info("sending data object: total size: %s, last offset: %s, new offset: %s", result.length,  offset, newOffset);
            return dfuBleUtils.streamData(packetCharacteristic, dataToSend);
        })
        .delay(1000)
        .then(function () {
            return dfuBleUtils.sendCalculateChecksumCommand(dfuCharacteristics[dfuConstants.SECURE_DFU_CONTROL_POINT_CHARACTERISTIC]);
        })
        .catch(function (error) {
            throw error;
        });
}

function checkDataObjectCrc(parsedResponse) {
    return new Promise(function(resolve, reject){
        const expectedCrc = dfuCache.get(dfuConstants.FIRMWARE_BIN_FILE_CHUNK_EXPECTED_CRC);
        const actualCrc = parsedResponse[dfuConstants.RESPONSE_SPECIFIC_DATA][dfuConstants.CRC_32];
        logger.debug("expected CRC: %s, actual CRC: %s", expectedCrc, actualCrc);
        resolve(parsedResponse);
    })
}

function continueSending(pData) {
    const binFileSize = dfuCache.get(dfuConstants.FIRMWARE_BIN_FILE_SIZE);
    const offset = dfuCache.get(dfuConstants.FIRMWARE_BIN_FILE_OFFSET);
    if (offset >= binFileSize) {
        logger.info(TAG + "firmware data file sent successfully");
        dfuCache.set(dfuConstants.FIRMWARE_SENT_SUCCESSFULLY, true);
        terminate();

    } else {
        sendCreateCommand(pData);
    }
}

function sendProgress(progress, message){

}

function terminate() {
    dfuProcessUtils.terminate();
}

module.exports.initPacketNotificationHandler = initFileNotificationHandler;
module.exports.setPrn = setPrn;