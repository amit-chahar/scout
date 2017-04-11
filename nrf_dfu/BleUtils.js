/**
 * Created by Amit-Chahar on 12-04-2017.
 */
var Promise = require('bluebird');

function discoverDescriptors(characteristic) {
    return new Promise(function (resolve, reject) {
        characteristic.discoverDescriptors(function (error, descriptors) {
            if (error) {
                reject("discovering descriptors: " + TAG);
            }
            resolve(descriptors);
        })
    });
}

module.exports.discoverDescriptors = discoverDescriptors;