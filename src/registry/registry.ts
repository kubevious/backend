import _ from 'the-lodash';
import { Promise } from 'the-promise';
import { ILogger } from 'the-logger' ;

import { RegistryState } from '@kubevious/helpers/dist/registry-state';

import { Context } from '../context';

export class Registry
{
    private _context : Context;
    private _logger : ILogger;

    private _currentState : RegistryState;

    constructor(context : Context)
    {
        this._context = context;
        this._logger = context.logger.sublogger("Registry");

        this._currentState = new RegistryState({ date: new Date(), items: {}});
    }

    get logger() {
        return this._logger;
    }

    getCurrentState() : RegistryState
    {
        return this._currentState;
    }

    accept(state : RegistryState)
    {
        this._currentState = state;
    }

}