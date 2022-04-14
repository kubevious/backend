import _ from 'the-lodash';
import { Promise, Resolvable } from 'the-promise';
import { ILogger } from 'the-logger' ;

import * as fs from 'fs';
import * as Path from 'path';

import { DataStore, DataStoreTableAccessor, MySqlDriver, MySqlStatement } from '@kubevious/easy-data-store';

import { Context } from '../context' ;

import { ConfigAccessors, prepareConfig } from '@kubevious/data-models'
import { NotificationAccessors, prepareNotification } from '@kubevious/data-models'
import { SnapshotsAccessors, prepareSnapshots } from '@kubevious/data-models'
import { RuleEngineAccessors, prepareRuleEngine } from '@kubevious/data-models'
import { ValidationAccessors, prepareValidation } from '@kubevious/data-models'


export class Database
{
    private _logger : ILogger;
    private _context : Context

    private _dataStore : DataStore;

    private _config : ConfigAccessors;
    private _notification : NotificationAccessors;
    private _snapshots : SnapshotsAccessors;
    private _ruleEngine : RuleEngineAccessors;
    private _validation : ValidationAccessors;


    constructor(logger : ILogger, context : Context)
    {
        this._context = context;
        this._logger = logger.sublogger("DB");

        this._dataStore = new DataStore(logger.sublogger("DataStore"), false);

        this._config = prepareConfig(this._dataStore);
        this._notification = prepareNotification(this._dataStore);
        this._snapshots = prepareSnapshots(this._dataStore);
        this._ruleEngine = prepareRuleEngine(this._dataStore);
        this._validation = prepareValidation(this._dataStore);
    }

    get isConnected() {
        return this._dataStore.isConnected;
    }

    get logger() {
        return this._logger;
    }

    get dataStore() {
        return this._dataStore;
    }

    get config() {
        return this._config;
    }

    get notification() {
        return this._notification;
    }

    get snapshots() {
        return this._snapshots;
    }

    get ruleEngine() {
        return this._ruleEngine;
    }

    get validation() {
        return this._validation;
    }

    init()
    {
        this._logger.info("[init]")
        return Promise.resolve()
            .then(() => this._dataStore.init())
            .then(() => {
                this._logger.info("[init] post connect.")
            })
    }

    table<TRow>(accessor: DataStoreTableAccessor<TRow>)
    {
        return this._dataStore.table(accessor);
    }


    onConnect(cb: () => Resolvable<any>)
    {
        this._dataStore.onConnect(cb);
    }

}