/**
 * Created by Amit-Chahar on 10-04-2017.
 */
var logger = require('../Logger');
var Promise = require('bluebird');
var helpers = require('./Helpers');

function enableNotifications(characteristic, enable, TAG) {

    if (enable) {
        return discoverCCCD(characteristic, TAG)
            .then(writeCCCD)
            .then(enableNotify)
            .then(function () {
                logger.info("notifications enabled successfully on " + TAG);
            })
    }
}

function discoverCCCD(characteristic, TAG) {
    var cData = {};
    return new Promise(function (resolve, reject) {
        characteristic.discoverDescriptors(function (error, descriptors) {
            if (error) {
                reject("discovering descriptors: " + TAG);
            }
            Promise.map(descriptors, function (descriptor) {
                if (descriptor.uuid === '2902') {
                    cData["characteristic"] = characteristic;
                    cData["descriptor"] = descriptor;
                    cData["TAG"] = TAG;
                }
            }).then(function () {
                resolve(cData);
            })
        });
    })
}

function writeCCCD(cData) {
    if (cData === undefined) {
        Promise.reject("CCCD not found: " + TAG);
    }

    var descriptor = cData["descriptor"];
    var TAG = cData["TAG"];

    return new Promise(function (resolve, reject) {
        var buf = new Buffer(2);
        buf.writeUInt8(0x01, 0);
        buf.writeUInt8(0x00, 1);
        descriptor.writeValue(buf, function (error) {
            if (error) {
                reject("writing CCCD: " + TAG);
            }
            logger.info("CCCD written successfully");
            resolve();
        }).then(function () {
            return helper.delay(2000);
        }).then(function () {
            return cData;
        })
    });
}

function enableNotify(data) {
    var characteristic = data["characteristic"];
    var TAG = data["TAG"];

    return new Promise(function (resolve, reject) {
        characteristic.notify(true, function (error) {
            if (error) {
                reject("enabling notifications locally");
            }
        }).then(function () {
            return helpers.delay(1000);
        })
    });
}

module.exports.enableNotifications = enableNotifications;