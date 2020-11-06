const Promise = require('the-promise');

module.exports = function(logger, driver, executeSql) {
    logger.info("MIGRATING v7.");

    var queryies = [
        "CREATE TABLE IF NOT EXISTS `notification_snooze` (" +
        "    `kind` varchar(128) NOT NULL," +
        "    `feedback` binary(16) NOT NULL," +
        "    `snooze` DATETIME NULL," +
        "    PRIMARY KEY (`kind`, `feedback`)" +
        ") ENGINE=InnoDB CHARACTER SET utf8 COLLATE utf8_general_ci;"
    ];

    return Promise.serial(queryies, x => executeSql(x));
}
