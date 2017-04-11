/**
 * Created by Amit-Chahar on 11-04-2017.
 */
//This is the starting point for the firmware update service
var logger = require('./Logger');
var nrf_dfu = require('./nrf_dfu/DfuMain');

logger.info("starting nrf dfu service");
nrf_dfu.startNrfDfuService();
