import _ from 'the-lodash';
import { Promise } from 'the-promise';
import { ILogger } from 'the-logger' ;

import { Context } from '../context';
import { CollectorSnapshotInfo } from '../collector/types';
import { LogicItem, LogicProcessor } from '@kubevious/helper-logic-processor'
import { RegistryState } from '@kubevious/helpers/dist/registry-state';
import { RegistryBundleState } from '@kubevious/helpers/dist/registry-bundle-state';
import { ProcessingTrackerScoper } from '@kubevious/helpers/dist/processing-tracker';
import { ConcreteRegistry } from '../concrete/registry';


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

    acceptConcreteRegistry(registry: ConcreteRegistry)
    {
        this.logger.info('[acceptConcreteRegistry] count: %s', registry.allItems.length);
        // this._latestSnapshot = snapshotInfo;
        // this._triggerProcess();

        return this._processCurrentSnapshot(registry);
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
            // var snapshot = this._latestSnapshot;
            // this._latestSnapshot = null;
            // this._isProcessing = true;
            // return this._processCurrentSnapshot(snapshot)
            //     .catch(reason => {
            //         this._logger.error('[_triggerProcess] failed: ', reason);
            //     })
            //     .finally(() => {
            //         this._isProcessing = false;
            //     });
        })
    }

    private _processCurrentSnapshot(registry: ConcreteRegistry)
    {
        return this._context.tracker.scope("FacadeRegistry::_processCurrentSnapshot", (tracker) => {

            let logicProcessor = new LogicProcessor(this.logger, tracker, registry);
            return logicProcessor.process()
                .then(registryState => {
                    this.logger.info("LogicProcessor Complete.")
                    this.logger.info("RegistryState Item Count: %s", registryState.getCount());

                    return this._context.snapshotProcessor.process(registryState, tracker);
                })
                .then(bundle => {
                    return this._runFinalize(bundle, tracker);
                })
        });
    }

    private _runFinalize(bundle : RegistryBundleState, tracker: ProcessingTrackerScoper)
    {
        return Promise.resolve()
            .then(() => {
                return this._debugOutput(bundle);
            })
            .then(() => {
                this._produceCounters(bundle);
            })
            .then(() => {
                return tracker.scope("websocket-update", () => {
                    return this._context.websocket.accept(bundle);
                });
            })
            .then(() => {
                return tracker.scope("registry-accept", () => {
                    return this._context.registry.accept(bundle);
                });
            })
            .then(() => {
                return tracker.scope("autocomplete-builder-accept", () => {
                    return this._context.autocompleteBuilder.accept(bundle)
                })
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

    private _debugOutput(bundle : RegistryBundleState)
    {
        return;
        return Promise.resolve()
            .then(() => {

                const snapshotInfo = {
                    date: bundle.date.toISOString(),
                    items: <any[]>[]
                }

                for (let x of bundle.nodeItems)
                {
                    snapshotInfo.items.push({
                        dn: x.dn,
                        config_kind: 'node',
                        config: x.config
                    })

                    for(let propName of _.keys(x.propertiesMap))
                    {
                        snapshotInfo.items.push({
                            dn: x.dn,
                            config_kind: 'props',
                            name: propName,
                            config: x.propertiesMap[propName]
                        })
                    }

                    if (x.selfAlerts.length > 0)
                    {
                        snapshotInfo.items.push({
                            dn: x.dn,
                            config_kind: 'alerts',
                            config: x.selfAlerts
                        })
                    }
                }

                this.debugObjectLogger.dump("latest-bundle", 0, snapshotInfo)
                
            })
            ;
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

}
