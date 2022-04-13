import _ from 'the-lodash';
import { Promise } from 'the-promise';
import { ILogger } from 'the-logger' ;

import { Context } from '../../context';

import { RuleObject } from './types';

import { RuleStatusRow } from '@kubevious/data-models/dist/models/rule_engine';
import { makeDbRulesRow } from '@kubevious/data-models/dist/accessors/rules-engine';

import { Database } from '../../db';
import { RuleStatus, RuleResult } from '@kubevious/ui-middleware/dist/services/rule'

import { RuleConfig, RulesExportData } from '@kubevious/ui-middleware/dist/services/rule'


export class RuleAccessor
{
    private _logger : ILogger;
    private _dataStore : Database;

    constructor(context : Context)
    {
        this._logger = context.logger.sublogger("RuleAccessor");
        this._dataStore = context.dataStore;
    }

    get logger() {
        return this._logger;
    }

    queryAll()
    {
        return this._dataStore.table(this._dataStore.ruleEngine.Rules)
            .queryMany({}, 
                {
                    fields: { fields: [ 'name', 'enabled' ]}
                });
    }

    queryEnabledRules() : Promise<RuleObject[]>
    {
        return <Promise<RuleObject[]>>(<any>(this._dataStore.table(this._dataStore.ruleEngine.Rules)
            .queryMany({ enabled: true })));
    }

    queryAllRuleStatuses()
    {
        return this._dataStore.table(this._dataStore.ruleEngine.RuleStatuses)
            .queryMany();
    }

    queryAllRuleItems()
    {
        return this._dataStore.table(this._dataStore.ruleEngine.RuleItems)
            .queryMany();
    }

    queryAllRuleLogs()
    {
        return this._dataStore.table(this._dataStore.ruleEngine.RuleLogs)
            .queryMany();
    }

    getRule(name: string)
    {
        return this._dataStore.table(this._dataStore.ruleEngine.Rules)
            .queryOne({ name: name },
                {
                    fields: { fields: [ 'name', 'target', 'script', 'enabled' ]}
                });
    }

    createRule(config: RuleConfig, targetName: string)
    {
        return Promise.resolve()
            .then((() => {
                if (targetName) {
                    if (config.name != targetName) {
                        return this._dataStore.table(this._dataStore.ruleEngine.Rules)
                            .delete({ name: targetName });
                    }
                }
            }))
            .then(() => {
                const ruleRow = makeDbRulesRow(config);
                return this._dataStore.table(this._dataStore.ruleEngine.Rules)
                    .create(ruleRow);
            });
    }

    deleteRule(name: string)
    {
        return this._dataStore.table(this._dataStore.ruleEngine.Rules)
            .delete({ name: name });
    }

    exportRules()
    {
        return this._dataStore.table(this._dataStore.ruleEngine.Rules)
        .queryMany({}, 
            {
                fields: { fields: [ 'name', 'enabled', 'target', 'script' ]}
            })
            .then(result => {
                const data : RulesExportData = {
                    kind: 'rules',
                    items: result.map(x => ({
                        name: x.name!,
                        script: x.script!,
                        target: x.target!,
                        enabled: x.enabled!,
                    })),
                };
                return data;
            });
    }

    importRules(rules: RulesExportData, deleteExtra: boolean)
    {
        const items = rules.items.map(x => makeDbRulesRow(x));
        return this._dataStore.table(this._dataStore.ruleEngine.Rules)
            .synchronizer({}, !deleteExtra)
            .execute(items);
    }

    getRulesStatuses()
    {
        return this._dataStore.table(this._dataStore.ruleEngine.Rules)
            .queryMany({})
            .then(ruleRows => {

                return this._dataStore.table(this._dataStore.ruleEngine.RuleStatuses)
                .queryMany({})
                .then(statusesRows => {

                    const ruleStatusesDict : Record<string, Partial<RuleStatusRow>[]> = {};
                    for(const row of statusesRows)
                    {
                        if (!ruleStatusesDict[row.rule_name!]) {
                            ruleStatusesDict[row.rule_name!] = [];
                        }
                        ruleStatusesDict[row.rule_name!].push(row);
                    }

                    const results : RuleStatus[] = [];

                    for(const ruleRow of ruleRows)
                    {
                        const statuses = ruleStatusesDict[ruleRow.name!] || [];

                        const matchingHashes = _.filter(statuses, x => x.hash!.equals(ruleRow.hash!));

                        results.push({
                            name: ruleRow.name!,
                            enabled: ruleRow.enabled!,
                            is_current: (matchingHashes.length > 0),
                            error_count: _.sumBy(statuses, x => x.error_count!),
                            item_count: _.sumBy(statuses, x => x.item_count!),
                        })
                    }

                    return results;

                });

            })
    }

    getRuleResult(name: string)
    {
        return this._dataStore.table(this._dataStore.ruleEngine.Rules)
        .queryOne({ name: name }, {
            fields: {
                fields: ['name', 'enabled']
            }
        })
        .then(ruleRow => {
            if (!ruleRow) {
                return null;
            }

            const result : RuleResult = {
                name: ruleRow.name!,
                items: [],
                is_current: true,
                error_count: 0,
                logs: []
            };

            return Promise.resolve()
                .then(() => {
                    return this._dataStore.table(this._dataStore.ruleEngine.RuleItems)
                        .queryMany({ rule_name: name })
                        .then(rows => {
                            for(const row of rows)
                            {
                                result.items.push({
                                    dn: row.dn!,
                                    errors: row.errors,
                                    warnings: row.warnings,
                                    markers: row.markers || undefined
                                });
                            }
                        })
                })
                .then(() => {
                    return this._dataStore.table(this._dataStore.ruleEngine.RuleLogs)
                        .queryMany({ rule_name: name })
                        .then(rows => {
                            for(const row of rows)
                            {
                                result.logs.push({
                                    kind: row.kind!,
                                    msg: row.msg
                                });
                            }
                        })
                })
                .then(() => result);
        })
    }
}