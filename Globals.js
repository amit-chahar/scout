/**
 * Created by Amit-Chahar on 10-04-2017.
 */
var noble = require('noble');
var firebase = require('firebase');

var firebaseConfig = {
    apiKey: "AIzaSyB9CiBRwVf2Mitp3e3-teecbq2sUxpXPrg",
    authDomain: "wispero-web.firebaseapp.com",
    databaseURL: "https://wispero-web.firebaseio.com",
    projectId: "wispero-web",
    storageBucket: "wispero-web.appspot.com",
    messagingSenderId: "509844807514"
};

firebase.initializeApp(firebaseConfig);
const firebaseDatabase = firebase.database();

module.exports.noble = noble;
module.exports.firebase = firebase;
module.exports.firebaseDataspace = firebaseDatabase;
