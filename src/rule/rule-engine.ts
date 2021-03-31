import _ from 'the-lodash';
import { Promise } from 'the-promise';
import { ILogger } from 'the-logger' ;

import { Context } from '../context';

import { DataStore, DataStoreTableSynchronizer } from '@kubevious/easy-data-store';
import { RegistryState } from '@kubevious/helpers/dist/registry-state';
import { ProcessingTrackerScoper } from '@kubevious/helpers/dist/processing-tracker';

import { RulesProcessor, ExecutionContext } from '@kubevious/helper-rule-engine';
import { RuleObject } from './types';

export class RuleEngine
{
    private _logger : ILogger;
    private _context : Context;

    private _ruleStatusesSynchronizer : DataStoreTableSynchronizer;
    private _ruleItemsSynchronizer : DataStoreTableSynchronizer;
    private _ruleLogsSynchronizer : DataStoreTableSynchronizer;
    private _markerItemsSynchronizer : DataStoreTableSynchronizer;

    constructor(context: Context, dataStore: DataStore)
    {
        this._context = context;
        this._logger = context.logger.sublogger("RuleProcessor");

        this._ruleStatusesSynchronizer = 
            dataStore.table('rule_statuses')
                .synchronizer();

        this._ruleItemsSynchronizer = 
            dataStore.table('rule_items')
                .synchronizer();

        this._ruleLogsSynchronizer = 
            dataStore.table('rule_logs')
                .synchronizer();

        this._markerItemsSynchronizer = 
            dataStore.table('marker_items')
                .synchronizer();
    }

    get logger() {
        return this._logger;
    }

    execute(state : RegistryState, tracker : ProcessingTrackerScoper)
    {
        this._logger.info("[execute] date: %s, count: %s", 
            state.date.toISOString(),
            state.getCount())

        let rulesDict : Record<string, RuleObject> = {};

        return this._fetchRules()
            .then(rules => {
                rulesDict = _.makeDict(rules, x => x.name, x => x);
                const processor = new RulesProcessor(this._logger, rules)
                return processor.execute(state, tracker)
            })
            .then(executionContext => {
                return this._postProcess(executionContext, rulesDict);
            })
            .then(() => {
                this.logger.info('[execute] END');
            })
    }

    private _fetchRules() : Promise<RuleObject[]>
    {
        return this._context.ruleAccessor
            .queryEnabledRules();
    }

    private _postProcess(executionContext: ExecutionContext, rulesDict: Record<string, RuleObject>)
    {
        return Promise.resolve()
            .then(() => this._saveRuleData(executionContext, rulesDict))
            .then(() => this._context.ruleCache.acceptExecutionContext(executionContext, rulesDict))
            .then(() => this._context.markerCache.acceptExecutionContext(executionContext))
    }
    
    private _saveRuleData(executionContext : ExecutionContext, rulesDict: Record<string, RuleObject>)
    {
        return this._context.database.driver.executeInTransaction(() => {
            return Promise.resolve()
                .then(() => this._syncRuleStatuses(executionContext, rulesDict))
                .then(() => this._syncRuleItems(executionContext))
                .then(() => this._syncRuleLogs(executionContext))
                .then(() => this._syncMarkerItems(executionContext));
        });
    }

    private _syncRuleStatuses(executionContext : ExecutionContext, rulesDict: Record<string, RuleObject>)
    {
        this.logger.info('[_syncRuleStatuses] Begin');

        const rules = _.values(executionContext.rules);
        const ruleStatuses = 
            _.map(rules, x => ({
                rule_name: x.name,
                hash: rulesDict[x.name].hash,
                date: new Date(),
                error_count: x.error_count,
                item_count: x.items.length
            }))

        this.logger.debug('[_syncRuleStatuses] Rows: ', ruleStatuses);
        return this._ruleStatusesSynchronizer.execute(ruleStatuses);
    }

    private _syncRuleItems(executionContext : ExecutionContext)
    {
        this.logger.info('[_syncRuleItems] Begin');

        const ruleItems : any[] = [];

        for(let rule of _.values(executionContext.rules))
        {
            for(let item of rule.items)
            {
                ruleItems.push({
                    rule_name: rule.name,
                    dn: item.dn,
                    errors: item.errors,
                    warnings: item.warnings,
                    markers: item.markers
                })
            }
        }

        this.logger.debug('[_syncRuleItems] Rows: ', ruleItems);
        return this._ruleItemsSynchronizer.execute(ruleItems);
    }

    private _syncRuleLogs(executionContext : ExecutionContext)
    {
        this.logger.info('[_syncRuleLogs] Begin');

        const ruleLogs : any[] = [];

        for(let rule of _.values(executionContext.rules))
        {
            for(let log of rule.logs)
            {
                ruleLogs.push({
                    rule_name: rule.name,
                    kind: log.kind,
                    msg: log.msg
                })
            }
        }

        this.logger.debug('[_syncRuleLogs] Rows: ', ruleLogs);
        return this._ruleLogsSynchronizer.execute(ruleLogs);
    }

    private _syncMarkerItems(executionContext : ExecutionContext)
    {
        this.logger.info('[_syncRuleItems] Begin');

        const markerItems : any[] = [];

        for(let marker of _.values(executionContext.markers))
        {
            for(let dn of marker.items)
            {
                markerItems.push({
                    marker_name: marker.name,
                    dn: dn
                })
            }
        }

        this.logger.debug('[_syncRuleItems] Row: ', markerItems);
        return this._markerItemsSynchronizer.execute(markerItems);
    }
    
}
