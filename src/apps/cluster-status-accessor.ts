
import { ILogger } from 'the-logger';
import _ from 'the-lodash';

import { Context } from '../context';

export class ClusterStatusAccessor
{
    private logger : ILogger;
    private _context : Context;

    constructor(logger: ILogger,
                context: Context)
    {
        this.logger = logger.sublogger('ClusterStatusAccessor');
        this._context = context;
    }

    getStatus()
    {
        const status : ClusterReportingStatus = {
            has_ready_snapshots: false,
            has_reported_snapshots: false,
            snapshots_in_queue: 0
        };

        return Promise.resolve()
            .then(() => {
                return this._getCollectorInfo()
                    .then(result => {
                        if (result) {                            
                            status.agent_version = result.agent_version;
                            status.latest_snapshot_id = result.snapshot_id;
                            status.latest_snapshot_date = result.date;

                            if (status.latest_snapshot_id) {
                                status.has_reported_snapshots = true;
                            }
                        }
                    })
            })
            .then(() => {
                return this._getLatestSnapshotInfo()
                    .then(result => {
                        if (result) {
                            status.has_ready_snapshots = true;
                            status.current_snapshot_id = result.snapshot_id;
                            status.current_snapshot_date = result.date;
                        }
                    })
            })
            .then(() => {
                return this._getProcessorState()
                    .then(result => {
                        if (result) {
                            status.snapshots_in_queue = result.snapshots_in_queue;
                        }
                    })
            })
            .then(() => status);
    }

    private _getCollectorInfo()
    {
        return this._context.configAccessor.getCollectorReportingInfo();
    }

    private _getLatestSnapshotInfo()
    {
        return this._context.configAccessor.getLatestSnapshotInfo();
    }

    private _getProcessorState()
    {
        return this._context.configAccessor.getCollectorStateConfig();
    }

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
