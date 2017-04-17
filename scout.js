/**
 * Created by Amit-Chahar on 11-04-2017.
 */
//This is the starting point for the firmware update service
const TAG = "Scout: ";
const logger = require('./Logger');
const firebaseUtils = require('./firebaseUtils');
firebaseUtils.initializeFirebase();
const firebaseDb = firebaseUtils.firebaseDb();


// var nrf_dfu = require('./nrf_dfu/DfuMain');
var config = require('./Config');
var Promise = require('bluebird');
const firebasePaths = require('./firebasePaths');
const scannerProcessHandler = require('./scannerProcessHandler');

logger.debug("user email: " + firebaseUtils.userEmail);
logger.debug("firebase user email as key: " + firebaseUtils.userEmailAsKey);
logger.debug("gateway name: " + firebaseUtils.gatewayName)
logger.debug("firebase gateway key: " + firebaseUtils.gatewayNameAsKey);

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
    // require('./Scanner').initializeAndStartScanner();
    // nrf_dfu.startNrfDfuService();
    scannerProcessHandler();
}
