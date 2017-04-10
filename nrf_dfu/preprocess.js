var globals = require('../Globals');
var noble = globals.noble;
var Promise = require('bluebird');

var peripheralIdOrAddress;
// = process.argv[2].toLowerCase();
const peripheral_name = 'Device_1_fv1.1';

const dfu_service_uuid = "8e400001f3154f609fb8838830daea50";
const dfu_char_uuid = "8e400001f3154f609fb8838830daea50";
const dfu_cccd_uuid = "00000290200001000800000805f9b34fb";

var mPeripheral, mService, mCharacteristic, mDescriptor;

noble.on('stateChange', function (state) {
    if (state === 'poweredOn') {
        noble.startScanning();
    } else {
        noble.stopScanning();
    }
});

noble.on('discover', function (peripheral) {
    console.log("Peripheral found");
    if (peripheral.advertisement.localName === peripheral_name || peripheral.id === peripheralIdOrAddress || peripheral.address === peripheralIdOrAddress) {
        noble.stopScanning();

        console.log('peripheral with ID ' + peripheral.id + ' found');
        var advertisement = peripheral.advertisement;

        var localName = advertisement.localName;
        var txPowerLevel = advertisement.txPowerLevel;
        var manufacturerData = advertisement.manufacturerData;
        var serviceData = advertisement.serviceData;
        var serviceUuids = advertisement.serviceUuids;

        if (localName) {
            console.log('  Local Name        = ' + localName);
        }

        if (txPowerLevel) {
            console.log('  TX Power Level    = ' + txPowerLevel);
        }

        if (manufacturerData) {
            console.log('  Manufacturer Data = ' + manufacturerData.toString('hex'));
        }

        if (serviceData) {
            console.log('  Service Data      = ' + serviceData);
        }

        if (serviceUuids) {
            console.log('  Service UUIDs     = ' + serviceUuids);
        }

        mPeripheral = peripheral;
        explore(peripheral);
    }
});

function explore(peripheral) {
    console.log('services and characteristics:');

    peripheral.on('disconnect', function () {
        console.log("Peripheral disconnected");
        process.exit(0);
    });

    peripheral.connect(function (error) {
        if (error) {
            console.log("Error: connecting peripheral");
            return;
        }
        console.log("start exploring services");
        exploreServices(peripheral);
    })
}

function exploreServices(peripheral) {
    peripheral.discoverServices([], function (error, services) {
        if (error) {
            console.log("Error: discovering DFU service");
            return;
        }
        services.forEach(function (service) {
            if (service.uuid === dfu_service_uuid) {
                console.log("start exploring characteristics");
                mService = service;
                exploreCharacteristics(service);
            }
        })
    })
}

function exploreCharacteristics(service) {
    service.discoverCharacteristics([], function (error, characteristics) {
        if (error) {
            console.log("Error: exploring characteristics");
            return;
        }
        characteristics.forEach(function (characteristic) {
            if (characteristic.uuid === dfu_char_uuid) {
                console.log("DFU characteristic found");

                characteristic.on("data", function (data, isNotification) {
                    if (isNotification) {
                        console.log("Notification on characteristic: ", data);
                    }
                })

                mCharacteristic = characteristic;
                exploreDescriptors(characteristic);
            }
        })
    });
}

function exploreDescriptors(characteristic) {
    characteristic.discoverDescriptors(function (error, descriptors) {
        descriptors.forEach(function (descriptor) {
            if (descriptor.uuid === '2902') {
                console.log("CCCD found");
                mDescriptor = descriptor;
                writeCCCD(descriptor);

                // readDescriptorValue(descriptor);

                // setTimeout(function () {
                //     var data = new Buffer(3);
                //     data.writeUInt8(0x20, 0);
                //     data.writeUInt8(0x01, 1);
                //     data.writeUInt8(0x01, 2);
                //     console.log("data: ", data);
                //     characteristic.write(data, false, function (error) {
                //         if (error) {
                //             console.log("Error: writing characteristic");
                //             return;
                //         }
                //         console.log("characteristic written successfully");
                //     })
                // }, 1000);
            }
        })
    });
}

function writeCCCD(descriptor) {
    var data = new Buffer(2);
    data.writeUInt8(0x01, 0);
    data.writeUInt8(0x00, 1);
    descriptor.writeValue(data, function (error) {
        if (error) {
            console.log("Error: writing descriptor");
            return;
        }
        console.log("descriptor written successfully");

        setTimeout(function () {
            enableNotifications();
        }, 2000);
    })
}

function enableNotifications() {
    mCharacteristic.once("notify", function (state) {
        console.log("Notify event");
        if (state) {
            var data = new Buffer(1);
            data.writeUInt8(0x01, 0);
            console.log("data: ", data);
            mCharacteristic.write(data, false, function (error) {
                if (error) {
                    console.log("Error: writing characteristic");
                    return;
                }
                console.log("characteristic written successfully to restart");
            })
        }
    })

    mCharacteristic.notify(true, function (error) {
        if (error) {
            console.log("Error: enable notification");
            return;
        }
        console.log("Enabling notifications");
    });
}

function readDescriptorValue(descriptor) {
    setTimeout(function () {
        descriptor.readValue(function (error, data) {
            if (error) {
                console.log("Error: reading " + descriptor.uuid + " descriptor value");
            }
            console.log("descriptor value: ", data);
        })
    }, 1000);
}
