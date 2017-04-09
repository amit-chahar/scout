var noble = require('noble');
var Promise = require('bluebird');

var peripheralIdOrAddress;
// = process.argv[2].toLowerCase();
const peripheral_name = 'Device_1_fv1.1';

const dfu_service_uuid = "8e400001-f315-4f60-9fb8-838830daea50";
const dfu_char_uuid = "8e400001-f315-4f60-9fb8-838830daea50";
const dfu_cccd_uuid = "000002902-0000-1000-8000-00805f9b34fb";


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
    peripheral.discoverServices(function (error, services) {
        if(error){
            console.log("Error: discovering DFU service");
            return;
        }
        services.forEach(function (service) {
            if(service.uuid === dfu_service_uuid){
                console.log("start exploring characteristics");
                exploreCharacteristics(peripheral);
            }
        })
    })
}

function exploreCharacteristics(peripheral){
    peripheral.discoverCharacteristics(function (error, characteristics) {
        if(error){
            console.log("Error: exploring characteristics");
            return;
        }
        characteristics.forEach(function (characteristic) {
            if(characteristic.uuid === dfu_char_uuid){
                console.log("DFU characteristic found");
                characteristics[0].discoverDescriptors(function (descriptors) {
                    descriptors.forEach(function (descriptor) {
                        if (descriptor.uuid === '2901') {
                            console.log("CCCD found");
                        }
                    })
                });
            }
        })
    });
}

