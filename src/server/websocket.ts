import _ from 'the-lodash';
import { RegistryBundleState } from '@kubevious/helpers/dist/registry-bundle-state';
import { ILogger } from 'the-logger';
import { Context } from '../context';
import { WebServer } from './';

import { WebSocketServer, WebSocketItem } from '@kubevious/websocket-server'

import { HashUtils } from '@kubevious/data-models';

export class WebSocket
{
    private _context : Context;
    private _logger : ILogger;
    private _webServer : WebServer;
    private _socket? : WebSocketServer;

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
        const httpServer = this._webServer.httpServer;
        this._socket = new WebSocketServer(
            this._logger.sublogger('WebSocket'),
            httpServer,
            '/socket');
        this._socket.run();
    }
    

    accept(state: RegistryBundleState)
    {
        const nodeItems : WebSocketItem[] = []
        const childrenItems : WebSocketItem[] = []
        const propertiesItems : WebSocketItem[] = []
        const alertsItems : WebSocketItem[] = []

        for(const node of state.nodeItems)
        {
            nodeItems.push(this._makeWsItem(node.dn, node.config));

            {
                const children = state.registryState.getChildrenDns(node.dn);
                if (children.length > 0)
                {
                    childrenItems.push(this._makeWsItem(node.dn, children))
                }
            }

            {
                const propertiesMap = node.propertiesMap;
                if (propertiesMap && _.keys(propertiesMap).length > 0)
                {
                    propertiesItems.push(this._makeWsItem(node.dn, propertiesMap));
                }
            }

            {
                const alertsMap = node.hierarchyAlerts;
                if (alertsMap && _.keys(alertsMap).length > 0)
                {
                    alertsItems.push(this._makeWsItem(node.dn, alertsMap));
                }
            }
        }

        this._context.websocket.updateScope({ kind: 'node' }, nodeItems);
        this._context.websocket.updateScope({ kind: 'children' }, childrenItems);
        this._context.websocket.updateScope({ kind: 'props' }, propertiesItems);
        this._context.websocket.updateScope({ kind: 'alerts' }, alertsItems);
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


    private _makeWsItem(dn: string, config: any) : WebSocketItem
    {
        // let key = {
        //     dn: dn,
        //     config: config
        // }
        // config_hash: HashUtils.calculateObjectHashStr(key)

        const item : WebSocketItem = {
            target: { dn: dn },
            value: _.cloneDeep(config),
        }
        return item;
    }
}