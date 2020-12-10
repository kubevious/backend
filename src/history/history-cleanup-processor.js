const _ = require('the-lodash');
const Promise = require('the-promise');
const moment = require('moment')
const CronJob = require('cron').CronJob
const HistoryPartitioning = require("kubevious-helpers").History.Partitioning;
const { HISTORY_TABLES } = require('./metadata');

class HistoryCleanupProcessor {
    constructor(context)
    {
        this._context = context;
        this._logger = context.logger.sublogger('HistoryCleanupProcessor');
        this._database = context.database;
        this._days = 15;
        this._isProcessing = false;

        this._startupDate = null;
        this._lastCleanupDate = null;
    }

    get logger() {
        return this._logger;
    }

    init()
    {
        this._startupDate = moment();
        this._setupCronJob();
    }

    _setupCronJob()
    {
        // TODO: Temporarity disabled cleanup scheduling.
        // return;
        var schedule = '* 0/15 0-2 * * *';
        // schedule = '*/1 * * * *';
        const cleanupJob = new CronJob(schedule, () => {
            this._processSchedule();
        })
        cleanupJob.start();
    }

    _processSchedule()
    {
        var now = moment();
        this.logger.info('[_processSchedule] now: %s', now);

        if (now.diff(this._startupDate, 'minutes') < 15) {
            this.logger.info('[_processSchedule] skipped, waiting 15 minutes post startup');
            return;
        }
        if (this._lastCleanupDate)
        {
            if (now.diff(this._lastCleanupDate, 'hours') < 20) {
                this.logger.info('[_processSchedule] skipped, processed within last 20 hours');
                return;
            }
        }

        this.logger.info('[_processSchedule] will execute');
        this.processCleanup();
    }

    processCleanup()
    {
        this._logger.info('[processCleanup] Begin');
        if (this._isProcessing) {
            this._logger.warn('[processCleanup] Skipped');
            return;
        }
        this._isProcessing = true;

        this._lastCleanupDate = moment();

        this._currentConfigHashes = [];
        this._usedHashesDict = {};

        this._cutoffDate = moment().subtract(this._days, 'days');
        this._logger.info('[processCleanup] Cutoff Date=%s', this._cutoffDate);

        return this._process(this._context.tracker)
            .then(() => {
                this._logger.info('[processCleanup] End');
            })
            .catch(reason => {
                this._logger.error('[processCleanup] FAILED: ', reason);
            })
            .finally(() => {
                this._isProcessing = false;
            })
    }

    _process(tracker)
    {
        return new Promise((resolve, reject) => {

            this._context.historyProcessor.lockForCleanup(historyLock => {

                return tracker.scope("HistoryCleanupProcessor::_process", (childTracker) => {
                    return Promise.resolve()
                        .then(() => this._outputDBUsage('pre-cleanup', childTracker))
                        .then(() => this._cleanupHistoryTables(childTracker))
                        .then(() => this._outputDBUsage('post-cleanup', childTracker))
                        
                })
                .finally(() => {
                    historyLock.finish();
                })
                .then(() => {
                    resolve();
                })
                .catch(reason => {
                    reject(reason);
                })
                ;

            });

        });
    }

    _cleanupHistoryTables(tracker)
    {
        this._logger.info('[_cleanupHistoryTables] Running...');

        return tracker.scope("_cleanupHistoryTables", (childTracker) => {
            return Promise.serial(HISTORY_TABLES, x => this._cleanupHistoryTable(x));
        });
    }

    _cleanupHistoryTable(tableName)
    {
        this._logger.info('[_cleanupHistoryTable] Table: %s', tableName);
        return this._database.queryPartitions(tableName)
            .then(partitions => {
                this._logger.info('[_cleanupHistoryTable] Table: %s, Current Partitions: ', tableName, partitions);

                var cutoffPartition = HistoryPartitioning.calculateDatePartition(this._cutoffDate);
                this._logger.info('[_cleanupHistoryTable] CutoffPartition=%s', cutoffPartition);

                for(var x of partitions)
                {
                    x.id = (x.value - 1);
                }

                var partitionsToDelete = partitions.filter(x => (x.id <= cutoffPartition));
                this._logger.info('[_cleanupHistoryTable] table: %s, partitionsToDelete:', tableName, partitionsToDelete);

                return Promise.serial(partitionsToDelete, x => this._deletePartition(tableName, x));
            });
    }

    _deletePartition(tableName, partitionInfo)
    {
        this._logger.info('[_deletePartition] Table: %s, Partition: %s, Id: %s', tableName, partitionInfo.name, partitionInfo.id);
        this._context.historyProcessor.markDeletedPartition(partitionInfo.id);
        return this._database.dropPartition(tableName, partitionInfo.name);
    }

    _outputDBUsage(stage, tracker)
    {
        return tracker.scope("_outputDBUsage", (childTracker) => {
            return this._outputDbSize(stage)
        });
    }

    _countTable(tableName, keyColumn, stage)
    {
        if (!stage) {
            stage = '';
        }
        return this._executeSql(`SELECT COUNT(\`${keyColumn}\`) as count FROM ${tableName}`)
            .then(result => {
                var count = result[0].count;
                this._logger.info('[_countTable] %s, Table: %s, Row Count: %s ', stage, tableName, count);
                return count;
            })
    }

    _outputDbSize(stage)
    {
        var sql = `SELECT \`TABLE_NAME\`, \`TABLE_ROWS\`, ((data_length + index_length) / 1024 / 1024 ) AS size FROM information_schema.TABLES WHERE table_schema = "${process.env.MYSQL_DB}"`
        return this._executeSql(sql)
            .then(result => {
                result = _.orderBy(result, ['size'], ['desc']);
                for(var x of result)
                {
                    this._logger.info('[_outputDbSize] %s, Table: %s, Rows: %s, Size: %s MB', stage, x.TABLE_NAME, x.TABLE_ROWS, x.size);
                }
            });
    }

    _executeSql(sql)
    {
        return this._database.executeSql(sql);
    }
}

module.exports = HistoryCleanupProcessor
