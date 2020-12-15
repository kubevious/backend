import _ from 'the-lodash';
import { Promise } from 'the-promise';
import { ILogger } from 'the-logger' ;

import { Context } from '../context';

import { DataStore, DataStoreTableSynchronizer } from '@kubevious/easy-data-store';
import { RegistryState } from '@kubevious/helpers/dist/registry-state';
import { ProcessingTrackerScoper } from '@kubevious/helpers/dist/processing-tracker';
import { ExecutionContext } from './execution-context';

const KubikRuleProcessor = require('kubevious-kubik').RuleProcessor;

export type RuleItem = Record<string, any>;

export class RuleProcessor
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

        var executionContext = {
            ruleStatuses: {},
            ruleItems: [],
            ruleLogs: [],
            markerItems: []
        }

        return this._fetchRules()
            .then(rules => {
                return tracker.scope("execute", (childTracker) => {
                    return this._processRules(state, rules, executionContext, childTracker);
                });
            })
            .then(() => this._saveRuleData(executionContext))
            .then(() => this._context.ruleCache.acceptExecutionContext(executionContext))
            .then(() => this._context.markerCache.acceptExecutionContext(executionContext))
            .then(() => {
                this.logger.info('[execute] END');
            })
    }

    private _fetchRules() : Promise<RuleItem[]>
    {
        return this._context.ruleAccessor
            .queryEnabledRules();
    }

    private _processRules(state : RegistryState, rules: RuleItem[], executionContext : ExecutionContext, tracker: ProcessingTrackerScoper)
    {
        return Promise.serial(rules, x => {

            return tracker.scope(x.name, (childTracker) => {
                return this._processRule(state, x, executionContext)
            });

        });
    }
    
    private _processRule(state: RegistryState, rule: RuleItem, executionContext : ExecutionContext)
    {
        this.logger.info('[_processRule] Begin: %s', rule.name);
        this.logger.verbose('[_processRule] Begin: ', rule);

        executionContext.ruleStatuses[rule.name] = {
            rule_name: rule.name,
            hash: rule.hash,
            date: new Date(),
            error_count: 0,
            item_count: 0
        };

        var processor = new KubikRuleProcessor(state, rule);
        return processor.process()
            .then((result : any) => {
                this.logger.silly('[_processRule] RESULT: ', result);
                this.logger.silly('[_processRule] RESULT ITEMS: ', result.ruleItems);

                if (result.success)
                {
                    for(var dn of _.keys(result.ruleItems))
                    {
                        this.logger.debug('[_processRule] RuleItem: %s', dn);

                        var ruleItemInfo = result.ruleItems[dn];

                        let ruleItem : RuleItem = {
                            errors: 0,
                            warnings: 0
                        };

                        var alertsToRaise = [];

                        if (ruleItemInfo.errors) {

                            if (ruleItemInfo.errors.messages &&
                                ruleItemInfo.errors.messages.length > 0)
                            {
                                ruleItem.errors = ruleItemInfo.errors.messages.length;
                                for(var msg of ruleItemInfo.errors.messages)
                                {
                                    alertsToRaise.push({ 
                                        severity: 'error',
                                        message:  'Rule ' + rule.name + ' failed. ' + msg
                                    });
                                }
                            }
                            else
                            {
                                ruleItem.errors = 1;
                                alertsToRaise.push({ 
                                    severity: 'error',
                                    message:  'Rule ' + rule.name + ' failed.'
                                });
                            }
                        }
                        else if (ruleItemInfo.warnings)
                        {
                            if (ruleItemInfo.warnings.messages && 
                                ruleItemInfo.warnings.messages.length > 0)
                            {
                                ruleItem.warnings = ruleItemInfo.warnings.messages.length;
                                for(var msg of ruleItemInfo.warnings.messages)
                                {
                                    alertsToRaise.push({ 
                                        severity: 'warn',
                                        message:  'Rule ' + rule.name + ' failed. ' + msg
                                    });
                                }
                            }
                            else
                            {
                                ruleItem.warnings = 1;
                                alertsToRaise.push({ 
                                    severity: 'warn',
                                    message:  'Rule ' + rule.name + ' failed.'
                                });
                            }
                        }

                        var shouldUseRuleItem = false;

                        for(var alertInfo of alertsToRaise)
                        {
                            shouldUseRuleItem = true;

                            state.raiseAlert(dn, {
                                id: 'rule-' + rule.name,
                                severity: alertInfo.severity,
                                msg: alertInfo.message,
                                source: {
                                    kind: 'rule',
                                    id: rule.name
                                }
                            });
                        }

                        if (ruleItemInfo.marks)
                        {
                            for(var marker of _.keys(ruleItemInfo.marks))
                            {
                                state.raiseMarker(dn, marker);
                                shouldUseRuleItem = true;
                                if (!ruleItem.markers) {
                                    ruleItem.markers = [];
                                }
                                ruleItem.markers.push(marker);

                                executionContext.markerItems.push({
                                    marker_name: marker,
                                    dn: dn
                                });
                            }
                        }

                        if (shouldUseRuleItem)
                        {
                            executionContext.ruleStatuses[rule.name].item_count++;

                            ruleItem.rule_name = rule.name;
                            ruleItem.dn = dn;
                            executionContext.ruleItems.push(ruleItem);
                        }
                    }
                }
                else
                {
                    this.logger.error('[_processRule] Failed: ', result.messages);

                    for(var msg of result.messages)
                    {
                        executionContext.ruleLogs.push({
                            rule_name: rule.name,
                            kind: 'error',
                            msg: msg
                        });

                        executionContext.ruleStatuses[rule.name].error_count++;
                    }
                }
            });
    }

    private _saveRuleData(executionContext : ExecutionContext)
    {
        return this._context.database.driver.executeInTransaction(() => {
            return Promise.resolve()
                .then(() => this._syncRuleStatuses(executionContext))
                .then(() => this._syncRuleItems(executionContext))
                .then(() => this._syncRuleLogs(executionContext))
                .then(() => this._syncMarkerItems(executionContext));
        });
    }

    private _syncRuleStatuses(executionContext : ExecutionContext)
    {
        this.logger.info('[_syncRuleStatuses] Begin');
        this.logger.debug('[_syncRuleStatuses] Begin', executionContext.ruleStatuses);
        return this._ruleStatusesSynchronizer.execute(_.values(executionContext.ruleStatuses));
    }

    private _syncRuleItems(executionContext : ExecutionContext)
    {
        this.logger.info('[_syncRuleItems] Begin');
        this.logger.debug('[_syncRuleItems] Begin', executionContext.ruleItems);
        return this._ruleItemsSynchronizer.execute(executionContext.ruleItems);
    }

    private _syncRuleLogs(executionContext : ExecutionContext)
    {
        this.logger.info('[_syncRuleLogs] Begin');
        this.logger.debug('[_syncRuleLogs] Begin', executionContext.ruleLogs);
        return this._ruleLogsSynchronizer.execute(executionContext.ruleLogs);
    }

    private _syncMarkerItems(executionContext : ExecutionContext)
    {
        this.logger.info('[_syncRuleItems] Begin');
        this.logger.debug('[_syncRuleItems] Begin', executionContext.markerItems);
        return this._markerItemsSynchronizer.execute(executionContext.markerItems);
    }
    
}
