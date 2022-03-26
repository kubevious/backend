import _ from 'the-lodash';
import { Promise } from 'the-promise';
import { ILogger } from 'the-logger' ;

import { Context } from '../context';

import { Database } from '../db';

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

    createMarker(config: any, target: any)
    {
        return Promise.resolve()
            .then((() => {
                if (target) {
                    if (config.name != target.name) {
                        return this._dataStore.table(this._dataStore.ruleEngine.Markers)
                            .delete(target);
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

    importMarkers(markers : { items: any[]}, deleteExtra: boolean)
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

}
