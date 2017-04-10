/**
 * Created by Amit-Chahar on 10-04-2017.
 */
var Globals = require("../Globals");
var noble = globals.noble;
var config = require("../Config");
var logger = require("../Log");
var enableNotificatioms

// https://infocenter.nordicsemi.com/topic/com.nordic.infocenter.sdk5.v12.0.0/lib_dfu_transport_ble.html?cp=4_0_0_3_4_3_2
const BASE_SERVICE_UUID = '0000xxxx-0000-1000-8000-00805f9b34fb';
const SECURE_DFU_SERVICE_UUID = BASE_SERVICE_UUID.replace('xxxx', 'fe59');

const BASE_CHARACTERISTIC_UUID = '8ec9xxxx-f315-4f60-9fb8-838830daea50';
const DFU_CONTROL_POINT_CHARACTERISTIC_UUID = BASE_CHARACTERISTIC_UUID.replace('xxxx', '0001');
const DFU_PACKET_CHARACTERISTIC_UUID = BASE_CHARACTERISTIC_UUID.replace('xxxx', '0002');
const BLE_PACKET_SIZE = 20;

var mPeripheral, mService, mControlPointCharacteristic, mPacketCharacteristic;

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
        connectToPeripheral(peripheral);
    }
});

function startDfuProcess(peripheral) {
    connectToPeripheral({"peripheral": peripheral})
        .
}

function connectToPeripheral(data) {
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
            mPeripheral = peripheral;
            findDfuService(peripheral);
        })
    })
}

function findDfuService(peripheral) {
    peripheral.discoverServices([], function (error, services) {
        if (error) {
            logger.error("discovering services");
            return;
        }
        services.forEach(function (service) {
            if (service.uuid === SECURE_DFU_SERVICE_UUID) {
                logger.info("secure DFU service found");
                mService = service;
                findControlPointAndPacketCharacteristic(service);
            }
        })
    })
}

function findControlPointAndPacketCharacteristic(service) {
    service.discoverCharacteristics([], function (error, characteristics) {
        if (error) {
            logger.error("discovering DFU characteristics");
            return;
        }

        var dfuCharCount = 0;

        characteristics.forEach(function (characteristic) {
            if (characteristic.uuid === DFU_CONTROL_POINT_CHARACTERISTIC_UUID) {
                mControlPointCharacteristic = characteristic;
                dfuCharCount += 1;
                logger.info("found DFU control point characteristic");
            } else if (characteristic.uuid == DFU_PACKET_CHARACTERISTIC_UUID) {
                mPacketCharacteristic = characteristic;
                dfuCharCount += 1;
                logger.info("found DFU packet characteristic");
            }
            if (dfuCharCount === 2) {
                startDfu();
            }
        })
    })
}

function startDfu() {

}
