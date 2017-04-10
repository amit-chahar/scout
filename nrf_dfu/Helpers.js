/**
 * Created by Amit-Chahar on 10-04-2017.
 */
var Promise = require('bluebird');

function delay(t) {
    return new Promise(function(resolve) {
        setTimeout(resolve, t)
    });
}

module.exports.delay = delay;