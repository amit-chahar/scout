/**
 * Created by Amit-Chahar on 10-04-2017.
 */
const TAG = "DFU Utils: ";

var Promise = require('bluebird');
var logger = require('../Logger');
var dfuConstants = require('./DfuConstants');
var fs = require('fs');
var rimraf = require('rimraf');
const download = require('file-download');
function delay(t) {
    return new Promise(function (resolve) {
        setTimeout(resolve, t)
    });
}


function parseResponse(response) {
    const responseCode = response.readUInt8(0);
    const requestOpCode = response.readUInt8(1);
    const resultCode = response.readUInt8(2);
    var responseSpecificData = {};

    logger.debug(TAG + "Response received: ", response);

    if (responseCode !== dfuConstants.CONTROL_OPCODES.RESPONSE_CODE) {
        throw new Error("Unexpected response code received: " + controlOpCodeToString(responseCode));
    }
    if (resultCode !== dfuConstants.RESULT_CODES.SUCCESS) {
        throw new Error("Error in result code: " + resultCodeToString(resultCode));
    }

    switch (requestOpCode) {
        case dfuConstants.CONTROL_OPCODES.CREATE:
            break;
        case dfuConstants.CONTROL_OPCODES.SET_PRN:
            break;
        case dfuConstants.CONTROL_OPCODES.CALCULATE_CHECKSUM:
            responseSpecificData[dfuConstants.OFFSET] = response.readUInt32LE(dfuConstants.CALCULATE_CHECKSUM_RESPONSE_FIELD.OFFSET);
            responseSpecificData[dfuConstants.CRC_32] = response.readUInt32LE(dfuConstants.CALCULATE_CHECKSUM_RESPONSE_FIELD.CRC32);
            break;
        case dfuConstants.CONTROL_OPCODES.EXECUTE:
            break;
        case dfuConstants.CONTROL_OPCODES.SELECT:
                responseSpecificData[dfuConstants.MAXIMUM_SIZE] = response.readUInt32LE(dfuConstants.SELECT_RESPONSE_FIELD.MAXIMUM_SIZE);
                responseSpecificData[dfuConstants.OFFSET] = response.readUInt32LE(dfuConstants.SELECT_RESPONSE_FIELD.OFFSET);
                responseSpecificData[dfuConstants.CRC_32] = response.readUInt32LE(dfuConstants.SELECT_RESPONSE_FIELD.CRC32);
            break;
        default:
            throw new Error("Unknown response op-code received: " + controlOpCodeToString(requestOpCode));
    }

    var parsedResponse = {};
    parsedResponse[dfuConstants.RESPONSE_CODE] = responseCode;
    parsedResponse[dfuConstants.REQUEST_OP_CODE] = requestOpCode;
    parsedResponse[dfuConstants.RESULT_CODE] = resultCode;
    parsedResponse[dfuConstants.RESPONSE_SPECIFIC_DATA] = responseSpecificData;

    return parsedResponse;
}

function controlOpCodeToString(responseCode) {
    for (var key in dfuConstants.CONTROL_OPCODES) {
        var val = dfuConstants.CONTROL_OPCODES[key];
        if (responseCode === val) {
            return key;
        }
    }
}

function resultCodeToString(resultCode) {
    for (var key in dfuConstants.RESULT_CODES) {
        var val = dfuConstants.RESULT_CODES[key];
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

function removeDirectory(path){
    return new Promise(function(resolve, reject){
        rimraf(path, function () {
            resolve();
        })
    });
}

function downloadFile(url, options){
    new Promise(function (resolve, reject) {
        download(url, options, function(error){
            if (error){
                reject(error);
            }
            resolve();
        })
    })
}

module.exports.delay = delay;
module.exports.parseResponse = parseResponse;
module.exports.controlOpCodeToString = controlOpCodeToString;
module.exports.resultCodeToString = resultCodeToString;
module.exports.parseBinaryFile = parseBinaryFile;
module.exports.removeDirectory = removeDirectory;
module.exports.downloadFile = downloadFile;
