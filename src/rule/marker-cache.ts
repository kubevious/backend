import _ from 'the-lodash';
import { Promise } from 'the-promise';
import { ILogger } from 'the-logger' ;

import { Context } from '../context';
import { ExecutionContext } from '@kubevious/helper-rule-engine';

export type Marker = Record<string, any>;
export interface MarkerResult 
{
    name: string;
    items: { dn: string}[];
}

export interface MarkerStatus
{
    name: string,
    shape: string,
    color: string,
    item_count: number
}

export class MarkerCache
{
    private _context: Context;
    private _logger : ILogger;

    private _markerDict : Record<string, Marker> = {};
    private _markerList : Marker[] = [];
    private _markersStatuses : MarkerStatus[] = [];
    private _markerResultsDict : Record<string, MarkerResult> = {};

    constructor(context: Context)
    {
        this._context = context;
        this._logger = context.logger.sublogger("MarkerCache");

        context.database.onConnect(this._onDbConnected.bind(this));
    }

    get logger() {
        return this._logger;
    }

    private _onDbConnected()
    {
        this._logger.info("[_onDbConnected] ...");

        return Promise.resolve()
            .then(() => this._refreshMarkerConfigs())
            .then(() => this._refreshMarkerItems())
    }

    triggerUpdate()
    {
        return Promise.resolve()
            .then(() => this._refreshMarkerConfigs())
            .then(() => this._updateMarkerOperationData())
    }
    
    // acceptExecutionContext(executionContext: ExecutionContext)
    // {
    //     this._acceptMarkerItems(executionContext);
    // }

    private _refreshMarkerItems()
    {
        return this._context.markerAccessor.getAllMarkersItems()
            .then(markerItems => {
                const executionContext : ExecutionContext = {
                    rules: {},
                    markers: {},
                }
                for(const row of markerItems)
                {
                    const markerName = row.marker_name!;
                    if (!executionContext.markers[markerName]) {
                        executionContext.markers[markerName] = {
                            name: markerName,
                            items: [],
                        }
                    }
                    executionContext.markers[markerName].items.push(row.dn!);
                }
                this._acceptMarkerItems(executionContext);
            })
    }

    private _acceptMarkerItems(executionContext: ExecutionContext)
    {
        this._markerResultsDict = {};

        for(const markerResult of _.values(executionContext.markers))
        {
            this._markerResultsDict[markerResult.name] = {
                name: markerResult.name,
                items: markerResult.items.map((x => ({
                    dn: x
                })))
            }
        }
        
        this._updateMarkerOperationData();
    }

    private _refreshMarkerConfigs()
    {
        return this._context.markerAccessor.queryAll()
            .then(result => {
                this._markerDict = _.makeDict(result, x => x.name!, x => x);
                this._markerList = _.orderBy(result, x => x.name!);
            })
            ;
    }

    private _updateMarkerOperationData()
    {
        this._updateMarkersStatuses();
        this._updateMarkerResults();
    }

    private _updateMarkersStatuses()
    {
        this._markersStatuses = this._markerList.map(x => this._makeMarkerStatus(x));
        this._context.websocket.update({ kind: 'markers-statuses' }, this._markersStatuses);
    }

    private _makeMarkerStatus(marker: Marker) : MarkerStatus
    {
        const results = this._markerResultsDict[marker.name];
        
        return {
            name: marker.name,
            shape: marker.shape,
            color: marker.color,
            item_count: results?.items?.length ?? 0
        }
    }

    private _updateMarkerResults()
    {
        const items = _.values(this._markerResultsDict).map(x => ({
            target: { name: x.name },
            value: x
        }));
        this._context.websocket.updateScope({ kind: 'marker-result' }, items);
    }

    getMarkersStatuses()
    {
        return this._markersStatuses;
    }

    getMarkerResult(name: string) : MarkerResult | null
    {
        if (this._markerResultsDict[name]) {
            return this._markerResultsDict[name];
        }
        return null;
    }

    queryMarkerList()
    {
        return this._markerList;
    }

    queryMarker(name: string) : Marker | null
    {
        const marker = this._markerDict[name];
        if (!marker) {
            return null;
        }
        return marker;
    }
}