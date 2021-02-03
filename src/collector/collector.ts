import _ from 'the-lodash';
import { Promise } from 'the-promise';
import { ILogger } from 'the-logger' ;

import { v4 as uuidv4 } from 'uuid';
import * as DateUtils from '@kubevious/helpers/dist/date-utils';

import { Context } from '../context';
import { SnapshotItemInfo } from '@kubevious/helpers/dist/snapshot/types';
import { ReportableSnapshotItem, ResponseReportSnapshot, ResponseReportSnapshotItems } from '@kubevious/helpers/dist/reportable/types';
import { CollectorSnapshotInfo, MetricItem } from './types';
import { ConcreteRegistry } from '../concrete/registry';
import { ItemId, K8sConfig, extractK8sConfigId } from '@kubevious/helper-logic-processor';

export interface UserMetricItem
{
    category: string,
    name: string,
    value: string | number
}


export interface CollectorSnapshotItem
{
    hash: string,
    data: SnapshotItemInfo
}

export interface DiffItem
{

}

export class Collector
{
    private _logger : ILogger;
    private _context : Context

    private _snapshots : Record<string, CollectorSnapshotInfo> = {};

    private _iteration : number = 0;

    private _parserVersion? : string;
    private _currentMetric : any;
    private _latestMetric : any;
    private _recentDurations : number[] = [];

    private _configHashes : Record<string, any> = {};


    constructor(context: Context)
    {
        this._context = context;
        this._logger = context.logger.sublogger("Collector");

        this.logger.info("[constructed] ");
    }

    get logger() {
        return this._logger;
    }

    extractMetrics()
    {
        let metrics : UserMetricItem[] = [];

        metrics.push({
            category: 'Collector',
            name: 'Parser Version',
            value: this._parserVersion ? this._parserVersion : 'unknown'
        })

        metrics.push({
            category: 'Collector',
            name: 'Recent Durations',
            value: JSON.stringify(this._recentDurations)
        })

        if (this._currentMetric && !this._currentMetric.dateEnd) {
            metrics.push({
                category: 'Collector',
                name: 'Current Report Date',
                value: this._currentMetric.dateStart
            })
    
            metrics.push({
                category: 'Collector',
                name: 'Current Report Kind',
                value: this._currentMetric.kind
            })

            let durationSeconds = DateUtils.diffSeconds(new Date(), this._currentMetric.dateStart);
            metrics.push({
                category: 'Collector',
                name: 'Current Report Duration(sec). Still collecting...',
                value: durationSeconds
            })
        }

        if (this._latestMetric) {
            metrics.push({
                category: 'Collector',
                name: 'Latest Report Date',
                value: this._latestMetric.dateStart
            })

            metrics.push({
                category: 'Collector',
                name: 'Latest Report Kind',
                value: this._latestMetric.kind
            })

            metrics.push({
                category: 'Collector',
                name: 'Latest Report Duration(sec)',
                value: this._latestMetric.durationSeconds
            })
        }

        return metrics;
    }

    private _newMetric(date: Date, kind: string) 
    {
        let metric : MetricItem = {
            origDate: date,
            dateStart: new Date(),
            dateEnd: null,
            kind: kind,
            durationSeconds: null
        };
        this._currentMetric = metric;
        return metric;
    }

    private _endMetric(metric: MetricItem)
    {
        metric.dateEnd = new Date();
        metric.durationSeconds = DateUtils.diffSeconds(metric.dateEnd, metric.dateStart);
        this._recentDurations.push(metric.durationSeconds);
        this._recentDurations = _.takeRight(this._recentDurations, 10);
        this._latestMetric = metric;
        return metric;
    }
    
    newSnapshot(date: Date, parserVersion: string, baseSnapshotId?: string) : ResponseReportSnapshot
    {
        this._parserVersion = parserVersion;

        let metric = this._newMetric(date, 'snapshot');

        let item_hashes : Record<string, string> = {};
        if (baseSnapshotId)
        {
            let baseSnapshot = this._snapshots[baseSnapshotId!];
            if (baseSnapshot) {
                item_hashes = _.clone(baseSnapshot.item_hashes);
            } else {
                return RESPONSE_NEED_NEW_SNAPSHOT;
            }
        }

        let id = uuidv4();
        this._snapshots[id] = {
            date: date,
            metric: metric,
            item_hashes: item_hashes
        };

        return {
            id: id
        };
    }

    acceptSnapshotItems(snapshotId: string, items: ReportableSnapshotItem[])
    {
        let snapshotInfo = this._snapshots[snapshotId];
        if (!snapshotInfo) {
            return RESPONSE_NEED_NEW_SNAPSHOT;
        }

        let missingHashes : string[] = [];

        for (let item of items)
        {
            if (item.present)
            {
                snapshotInfo.item_hashes[item.idHash] = item.configHash!;

                if (!(item.idHash in this._configHashes)) {
                    missingHashes.push(item.configHash!)
                }
            }
            else
            {
                delete snapshotInfo.item_hashes[item.idHash];
            }
        }

        let response : ResponseReportSnapshotItems = {}
        if (missingHashes.length > 0)
        {
            response.needed_configs = missingHashes;
        }

        return response;
    }

    activateSnapshot(snapshotId: string)
    {
        return this._context.tracker.scope("collector::activateSnapshot", (tracker) => {
            let snapshotInfo = this._snapshots[snapshotId];
            if (!snapshotInfo) {
                return RESPONSE_NEED_NEW_SNAPSHOT;
            }

            this._endMetric(snapshotInfo.metric);

            this.logger.info("[_acceptSnapshot] item count: %s", _.keys(snapshotInfo.item_hashes).length);
            this.logger.info("[_acceptSnapshot] metric: ", snapshotInfo.metric);
            
            const registry = new ConcreteRegistry(this._logger, snapshotInfo.date);
            for(let itemHash of _.keys(snapshotInfo.item_hashes))
            {
                let configHash = snapshotInfo.item_hashes[itemHash];
                let config = this._configHashes[configHash];
                let itemId = this._extractId(config);
                registry.add(itemId, config);
            }
            
            this._context.facadeRegistry.acceptConcreteRegistry(registry);

            return {};
        });
    }

    storeConfig(hash: string, config: object)
    {
        this._configHashes[hash] = config;
    }

    private _extractId(config: any)
    {
        let c = <K8sConfig>config;
        return extractK8sConfigId(c);
    }

}

const RESPONSE_NEED_NEW_SNAPSHOT = {
    new_snapshot: true
};
