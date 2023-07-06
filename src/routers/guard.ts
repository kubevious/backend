import _ from 'the-lodash';
import { ILogger } from 'the-logger';
import { Context } from '../context';
import { Router } from '@kubevious/helper-backend';
import { Helpers } from '../server';
import { QueryOptions } from '@kubevious/easy-data-store/dist/driver';
import { ChangePackageListItem, ChangePackageListResult, ChangePackageItemDetails } from '@kubevious/ui-middleware/dist/services/guard';
import { ValidationState } from '@kubevious/ui-middleware/dist/entities/guard';
import Joi from 'joi';
import { MyPromise } from 'the-promise';

const LIMIT_COUNT = 25;

export default function (router: Router, context: Context,  logger: ILogger, { dataStore } : Helpers) {

    router.url('/api/v1/guard');

    router.get<any, any, { nextToken? : number }>('/changes', (req, res) => {

        const queryOptions : QueryOptions = {
            fields: { fields: ['id', 'change_id', 'date', 'summary'] },
            filters: { fields: [] },
            order: { fields: [{ name: 'date', asc: false }]},
            limitCount: LIMIT_COUNT,
        }

        if (req.query.nextToken) {
            queryOptions.filters!.fields!.push({
                name: 'id',
                operator: '<',
                value: req.query.nextToken
            })
        }

        const result: ChangePackageListResult = {
            totalCount: 0,
            items: [],
        };

        return Promise.resolve()
            .then(() => {
                return dataStore.guard.ChangePackage.table()
                    .queryCount()
                    .then(count => {
                        result.totalCount = count;
                    });
            })
            .then(() => {
                return dataStore.guard.ChangePackage.table()
                    .queryMany({}, queryOptions)
                    .then(rows => {

                        if (rows.length === LIMIT_COUNT)
                        {
                            const last_item = _.last(rows);
                            if (last_item) {
                                result.nextToken = last_item.id;
                            }
                        }

                        return MyPromise.serial(rows, row => {
                            return dataStore.guard.ValidationState.table()
                                .queryOne({ change_id: row.change_id! })
                                .then(stateRow => {
                                    if (!stateRow) {
                                        const result : ChangePackageListItem = {
                                            change_id: row.change_id!,
                                            date: new Date(row.date!).toISOString(),
                                            state: ValidationState.pending,
                                            changeSummary: row.summary!
                                        }
                                        return result;
                                    } else {
                                        const result : ChangePackageListItem = {
                                            change_id: row.change_id!,
                                            date: new Date(row.date!).toISOString(),
                                            changeSummary: row.summary!,
                                            state: stateRow.state!,
                                            success: stateRow.success ? true : false,
                                            validationSummary: stateRow.summary!
                                        }
                                        return result;
                                    }
                                });
                        })
                        .then(items => {
                            result.items = items;
                        })
                    });
            })
            .then(() => result);
    })
    .querySchema(Joi.object({
        nextToken: Joi.number().optional(),
    }))
    ;
    

    router.get<any, any, { id : string }>('/change/details', (req, res) => {

        const changeId = req.query.id;

        return dataStore.guard.ChangePackage.table()
            .queryOne({ change_id: changeId })
            .then(changePackage => {
                if (!changePackage) {
                    return null;
                }

                return dataStore.guard.ValidationState.table()
                    .queryOne({ change_id: changeId })
                    .then(stateRow => {
                        if (!stateRow) {
                            const result : ChangePackageItemDetails = {
                                change_id: changeId,
                                date: new Date(changePackage.date!).toISOString(),
                                state: ValidationState.pending,
                                changeSummary: changePackage.summary!,

                                charts: changePackage.charts!,
                                changes: changePackage.changes!,
                                deletions: changePackage.deletions!,
                            }
                            return result;
                        } else {
                            const result : ChangePackageItemDetails = {
                                change_id: changeId,
                                date: new Date(changePackage.date!).toISOString(),
                                state: stateRow.state!,
                                changeSummary: changePackage.summary!,
                                
                                charts: changePackage.charts!,
                                changes: changePackage.changes!,
                                deletions: changePackage.deletions!,

                                success: stateRow.success ? true : false,
                                validationSummary: stateRow.summary!,
                                newIssues: stateRow.newIssues,
                                clearedIssues: stateRow.clearedIssues
                            }
                            return result;
                        }
                    });
            });

    })
    .querySchema(Joi.object({
        id: Joi.string().required(),
    }));
}

