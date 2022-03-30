import _ from 'the-lodash';
import { Promise } from 'the-promise';
import { ILogger } from 'the-logger';
import { DataFetcher, HasKind } from '../utils/data-fetcher';
import { Context } from '../context';
import { WebSocketKind } from '../server/types';

export class DiagramDataFetcher
{
    private _context : Context;
    private _logger : ILogger;
    private _readerLogger : ILogger;
    private _fetcher : DataFetcher;
    
    constructor(context : Context)
    {
        this._context = context;
        this._logger = context.logger.sublogger('DiagramDataFetcher');
        this._readerLogger = context.logger.sublogger('SnapshotReader');
        this._fetcher = new DataFetcher(this._logger);

        this._fetcher.register(WebSocketKind.node, this._resolveNode.bind(this));
        this._fetcher.register(WebSocketKind.children, this._resolveChildren.bind(this));
        this._fetcher.register(WebSocketKind.props, this._resolveProps.bind(this));
        this._fetcher.register(WebSocketKind.alerts, this._resolveAlerts.bind(this));

        this._fetcher.register(WebSocketKind.latest_snapshot_id, this._resolveLatestSnapshotId.bind(this));
    }

    resolveDiagramItem(target: HasKind) : Promise<any | null>
    {
        return this._fetcher.resolve(target);
    }

    private _resolveNode(target: any)
    {
        const snapshotReader = this._makeSnapshotReader(target);
        if (!snapshotReader) {
            return null;
        }
        return snapshotReader.queryNode(target.dn);
    }

    private _resolveChildren(target: any)
    {
        const snapshotReader = this._makeSnapshotReader(target);
        if (!snapshotReader) {
            return null;
        }
        return snapshotReader.queryChildren(target.dn);
    }

    private _resolveProps(target: any)
    {
        const snapshotReader = this._makeSnapshotReader(target);
        if (!snapshotReader) {
            return null;
        }
        return snapshotReader.queryProperties(target.dn);
    }

    private _resolveAlerts(target: any)
    {
        const snapshotReader = this._makeSnapshotReader(target);
        if (!snapshotReader) {
            return null;
        }
        return snapshotReader.queryAlerts(target.dn);
    }

    private _resolveLatestSnapshotId(target: any)
    {
        return this._context.configAccessor.getLatestSnapshotId();
    }

    private _makeSnapshotReader(target: any)
    {
        if (!target.snapshotId) {
            return null;
        }
        const snapshotReader = this._context.makeSnapshotReader(target.snapshotId);
        return snapshotReader;
    }
    
}