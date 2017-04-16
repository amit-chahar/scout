/**
 * Created by Amit-Chahar on 11-04-2017.
 */
//This is the starting point for the firmware update service
const utils = require('./Utils');
utils.initializeFirebase();

var logger = require('./Logger');
var nrf_dfu = require('./nrf_dfu/DfuMain');
var globals = require('./Globals');
var firebaseDb = globals.firebaseDatabase;
var config = require('./Config');
var Promise = require('bluebird');
const firebasePaths = require('./firebasePaths');

logger.debug("user email: " + utils.getUserEmail());
logger.debug("firebase user key: " + utils.getUserKey());
logger.debug("gateway name: " + utils.getGatewayName())
logger.debug("firebase gateway key: " + utils.getValidFirebaseGatewayName());

logger.debug("firebase gateway path: " + firebasePaths.firebaseGatewayPath);
firebaseDb.ref(firebasePaths.firebaseGatewayPath).once('value')
    .then(function (snapshot) {
        const gateway = snapshot.val();
        logger.debug("gateway info from firebase", gateway);
        if (gateway["secretKey"] === config.SECRET_KEY) {
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
