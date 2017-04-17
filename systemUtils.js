/**
 * Created by Amit-Chahar on 18-04-2017.
 */
const TAG = "System Utils: ";
const logger = require('./Logger');
const execSync = require('child_process').execSync;

function restartBluetoothService() {
    const command = "sudo service bluetooth restart";
    logger.verbose(TAG + "Restarting bluetooth service");
    try {
        execSync(command);
        logger.verbose(TAG + "bluetooth service restarted successfully");
        return true;
    } catch (error) {
        logger.verbose(TAG + "unable to restart bluetooth service, error: ", error);
        return false;
    }
}

module.exports.restartBluetoothService = restartBluetoothService;