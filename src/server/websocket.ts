import _ from 'the-lodash';
import { ILogger } from 'the-logger';
import { Context } from '../context';
import { WebServer } from './';

import { WebSocketBaseServer } from '@kubevious/websocket-server'

import { HasKind, SocketContext, SocketLocals, WebSocketHandler } from './types';
import { FetchHandler, WSFetcherParams} from './types';
import { TargetExtrasBuilder, WSTargetExtrasBuilderParams} from './types';

import { SubscriptionMeta } from '@kubevious/websocket-server/dist/base-server';
import { WebSocketKind } from '@kubevious/ui-middleware';

import { RULE_ENGINE_HANDLERS } from './websocket-handlers/rule-engine';
import { DIAGRAM_HANDLERS } from './websocket-handlers/diagram';
import { REPORTING_HANDLERS } from './websocket-handlers/reporting';
import { WORLDVIOUS_HANDLERS } from './websocket-handlers/worldvious';
import { MyPromise } from 'the-promise';

type MyWebSocketServer = WebSocketBaseServer<SocketContext, SocketLocals>;

export class WebSocket
{
    private _context : Context;
    private _logger : ILogger;
    private _webServer : WebServer;
    private _socket? : MyWebSocketServer;

    private _kindHandlers : Record<string, KindHandlerInfo> = {};

    constructor(context: Context, webServer : WebServer )
    {
        this._context = context;
        this._logger = context.logger.sublogger("WebSocketServer");
        this._webServer = webServer;

        this._loadHandlers(RULE_ENGINE_HANDLERS);
        this._loadHandlers(DIAGRAM_HANDLERS);
        this._loadHandlers(REPORTING_HANDLERS);
        this._loadHandlers(WORLDVIOUS_HANDLERS);
    }

    get logger() {
        return this._logger;
    }

    run()
    {
        this._socket = new WebSocketBaseServer<SocketContext, SocketLocals>(
            this._logger.sublogger('WebSocket'),
            this._webServer.httpServer,
            { 
                path: '/socket'
            });

        this._socket.setupSubscriptionMetaFetcher((target, socket) => {
            // this._logger.info('[setupSubscriptionMetaFetcher] target: ', target);

            const subMeta : SubscriptionMeta = {};

            const kindHandler = this._kindHandlers[target.kind];
            if (kindHandler) {
                subMeta.contextFields = _.clone(kindHandler.contextFields)

                if (kindHandler.targetExtrasBuilder) {
                    const params : WSTargetExtrasBuilderParams = {
                        target: target,
                        context: this._context
                    }
                    subMeta.targetExtras = kindHandler.targetExtrasBuilder(params);
                }
            } else {
                this._logger.error('[setupSubscriptionMetaFetcher] NO HANDLER FOR TARGET: ', target);
            }

            return subMeta;
        });


        this._socket.handleSocket((globalTarget, socket, globalId, localTarget, subMeta) => {
            // this._logger.info('[handleSocket] globalTarget: ', globalTarget);

            const myTarget = <HasKind>globalTarget;
            if (!myTarget) {
                this._logger.error('[handleSocket] MISSING GLOBAL TARGET. Local Target: ', localTarget);
                return;
            }

            return Promise.resolve(this._fetchData(myTarget))
                .then(result => {
                    // this._logger.info('[handleSocket] globalTarget: , Resolved: ', globalTarget, result);
                    if (result) {
                        this._socket?.notifySocket(socket, localTarget, result)
                    } else {
                        this._socket?.notifySocket(socket, localTarget, null)
                    }
                })
        });

        this._socket.run();
    }

    notifyAll(globalTarget: any, value: any)
    {
        this._socket!.notifyAll(globalTarget, value);
    }

    invalidateAll(globalTarget: HasKind)
    {
        return Promise.resolve(this._fetchData(globalTarget))
            .then(result => {
                this._socket!.notifyAll(globalTarget, result);
            });
    }

    invalidateAllOfAKind(kind: WebSocketKind)
    {
        this.logger.info("[invalidateAllOfAKind] kind: %s", kind);
        
        const allTargets = this._socket!.extractAllTargets() as HasKind[];
        const targets = allTargets.filter(x => x.kind === kind);

        return MyPromise.serial(targets, target => {
            return this.invalidateAll(target)
        });
    }

    private _fetchData(target: HasKind)
    {
        const kindHandler = this._kindHandlers[target.kind];
        if (!kindHandler) {
            return null;
        }

        const fetcher = kindHandler.fetcher;
        if (!fetcher) {
            return null;
        }

        const params : WSFetcherParams = {
            target: target,
            context: this._context
        }

        return MyPromise.try(() => fetcher(params));
    }

    private _loadHandlers(handlers: WebSocketHandler[])
    {
        for(const handler of handlers)
        {
            if (_.isString(handler.kind)) {
                this._setupHandler(handler.kind, handler);
            } else {
                for(const kind of handler.kind)
                {
                    this._setupHandler(kind, handler);
                }
            }
        }
    }

    private _setupHandler(kind: WebSocketKind, handler: WebSocketHandler)
    {
        this._kindHandlers[kind] = {
            targetExtrasBuilder: handler.targetExtrasBuilder,
            fetcher: handler.fetcher,
            contextFields: (handler.contextFields && handler.contextFields.length > 0) ? handler.contextFields : []
        }
    }

}


interface KindHandlerInfo
{
    contextFields : string[],
    fetcher: FetchHandler,
    targetExtrasBuilder?: TargetExtrasBuilder,
}