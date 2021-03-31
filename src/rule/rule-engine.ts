import _ from 'the-lodash';
import { Promise } from 'the-promise';
import { ILogger } from 'the-logger' ;

import { Context } from '../context';

import { DataStore, DataStoreTableSynchronizer } from '@kubevious/easy-data-store';
import { RegistryState } from '@kubevious/helpers/dist/registry-state';
import { ProcessingTrackerScoper } from '@kubevious/helpers/dist/processing-tracker';

import { RulesProcessor, ExecutionContext } from '@kubevious/helper-rule-engine';
import { RuleItem, RuleObject } from './types';


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
            .then(() => this._context.ruleCache.acceptExecutionContext(executionContext))
            .then(() => this._context.markerCache.acceptExecutionContext(executionContext))
    }
    
    // private _processRule(state: RegistryState, rule: RuleObject, executionContext : ExecutionContext)
    // {
    //     this.logger.info('[_processRule] Begin: %s', rule.name);
    //     this.logger.verbose('[_processRule] Begin: ', rule);

    //     executionContext.ruleStatuses[rule.name] = {
    //         rule_name: rule.name,
    //         hash: rule.hash,
    //         date: new Date(),
    //         error_count: 0,
    //         item_count: 0
    //     };

    //     let processor = new KubikRuleProcessor(state, rule);
    //     return processor.process()
    //         .then((result) => {
    //             this.logger.silly('[_processRule] RESULT: ', result);
    //             this.logger.silly('[_processRule] RESULT ITEMS: ', result.ruleItems);

    //             if (result.success)
    //             {
    //                 for(let dn of _.keys(result.ruleItems))
    //                 {
    //                     this.logger.debug('[_processRule] RuleItem: %s', dn);

    //                     let ruleItemInfo = result.ruleItems[dn];

    //                     let ruleItem : RuleItem = {
    //                         errors: 0,
    //                         warnings: 0
    //                     };

    //                     let alertsToRaise = [];

    //                     if (ruleItemInfo.errors) {

    //                         if (ruleItemInfo.errors.messages &&
    //                             ruleItemInfo.errors.messages.length > 0)
    //                         {
    //                             ruleItem.errors = ruleItemInfo.errors.messages.length;
    //                             for(let msg of ruleItemInfo.errors.messages)
    //                             {
    //                                 alertsToRaise.push({ 
    //                                     severity: 'error',
    //                                     message:  'Rule ' + rule.name + ' failed. ' + msg
    //                                 });
    //                             }
    //                         }
    //                         else
    //                         {
    //                             ruleItem.errors = 1;
    //                             alertsToRaise.push({ 
    //                                 severity: 'error',
    //                                 message:  'Rule ' + rule.name + ' failed.'
    //                             });
    //                         }
    //                     }
    //                     else if (ruleItemInfo.warnings)
    //                     {
    //                         if (ruleItemInfo.warnings.messages && 
    //                             ruleItemInfo.warnings.messages.length > 0)
    //                         {
    //                             ruleItem.warnings = ruleItemInfo.warnings.messages.length;
    //                             for(let msg of ruleItemInfo.warnings.messages)
    //                             {
    //                                 alertsToRaise.push({ 
    //                                     severity: 'warn',
    //                                     message:  'Rule ' + rule.name + ' failed. ' + msg
    //                                 });
    //                             }
    //                         }
    //                         else
    //                         {
    //                             ruleItem.warnings = 1;
    //                             alertsToRaise.push({ 
    //                                 severity: 'warn',
    //                                 message:  'Rule ' + rule.name + ' failed.'
    //                             });
    //                         }
    //                     }

    //                     let shouldUseRuleItem = false;

    //                     for(let alertInfo of alertsToRaise)
    //                     {
    //                         shouldUseRuleItem = true;

    //                         state.raiseAlert(dn, {
    //                             id: 'rule-' + rule.name,
    //                             severity: alertInfo.severity,
    //                             msg: alertInfo.message,
    //                             source: {
    //                                 kind: 'rule',
    //                                 id: rule.name
    //                             }
    //                         });
    //                     }

    //                     if (ruleItemInfo.marks)
    //                     {
    //                         for(let marker of _.keys(ruleItemInfo.marks))
    //                         {
    //                             state.raiseMarker(dn, marker);
    //                             shouldUseRuleItem = true;
    //                             if (!ruleItem.markers) {
    //                                 ruleItem.markers = [];
    //                             }
    //                             ruleItem.markers.push(marker);

    //                             executionContext.markerItems.push({
    //                                 marker_name: marker,
    //                                 dn: dn
    //                             });
    //                         }
    //                     }

    //                     if (shouldUseRuleItem)
    //                     {
    //                         executionContext.ruleStatuses[rule.name].item_count++;

    //                         ruleItem.rule_name = rule.name;
    //                         ruleItem.dn = dn;
    //                         executionContext.ruleItems.push(ruleItem);
    //                     }
    //                 }
    //             }
    //             else
    //             {
    //                 this.logger.error('[_processRule] Failed: ', result.messages);

    //                 for(let msg of result.messages)
    //                 {
    //                     executionContext.ruleLogs.push({
    //                         rule_name: rule.name,
    //                         kind: 'error',
    //                         msg: msg
    //                     });

    //                     executionContext.ruleStatuses[rule.name].error_count++;
    //                 }
    //             }
    //         });
    // }

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
