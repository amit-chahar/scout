/**
 * Created by Amit-Chahar on 10-04-2017.
 */
var logger = require('../Logger');
var Promise = require('bluebird');
var helpers = require('./Helpers');

function enableNotifications(characteristic, enable, TAG) {

    if(enable) {
        return discoverCCCD(characteristic, TAG)
            .then(writeCCCD)
            .then(enableNotify)
    }
}

function discoverCCCD(characteristic, TAG) {
    return new Promise(function (resolve, reject) {
        characteristic.discoverDescriptors(function (error, descriptors) {
            if (error) {
                reject("discovering descriptors: " + TAG);
            }
            descriptors.forEach(function (descriptor) {
                if (descriptor.uuid === '2902') {
                    var data = {
                        "characteristic": characteristic,
                        "descriptor": descriptor,
                        "TAG": TAG
                    }
                    resolve(data);
                }
            })
        });
    })
}

function writeCCCD(data) {
    var descriptor = data.descriptor;
    var TAG = data.TAG;

    if (data === undefined) {
        Promise.reject("CCCD not found: " + TAG);
    }

    var data = new Buffer(2);
    data.writeUInt8(0x01, 0);
    data.writeUInt8(0x00, 1);
    descriptor.writeValue(data, function (error) {
        if (error) {
            Promise.reject("writing CCCD: " + TAG);
        }
        logger.info("CCCD written successfully");
        return helpers.delay(2000).then(function () {
            Promise.resolve(data);
        });
    })
}

function enableNotify(data) {
    var characteristic = data.characteristic;
    var TAG = data.TAG;

    characteristic.notify(true, function (error) {
        if (error) {
            Promise.reject("enabling notifications locally");
        }
        logger.info("notifications enabled: " + TAG);
        return helpers.delay(1000);
    });
}

module.exports.enableNotifications = enableNotifications;