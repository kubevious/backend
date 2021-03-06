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
    
    acceptExecutionContext(executionContext: ExecutionContext)
    {
        this._acceptMarkerItems(executionContext);
    }

    private _acceptMarkerItems(executionContext: ExecutionContext)
    {
        this._markerResultsDict = {};

        for(let markerResult of _.values(executionContext.markers))
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

    private _refreshMarkerItems()
    {
        return this._context.markerAccessor.getAllMarkersItems()
            .then(result => {
                let executionContext : ExecutionContext = {
                    rules: {},
                    markers: {},
                }
                for(let row of result)
                {
                    if (!executionContext.markers[row.marker_name]) {
                        executionContext.markers[row.marker_name] = {
                            name: row.marker_name,
                            items: [],
                        }
                    }
                    executionContext.markers[row.marker_name].items.push(row.dn);
                }
                this._acceptMarkerItems(executionContext);
            })
    }

    private _refreshMarkerConfigs()
    {
        return this._context.markerAccessor.queryAll()
            .then(result => {
                this._markerDict = _.makeDict(result, x => x.name, x => x);
                this._markerList = _.orderBy(result, x => x.name);
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
        var item_count = 0;
        var result = this._markerResultsDict[marker.name];
        if (result) {
            item_count = result.items.length;
        }
        
        return {
            name: marker.name,
            shape: marker.shape,
            color: marker.color,
            item_count: item_count
        }
    }

    private _updateMarkerResults()
    {
        var items = _.values(this._markerResultsDict).map(x => ({
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
        var marker = this._markerDict[name];
        if (!marker) {
            return null;
        }
        return marker;
    }
}