const Promise = require('the-promise');
const _ = require('lodash');
const { v4: uuidv4 } = require('uuid');
const DateUtils = require('kubevious-helpers').DateUtils;

class Collector
{
    constructor(context)
    {
        this._context = context;
        this._logger = context.logger.sublogger("Collector");

        this.logger.info("[constructed] ");

        this._snapshots = {};
        this._diffs = {};

        this._iteration = 0;

        this._parserVersion = null;
        this._currentMetric = null;
        this._latestMetric = null;
    }

    get logger() {
        return this._logger;
    }

    extractMetrics()
    {
        let metrics = [];

        metrics.push({
            name: 'Collector :: Parser Version',
            value: this._parserVersion ? this._parserVersion : 'unknown'
        })

        metrics.push({
            name: 'Collector :: Latest Report Date',
            value: this._currentMetric ? this._currentMetric.dateStart : ''
        })

        if (this._currentMetric) {
            if (!this._currentMetric.dateEnd)
            {
                let durationSeconds = DateUtils.diffSeconds(new Date(), this._currentMetric.dateStart);
                metrics.push({
                    name: 'Collector :: Current Report Duration(sec)',
                    value: durationSeconds
                })
            }
        }

        if (this._latestMetric) {
            metrics.push({
                name: 'Collector :: Latest Report Duration(sec)',
                value: this._latestMetric.durationSeconds
            })
        }

        return metrics;
    }

    _newMetric(date)
    {
        let metric = {
            origDate: date,
            dateStart: new Date(),
            dateEnd: null,
            kind: null,
            durationSeconds: null
        };
        this._currentMetric = metric;
        return metric;
    }

    _endMetric(metric)
    {
        metric.dateEnd = new Date();
        metric.durationSeconds = DateUtils.diffSeconds(metric.dateEnd, metric.dateStart);
        this._latestMetric = metric;
        return metric;
    }
    
    newSnapshot(date, parserVersion)
    {
        this._parserVersion = parserVersion;

        let metric = this._newMetric(date);
        metric.kind = 'snapshot';

        var id = uuidv4();
        this._snapshots[id] = {
            date: date,
            metric: metric,
            items: {}
        };

        return {
            id: id
        };
    }

    acceptSnapshotItems(snapshotId, items)
    {
        var snapshotInfo = this._snapshots[snapshotId];
        if (!snapshotInfo) {
            return RESPONSE_NEED_NEW_SNAPSHOT;
        }

        for(var item of items)
        {
            snapshotInfo.items[item.hash] = item.data;
        }

        return {};
    }

    activateSnapshot(snapshotId)
    {
        return this._context.tracker.scope("collector::activateSnapshot", (tracker) => {
            var snapshotInfo = this._snapshots[snapshotId];
            if (!snapshotInfo) {
                return RESPONSE_NEED_NEW_SNAPSHOT;
            }

            this._acceptSnapshot(snapshotInfo);

            return {};
        });
    }

    newDiff(snapshotId, date)
    {
        var snapshotInfo = this._snapshots[snapshotId];
        if (!snapshotInfo) {
            return RESPONSE_NEED_NEW_SNAPSHOT;
        }

        let metric = this._newMetric(date);
        metric.kind = 'diff';

        var id = uuidv4();
        this._diffs[id] = {
            date: date,
            metric: metric,
            snapshotId: snapshotId,
            items: []
        };

        return {
            id: id
        };
    }

    acceptDiffItems(diffId, items)
    {
        var diffInfo = this._diffs[diffId];
        if (!diffInfo) {
            return RESPONSE_NEED_NEW_SNAPSHOT;
        }

        for(var item of items)
        {
            diffInfo.items.push(item);
        }

        return {};
    }

    activateDiff(diffId)
    {
        return this._context.tracker.scope("collector::activateDiff", (tracker) => {
            var diffInfo = this._diffs[diffId];
            if (!diffInfo) {
                return RESPONSE_NEED_NEW_SNAPSHOT;
            }
    
            var snapshotInfo = this._snapshots[diffInfo.snapshotId];
            if (!snapshotInfo) {
                return RESPONSE_NEED_NEW_SNAPSHOT;
            }
    
            var newSnapshotId = uuidv4();
            var newSnapshotInfo = {
                date: new Date(diffInfo.date),
                metric: diffInfo.metric,
                items: _.clone(snapshotInfo.items)
            };
            this._snapshots[newSnapshotId] = newSnapshotInfo;
    
            for(var diffItem of diffInfo.items)
            {
                if (diffItem.present)
                {
                    newSnapshotInfo.items[diffItem.hash] = diffItem.data;
                }
                else
                {
                    delete newSnapshotInfo.items[diffItem.hash];
                }
            }
    
            delete this._snapshots[diffInfo.snapshotId];
    
            this._acceptSnapshot(newSnapshotInfo);
    
            return {
                id: newSnapshotId
            };
        });
    }

    _acceptSnapshot(snapshotInfo)
    {
        this._endMetric(snapshotInfo.metric);

        this.logger.info("[_acceptSnapshot] item count: %s", _.keys(snapshotInfo.items).length);
        this.logger.info("[_acceptSnapshot] metric: ", snapshotInfo.metric);
        var safeSnapshot = _.cloneDeep(snapshotInfo);
        this._context.facadeRegistry.acceptCurrentSnapshot(safeSnapshot);
    }

}

const RESPONSE_NEED_NEW_SNAPSHOT = {
    new_snapshot: true
};

module.exports = Collector;