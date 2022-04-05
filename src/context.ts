import _ from 'the-lodash';
import { ILogger } from 'the-logger';
import { Promise } from 'the-promise';

import { Backend } from '@kubevious/helper-backend'

import { Database } from './db';
import { RedisClient } from '@kubevious/helper-redis'

import { MarkerAccessor } from './apps/rule-engine/marker-accessor';
import { MarkerEditor } from './apps/rule-engine/marker-editor';
import { RuleAccessor } from './apps/rule-engine/rule-accessor';
import { RuleEditor } from './apps/rule-engine/rule-editor';
import { NotificationsApp } from './apps/notifications';
import { WorldviousClient } from '@kubevious/worldvious-client';

import { WebServer } from './server';
import { WebSocket } from './server/websocket';

import { SeriesResampler } from '@kubevious/data-models';

import { ConfigAccessor } from '@kubevious/data-models';
import { SnapshotReader } from '@kubevious/data-models/dist/accessors/snapshot-reader';
import { BufferUtils } from '@kubevious/data-models';
import { TimelineRow } from '@kubevious/data-models/dist/models/snapshots';

import { DiagramDataFetcher } from './apps/diagram-data-fetcher';
import { ClusterStatusAccessor } from './apps/cluster-status-accessor';

import { SearchEngine } from './apps/search-engine';


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
    private _redis : RedisClient;

    private _configAccessor : ConfigAccessor;

    private _markerAccessor: MarkerAccessor;
    private _markerEditor: MarkerEditor;
    private _ruleAccessor: RuleAccessor;
    private _ruleEditor: RuleEditor;

    private _seriesResamplerHelper: SeriesResampler<TimelineRow>;

    private _notificationsApp: NotificationsApp;
    private _diagramDataFetcher : DiagramDataFetcher;
    private _clusterStatusAccessor : ClusterStatusAccessor;

    private _searchEngine : SearchEngine;

    constructor(backend : Backend)
    {
        this._backend = backend;
        this._logger = backend.logger.sublogger('Context');

        this._logger.info("Version: %s", VERSION);

        this._worldvious = new WorldviousClient(this.logger, 'backend', VERSION);

        this._dataStore = new Database(this._logger, this);
        this._redis = new RedisClient(this.logger.sublogger('Redis'));

        this._configAccessor = new ConfigAccessor(this._dataStore.dataStore, this._dataStore.config);

        this._markerAccessor = new MarkerAccessor(this);
        this._markerEditor = new MarkerEditor(this);
        this._ruleAccessor = new RuleAccessor(this);
        this._ruleEditor = new RuleEditor(this);

        this._seriesResamplerHelper = new SeriesResampler<TimelineRow>(200)
            .column("changes", x => _.max(x) ?? 0)
            .column("error", _.mean)
            .column("warn", _.mean)
            ;

        this._notificationsApp = new NotificationsApp(this);

        this._diagramDataFetcher = new DiagramDataFetcher(this);

        this._clusterStatusAccessor = new ClusterStatusAccessor(this.logger, this);

        this._searchEngine = new SearchEngine(this);

        this._server = new WebServer(this);
        this._websocket = new WebSocket(this, this._server);


        backend.registerErrorHandler((reason) => {
            return this.worldvious.acceptError(reason);
        });

        backend.stage("setup-worldvious", () => this._worldvious.init());

        backend.stage("setup-metrics-tracker", () => this._setupMetricsTracker());

        backend.stage("setup-db", () => this._dataStore.init());

        backend.stage("setup-redis", () => this._redis.run());

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

    get redis() {
        return this._redis;
    }

    get configAccessor() {
        return this._configAccessor;
    }

    get markerAccessor() {
        return this._markerAccessor;
    }

    get markerEditor() {
        return this._markerEditor;
    }

    get ruleAccessor() {
        return this._ruleAccessor;
    }

    get ruleEditor() {
        return this._ruleEditor;
    }

    get websocket() {
        return this._websocket;
    }

    get clusterStatusAccessor() {
        return this._clusterStatusAccessor;
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

    get executionLimiter() {
        return this._server.executionLimiter;
    }

    public makeSnapshotReader(snapshotId: string)
    {
        return new SnapshotReader(this._logger,
            this._dataStore.snapshots,
            this._dataStore.dataStore,
            BufferUtils.fromStr(snapshotId)
            )
    }

    get diagramDataFetcher() {
        return this._diagramDataFetcher;
    }

    get searchEngine() {
        return this._searchEngine;
    }

    private _setupMetricsTracker()
    {
        this.tracker.registerListener(extractedData => {
            this._worldvious.acceptMetrics(extractedData);
        })
    }

}
