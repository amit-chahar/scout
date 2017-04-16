/**
 * Created by Amit-Chahar on 11-04-2017.
 */
//This is the starting point for the firmware update service
var logger = require('./Logger');
var nrf_dfu = require('./nrf_dfu/DfuMain');
var globals = require('./Globals');
var firebaseDb = globals.firebaseDatabase;
var config = require('./Config');
var Promise = require('bluebird');
const firebasePaths = require('./firebasePaths');

firebaseDb.ref(firebasePaths.firebaseGatewayPath).once('value', function (snapshot) {
    const gateway = snapshot.val();
    if(gateway["secretKey"] === config.SECRET_KEY){
        authenticated();
    } else {
        logger.error("Unable to authenticate gateway");
        return;
    }
})

function authenticated() {
    logger.info("gateway authenticated successfully");
    require('./Scanner')
}
//
// logger.info("starting nrf dfu service");
// nrf_dfu.startNrfDfuService();
