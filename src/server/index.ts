import Path from 'path';
import { ILogger } from 'the-logger';
import { Server } from '@kubevious/helper-backend';
import { Context } from '../context';
import { Database } from '../db';

export interface Helpers 
{
    dataStore: Database;
}

export class WebServer
{
    private logger : ILogger;
    private server : Server<Context, Helpers>;
    private helpers : Helpers;

    constructor(context : Context)
    {
        this.logger = context.logger.sublogger('WebServer');
        this.helpers = {
            dataStore: context.dataStore
        };

        this.server = new Server(this.logger, context, this.helpers, {
            routersDir: Path.join(__dirname, '..', 'routers')
        });
        this.server.initializer((app) => {
            app.set('trust proxy', true);
        })
    }

    get httpServer() {
        return this.server.httpServer;
    }

    get executionLimiter() {
        return this.server.executionLimiter
    }

    run() : Promise<Server<Context, Helpers>>
    {
        this.server.initializer(app => {

            // TODO: To be called after load Routers (a post-initializer)
            // this._app.use((req, res, next) => {
            //     res.status(404).json({
            //         status: 404,
            //         message: 'Not Found'
            //     });
            // });

        })
        
        return this.server.run();
    }

        // var routerContext = {
        //     logger: this.logger.sublogger("Router" + name),
        //     router: wrappedRouter,
        //     app: this._app,
        //     websocket: this._context.websocket,
        //     context: this._context,
        //     reportError: (statusCode, message) => {
        //         throw new RouterError(message, statusCode);
        //     },
        //     reportUserError: (message) => {
        //         throw new RouterError(message, 400);
        //     }
        // }

}
