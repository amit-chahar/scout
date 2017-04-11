/**
 * Created by Amit-Chahar on 10-04-2017.
 */
var Globals = require("../Globals");
var noble = globals.noble;
var config = require("../Config");
var logger = require("../Logger");
var notificationHelper = require('./BleNotificationHelper');
var constants = require('./DfuConstants');
var notificationHandler = require('./BleNotificationHandler');
var helpers = require('./Helpers');
var path = require('path');
var AdmZip = require('adm-zip');

const FIRMWARES_BASEPATH = path.join(__dirname, "nrf_dfu", "firmwares");
const FIRMWARES_ZIPPED_BASEPATH = path.join(FIRMWARES_BASEPATH, "zipped");
const FIRMWARES_EXTRACTED_BASEPATH = path.join(FIRMWARES_BASEPATH, "extracted");

logger.debug("zipped firmwares basepath: ", FIRMWARES_ZIPPED_BASEPATH);
logger.debug("extracted firmware basepath: ", FIRMWARES_EXTRACTED_BASEPATH);

function intializeAndStart(firmwareZipName){
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
        .then(prepareDfuFiles)
        .then(selectCommand)
}

function connectToPeripheral(pData) {
    var peripheral = pdata[constants.PERIPHERAL];
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
    peripheral.discoverServices([], function (error, services) {
        if (error) {
            Promise.reject("discovering services");
        }
        services.forEach(function (service) {
            if (service.uuid === constants.SECURE_DFU_SERVICE_UUID) {
                logger.info("secure DFU service found");
                pData[constants.SECURE_DFU_SERVICE] = service;
                Promise.resolve(pData);
            }
        })
    })
}

function findControlPointAndPacketCharacteristic(pData) {
    if (pData === undefined) {
        Promise.reject("DFU service not available");
    }
    var service = pData[constants.SECURE_DFU_SERVICE];
    service.discoverCharacteristics([], function (error, characteristics) {
        if (error) {
            Promise.reject("discovering DFU characteristics");
        }

        var dfuCharCount = 0;
        characteristics.forEach(function (characteristic) {
            if (characteristic.uuid === constants.SECURE_DFU_CONTROL_POINT_CHARACTERISTIC_UUID) {
                pData[constants.SECURE_DFU_CONTROL_POINT_CHARACTERISTIC] = characteristic;
                dfuCharCount += 1;
                logger.info("found DFU control point characteristic");
            } else if (characteristic.uuid == constants.SECURE_DFU_PACKET_CHARACTERISTIC_UUID) {
                pData[constants.SECURE_DFU_PACKET_CHARACTERISTIC] = characteristic;
                dfuCharCount += 1;
                logger.info("found DFU packet characteristic");
            }
            if (dfuCharCount === 2) {
                Promise.resolve(pData);
            }
        })
    })
}

function enableNotificationOnControlPointCharacteristic(pData) {
    var controlPointCharacteristic = pData[constants.SECURE_DFU_CONTROL_POINT_CHARACTERISTIC];
    var TAG = "control point characteristic";
    notificationHelper.enableNotifications(controlPointCharacteristic, true, TAG)
        .then(function () {
            controlPointCharacteristic.on('data', function (data, isNotification) {
                if (isNotification) {
                    notificationHandler.controlPointNotificationHandler(pData, response, isNotification);
                }
            });
            Promise.resolve(pData);
        })
}

function prepareDfuFiles(pData) {
    var firmwareZipName = pData[constants.FIRMWARE_ZIP_NAME];
    var zipFilePath = path.join(FIRMWARES_ZIPPED_BASEPATH, firmwareZipName);
    const zip = new AdmZip(zipFilePath);
    const zipEntries = zip.getEntries();

    //TODO: set extract path correctly
    zip.extractAllTo(FIRMWARES_EXTRACTED_BASEPATH, true);

    zipEntries.forEach(function (zipEntry) {
        if (path.extname(zipEntry.entryName()) === ".dat") {
            pData[constants.FIRMWARE_DAT_FILE] = zipEntry.entryName();
            logger.debug("firmware dat file path: ", zipEntry.entryName());
        } else if (path.extname(zipEntry.entryName()) === ".bin") {
            pData[constants.FIRMWARE_BIN_FILE] = zipEntry.entryName();
            logger.debug("firmware bin file path: ", zipEntry.entryName());
        } else if (path.extname(zipEntry.entryName()) === ".json") {
            pData[constants.FIRMWARE_MANIFEST_FILE] = zipEntry.entryName();
            logger.debug("firmware manifest file path: ", zipEntry.entryName());
        }
    });

    Promise.resolve(pData);
}

function selectCommand(pData) {
    var controlPointCharacteristic = pData[constants.SECURE_DFU_CONTROL_POINT_CHARACTERISTIC];
    var command = new Buffer([constants.CONTROL_OPCODES.SELECT, constants.CONTROL_PARAMETERS.COMMAND_OBJECT]);
    controlPointCharacteristic.write(command, false, function (error) {
        if (error) {
            Promise.reject("writing select command to control characteristic");
        }
        log.info("select command sent: " + command.toString(16));
        Promise.resolve(pData);
    });
}

module.exports.initializeAndStart = intializeAndStart;