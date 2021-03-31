import _ from 'the-lodash';
import { Promise } from 'the-promise';
import { ILogger } from 'the-logger' ;

import { Context } from '../context';

import { ExecutionContext, RuleResult as RuleEngineRuleResult } from '@kubevious/helper-rule-engine';

export type UserRule = Record<string, any>;

export type UserRuleStatus = Record<string, any>;
export type UserRuleResult = Record<string, any>;

export interface MyRuleResult {
    engineResult: RuleEngineRuleResult
}

export class RuleCache
{
    private _logger : ILogger;
    private _context : Context;

    private _userRules : any[] = [];
    
    private _ruleConfigDict : Record<string, any> = {};
    private _engineRuleResultsDict : Record<string, RuleEngineRuleResult> = {};

    private _listRuleStatuses : UserRuleStatus[] = [];
    private _ruleResultsDict : Record<string, UserRuleResult> = {};

    constructor(context : Context)
    {
        this._context = context;
        this._logger = context.logger.sublogger("RuleCache");

        context.database.onConnect(this._onDbConnected.bind(this));
    }

    get logger() {
        return this._logger;
    }

    private _onDbConnected()
    {
        this._logger.info("[_onDbConnected] ...");

        return Promise.resolve()
            .then(() => this._refreshRuleConfigs())
            .then(() => this._refreshExecutionStatuses())
            .then(() => this._recalculateRuleList())
            .then(() => this._notifyRuleResults())
    }

    triggerListUpdate()
    {
        return Promise.resolve()
            .then(() => this._refreshRuleConfigs())
            .then(() => this._recalculateRuleList())
            .then(() => this._notifyRuleResults())
    }

    private _refreshRuleConfigs()
    {
        return this._context.ruleAccessor.queryAll()
            .then(result => {
                this._ruleConfigDict = _.makeDict(result, x => x.name, x => x);
            })
            ;
    }

    private _recalculateRuleList()
    {
        this._userRules = this._buildRuleList();
        this._listRuleStatuses = this._buildRuleStatusList();

        this._context.websocket.update({ kind: 'rules-statuses' }, this.queryRuleStatusList());
    }

    queryRuleList()
    {
        return this._userRules;
    }

    queryRuleStatusList()
    {
        return this._listRuleStatuses;
    }

    queryRule(name: string) : UserRule | null
    {
        var rule = this._ruleConfigDict[name];
        if (!rule) {
            return null;
        }
        var userRule = this._buildRuleConfig(rule);
        return userRule;
    }

    private _buildRuleList() : UserRule[]
    {
        var userRules : UserRule[] = [];
        for(var rule of _.values(this._ruleConfigDict))
        {
            var userRule = {
                name: rule.name
            }
            userRules.push(userRule);
        }
        userRules = _.orderBy(userRules, x => x.name);
        return userRules;
    }

    private _buildRuleStatusList() : UserRuleStatus[]
    {
        var userRules = [];
        for(var rule of _.values(this._ruleConfigDict))
        {
            var userRule = this._buildRuleStatus(rule.name);
            userRules.push(userRule);
        }

        userRules = _.orderBy(userRules, x => x.name);

        return userRules;
    }

    private _refreshExecutionStatuses()
    {
        let executionContext : ExecutionContext = {
            rules: {},
            markers: {}
        }

        return Promise.all([
            this._context.ruleAccessor.queryAllRuleStatuses()
                .then(result => {
                    for(let row of result)
                    {
                        const ruleResult = this._getRuleResult(executionContext, row.rule_name);
                        ruleResult.error_count = row.error_count;
                    }
                }),
            this._context.ruleAccessor.queryAllRuleItems()
                .then(result => {
                    for(let row of result)
                    {
                        const ruleResult = this._getRuleResult(executionContext, row.rule_name);
                        ruleResult.items.push({
                            errors: row.errors,
                            warnings: row.warnings,
                            markers: row.markers,
                            dn: row.dn
                        })
                    }
                }),
            this._context.ruleAccessor.queryAllRuleLogs()
                .then(result => {
                    for(let row of result)
                    {
                        const ruleResult = this._getRuleResult(executionContext, row.rule_name);
                        ruleResult.logs.push({
                            kind: row.kind,
                            msg: row.msg
                        })
                    }
                })
        ])
        .then(() => this._acceptExecutionContext(executionContext));
    }

    private _getRuleResult(executionContext : ExecutionContext, name: string) : RuleEngineRuleResult
    {
        let value = executionContext.rules[name];
        if (value) {
            return value;
        }
        value = {
            name: name,
            items: [],
            logs: [],
            markers: {},
            error_count: 0
        }
        executionContext.rules[name] = value;
        return value;
    }

    acceptExecutionContext(executionContext: ExecutionContext)
    {
        this._acceptExecutionContext(executionContext);
        this._recalculateRuleList();
        this._notifyRuleResults();
    }

    private _acceptExecutionContext(executionContext: ExecutionContext)
    {
        this._engineRuleResultsDict = executionContext.rules;
    }

    private _notifyRuleResults()
    {
        this._ruleResultsDict = {};
        for(var rule of _.values(this._ruleConfigDict))
        {
            this._ruleResultsDict[rule.name] = this._buildRuleResult(rule.name);
        }

        var data = _.values(this._ruleResultsDict).map(x => ({
            target: { name: x.name },
            value: x
        }));

        return this._context.websocket.updateScope({ kind: 'rule-result' }, data);
    }

    getRuleResult(name: string)
    {
        if (this._ruleResultsDict[name]) {
            return this._ruleResultsDict[name];
        }
        return null;
    }

    private _buildRuleConfig(rule: any) : UserRule
    {
        var userRule = {
            name: rule.name,
            target: rule.target,
            script: rule.script,
            enabled: rule.enabled
        }
        return userRule;
    }

    private _buildRuleStatus(name: string) : UserRuleStatus
    {
        var info : any = {
            name: name,
            enabled: false,
            is_current: false,
            error_count: 0,
            item_count: 0,
        };

        var ruleConfig = this._ruleConfigDict[name];
        if (ruleConfig)
        {
            info.enabled = ruleConfig.enabled;
            if (ruleConfig.enabled)
            {
                var ruleExecResult = this._engineRuleResultsDict[name];
                if (ruleExecResult)
                {
                    info.item_count = ruleExecResult.items.length;
                    info.error_count = ruleExecResult.logs.length;

                    // var status = ruleExecResult.status;
                    // if (status)
                    // {
                    //     if (ruleConfig.hash == status.hash) {
                    //         info.is_current = true;
                    //     }
                    // }
                }
            }
            else
            {
                info.is_current = true;
            }
        }

        return info;
    }

    private _buildRuleResult(name: string) : UserRuleResult
    {
        var info : any = {
            name: name,
            enabled: false,
            is_current: false,
            error_count: 0,
            items: [],
            logs: []
        };

        var ruleConfig = this._ruleConfigDict[name];
        if (ruleConfig)
        {
            info.enabled = ruleConfig.enabled;
            if (ruleConfig.enabled)
            {
                var ruleExecResult = this._engineRuleResultsDict[name];
                if (ruleExecResult)
                {
                    info.error_count = ruleExecResult.logs.length;

                    // var status = ruleExecResult.status;
                    // if (status)
                    // {
                    //     if (ruleConfig.hash == status.hash) {
                    //         info.is_current = true;
                    //     }
                    // }
    
                    info.items = ruleExecResult.items.map(x => {
                        return {
                            dn: x.dn,
                            has_error: (x.errors > 0),
                            has_warning: (x.warnings > 0),
                            markers: x.markers
                        }
                    });
                    info.logs = ruleExecResult.logs;
                }
            }
            else
            {
                info.is_current = true;
            }
        }

        return info;
    }
}