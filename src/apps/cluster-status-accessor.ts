
import { ILogger } from 'the-logger';
import _ from 'the-lodash';

import { ITableAccessor } from '@kubevious/easy-data-store';
import { SnapshotsAccessors } from '@kubevious/data-models/dist/models/snapshots';
import { BufferUtils } from '@kubevious/data-models';

export interface ClusterStatusAccessorTarget
{
    projectIdStr: string;
    clusterIdStr: string;
    clusterDataStore: ITableAccessor;
}

export class ClusterStatusAccessor
{
    private logger : ILogger;
    private _dataStore : ITableAccessor;
    
    private _snapshots : SnapshotsAccessors;

    constructor(logger: ILogger,
                dataStore: ITableAccessor,
                snapshots : SnapshotsAccessors)
    {
        this.logger = logger.sublogger('ClusterAccessor');
        this._dataStore = dataStore;
        this._snapshots = snapshots;
    }

    getStatus()
    {
        const status : ClusterReportingStatus = {
            has_ready_snapshots: false,
            has_reported_snapshots: false,
            snapshots_in_queue: 0
        };

        return Promise.resolve()
            // .then(() => {
            //     return this._getRedisLatestSnapshotInfo()
            //         .then(result => {
            //             if (result) {                            
            //                 status.agent_version = result.agentVersion;
            //                 status.latest_snapshot_id = result.id;
            //                 status.latest_snapshot_date = result.date;

            //                 if (status.latest_snapshot_id) {
            //                     status.has_reported_snapshots = true;
            //                 }
            //             }
            //         })
            // })
            // .then(() => {
            //     return this._queryCurrentSnapshotId()
            //         .then(result => {
            //             if (result) {
            //                 status.has_ready_snapshots = true;
            //                 status.current_snapshot_id = BufferUtils.toStr(result.snapshot_id!);
            //                 status.current_snapshot_date = result.date!.toISOString();
            //             }
            //         })
            // })
            // .then(() => {
            //     return this._getSnapshotQueueSize()
            //         .then(result => {
            //             status.snapshots_in_queue = result;
            //         })
            // })
            .then(() => status);
    }

    // private _getRedisLatestSnapshotInfo()
    // {
    //     const client = this._redis.hashSet(this._nameFetcher.latestSnapshotInfo())
    //     return client.get()
    //         .then(result => {
    //             if (!result) {
    //                 return null;
    //             }
    //             return <RedisLatestSnapshotInfo><any>result;
    //         });
    // }

    // private _getSnapshotQueueSize()
    // {
    //     const queueSetClient = this._redis.set(this._nameFetcher.clusterSnaphotQueue());
    //     return Promise.resolve()
    //         .then(() => queueSetClient.count())
    // }

    // private _queryCurrentSnapshotId()
    // {
    //     return this._clusterDataStore.table(this._snapshots.ClusterLatestSnapshot)
    //         .queryOne({}, {
    //             fields: { excludeScope : true }
    //         })
    //         .then(row => {
    //             if (!row) {
    //                 return null;
    //             }
    //             (<any>row).snapshot_id = BufferUtils.toStr(row.snapshot_id!);
    //             return row;
    //         })
    // }

}

export interface ClusterReportingStatus {
    has_ready_snapshots: boolean;
    has_reported_snapshots: boolean;
    snapshots_in_queue: number;
    current_snapshot_id?: string;
    current_snapshot_date?: string;
    agent_version?: string;
    latest_snapshot_id?: string;
    latest_snapshot_date?: string;
}
