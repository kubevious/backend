import _ from 'the-lodash';
import { ILogger } from 'the-logger';
import { Context } from '../context';
import { Router } from '@kubevious/helper-backend'
import Joi from 'joi';

import { BufferUtils, NodeHistoryReader } from '@kubevious/data-models';

import { Helpers } from '../server';

import { PartitionUtils } from '@kubevious/data-models';

export default function (router: Router, context: Context, logger: ILogger, { dataStore } : Helpers) {

    router.url('/api/v1/history');
    
    router.get<{}, any, any>('/timeline_preview', (req, res) => {

        const startPartId = getStartPartitionId();

        return dataStore.table(dataStore.snapshots.Timeline)
            .queryMany(
                {},
                {
                    fields: { 
                        fields: ['date', 'changes', 'error', 'warn'] 
                    },
                    filters: {
                        fields: [
                            {
                                name: 'part',
                                operator: '>=',
                                value: startPartId
                            }
                        ]
                    }
                }
            )
            .then(results => {
                // for(let x of results)
                // {
                //     (<any>x).snapshot_id = BufferUtils.toStr(x.snapshot_id!);
                // }
                // return results;

                return context.seriesResamplerHelper.process(results);
            });
    })
    ;


    router.get<{}, any, TimelineQuery >('/timeline', (req, res) => {

        const startPartId = getStartPartitionId();

        const partitionFrom = Math.max(PartitionUtils.getPartitionIdFromDate(req.query.from), startPartId);
        const partitionTo = PartitionUtils.getPartitionIdFromDate(req.query.to);

        return dataStore.table(dataStore.snapshots.Timeline)
            .queryMany(
                {},
                {
                    fields: { fields: ['date', 'changes', 'error', 'warn'] }, 
                    filters: {
                        fields: [
                            {
                                name: 'date',
                                operator: '>=',
                                value: req.query.from
                            },
                            {
                                name: 'date',
                                operator: '<=',
                                value: req.query.to
                            },
                            {
                                name: 'part',
                                operator: '>=',
                                value: partitionFrom
                            },
                            {
                                name: 'part',
                                operator: '<=',
                                value: partitionTo
                            }
                        ]
                    }
                }
            )
            .then(results => {
                return context.seriesResamplerHelper.process(results);
            });
    })
    .querySchema(Joi.object({
        from: Joi.string().required(),
        to: Joi.string().required(),
    }))
    ;


    router.get<{}, any, SnapshotAtDateQuery>('/snapshot_at_date', (req, res) => {
        const part = PartitionUtils.getPartitionIdFromDate(req.query.date);
        return getSnapshot(part, req.query.date)
            .then(row => {
                if (row) {
                    return row;
                }

                return getSnapshot(part - 1, req.query.date);
            })
            .then(row => {
                if (row) {
                    return {
                        snapshot_id: BufferUtils.toStr(row.snapshot_id!),
                        date: row.date!
                    }
                }

                return null;
            });
    })
    .querySchema(Joi.object({
        date: Joi.string().isoDate().required(),
    }))
    ;

    
    router.get<{ }, any, NodeHistoryQuery >('/node', (req, res) => {

        return context.tracker.scope("history-node-query", () => {
            const reader = makeNodeHistoryReader(req.query);
            return reader.queryNode();
        });

    })    
    .querySchema(Joi.object({
        dn: Joi.string().required(),
        token: Joi.string().optional(),
    }));

    
    router.get<{}, any, NodeHistoryQuery >('/hierarchy', (req, res) => {

        return context.tracker.scope("history-hierarchy-query", () => {
            const reader = makeNodeHistoryReader(req.query);
            return reader.queryHierarchy();
        });

    })    
    .querySchema(Joi.object({
        dn: Joi.string().required(),
        token: Joi.string().optional(),
    }));


    function getSnapshot(part: number, date: string)
    {
        return dataStore.table(dataStore.snapshots.Snapshots)
            .queryMany({ part: part }, {
                filters: {
                    fields: [
                        {
                            name: 'date',
                            operator: '<=',
                            value: date
                        }
                    ]
                }
            })
            .then(rows => {
                if (rows.length == 0) {
                    return null;
                }
                return _.chain(rows)
                    .orderBy(x => x.date, 'desc')
                    .head()
                    .value();
            })
            ;
    }


    function getStartPartitionId()
    {
        return PartitionUtils.getRelativePartitionId(15);
    }

    function makeNodeHistoryReader(query: NodeHistoryQuery)
    {
        const reader = new NodeHistoryReader(
            logger, 
            context.dataStore.dataStore,
            context.dataStore.snapshots,
            context.executionLimiter,
            query.dn,
            query.token);
        return reader;
    }

}



export interface TimelineQuery
{
    from: string,
    to: string
}

export interface SnapshotAtDateQuery
{
    date: string
}

export interface TimelinePoint
{
    date: string,
    changes: number,
    error: number,
    warn: number
}

interface NodeHistoryQuery
{
    dn: string,
    token?: string,
}