import _ from 'the-lodash';
import { Promise } from 'the-promise';
import { ILogger } from 'the-logger' ;

import { Context } from '../context';

import { Index as FlexSearchIndex  } from 'flexsearch'
import FlexSearch from 'flexsearch'

import * as DocsHelper from '@kubevious/helpers/dist/docs';
import { RegistryBundleState } from '@kubevious/helpers/dist/registry-bundle-state';

export class SearchEngine
{
    private _logger : ILogger;
    private _context : Context;
    private _index? : any; //FlexSearchIndex<any>;

    constructor(context: Context)
    {
        this._context = context;
        this._logger = context.logger.sublogger("SearchEngine");
        this.reset();
    }

    get logger() {
        return this._logger;
    }

    accept(state: RegistryBundleState)
    {
        this.reset()

        for(var node of state.nodeItems)
        {
            this.addSnapshotItemToIndex(node.dn, node.config);
        }
    }

    reset()
    {
        this._index = FlexSearch.create<any>({
            encode: "icase",
            tokenize: "full",
            threshold: 1,
            resolution: 3,
            depth: 2
        });
    }

    addSnapshotItemToIndex(dn: string, item: any)
    {
        var doc = [ dn ];
        var prettyKind = DocsHelper.prettyKind(item.kind);
        doc.push(prettyKind);
        var str = doc.join(' ');
        this._index.add(dn, str);
    }

    search(criteria: string[])
    {
        if ((!criteria) || criteria.length < 2) {
            return [];
        }  
        var results = this._index.search(criteria);
        this.logger.silly("SEARCH: %s, result: ", criteria, results);
        if (_.isArray(results)) {
            results = results.map(x => ({ dn: x }))
        } else {
            results = [];
        }
        return results;
    }

}
