import _ from 'the-lodash';
import { ILogger } from 'the-logger' ;

import { Context } from '../context';
import { SearchResults } from './results';

import { Index as FlexSearchIndex  } from 'flexsearch'
import FlexSearch from 'flexsearch'

import { prettyKind as helperPrettyKind } from '@kubevious/helpers/dist/docs';
import { SearchQuery, AlertsPayload, Filters  } from '../types';
import { RegistryBundleState } from '@kubevious/helpers/dist/registry-bundle-state';
import { RegistryBundleNode } from '@kubevious/helpers/dist/registry-bundle-node';
import { AlertCounter } from '@kubevious/helpers/dist/registry-state';

export class SearchEngine
{
    private _logger : ILogger;
    private _context : Context;
    private _index?: FlexSearchIndex<any>;
    private _rawItems: RegistryBundleNode[] = [];

    constructor(context: Context)
    {
        this._context = context;
        this._logger = context.logger.sublogger("SearchEngine");
        
        this._reset();
    }

    get logger() {
        return this._logger;
    }

    accept(state: RegistryBundleState)
    {
        this._rawItems = state.nodeItems;

        this._reset()
        for(var node of state.nodeItems)
        {
            this._addSnapshotItemToIndex(node)
        }
    }

    private _reset()
    {
        this._index = FlexSearch.create<any>({
            encode: "icase",
            tokenize: "full",
            threshold: 1,
            resolution: 3,
            depth: 2
        });
    }

    private _addSnapshotItemToIndex(node: RegistryBundleNode)
    {
        var doc: string[] | string = [ node.dn ];
        var prettyKind = helperPrettyKind(node.config.kind);
        doc.push(prettyKind);
        doc = doc.join(' ');
        this._index!.add(node.dn as any, doc);
    }

    searchByKeyword(_condition: string, criteria: string, search: SearchResults) {
        if (criteria.length > 1 || search.wasFiltered) {
            const results = this._index!.search(criteria)
            this.logger.silly("SEARCH: %s, result: ", criteria, results);
            if (Array.isArray(results)) {
                const nodes = search.wasFiltered ? search.results : this._rawItems
                search.results = nodes.filter(item =>
                    results.some((x: string) =>
                        item.dn === x
                    )
                )
                search.wasFiltered = true
                return
            }
        }

        search.results = [];
        search.wasFiltered = true
    }

    filterByMarkers(_condition: string, criteriaMarkers: string[], search: SearchResults) {
        const nodes = search.wasFiltered ? search.results : this._rawItems
        search.results = nodes.filter(
            (item: RegistryBundleNode) =>
                criteriaMarkers.every((criteria) =>
                    item.registryNode.markersDict[criteria]
                    )
            )
        search.wasFiltered = true
    }

    filterByKind(_condition: string, value: string, search: SearchResults) {
        const nodes = search.wasFiltered ? search.results : this._rawItems
        search.results = nodes.filter((item) =>
            item.config.kind === value
        )
        search.wasFiltered = true
    }

    filterByAlerts(condition: keyof AlertCounter, value: string, search: SearchResults) {
        const parsedValue: AlertsPayload = JSON.parse(value)
        const nodes = search.wasFiltered ? search.results : this._rawItems
        search.results = nodes.filter((item) => {
            const selfCounter = item.selfAlertCount;
            const counter = item.alertCount;

            return parsedValue.kind === 'at-least'
                ? counter[condition] as number >= parsedValue.count || selfCounter[condition] >= parsedValue.count
                : counter[condition] <= parsedValue.count && selfCounter[condition] <= parsedValue.count || !counter[condition] && !selfCounter[condition]
        })
        search.wasFiltered = true
    }

    filterByFields(condition: 'labels' | 'annotations', value: string[], search: SearchResults) {
        const nodes: RegistryBundleNode[] = search.wasFiltered ? search.results : this._rawItems
        search.results = nodes.filter((item: RegistryBundleNode) => {
            let hasCriteria = value.every((filterCriteria) => {
                const { key, value }: { key: string; value: string} = JSON.parse(filterCriteria)
                return this.filterByFieldCriteria(item, condition, value, key)
        })
            return hasCriteria
        })
        search.wasFiltered = true
    }

    filterByFieldCriteria(item: RegistryBundleNode, condition: 'labels' | 'annotations', criteria: string, type: string) {
        let isFound = false
        const itemProps = item[condition].config
        if (itemProps) {
            Object.entries(itemProps).forEach(([key, value]) => {
                if (key === type && value === criteria) {
                    return isFound = true
                }
            })
        }
        return isFound
    }

    search(query: SearchQuery)
    {
        const search = new SearchResults()
        let response: {
            totalCount?: number
            results?: { dn: string }[]
        } = {}

        const filterMapping: Record<string, Function> = {
            [Filters.kind]: this.filterByKind.bind(this),
            [Filters.annotations]: this.filterByFields.bind(this),
            [Filters.error]: this.filterByAlerts.bind(this),
            [Filters.labels]: this.filterByFields.bind(this),
            [Filters.markers]: this.filterByMarkers.bind(this),
            [Filters.warn]: this.filterByAlerts.bind(this),
            [Filters.criteria]: this.searchByKeyword.bind(this)
        }

        let filter: keyof SearchQuery
        for (filter in query as SearchQuery) {

            const mapCurrentFilter = filterMapping[filter]

            mapCurrentFilter(filter, query[filter], search)
        }

        const resultsArray = search.results

        response.totalCount = resultsArray.length
        response.results = resultsArray.slice(0, 200).map((el: RegistryBundleNode) => ({ dn: el.dn }))

        search.wasFiltered = false
        return response
    }

}
