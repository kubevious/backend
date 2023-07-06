import _ from 'the-lodash';
import { ILogger } from 'the-logger' ;

import { Context } from '../../context';

import { Database } from '../../db';

import { MarkerConfig, MarkerStatus, MarkerResult } from '@kubevious/ui-middleware/dist/services/marker'

export class MarkerAccessor
{
    private _logger : ILogger;
    private _dataStore : Database;

    constructor(context : Context)
    {
        this._logger = context.logger.sublogger("MarkerAccessor");
        this._dataStore = context.dataStore;
    }

    get logger() {
        return this._logger;
    }

    queryAll()
    {
        return this._dataStore.table(this._dataStore.ruleEngine.Markers)
            .queryMany();
    }

    exportMarkers()
    {
        return this.queryAll()
            .then(result => {
                return {
                    kind: 'markers',
                    items: result
                };
            });
    }

    getMarker(name: string)
    {
        return this._dataStore.table(this._dataStore.ruleEngine.Markers)
            .queryOne({ name: name });
    }

    createMarker(config: MarkerConfig, targetMarkerName: string)
    {
        return Promise.resolve()
            .then((() => {
                if (targetMarkerName) {
                    if (config.name != targetMarkerName) {
                        return this._dataStore.table(this._dataStore.ruleEngine.Markers)
                            .delete({ name: targetMarkerName });
                    }
                }
            }))
            .then(() => {
                return this._dataStore.table(this._dataStore.ruleEngine.Markers)
                    .create({ 
                        name: config.name,
                        shape: config.shape,
                        color: config.color,
                        propagate: config.propagate
                    })
            });
    }

    deleteMarker(name: string)
    {
        return this._dataStore.table(this._dataStore.ruleEngine.Markers)
            .delete({ 
                name: name
            });
    }

    importMarkers(markers : { items: MarkerConfig[] }, deleteExtra: boolean)
    {
        return this._dataStore.table(this._dataStore.ruleEngine.Markers)
            .synchronizer({}, !deleteExtra)
            .execute(markers.items)
    }

    getAllMarkersItems()
    {
        return this._dataStore.table(this._dataStore.ruleEngine.MarkerItems)
            .queryMany();
    }

    getMarkerItems(name: string)
    {
        return this._dataStore.table(this._dataStore.ruleEngine.MarkerItems)
            .queryMany({ marker_name: name });
    }

    getMarkersStatuses()
    {
        return this._dataStore.table(this._dataStore.ruleEngine.Markers)
        .queryMany({}, {
            fields: {
                fields: ['name', 'shape', 'color']
            }
        })
        .then(markerRows => {

            return this._dataStore.table(this._dataStore.ruleEngine.MarkerItems)
                .queryGroup(['marker_name'], {}, ['COUNT(*) as count'])
                .then(markerItemRows => {

                    const results : MarkerStatus[] = [];

                    const markerItemsDict = _.makeDict(markerItemRows, x => x.marker_name!, x => x);

                    for(const markerRow of markerRows)
                    {
                        const markerItem = markerItemsDict[markerRow.name!];

                        results.push({
                            name: markerRow.name!,
                            shape: markerRow.shape!,
                            color: markerRow.color!,
                            item_count: markerItem ? (<any>markerItem).count : 0
                        })
                    }

                    return results;
                });

        })
    }

    getMarkerResult(name: string)
    {
        return this._dataStore.table(this._dataStore.ruleEngine.Markers)
            .queryOne({ name: name }, {
                fields: {
                    fields: ['name']
                }
            })
            .then(markerRow => {
                if (!markerRow) {
                    return null;
                }
                
                return this._dataStore.table(this._dataStore.ruleEngine.MarkerItems)
                    .queryMany({ marker_name: name })
                    .then(rows => {
                        const result : MarkerResult = {
                            name: name,
                            items: []
                        };
                        
                        for(const row of rows)
                        {
                            result.items.push({
                                dn: row.dn!,
                            });
                        }

                        return result;
                    })
            })
    }
}
