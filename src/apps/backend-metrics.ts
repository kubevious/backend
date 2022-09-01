import { ILogger } from "the-logger";
import { Promise } from "the-promise";
import { Context } from "../context";

import { BackendMetricItem, BackendMetricsResponse } from '@kubevious/ui-middleware'
import { HttpClient } from '@kubevious/http-client'

import VERSION from '../version';


export class BackendMetrics
{
    private _context : Context;
    private _logger : ILogger;

    private _microservices : MicroserviceInfo[] = [];

    constructor(context : Context)
    {
        this._context = context;
        this._logger = context.logger.sublogger("BackendMetrics");

        this._addMicroservice("Collector", context.microservices.collector);
        this._addMicroservice("Parser", context.microservices.parser);
        this._addMicroservice("Guard", context.microservices.guard);
    }

    get logger() {
        return this._logger;
    }

    extractMetrics() 
    {
        const metrics: BackendMetricItem[] = [];

        metrics.push({
            category: "Backend",
            name: "State",
            value: "Running"
        });

        metrics.push({
            category: "Backend",
            name: "Version",
            value: VERSION
        });

        metrics.push({
            category: "Backend",
            name: "MySQL Connected",
            value: this._context.dataStore.isConnected
        });

        metrics.push({
            category: "Backend",
            name: "Redis Connected",
            value: this._context.redis.isConnected
        });

        return Promise.parallel(this._microservices, x => {
            return this._fetchFromBackend(x, metrics);
        })
        .then(() => metrics);
    }

    private _fetchFromBackend(service: MicroserviceInfo, metrics: BackendMetricItem[])
    {
        return service.client.get<BackendMetricsResponse>('/api/v1/metrics')
            .then(result => {           

                metrics.push({
                    category: service.name,
                    name: "State",
                    value: "Running"
                });

                for(const x of (result?.data?.metrics ?? []))
                {
                    metrics.push(x);
                }
            })
            .catch(reason => {
                this._logger.error("[_fetchFromBackend] service: %s, reason:", service.name, reason);

                metrics.push({
                    category: service.name,
                    name: "State",
                    value: "Unreachable"
                });

                return [];
            })
    }

    private _addMicroservice(name: string, client: HttpClient)
    {
        this._microservices.push({
            name: name,
            client: client
        });
    }

}

interface MicroserviceInfo
{
    name: string;
    client: HttpClient;
}