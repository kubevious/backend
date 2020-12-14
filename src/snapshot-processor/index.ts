import _ from 'the-lodash';
import { Promise } from 'the-promise';
import { ILogger } from 'the-logger' ;

import * as fs from 'fs';
import * as Path from 'path';

import { RegistryState, StateBundle } from '@kubevious/helpers/dist/registry-state';
import { ProcessorBuilder, ProcessorInfo, Handler as ProcessorHandler } from './builder';

import { Context } from '../context';
import { ProcessingTrackerScoper } from '@kubevious/helpers/dist/processing-tracker';
import { SnapshotInfo } from '../collector/collector';

interface ProcessorEntry
{
    name: string;
    order: number;
    handler: ProcessorHandler;
}

export class SnapshotProcessor
{
    private _logger : ILogger;
    private _context : Context;

    private _processors : ProcessorEntry[] = [];

    constructor(context: Context)
    {
        this._context = context;
        this._logger = context.logger.sublogger('SnapshotProcessor');

        this._extractProcessors();
    }

    get logger() {
        return this._logger;
    }

    private _extractProcessors()
    {
        this.logger.info('[_extractProcessors] ');
        var location = 'snapshot-processors';
        var files = fs.readdirSync(Path.join(__dirname, location));
        files = _.filter(files, x => x.endsWith('.js'));

        for(let fileName of files)
        {
            const pa = './' + location + '/' + fileName;
            const processorBuilder = <ProcessorBuilder> require(pa);
            const processorInfo = processorBuilder._export();

            if (!processorInfo.isDisabled)
            {
                this._processors.push({
                    name: Path.parse(fileName).name,
                    order: processorInfo.order,
                    handler: processorInfo.handler!
                });
            }
        }
        this._processors = _.orderBy(this._processors, x => x.order);

        for(var processor of this._processors)
        {
            this._logger.info("[_extractProcessors] HANDLER: %s :: %s", 
                processor.order, 
                processor.name)
        }
    }

    process(snapshotInfo: SnapshotInfo, tracker: ProcessingTrackerScoper, extraParams?: any)
    {
        return tracker.scope("SnapshotProcessor::process", (innerTracker) => {

            var registryState : RegistryState | null = null;
            var bundle : StateBundle | null = null;
            return Promise.resolve()
                .then(() => this._makeState(snapshotInfo, innerTracker))
                .then(result => {
                    registryState = result;
                })
                .then(() => this._runProcessors(registryState!, extraParams, innerTracker))
                .then(() => {
                    return innerTracker.scope("finalizeState", () => {
                        registryState!.finalizeState();
                    });
                })
                .then(() => {
                    return innerTracker.scope("buildBundle", () => {
                        bundle = registryState!.buildBundle();
                    });
                })
                .then(() => {
                    return {
                        registryState: registryState!,
                        bundle: bundle!
                    }
                })
        });
    }

    private _makeState(snapshotInfo: SnapshotInfo, tracker: ProcessingTrackerScoper)
    {
        return tracker.scope("_makeState", () => {
            var registryState = new RegistryState(snapshotInfo)
            return registryState;
        });
    }

    private _runProcessors(registryState: RegistryState, extraParams: any, tracker : ProcessingTrackerScoper)
    {
        return tracker.scope("handlers", (procTracker) => {
            return Promise.serial(this._processors, processor => {
                return procTracker.scope(processor.name, (innerTracker) => {

                    var params;
                    if (extraParams) {
                        params = _.clone(extraParams);
                    } else {
                        params = {}
                    }
                    params = _.defaults(params, {
                        logger: this.logger,
                        context: this._context,
                        state: registryState,
                        tracker: innerTracker
                    });
                    
                    return processor.handler(params);
                })
            })
        });
    }

}