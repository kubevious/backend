const Promise = require('the-promise');

module.exports = function(logger, driver, executeSql) {
    logger.info("MIGRATING v1");

    var queries = [
        "CREATE TABLE IF NOT EXISTS `config` (" +
            "`key` varchar(64) NOT NULL DEFAULT ''," +
            "`value` json NOT NULL," +
            "PRIMARY KEY (`key`)" +
        ") ENGINE=InnoDB CHARACTER SET utf8 COLLATE utf8_general_ci;"
    ];
    return Promise.serial(queries, x => executeSql(x));
}