/**
 * Created by Amit-Chahar on 10-04-2017.
 */
var Promise = require('bluebird');
var logger = require('../Logger');
var constants = require('./DfuConstants');
var fs = require('fs');
var AdmZip = require('adm-zip');
var rimraf = require('rimraf');

function delay(t) {
    return new Promise(function (resolve) {
        setTimeout(resolve, t)
    });
}

function parseResponse(response) {
    const responseCode = response.getUint8(0);
    const requestOpCode = response.getUint8(1);
    const resultCode = response.getUint8(2);
    var responseSpecificData;

    logger.debug("Response received: ", response);

    if (responseCode !== constants.CONTROL_OPCODES.RESPONSE_CODE) {
        throw new Error("Unexpected response code received: " + controlOpCodeToString(responseCode));
    }
    if (resultCode !== constants.RESULT_CODES.SUCCESS) {
        throw new Error("Error in result code: " + resultCodeToString(resultCode));
    }

    switch (requestOpCode) {
        case constants.CONTROL_OPCODES.CREATE:
            break;
        case constants.CONTROL_OPCODES.SET_PRN:
            break;
        case constants.CONTROL_OPCODES.CALCULATE_CHECKSUM:
            responseSpecificData = {
                "offset": response.readUInt32LE(constants.CALCULATE_CHECKSUM_RESPONSE_FIELD.OFFSET),
                "crc32": response.readUInt32LE(constants.CALCULATE_CHECKSUM_RESPONSE_FIELD.CRC32)
            };
            break;
        case constants.CONTROL_OPCODES.EXECUTE:
            break;
        case constants.CONTROL_OPCODES.SELECT:
            responseSpecificData = {
                "maximumSize": response.readUInt32LE(constants.SELECT_RESPONSE_FIELD.MAXIMUM_SIZE),
                "offset": response.readUInt32LE(constants.SELECT_RESPONSE_FIELD.OFFSET),
                "crc32": response.readUInt32LE(constants.SELECT_RESPONSE_FIELD.CRC32)
            };
            break;
        default:
            throw new Error("Unknown response op-code received: " + controlOpCodeToString(requestOpCode));
    }

    return {
        "responseCode": responseCode,
        "requestOpCode": requestOpCode,
        "resultCode": resultCode,
        "data": responseSpecificData
    };
}

function controlOpCodeToString(responseCode) {
    for (var key in constants.CONTROL_OPCODES) {
        var val = constants.CONTROL_OPCODES[key];
        if (responseCode === val) {
            return key;
        }
    }
}

function resultCodeToString(resultCode) {
    for (var key in constants.RESULT_CODES) {
        var val = constants.RESULT_CODES[key];
        if (resultCode === val) {
            return key;
        }
    }
}

function parseBinaryFile(filePath) {
    return new Promise(function (resolve, reject) {
        fs.readFile(filePath, function (error, data) {
            if (error) {
                reject(error);
            }
            resolve(data);
        });
    });
}

function sendData(characteristic, buffer) {
    return new Promise(function (resolve, reject) {
        if (buffer.length <= 0) {
            resolve();
        }
        else {
            writeDataToCharacteristic(characteristic, buffer.slice(0, constants.BLE_PACKET_SIZE), false)
                .then(function () {
                    return sendData(characteristic, buffer.slice(constants.BLE_PACKET_SIZE))
                })
                .then(function () {
                    resolve();
                })
                .catch(function (error) {
                    reject(error);
                });
        }
    });
}

function writeDataToCharacteristic(characteristic, data, withoutResponse) {
    return new Promise(function (resolve, reject) {
        characteristic.write(data, withoutResponse, function (error) {
            if (error) {
                logger.error("writing to characteristic");
                reject(error);
            }
            resolve();
        })
    });
}

function removeDirectory(path){
    return new Promise(function(resolve, reject){
        rimraf(path, function () {
            resolve();
        })
    });
}

module.exports.delay = delay;
module.exports.parseResponse = parseResponse;
module.exports.controlOpCodeToString = controlOpCodeToString;
module.exports.resultCodeToString = resultCodeToString;
module.exports.parseBinaryFile = parseBinaryFile;
module.exports.sendData = sendData;
module.exports.writeDataToCharacteristic = writeDataToCharacteristic;
module.exports.removeDirectory = removeDirectory;