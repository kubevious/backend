const Promise = require('the-promise');
const _ = require('the-lodash');
const DataStore = require("helper-easy-data-store").DataStore;

const TARGET_DB_VERSION = 8;

class Database
{
    constructor(logger, context)
    {
        this._context = context;
        this._logger = logger.sublogger("DB");

        this._dataStore = new DataStore(logger.sublogger("DataStore"), false, {
            charset: 'utf8_general_ci'
        });
        this._driver = this._dataStore.mysql;

        this._statements = {};

        this._driver.onMigrate(this._onDbMigrate.bind(this));

        this._setupMeta();
    }

    get logger() {
        return this._logger;
    }

    get dataStore() {
        return this._dataStore;
    }

    get driver() {
        return this._driver;
    }

    get isConnected() {
        return this._driver.isConnected;
    }

    _setupMeta()
    {
        require('./rules')(this._dataStore.meta());
        require('./markers')(this._dataStore.meta());
        require('./notifications')(this._dataStore.meta());
    }

    onConnect(cb)
    {
        return this._driver.onConnect(cb);
    }

    registerStatement(id, sql)
    {
        this._statements[id] = this._driver.statement(sql);
    }

    executeStatement(id, params)
    {
        var statement = this._statements[id];
        return statement.execute(params);
    }

    executeStatements(statements)
    {
        var myStatements = statements.map(x => ({
            statement: this._statements[x.id],
            params: x.params
        }))
        return this._driver.executeStatements(myStatements);
    }

    executeInTransaction(cb)
    {
        return this._driver.executeInTransaction(cb);
    }

    executeSql(sql)
    {
        return this.driver.executeSql(sql);
    }

    queryPartitions(tableName)
    {
        var sql = 
            "SELECT PARTITION_NAME, PARTITION_DESCRIPTION " +
            "FROM information_schema.partitions " +
            `WHERE TABLE_SCHEMA='${process.env.MYSQL_DB}' ` +
            `AND TABLE_NAME = '${tableName}' ` +
            'AND PARTITION_NAME IS NOT NULL ' +
            'AND PARTITION_DESCRIPTION != 0;';
        
        return this.executeSql(sql)
            .then(results => {
                return results.map(x => ({
                    name: x.PARTITION_NAME,
                    value: parseInt(x.PARTITION_DESCRIPTION)
                }));
            })
    }

    createPartition(tableName, name, value)
    {
        this._logger.info("[createPartition] Table: %s, %s -> %s", tableName, name, value);

        var sql = 
            `ALTER TABLE \`${tableName}\` ` +
            `ADD PARTITION (PARTITION ${name} VALUES LESS THAN (${value}))`;
        
        return this.executeSql(sql);
    }

    dropPartition(tableName, name)
    {
        this._logger.info("[dropPartition] Table: %s, %s", tableName, name);

        var sql = 
            `ALTER TABLE \`${tableName}\` ` +
            `DROP PARTITION ${name}`;
        
        return this.executeSql(sql);
    }

    init()
    {
        this._logger.info("[init]")
        return Promise.resolve()
            .then(() => this._dataStore.connect())
            .then(() => {
                this._logger.info("[init] post connect.")
            })
    }

    _onDbMigrate()
    {
        this._logger.info("[_onDbMigrate] ...");
        this._latestSnapshot = null;
        return Promise.resolve()
            .then(() => this._processMigration())
            ;
    }

    _processMigration()
    {
        this.logger.info("[_processMigration] ...");

        return this.driver.executeInTransaction(() => {
            return Promise.resolve()
                .then(() => this._getDbVersion())
                .then(version => {
                    this.logger.info("[_processMigration] VERSION: %s", version);
                    this.logger.info("[_processMigration] TARGET_DB_VERSION: %s", TARGET_DB_VERSION);
                    if (version == TARGET_DB_VERSION) {
                        return;
                    }
                    if (version > TARGET_DB_VERSION) {
                        this.logger.error("[_processMigration] You are running database version more recent then the binary. Results may be unpredictable.");
                        return;
                    }
                    var migrateableVersions = _.range(version + 1, TARGET_DB_VERSION + 1);
                    this.logger.info("[_processMigration] MigrateableVersions: ", migrateableVersions);
                    return Promise.serial(migrateableVersions, x => this._processVersionMigration(x));
                })
        });
    }

    _processVersionMigration(targetVersion)
    {
        this.logger.info("[_processVersionMigration] target version: %s", targetVersion);

        var migrator = require('./migrators/' + targetVersion);
        return Promise.resolve()
            .then(() => {
                return migrator(this.logger, this.driver, this._migratorExecuteSql.bind(this), this._context);
            })
            .then(() => {
                return this._setDbVersion(targetVersion);
            })
    }

    _migratorExecuteSql(sql, params)
    {
        this.logger.info("[_migratorExecuteSql] Executing: %s, params: ", sql, params);
        return this.driver.executeSql(sql, params)
            .catch(reason => {
                this.logger.info("[_migratorExecuteSql] Failed. Reason: ", reason);
                throw reason;
            })
    }

    _getDbVersion()
    {
        return this._tableExists('config')
            .then(configExists => {
                if (!configExists) {
                    this.logger.warn('[_getDbVersion] Config table does not exist.');
                    return 0;
                }
                return this.driver.executeSql('SELECT `value` FROM `config` WHERE `key` = "DB_SCHEMA"')
                    .then(result => {
                        var value = _.head(result);
                        if (value) {
                            return value.value.version || 0;
                        }
                        return 0;
                    })
            })
            ;
    }

    _tableExists(name)
    {
        return this.driver.executeSql(`SHOW TABLES LIKE '${name}';`)
            .then(result => {
                return result.length > 0;
            })
    }

    _setDbVersion(version)
    {
        this._logger.info("[_setDbVersion] version: %s", version);

        var valueObj = {
            version: version
        };

        return this.driver.executeSql('INSERT INTO `config` (`key`, `value`) VALUES ("DB_SCHEMA", ?) ON DUPLICATE KEY UPDATE `value` = ?',
            [valueObj, valueObj])
            ;
    }
}

module.exports = Database;