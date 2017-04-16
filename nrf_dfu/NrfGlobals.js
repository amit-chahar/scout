/**
 * Created by Amit-Chahar on 12-04-2017.
 */
const NodeCache = require('node-cache');
const perDfuCache = new NodeCache({useClones: false});
const events = require('events');
const eventEmitter = new events.EventEmitter();

module.exports.perDfuCache = perDfuCache;
module.exports.eventEmitter = eventEmitter;