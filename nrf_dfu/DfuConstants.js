/**
 * Created by Amit-Chahar on 10-04-2017.
 */
module.exports = {
    "APPLICATION_DFU_SERVICE_UUID": "8e400001f3154f609fb8838830daea50",
    "APPLICATION_DFU_CHAR_UUID": "8e400001f3154f609fb8838830daea50",

    "FIRMWARE_ZIP_NAME": "firmwareZipName",
    "FIRMWARE_DAT_FILE_PATH": "firmwareDatFilePath",
    "FIRMWARE_BIN_FILE_PATH": "firmwareBinFilePath",
    "FIRMWARE_MANIFEST_FILE_PATH": "firmwareManifestFilePath",
    "FIRMWARE_DAT_FILE_SIZE": "firmwareDatFileSize",
    "FIRMWARE_BIN_FILE_SIZE": "firmwareBinFileSize",
    "FIRMWARE_EXPECTED_CRC": "ExpectedCrc",
    "FIRMWARE_DAT_FILE_EXPECTED_CRC": "datFileExpectedCrc",
    "FIRMWARE_BIN_FILE_EXPECTED_CRC": "binFileExpectedCrc",
    "FIRMWARE_DAT_FILE_OFFSET": "datFileOffset",
    "FIRMWARE_BIN_FILE_OFFSET": "binFileOffset",
    "FIRMWARE_CHUNK_EXPECTED_CRC": "ChunkExpectedCrc",
    "FIRMWARE_BIN_FILE_CHUNK_EXPECTED_CRC": "binFileChunkExpectedCrc",
    "FIRMWARE_DAT_FILE_CHUNK_EXPECTED_CRC": "datFileChunkExpectedCrc",
    "FIRMWARE_BIN_FILE_CREATE_OBJECT_MAX_SIZE": "binFileCreateObjectMaxSize",
    "FIRMWARE_DAT_FILE_CREATE_OBJECT_MAX_SIZE": "datFileCreateObjectMaxSize",
    "FIRMWARE_BIN_FILE_SENT_SUCCESSFULLY": "binFileSentSuccessfully",
    "FIRMWARE_DAT_FILE_SENT_SUCCESSFULLY": "datFileSentSuccessfully",
    "FIRMWARE_SENT_SUCCESSFULLY": "firmwareSentSuccessfully",
    "PERIPHERAL": "peripheral",
    "SECURE_DFU_SERVICE": "secureDfuService",
    "SECURE_DFU_SERVICE_UUID": "0000fe590000-1000800000805f9b34fb",
    "SECURE_DFU_SERVICE_SHORT_UUID": "fe59",
    "SECURE_DFU_CONTROL_POINT_CHARACTERISTIC": "secureDfuControlPointCharacteristic",
    "SECURE_DFU_CONTROL_POINT_CHARACTERISTIC_UUID": "8ec90001f3154f609fb8838830daea50",
    "SECURE_DFU_PACKET_CHARACTERISTIC": "secureDfuPacketCharacteristic",
    "SECURE_DFU_PACKET_CHARACTERISTIC_UUID": "8ec90002f3154f609fb8838830daea50",
    "BLE_PACKET_SIZE": 20,

    //Parsed response fields
    "RESPONSE_CODE": "responseCode",
    "REQUEST_OP_CODE": "requestOpCode",
    "RESULT_CODE": "resultCode",
    "RESPONSE_SPECIFIC_DATA": "responseSpecificData",

    //Response specific fields
    "MAXIMUM_SIZE": "maximumSize",
    "OFFSET": "offset",
    "CRC_32": "crc32",

    "CONTROL_OPCODES": {
        "CREATE": 0x01,
        "SET_PRN": 0x02,
        "CALCULATE_CHECKSUM": 0x03,
        "EXECUTE": 0x04,
        "SELECT": 0x06,
        "RESPONSE_CODE": 0x60
    },

    "CONTROL_PARAMETERS": {
        "COMMAND_OBJECT": 0x01,
        "DATA_OBJECT": 0x02
        // size: Object size in little endian, set by caller.
        // vale: Number of packets to be sent before receiving a PRN, set by caller. Default == 0.
    },

    // Possible result codes sent in the response packet.
    "RESULT_CODES": {
        "INVALID_CODE": 0x00,
        "SUCCESS": 0x01,
        "OPCODE_NOT_SUPPORTED": 0x02,
        "INVALID_PARAMETER": 0x03,
        "INSUFFICIENT_RESOURCES": 0x04,
        "INVALID_OBJECT": 0x05,
        "UNSUPPORTED_TYPE": 0x07,
        "OPERATION_NOT_PERMITTED": 0x08,
        "OPERATION_FAILED": 0x0A
    },

    "SELECT_RESPONSE_FIELD": {
        "MAXIMUM_SIZE": 3,
        "OFFSET": 7,
        "CRC32": 11
    },

    "CALCULATE_CHECKSUM_RESPONSE_FIELD": {
        "OFFSET": 3,
        "CRC32": 7
    }
};