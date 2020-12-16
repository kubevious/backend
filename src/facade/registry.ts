import _ from 'the-lodash';
import { Promise } from 'the-promise';
import { ILogger } from 'the-logger' ;

import { Context } from '../context';
import { CollectorSnapshotInfo } from '../collector/collector';
import { RegistryState } from '@kubevious/helpers/dist/registry-state';
import { RegistryBundleState } from '@kubevious/helpers/dist/registry-bundle-state';
import { ProcessingTrackerScoper } from '@kubevious/helpers/dist/processing-tracker';

export class FacadeRegistry
{
    private _logger : ILogger;
    private _context : Context

    private _latestSnapshot : CollectorSnapshotInfo | null = null;
    private _isProcessing : boolean = false;
    private _isScheduled : boolean = false;
    
    constructor(context : Context)
    {
        this._context = context;
        this._logger = context.logger.sublogger("FacadeRegistry");
    }

    get logger() {
        return this._logger;
    }

    get debugObjectLogger() {
        return this._context.debugObjectLogger;
    }

    acceptCurrentSnapshot(snapshotInfo: CollectorSnapshotInfo)
    {
        this._latestSnapshot = snapshotInfo;
        this._triggerProcess();
    }

    private _triggerProcess()
    {
        this._logger.verbose('[_triggerProcess] Begin');

        if (this._isScheduled) {
            this._logger.verbose('[_triggerProcess] Timer scheduled...');
            return;
        }
        if (this._isProcessing) {
            this._logger.verbose('[_triggerProcess] Is Processing...');
            return;
        }

        this._isScheduled = true;

        this._context.backend.timer(5000, () => {
            this._logger.verbose('[_triggerProcess] Timer Triggered...');

            this._isScheduled = false;

            if (!this._latestSnapshot) {
                this._logger.verbose('[_triggerProcess] No Latest snapshot...');
                return;
            }
            var snapshot = this._latestSnapshot;
            this._latestSnapshot = null;
            this._isProcessing = true;
            return this._processCurrentSnapshot(snapshot)
                .catch(reason => {
                    this._logger.error('[_triggerProcess] failed: ', reason);
                })
                .finally(() => {
                    this._isProcessing = false;
                });
        })
    }

    private _processCurrentSnapshot(snapshotInfo: CollectorSnapshotInfo)
    {
        return this._context.tracker.scope("FacadeRegistry::_processCurrentSnapshot", (tracker) => {

            return this._context.snapshotProcessor.process(snapshotInfo, tracker)
                .then(bundle => {
                    return this._runFinalize(bundle, tracker);
                })
        });
    }

    private _runFinalize(bundle : RegistryBundleState, tracker: ProcessingTrackerScoper)
    {
        return Promise.resolve()
            .then(() => {
                return Promise.resolve()
                    .then(() => this.debugObjectLogger.dump("latest-bundle-nodes", 0, bundle.nodes))
                    .then(() => this.debugObjectLogger.dump("latest-bundle-children", 0, bundle.children))
                    .then(() => this.debugObjectLogger.dump("latest-bundle-properties", 0, bundle.properties))
                    .then(() => this.debugObjectLogger.dump("latest-bundle-alerts", 0, bundle.alerts));
            })
            .then(() => {
                this._produceCounters(bundle);
            })
            .then(() => {
                return tracker.scope("websocket-update", () => {
                    return this._updateWebsocket(bundle);
                });
            })
            .then(() => {
                return tracker.scope("registry-accept", () => {
                    return this._context.registry.accept(bundle);
                });
            })
            .then(() => {
                return tracker.scope("search-accept", () => {
                    return this._context.searchEngine.accept(bundle);
                });
            })
            .then(() => {
                return tracker.scope("history-accept", () => {
                    return this._context.historyProcessor.accept(bundle);
                });
            })
    }

    private _produceCounters(bundle: RegistryBundleState)
    {
        const counters = this._extractCounters(bundle);
        this.logger.info("[COUNTERS] BEGIN");
        for(let counter of counters)
        {
            this.logger.info("[COUNTERS] %s => %s", counter.name, counter.count);
        }
        this.logger.info("[COUNTERS] END");
        this._context.worldvious.acceptCounters(counters);
    }

    private _extractCounters(bundle: RegistryBundleState)
    {
        let nodeCountDict : Record<string, number> = {};
        for(let node of bundle.nodeItems)
        {
            if (!nodeCountDict[node.kind])
            {
                nodeCountDict[node.kind] = 1;
            }
            else
            {
                nodeCountDict[node.kind]++;
            }
        }

        let nodeCounters = _.keys(nodeCountDict).map(x => ({
            name: x,
            count: nodeCountDict[x]
        }))

        return nodeCounters;
    }

    private _updateWebsocket(bundle: RegistryBundleState)
    {
        {
            var items = [];
            for(var x of bundle.nodes)
            {
                items.push({
                    target: { dn: x.dn },
                    value: _.cloneDeep(x.config),
                    value_hash: x.config_hash,
                });
            }
            this._context.websocket.updateScope({ kind: 'node' }, items);
        }

        {
            var items = [];
            for(var x of bundle.children)
            {
                items.push({
                    target: { dn: x.dn },
                    value: _.cloneDeep(x.config),
                    value_hash: x.config_hash,
                });
            }
            this._context.websocket.updateScope({ kind: 'children' }, items);
        }

        {
            var items = [];
            for(var x of bundle.properties)
            {
                items.push({
                    target: { dn: x.dn },
                    value: _.cloneDeep(x.config),
                    value_hash: x.config_hash,
                });
            }
            this._context.websocket.updateScope({ kind: 'props' }, items);
        }

        {
            var items = [];
            for(var x of bundle.alerts)
            {
                items.push({
                    target: { dn: x.dn },
                    value: _.cloneDeep(x.config),
                    value_hash: x.config_hash,
                });
            }
            this._context.websocket.updateScope({ kind: 'alerts' }, items);
        }
    }

}