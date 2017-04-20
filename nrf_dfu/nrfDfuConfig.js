/**
 * Created by Amit-Chahar on 17-04-2017.
 */
const path = require('path');

const FIRMWARES_BASEPATH = path.join(__dirname, "firmwares");

module.exports = {
    "BOOTLOADER_MODE_DEVICE_NAME": "Wispero_DFU",
    "DFU_STARTER_SCAN_TIMEOUT": 10000,
    "DFU_MAIN_PROCESS_SCAN_TIMEOUT": 10000,
    "DFU_MAIN_PROCESS_TIMEOUT": 100000,
    "CONNECTION_RETRY_INTERVAL": 5000,

    "FIRMWARES_ZIPPED_BASEPATH": path.join(FIRMWARES_BASEPATH, "zipped"),
    "FIRMWARES_TMP_BASEPATH": path.join(FIRMWARES_BASEPATH, "tmp"),

    "PACKET_RECEIPT_NOTIFICATION": 0
}