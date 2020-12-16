import _ from 'the-lodash';
import { Promise } from 'the-promise';
import { ILogger } from 'the-logger' ;

import { Context } from '../context';
import { SnapshotInfo } from '../collector/collector';
import { RegistryState, StateBundle } from '@kubevious/helpers/dist/registry-state';
import { ProcessingTrackerScoper } from '@kubevious/helpers/dist/processing-tracker';

export class FacadeRegistry
{
    private _logger : ILogger;
    private _context : Context

    private _latestSnapshot : SnapshotInfo | null = null;
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

    acceptCurrentSnapshot(snapshotInfo: SnapshotInfo)
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

    private _processCurrentSnapshot(snapshotInfo: SnapshotInfo)
    {
        return this._context.tracker.scope("FacadeRegistry::_processCurrentSnapshot", (tracker) => {

            return this._context.snapshotProcessor.process(snapshotInfo, tracker)
                .then(result => {
                    return this._runFinalize(result.registryState, result.bundle, tracker);
                })
        });
    }

    private _runFinalize(registryState: RegistryState, bundle : StateBundle, tracker: ProcessingTrackerScoper)
    {
        return Promise.resolve()
            .then(() => this.debugObjectLogger.dump("latest-bundle", 0, bundle))
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
                    return this._context.registry.accept(registryState);
                });
            })
            .then(() => {
                return tracker.scope("autocomplete-builder-accept", () => {
                    return this._context.autocompleteBuilder.accept(registryState)
                })
            })
            .then(() => {
                return tracker.scope("search-accept", () => {
                    return this._context.searchEngine.accept(registryState);
                });
            })
            .then(() => {
                return tracker.scope("history-accept", () => {
                    return this._context.historyProcessor.accept(registryState);
                });
            })
    }

    private _produceCounters(bundle: StateBundle)
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

    private _extractCounters(bundle: StateBundle)
    {
        let nodeCountDict : Record<string, number> = {};
        for(let node of bundle.nodes)
        {
            if (!nodeCountDict[node.config.kind])
            {
                nodeCountDict[node.config.kind] = 1;
            }
            else
            {
                nodeCountDict[node.config.kind]++;
            }
        }

        let nodeCounters = _.keys(nodeCountDict).map(x => ({
            name: x,
            count: nodeCountDict[x]
        }))

        return nodeCounters;
    }

    private _updateWebsocket(bundle: StateBundle)
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
