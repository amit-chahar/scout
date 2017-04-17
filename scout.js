/**
 * Created by Amit-Chahar on 11-04-2017.
 */
//This is the starting point for the firmware update service
const globals = require('./Globals');
const utils = require('./Utils');

var logger = require('./Logger');
var nrf_dfu = require('./nrf_dfu/DfuMain');
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
        if(snapshot.exists()) {
            const gateway = snapshot.val();
            logger.debug("gateway info from firebase", gateway);
            if (gateway["secretKey"] === config.SECRET_KEY) {
                authenticated();
            } else {
                logger.error("Unable to authenticate gateway");
            }
        } else {
            logger.error("Gateway not present in database. Please add the gateway in app");
        }
    });

function authenticated() {
    logger.info("gateway authenticated successfully");
    //require('./Scanner').initializeAndStartScanner();
    nrf_dfu.startNrfDfuService();
}
