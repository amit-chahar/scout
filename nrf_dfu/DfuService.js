/**
 * Created by Amit-Chahar on 10-04-2017.
 */
var globals = require("../Globals");
var noble = globals.noble;
var config = require("../Config");
var logger = require("../Logger");
var notificationHelper = require('./BleNotificationHelper');
var constants = require('./DfuConstants');
var notificationHandler = require('./BleNotificationHandler');
var helpers = require('./Helpers');
var path = require('path');
var AdmZip = require('adm-zip');
var Promise = require('bluebird');
var util = require('util');

const FIRMWARES_BASEPATH = path.join(__dirname, "firmwares");
const FIRMWARES_ZIPPED_BASEPATH = path.join(FIRMWARES_BASEPATH, "zipped");
const FIRMWARES_TMP_BASEPATH = path.join(FIRMWARES_BASEPATH, "tmp");

logger.debug("zipped firmwares basepath: ", FIRMWARES_ZIPPED_BASEPATH);
logger.debug("tmp directory basepath: ", FIRMWARES_TMP_BASEPATH);

function intializeAndStart(firmwareZipName) {
    noble.on('stateChange', function (state) {
        if (state === 'poweredOn') {
            noble.startScanning();
        } else {
            noble.stopScanning();
        }
    });

    noble.on('discover', function (peripheral) {
        if (peripheral.advertisement.localName === config.BOOTLOADER_MODE_DEVICE_NAME) {
            logger.info("Peripheral found advertising in bootloader mode: ", peripheral.address);
            noble.stopScanning();
            startDfuProcess(peripheral, firmwareZipName);
        }
    });
}

function startDfuProcess(peripheral, firmwareZipName) {
    var pData = {};
    pData[constants.FIRMWARE_ZIP_NAME] = firmwareZipName;
    pData[constants.PERIPHERAL] = peripheral;
    connectToPeripheral(pData)
        .then(findDfuService)
        .then(findControlPointAndPacketCharacteristic)
        .then(enableNotificationOnControlPointCharacteristic)
        .then(removeTmpDirectory)
        .then(prepareDfuFiles)
        .then(selectCommand)
        .catch(function (error) {
            logger.error("firmware update halted");
            throw error;
        })
}

function connectToPeripheral(pData) {
    var peripheral = pData[constants.PERIPHERAL];
    return new Promise(function (resolve, reject) {
        peripheral.on("disconnect", function (error) {
            if (error) {
                logger.error("disconnecting peripheral");
                return;
            }
            logger.info("peripheral disconnected: ", peripheral.address);
        });

        peripheral.connect(function (error) {
            if (error) {
                reject("Can't connect peripheral: ", peripheral.address);
            }
            logger.info("Connected to peripheral: " + peripheral.address);
            resolve(pData);
        })
    })
}

function findDfuService(pData) {
    var peripheral = pData[constants.PERIPHERAL];
    logger.info("finding secure DFU service");
    return new Promise(function (resolve, reject) {
        peripheral.discoverServices([], function (error, services) {
            if (error) {
                reject("discovering services");
            }

            return Promise.map(services, function (service) {
                logger.debug("found service with UUID: ", service.uuid);
                if (service.uuid === constants.SECURE_DFU_SERVICE_SHORT_UUID) {
                    logger.info("secure DFU service found");
                    pData[constants.SECURE_DFU_SERVICE] = service;
                }
                return;
            }).then(function () {
                resolve(pData);
            })
        })
    });
}

function findControlPointAndPacketCharacteristic(pData) {
    if (pData === undefined || pData[constants.SECURE_DFU_SERVICE] === undefined) {
        Promise.reject("DFU service not available");
    }
    var service = pData[constants.SECURE_DFU_SERVICE];
    return new Promise(function (resolve, reject) {
        service.discoverCharacteristics([], function (error, characteristics) {
            if (error) {
                reject("discovering DFU characteristics");
            }

            return Promise.map(characteristics, function (characteristic) {
                //logger.debug("found characteristic in secure DFU service with UUID: ", characteristic.uuid);
                if (characteristic.uuid === constants.SECURE_DFU_CONTROL_POINT_CHARACTERISTIC_UUID) {
                    pData[constants.SECURE_DFU_CONTROL_POINT_CHARACTERISTIC] = characteristic;
                    logger.info("found DFU control point characteristic");
                } else if (characteristic.uuid == constants.SECURE_DFU_PACKET_CHARACTERISTIC_UUID) {
                    pData[constants.SECURE_DFU_PACKET_CHARACTERISTIC] = characteristic;
                    logger.info("found DFU packet characteristic");
                }
                return;
            }).then(function () {
                resolve(pData);
            });
        });
    })
}

function enableNotificationOnControlPointCharacteristic(pData) {
    var controlPointCharacteristic = pData[constants.SECURE_DFU_CONTROL_POINT_CHARACTERISTIC];
    var TAG = "control point characteristic";
    return notificationHelper.enableNotifications(controlPointCharacteristic, true, TAG)
        .then(function () {
            controlPointCharacteristic.on('data', function (response, isNotification) {
                if (isNotification) {
                    notificationHandler.controlPointNotificationHandler(pData, response, isNotification);
                }
            });
            return pData;
        })
}

function removeTmpDirectory(pData) {
    logger.debug("removing tmp directory: " + FIRMWARES_TMP_BASEPATH);
    return helpers.removeDirectory(FIRMWARES_TMP_BASEPATH)
        .then(function () {
            logger.debug("tmp directory removed successfully");
            return pData;
        })
}

function prepareDfuFiles(pData) {
    var firmwareZipName = pData[constants.FIRMWARE_ZIP_NAME];
    var zipFilePath = path.join(FIRMWARES_ZIPPED_BASEPATH, firmwareZipName);
    logger.debug("firmware zip file path: ", zipFilePath);
    const zip = new AdmZip(zipFilePath);
    const zipEntries = zip.getEntries();

    logger.info("extracting firmware files");
    //TODO: set extract path correctly
    zip.extractAllTo(FIRMWARES_TMP_BASEPATH, true);
    logger.debug("extracted firmwares files to: " + FIRMWARES_TMP_BASEPATH);

    return Promise.map(zipEntries, (function (zipEntry) {
            if (path.extname(zipEntry.entryName) === ".dat") {
                pData[constants.FIRMWARE_DAT_FILE] = zipEntry.entryName();
                logger.debug("firmware dat file path: ", zipEntry.entryName());
            } else if (path.extname(zipEntry.entryName) === ".bin") {
                pData[constants.FIRMWARE_BIN_FILE] = zipEntry.entryName();
                logger.debug("firmware bin file path: ", zipEntry.entryName());
            } else if (path.extname(zipEntry.entryName) === ".json") {
                pData[constants.FIRMWARE_MANIFEST_FILE] = zipEntry.entryName();
                logger.debug("firmware manifest file path: ", zipEntry.entryName());
            }
        })
    ).then(function () {
        return pData;
    })
}

function selectCommand(pData) {
    var controlPointCharacteristic = pData[constants.SECURE_DFU_CONTROL_POINT_CHARACTERISTIC];
    var command = new Buffer([constants.CONTROL_OPCODES.SELECT, constants.CONTROL_PARAMETERS.COMMAND_OBJECT]);
    logger.debug("writing select command to control characteristic");
    return helpers.writeDataToCharacteristic(controlPointCharacteristic, command, false)
        .then(function () {
            logger.info("select command sent: " + command.toString('hex'));
            return pData;
        })
}

module.exports.initializeAndStart = intializeAndStart;
