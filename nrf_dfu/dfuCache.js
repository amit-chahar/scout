/**
 * Created by Amit-Chahar on 12-04-2017.
 */
const NodeCache = require('node-cache');
const dfuCache = new NodeCache({useClones: false});

module.exports = dfuCache;