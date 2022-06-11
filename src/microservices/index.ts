import { ILogger } from "the-logger";
import { Context } from "../context";

import { HttpClient } from '@kubevious/http-client'


export class Microservices
{
    private _context : Context;
    private _logger : ILogger;

    private _collector: HttpClient;
    private _parser: HttpClient;
    private _guard: HttpClient;

    constructor(context : Context)
    {
        this._context = context;
        this._logger = context.logger.sublogger("Microservices");

        if (!process.env.COLLECTOR_BASE_URL) {
            throw new Error("COLLECTOR_BASE_URL not set");
        }
        this._collector = new HttpClient(process.env.COLLECTOR_BASE_URL)

        if (!process.env.PARSER_BASE_URL) {
            throw new Error("PARSER_BASE_URL not set");
        }
        this._parser = new HttpClient(process.env.PARSER_BASE_URL)

        if (!process.env.GUARD_BASE_URL) {
            throw new Error("GUARD_BASE_URL not set");
        }
        this._guard = new HttpClient(process.env.GUARD_BASE_URL)
    }

    get logger() {
        return this._logger;
    }

    get collector() {
        return this._collector;
    }

    get parser() {
        return this._parser;
    }

    get guard() {
        return this._guard;
    }


}
