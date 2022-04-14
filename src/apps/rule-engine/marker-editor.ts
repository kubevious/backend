import _ from 'the-lodash';
import { Promise } from 'the-promise';
import { ILogger } from 'the-logger' ;

import { Context } from '../../context';
import { WebSocketKind } from '@kubevious/ui-middleware';

import { MarkerAccessor } from './marker-accessor';

import { MarkerConfig, MarkersExportData } from '@kubevious/ui-middleware/dist/services/marker'


export class MarkerEditor
{
    private _context: Context;
    private _logger : ILogger;

    private _markerAccessor : MarkerAccessor;

    constructor(context: Context)
    {
        this._context = context;
        this._logger = context.logger.sublogger("MarkerEditor");

        this._markerAccessor = context.markerAccessor;
    }

    get logger() {
        return this._logger;
    }

    createMarker(body: MarkerConfig, markerName: string)
    {
        let newMarker : any;
        return this._markerAccessor
            .createMarker(body, markerName)
            .then(result => {
                newMarker = result;
            })
            .finally(() => this._triggerUpdate())
            .then(() => {
                return newMarker;
            })
    }

    deleteMarker(markerName: string)
    {
        return this._markerAccessor
            .deleteMarker(markerName)
            .finally(() => this._triggerUpdate())
            .then(() => {
                return {};
            })
    }

    importMarkers(data: MarkersExportData, deleteExtra: boolean)
    {
        return this._markerAccessor
            .importMarkers(data, deleteExtra)
            .finally(() => this._triggerUpdate())
            .then(() => {
                return {};
            }); 
    }

    private _triggerUpdate()
    {
        this._context.websocket.invalidateAll({ kind: WebSocketKind.markers_statuses });
    }
    
}