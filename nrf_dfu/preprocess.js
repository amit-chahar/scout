var noble = require('noble');
var Promise = require('bluebird');

var peripheralIdOrAddress;
// = process.argv[2].toLowerCase();
const peripheral_name = 'Device_1_fv1.1';

const dfu_service_uuid = "8e400001f3154f609fb8838830daea50";
const dfu_char_uuid = "8e400001f3154f609fb8838830daea50";
const dfu_cccd_uuid = "00000290200001000800000805f9b34fb";


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

        console.log();

        explore(peripheral);
    }
});

function explore(peripheral) {
    console.log('services and characteristics:');

    peripheral.on('disconnect', function () {
        console.log("Peripheral disconnected");
        //process.exit(0);
    });

    peripheral.connect(function (error) {
        if(error){
            console.log("Error: connecting peripheral");
            return;
        }
	console.log("start exploring services");
        exploreServices(peripheral);
    })
}

function exploreServices(peripheral){
    peripheral.discoverServices([], function (error, services) {
        if(error){
            console.log("Error: discovering DFU service");
            return;
        }
        services.forEach(function (service) {
            if(service.uuid === dfu_service_uuid){
                console.log("start exploring characteristics");
                exploreCharacteristics(service);
            }
        })
    })
}

function exploreCharacteristics(service){
    service.discoverCharacteristics([], function (error, characteristics) {
        if(error){
            console.log("Error: exploring characteristics");
            return;
        }
        characteristics.forEach(function (characteristic) {
            if(characteristic.uuid === dfu_char_uuid){
                console.log("DFU characteristic found");

                characteristic.once("notify", function (state) {
                    if(state){
                        var data = new Buffer(1);
                        data.writeUInt8(0x01, 0);
                        console.log("data: ", data);
                        characteristic.write(data, true, function(error){
                            if(error){
                                console.log("Error: writing characteristic");
                                return;
                            }
                            console.log("characteristic written successfully");
                        })
                    }
                })

                // characteristic.notify(true, function (error) {
                //     if(error){
                //         console.log("Error: enable notificatioin");
                //         return;
                //     }
                // });

                characteristics[0].discoverDescriptors(function (error, descriptors) {
                    descriptors.forEach(function (descriptor) {
                        if (descriptor.uuid === '2902') {
                            console.log("CCCD found");
                            var data = new Buffer(2);
                            data.writeUInt8(0x01, 0);
			    data.writeUInt8(0x00, 1);
                            descriptor.writeValue(data, function(error){
                                if(error) {
                                    console.log("Error: writing descritor");
                                    return;
                                }
                                console.log("descriptor written successfully");
                                setTimeout(function () {
                                    var data = new Buffer(3);
                                    data.writeUInt8(0x20, 0);
				    data.writeUInt8(0x01, 1);
				    data.writeUInt8(0x01, 2);
                                    console.log("data: ", data);
                                    characteristic.write(data, false, function(error){
                                        if(error){
                                            console.log("Error: writing characteristic");
                                            return;
                                        }
                                        console.log("characteristic written successfully");
                                    })
                                }, 1000);
                            })
                        }
                    })
                });
            }
        })
    });
}

