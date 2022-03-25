import _ from 'the-lodash';
import { Promise, Resolvable } from 'the-promise';
import { ILogger } from 'the-logger' ;

import * as fs from 'fs';
import * as Path from 'path';

import { DataStore, MySqlDriver, MySqlStatement } from '@kubevious/easy-data-store';

import { Context } from '../context' ;

import { ConfigAccessors, prepareConfig } from '@kubevious/data-models/dist/models/config'
import { NotificationAccessors, prepareNotification } from '@kubevious/data-models/dist/models/notification'
import { SnapshotsAccessors, prepareSnapshots } from '@kubevious/data-models/dist/models/snapshots'
import { RuleEngineAccessors, prepareRuleEngine } from '@kubevious/data-models/dist/models/rule_engine'


export class Database
{
    private _logger : ILogger;
    private _context : Context

    private _dataStore : DataStore;

    private _config : ConfigAccessors;
    private _notification : NotificationAccessors;
    private _snapshots : SnapshotsAccessors;
    private _ruleEngine : RuleEngineAccessors;


    constructor(logger : ILogger, context : Context)
    {
        this._context = context;
        this._logger = logger.sublogger("DB");

        this._dataStore = new DataStore(logger.sublogger("DataStore"), false);

        this._config = prepareConfig(this._dataStore);
        this._notification = prepareNotification(this._dataStore);
        this._snapshots = prepareSnapshots(this._dataStore);
        this._ruleEngine = prepareRuleEngine(this._dataStore);
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

    init()
    {
        this._logger.info("[init]")
        return Promise.resolve()
            .then(() => this._dataStore.init())
            .then(() => {
                this._logger.info("[init] post connect.")
            })
    }

    onConnect(cb: () => Resolvable<any>)
    {
        this._dataStore.onConnect(cb);
    }

}