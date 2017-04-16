/**
 * Created by Amit-Chahar on 12-04-2017.
 */
const NodeCache = require('node-cache');
const perDfuCache = new NodeCache({useClones: false});
var EventEmitter = require('events').EventEmitter;

module.exports.perDfuCache = perDfuCache;
module.exports.eventEmitter = EventEmitter;