/**
 * Created by Amit-Chahar on 10-04-2017.
 */
var noble = require('noble');
var firebase = require('firebase');
var Build = {
    "DEBUG": true
};

if (Build.DEBUG === true) {
    const firebaseConfig = {
        apiKey: "AIzaSyBB4ArjQhGkK_5GCCmNqNZkNsK8eyowJBs",
        authDomain: "wispero-patrol-debug.firebaseapp.com",
        databaseURL: "https://wispero-patrol-debug.firebaseio.com",
        projectId: "wispero-patrol-debug",
        storageBucket: "wispero-patrol-debug.appspot.com",
        messagingSenderId: "500145202622"
    }
    firebase.initializeApp(firebaseConfig);
} else {
    const config = {
        apiKey: "AIzaSyD8JSTNZEumi28aW-Z-IldzC4ty078kuTg",
        authDomain: "wispero-patrol.firebaseapp.com",
        databaseURL: "https://wispero-patrol.firebaseio.com",
        projectId: "wispero-patrol",
        storageBucket: "wispero-patrol.appspot.com",
        messagingSenderId: "460959009015"
    };
    firebase.initializeApp(config);
}

const firebaseDatabase = firebase.database();

module.exports.noble = noble;
module.exports.firebase = firebase;
module.exports.firebaseDatabase = firebaseDatabase;
