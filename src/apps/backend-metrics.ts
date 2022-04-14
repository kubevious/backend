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

        if (!process.env.COLLECTOR_BASE_URL) {
            throw new Error("COLLECTOR_BASE_URL not set");
        }
        this._addMicroservice("Collector", process.env.COLLECTOR_BASE_URL);

        if (!process.env.PARSER_BASE_URL) {
            throw new Error("PARSER_BASE_URL not set");
        }
        this._addMicroservice("Parser", process.env.PARSER_BASE_URL);
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
            category: "Collector",
            name: "MySQL Connected",
            value: this._context.dataStore.isConnected
        });

        metrics.push({
            category: "Collector",
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

    private _addMicroservice(name: string, baseUrl: string)
    {
        this._microservices.push({
            name: name,
            client: new HttpClient(baseUrl)
        });
    }

}

interface MicroserviceInfo
{
    name: string;
    client: HttpClient;
}