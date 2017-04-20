/**
 * Created by Amit-Chahar on 19-04-2017.
 */
/**
 * Created by Amit-Chahar on 10-04-2017.
 */
const TAG = "DFU Service: ";

const bleUtils = require('./bleUtils');
const dfuBleUtils = require('./nrfDfuBleUtils');
var noble = require('noble');
var logger = require("../Logger");
var constants = require('./DfuConstants');
var dfuNotificationHandler = require('./dfuNotificationHandler');
var dfuUtils = require('./dfuUtils');
var path = require('path');
var AdmZip = require('adm-zip');
var Promise = require('bluebird');
const dfuConfig = require('./nrfDfuConfig');
const dfuCache = require('./dfuCache');
const dfuServiceMessage = require('./dfuServiceMessage');
const dfuProcessUtils = require('./dfuProcessUtils');

const mFirmwareZipName = process.argv[2];

logger.debug(TAG + "zipped firmwares basepath: ", dfuConfig.FIRMWARES_ZIPPED_BASEPATH);
logger.debug("tmp directory basepath: ", dfuConfig.FIRMWARES_TMP_BASEPATH);

var scanning = false;
var deviceFound = false;

noble.on('stateChange', function (state) {
    logger.verbose(TAG + "noble state: " + state);
    if (state === 'poweredOn') {
        startScan();
    }
});

function startScan() {
    logger.verbose(TAG + "starting scan");
    noble.once('scanStart', function () {
        scanning = true;
        logger.verbose(TAG + "scan started successfully");
    });
    noble.startScanning();
    setTimeout(function () {
        stopScan();
    }, dfuConfig.DFU_MAIN_PROCESS_SCAN_TIMEOUT);
}

function stopScan() {
    logger.verbose(TAG + "stopping scan");
    if (scanning) {
        noble.once('scanStop', function () {
            logger.verbose(TAG + "scan stopped successfullly");
            scanning = false;
        });
        noble.stopScanning();
    }

    //if no device is found and scan stopped, then terminate
    if (!deviceFound) {
        terminate();
    }
}

function terminate() {
    dfuProcessUtils.terminate();
}

noble.on('discover', function (peripheral) {
    if (peripheral.advertisement.localName === dfuConfig.BOOTLOADER_MODE_DEVICE_NAME) {
        logger.info(TAG + "Peripheral found advertising in bootloader mode: ", peripheral.address);
        deviceFound = true;
        stopScan();

        //clean per DFU cache
        dfuCache.flushAll();

        peripheral.on("disconnect", function (error) {
            if (error) {
                logger.error("disconnecting peripheral");
                logger.error(error);
            }
            logger.info("peripheral disconnected: ", peripheral.address);
            terminate();
        });

        var mDfuCharacteristics;
        bleUtils.connectToPeripheral(peripheral)
            .then(bleUtils.discoverServices)
            .then(dfuBleUtils.discoverBootloaderDfuService)
            .then(bleUtils.discoverCharacteristics)
            .then(dfuBleUtils.discoverControlPointAndPacketCharacteristics)
            .then(function (dfuCharacteristics) {
                if (dfuCharacteristics === undefined) {
                    logger.verbose(TAG + "DFU characteristics are undefined");
                    throw new Error();
                }
                mDfuCharacteristics = dfuCharacteristics;
                return dfuCharacteristics[constants.SECURE_DFU_CONTROL_POINT_CHARACTERISTIC];
            })
            .then(bleUtils.enableNotifications)
            .then(function () {
                return addControlPointNotificationListener(mDfuCharacteristics);
            })
            .then(removeTmpDirectory)
            .then(prepareDfuFiles)
            .then(function (firmwareFilesPaths) {
                dfuCache.set(constants.FIRMWARE_DAT_FILE_PATH, firmwareFilesPaths[constants.FIRMWARE_DAT_FILE_PATH]);
                dfuCache.set(constants.FIRMWARE_BIN_FILE_PATH, firmwareFilesPaths[constants.FIRMWARE_BIN_FILE_PATH]);
                return mDfuCharacteristics[constants.SECURE_DFU_CONTROL_POINT_CHARACTERISTIC];
            })
            .then(dfuNotificationHandler.setPrn)
            .then(function (characteristic) {
                return dfuBleUtils.sendSelectCommand(characteristic, constants.CONTROL_PARAMETERS.COMMAND_OBJECT);
            })
            .catch(function (error) {
                logger.error(TAG + "DFU failed");
                logger.error(error);
                terminate();
            })
    }
});

function addControlPointNotificationListener(dfuCharacteristics) {
    logger.verbose(TAG + "adding control point characteristic notification listener");
    if (dfuCharacteristics === undefined) {
        logger.error(TAG + "control point characteristic is undefined");
        throw new Error();
    }

    const controlPointCharacteristic = dfuCharacteristics[constants.SECURE_DFU_CONTROL_POINT_CHARACTERISTIC];
    controlPointCharacteristic.on('data', function (response, isNotification) {
        if (isNotification) {
            dfuNotificationHandler.initPacketNotificationHandler(dfuCharacteristics, response, isNotification);
        }
    });
    return dfuCharacteristics;
}

function removeTmpDirectory() {
    logger.debug(TAG + "removing tmp directory: " + dfuConfig.FIRMWARES_TMP_BASEPATH);
    return dfuUtils.removeDirectory(dfuConfig.FIRMWARES_TMP_BASEPATH)
        .then(function () {
            logger.verbose(TAG + "tmp directory removed successfully");
        })
}

function prepareDfuFiles() {
    var zipFilePath = path.join(dfuConfig.FIRMWARES_ZIPPED_BASEPATH, mFirmwareZipName);
    logger.debug(TAG + "firmware zip file path: ", zipFilePath);
    const zip = new AdmZip(zipFilePath);
    const zipEntries = zip.getEntries();

    logger.verbose(TAG + "extracting firmware files");
    zip.extractAllTo(dfuConfig.FIRMWARES_TMP_BASEPATH, true);
    logger.debug(TAG + "extracted firmwares files to: " + dfuConfig.FIRMWARES_TMP_BASEPATH);

    var datFilePath, binFilePath, manifestFilePath;
    return Promise.map(zipEntries, (function (zipEntry) {
            var entryName = zipEntry.entryName;
            if (path.extname(entryName) === ".dat") {
                datFilePath = path.join(dfuConfig.FIRMWARES_TMP_BASEPATH, entryName);
                logger.debug(TAG + "firmware DAT file path: ", datFilePath);
            } else if (path.extname(zipEntry.entryName) === ".bin") {
                binFilePath = path.join(dfuConfig.FIRMWARES_TMP_BASEPATH, entryName);
                logger.debug(TAG + "firmware bin file path: ", binFilePath);
            } else if (path.extname(zipEntry.entryName) === ".json") {
                manifestFilePath = path.join(dfuConfig.FIRMWARES_TMP_BASEPATH, entryName);
                logger.debug(TAG + "firmware manifest file path: ", manifestFilePath);
            }
        })
    ).then(function () {
        if(datFilePath === undefined || binFilePath === undefined || manifestFilePath === undefined){
            logging.error(TAG + "extracting DFU files");
            throw new Error();
        }
        var firmwareFilesPaths = {};
        firmwareFilesPaths[constants.FIRMWARE_DAT_FILE_PATH] = datFilePath;
        firmwareFilesPaths[constants.FIRMWARE_BIN_FILE_PATH] = binFilePath;
        firmwareFilesPaths[constants.FIRMWARE_MANIFEST_FILE_PATH] = manifestFilePath;
        logger.verbose(TAG + "DFU files prepared");
        return firmwareFilesPaths;
    })
}

module.exports.terminate = terminate;