/**
 * Created by Amit-Chahar on 10-04-2017.
 */
var noble = require('noble');
var firebase = require('firebase');
var utils = require('./Utils');

utils.initializeFirebase();
const firebaseDatabase = firebase.database();

module.exports.noble = noble;
module.exports.firebaseDatabase = firebaseDatabase;
