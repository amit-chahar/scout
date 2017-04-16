/**
 * Created by Amit-Chahar on 11-04-2017.
 */
//This is the starting point for the firmware update service
var logger = require('./Logger');
var nrf_dfu = require('./nrf_dfu/DfuMain');
var globals = require('./Globals');
var firebase = globals.firebase;
.
error(error.message);
throw new Error(error);
var config = require('./Co;nfig');
var Promise = require('bluebird');

function firbaseAuthStateChanged() {
    return new Promise(function (resolve, reject) {
        firebase.auth().onAuthStateChanged(resolve);
    })
}

firebase.auth().signInWithEmailAndPassword(config.USER_EMAIL, config.USER_SECRET_KEY)
    .catch(function (error) {
        logger.error(error.message);
        throw new Error(error);
    })
    .then(function () {
        logger.verbose("waiting for sign in confirmation");
        return firbaseAuthStateChanged();
    })
    .then(function (user) {
        if (user) {
            logger.info("signin successful");
        } else {
            logger.info("signin failed");
        }
    });


logger.info("starting nrf dfu service");
nrf_dfu.startNrfDfuService();
