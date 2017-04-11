/**
 * Created by Amit-Chahar on 11-04-2017.
 */
var dfuService = require("./DfuService");

function startNrfDfuService(){
    var firmwareZipName = "fv1.1.zip";
    logger.info("starting nrf DFU: firmware: " + firmwareZipName);
    dfuService.initializeAndStart(firmwareZipName);
}

module.exports.startNrfDfuService = startNrfDfuService;