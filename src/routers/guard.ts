import _ from 'the-lodash';
import { ILogger } from 'the-logger';
import { Promise } from 'the-promise';
import { Context } from '../context';
import { Router } from '@kubevious/helper-backend';
import { Helpers } from '../server';
import { QueryOptions } from '@kubevious/easy-data-store/dist/driver';
import { ChangePackageListItem, ChangePackageListResult } from '@kubevious/ui-middleware/dist/services/guard';
import { ValidationState } from '@kubevious/ui-middleware/dist/entities/guard';

const LIMIT_COUNT = 100;

export default function (router: Router, context: Context,  logger: ILogger, { dataStore } : Helpers) {

    router.url('/api/v1/guard');

    router.get<any, any, { last_id? : string }>('/changes', (req, res) => {

        const queryOptions : QueryOptions = {
            fields: { fields: ['change_id', 'date', 'summary'] },
            filters: { fields: [] },
            order: { fields: [{ name: 'date', asc: false }]},
            limitCount: LIMIT_COUNT,
        }

        if (req.query.lastId) {
            queryOptions.filters!.fields!.push({
                name: 'string',
                operator: '<',
                value: req.query.last_id
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
                                result.nextId = last_item.change_id;
                            }
                        }

                        return Promise.serial(rows, row => {
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
    ;
    
}

