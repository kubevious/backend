import _ from 'the-lodash';
import { Promise } from 'the-promise';
import { ILogger } from 'the-logger' ;

import { Context } from '../../context';
import { WebSocketKind } from '../../server/types';

import { RuleAccessor } from './rule-accessor';

import { RuleConfig, RulesExportData } from '@kubevious/ui-middleware/dist/services/rule'


export class RuleEditor
{
    private _context: Context;
    private _logger : ILogger;

    private _ruleAccessor : RuleAccessor;

    constructor(context: Context)
    {
        this._context = context;
        this._logger = context.logger.sublogger("RuleEditor");

        this._ruleAccessor = context.ruleAccessor;
    }

    get logger() {
        return this._logger;
    }

    createRule(body: RuleConfig, ruleName: string)
    {
        let newMarker : any;
        return this._ruleAccessor
            .createRule(body, ruleName)
            .then(result => {
                newMarker = result;
            })
            .finally(() => this._triggerUpdate())
            .then(() => {
                return newMarker;
            })
    }

    deleteRule(ruleName: string)
    {
        return this._ruleAccessor
            .deleteRule(ruleName)
            .finally(() => this._triggerUpdate())
            .then(() => {
                return {};
            })
    }

    importMarkers(data: RulesExportData, deleteExtra: boolean)
    {
        return this._ruleAccessor
            .importRules(data, deleteExtra)
            .finally(() => this._triggerUpdate())
            .then(() => {
                return {};
            }); 
    }

    private _triggerUpdate()
    {
        this._context.websocket.invalidateAll({ kind: WebSocketKind.rules_statuses });
    }
    
}