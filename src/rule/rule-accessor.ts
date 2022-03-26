import _ from 'the-lodash';
import { Promise } from 'the-promise';
import { ILogger } from 'the-logger' ;

import { Context } from '../context';


import { HashUtils } from '@kubevious/data-models';
import { RuleObject } from './types';

import { RulesRow } from '@kubevious/data-models/dist/models/rule_engine';

import { Database } from '../db';

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
            .queryMany();
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
            .queryOne({ name: name });
    }

    createRule(config: any, target: any)
    {
        return Promise.resolve()
            .then((() => {
                if (target) {
                    if (config.name != target.name) {
                        return this._dataStore.table(this._dataStore.ruleEngine.Rules)
                            .delete(target);
                    }
                }
            }))
            .then(() => {
                const ruleObj = this.makeDbRule(config);
                return this._dataStore.table(this._dataStore.ruleEngine.Rules)
                    .create(ruleObj);
            });
    }

    deleteRule(name: string)
    {
        return this._dataStore.table(this._dataStore.ruleEngine.Rules)
            .delete({ name: name });
    }

    exportRules()
    {
        return this.queryAll()
            .then(result => {
                return {
                    kind: 'rules',
                    items: result.map(x => ({
                        name: x.name,
                        script: x.script,
                        target: x.target,
                        enabled: x.enabled,
                    })),
                };
            });
    }

    importRules(rules: { items: any[] }, deleteExtra: boolean)
    {
        const items = rules.items.map(x => this.makeDbRule(x));
        return this._dataStore.table(this._dataStore.ruleEngine.Rules)
            .synchronizer({}, !deleteExtra)
            .execute(items);
    }

    makeDbRule(rule: any)
    {
        const ruleObj : Partial<RulesRow> = {
            name: rule.name,
            enabled: rule.enabled,
            target: rule.target,
            script: rule.script,
            date: new Date()
        }
        const hash = HashUtils.calculateObjectHash(ruleObj);
        ruleObj.hash = hash;
        return ruleObj;
    }

}