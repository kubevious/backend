import _ from 'the-lodash';
import { ILogger } from 'the-logger';
import { Context } from '../context';
import { Router } from '@kubevious/helper-backend';
import { BufferUtils } from '@kubevious/data-models';
import { Helpers } from '../server';

export default function (router: Router, context: Context,  logger: ILogger, { dataStore } : Helpers) {

    router.url('/api/v1/cluster');

    router.get('/latest_snapshot', (req, res) => {

        return context.configAccessor.getLatestSnapshotId()
            .then(snapshotId => {
                if (!snapshotId) {
                    return null;
                }

                return {
                    snapshot_id: snapshotId
                }
            });
    })
    ;

    router.get('/snapshots', (req, res) => {
        return dataStore.table(dataStore.snapshots.Snapshots)
            .queryMany({}, {
                fields : { 
                    fields: [
                        'snapshot_id',
                        'date'
                    ]
                },
                skipCache: true
            })
            .then(results => {
                for(const x of results) {
                    (<any>x).snapshot_id = BufferUtils.toStr(x.snapshot_id!);
                }
                return _.orderBy(results, x => x.date, ['desc']);
            });
    })    
    ;
   
}