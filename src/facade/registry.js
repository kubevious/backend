const Promise = require('the-promise');
const _ = require('lodash');

class FacadeRegistry
{
    constructor(context)
    {
        this._context = context;
        this._logger = context.logger.sublogger("FacadeRegistry");

        this._configMap = {};
        this._latestSnapshot = null;
    }

    get logger() {
        return this._logger;
    }

    get debugObjectLogger() {
        return this._context.debugObjectLogger;
    }

    acceptCurrentSnapshot(snapshotInfo)
    {
        this._latestSnapshot = snapshotInfo;
        this._triggerProcess();
    }

    _triggerProcess()
    {
        this._logger.verbose('[_triggerProcess] Begin');

        if (this._processTimer) {
            this._logger.verbose('[_triggerProcess] Timer scheduled...');
            return;
        }
        if (this._isProcessing) {
            this._logger.verbose('[_triggerProcess] Is Processing...');
            return;
        }

        this._processTimer = setTimeout(() => {
            this._logger.verbose('[_triggerProcess] Timer Triggered...');

            this._processTimer = null;
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

        }, 5000);
    }

    _processCurrentSnapshot(snapshotInfo)
    {
        return this._context.tracker.scope("FacadeRegistry::_processCurrentSnapshot", (tracker) => {

            return this._context.snapshotProcessor.process(snapshotInfo, tracker)
                .then(result => {
                    return this._runFinalize(result.registryState, result.bundle, tracker);
                })
        });
    }

    _runFinalize(registryState, bundle, tracker)
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

    _produceCounters(bundle)
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

    _extractCounters(bundle)
    {
        let nodeCountDict = {};
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

    _updateWebsocket(bundle)
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

module.exports = FacadeRegistry;