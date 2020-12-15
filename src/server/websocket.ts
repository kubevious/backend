import { ILogger } from 'the-logger';
import { Context } from '../context';
import { WebServer } from './';

const WebSocketServer = require('websocket-subscription-server').WebSocketServer;

export class WebSocket
{
    private _context : Context;
    private _logger : ILogger;
    private _webServer : WebServer;
    private _socket? : any; //WebSocketServer;

    constructor(context: Context, webServer : WebServer )
    {
        this._context = context;
        this._logger = context.logger.sublogger("WebSocketServer");
        this._webServer = webServer;
    }

    get logger() {
        return this._logger;
    }

    run()
    {
        let httpServer = this._webServer.httpServer;
        this._socket = new WebSocketServer(this._logger.sublogger('WebSocket'), httpServer, '/socket');
        this._socket.run();
    }

    update(key: any, value: any)
    {
        this.logger.debug("[update] ", key, value);

        if (!this._socket) {
            return;
        }
        this._socket!.update(key, value);
    }

    updateScope(key: any, value: any)
    {
        this.logger.debug("[updateScope] ", key, value);

        if (!this._socket) {
            return;
        }
        this._socket.updateScope(key, value);
    }
}
