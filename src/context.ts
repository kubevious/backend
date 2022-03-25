import _ from 'the-lodash';
import { ILogger } from 'the-logger';
import { Promise } from 'the-promise';

import { Backend } from '@kubevious/helper-backend'

import { Database } from './db';
import { Registry } from './registry/registry';
import { DebugObjectLogger } from './utils/debug-object-logger';
import { MarkerAccessor } from './rule/marker-accessor';
import { MarkerCache } from './rule/marker-cache';
import { RuleAccessor } from './rule/rule-accessor';
import { RuleCache } from './rule/rule-cache';
import { RuleEngine } from './rule/rule-engine';
import { NotificationsApp } from './apps/notifications';
import { WorldviousClient } from '@kubevious/worldvious-client';

import { WebServer } from './server';
import { WebSocket } from './server/websocket';

import { SnapshotReader as HistorySnapshotReader } from '@kubevious/helpers/dist/history/snapshot-reader';
import { SeriesResampler } from '@kubevious/helpers/dist/history/series-resampler';

import VERSION from './version'

export class Context
{
    private _backend : Backend;
    private _logger: any; //  ILogger;
    /* Both of the 'DumpWriter' class (inside the-logger and worldvious-client/node_modules/the-logger)
    should have public _writer and _indent prorerties to be able to uncomment */
    private _worldvious : WorldviousClient;

    private _server: WebServer;
    private _websocket: WebSocket;

    private _dataStore: Database;

    private _debugObjectLogger: DebugObjectLogger;

    // private _markerAccessor: MarkerAccessor;
    // private _markerCache: MarkerCache;
    // private _ruleAccessor: RuleAccessor;
    // private _ruleCache: RuleCache;
    // private _ruleEngine: RuleEngine;

    private _seriesResamplerHelper: SeriesResampler;

    private _notificationsApp: NotificationsApp;

    constructor(backend : Backend)
    {
        this._backend = backend;
        this._logger = backend.logger.sublogger('Context');

        this._logger.info("Version: %s", VERSION);

        this._worldvious = new WorldviousClient(this.logger, 'backend', VERSION);

        this._dataStore = new Database(this._logger, this);
        this._debugObjectLogger = new DebugObjectLogger(this);

        // this._markerAccessor = new MarkerAccessor(this, this.database.dataStore);
        // this._markerCache = new MarkerCache(this);
        // this._ruleAccessor = new RuleAccessor(this, this.database.dataStore);
        // this._ruleCache = new RuleCache(this);
        // this._ruleEngine = new RuleEngine(this, this.database.dataStore);

        this._seriesResamplerHelper = new SeriesResampler(200)
            .column("changes", _.max)
            .column("error", _.mean)
            .column("warn", _.mean)
            ;

        this._notificationsApp = new NotificationsApp(this);

        this._server = new WebServer(this);
        this._websocket = new WebSocket(this, this._server);

        backend.registerErrorHandler((reason) => {
            return this.worldvious.acceptError(reason);
        });

        backend.stage("setup-worldvious", () => this._worldvious.init());

        backend.stage("setup-metrics-tracker", () => this._setupMetricsTracker());

        backend.stage("setup-db", () => this._dataStore.init());

        backend.stage("setup-server", () => this._server.run());
        backend.stage("setup-websocket", () => this._websocket.run());
        backend.stage("notifications-app", () => this._notificationsApp.init());
    }

    get backend() {
        return this._backend;
    }

    get logger() {
        return this._logger;
    }

    get tracker() {
        return this.backend.tracker;
    }

    get database() {
        return this._dataStore;
    }

    get dataStore() {
        return this._dataStore;
    }

    get debugObjectLogger() {
        return this._debugObjectLogger;
    }

    // get markerAccessor() {
    //     return this._markerAccessor;
    // }

    // get markerCache() {
    //     return this._markerCache;
    // }

    // get ruleAccessor() {
    //     return this._ruleAccessor;
    // }

    // get ruleCache() {
    //     return this._ruleCache;
    // }

    // get ruleEngine() {
    //     return this._ruleEngine;
    // }

    get websocket() {
        return this._websocket;
    }

    get worldvious() : WorldviousClient {
        return this._worldvious;
    }

    get seriesResamplerHelper() {
        return this._seriesResamplerHelper;
    }

    get notificationsApp() {
        return this._notificationsApp;
    }

    private _setupMetricsTracker()
    {
        this.tracker.registerListener(extractedData => {
            this._worldvious.acceptMetrics(extractedData);
        })
    }

}
