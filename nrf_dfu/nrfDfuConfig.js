/**
 * Created by Amit-Chahar on 17-04-2017.
 */
const path = require('path');

const FIRMWARES_BASEPATH = path.join(__dirname, "firmwares");

module.exports = {
    "DFU_STARTER_SCAN_TIMEOUT": 10000,
    "DFU_MAIN_PROCESS_SCAN_TIMEOUT": 10000,
    "CONNECTION_RETRY_INTERVAL": 5000,

    "FIRMWARES_ZIPPED_BASEPATH": path.join(FIRMWARES_BASEPATH, "zipped"),
    "FIRMWARES_TMP_BASEPATH": path.join(FIRMWARES_BASEPATH, "tmp")
}