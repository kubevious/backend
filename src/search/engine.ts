import _ from 'the-lodash';
import { ILogger } from 'the-logger' ;
import { RegistryState } from '@kubevious/helpers/dist/registry-state';

import { Context } from '../context';
import { SearchResults } from './results';

import { Index as FlexSearchIndex  } from 'flexsearch'
import FlexSearch from 'flexsearch'

import { prettyKind as helperPrettyKind } from '@kubevious/helpers/dist/docs';
import { SearchQuery, NodeItem, AlertsPayload  } from '../types';

export class SearchEngine
{
    private _logger : ILogger;
    private _context : Context;
    private _index?: any; //FlexSearchIndex<any>;
    private _rawItems: NodeItem[]

    constructor(context: Context)
    {
        this._context = context;
        this._logger = context.logger.sublogger("SearchEngine");
        this._rawItems = []
        this.reset();
    }

    get logger() {
        return this._logger;
    }

    accept(state: RegistryState)
    {
        this.reset()

        for(var node of state.getNodes())
        {
            const { labels, annotations } = state.getProperties(node.dn)
            const nodeLabels = labels ? labels.config : {}
            const nodeAnnotations = annotations ? annotations.config : {}
            this._rawItems.push({ ...node, labels: nodeLabels, annotations: nodeAnnotations })
            this.addSnapshotItemToIndex(node)
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

    addSnapshotItemToIndex(node: any)
    {
        var doc: any = [ node.dn ];
        var prettyKind = helperPrettyKind(node.config.kind);
        doc.push(prettyKind);
        doc = doc.join(' ');
        this._index.add(node.dn, doc);
    }

    searchByKeyword(criteria: string, search: SearchResults) {
        if (criteria.length > 1 || search.wasFiltered) {
            var results = this._index.search(criteria);
            this.logger.silly("SEARCH: %s, result: ", criteria, results);
            if (Array.isArray(results)) {
                const nodes = search.wasFiltered ? search.results : this._rawItems
                search.results = nodes.filter((item: NodeItem) => {
                    return results.some((x: string) => {
                        return item.dn === x
                    })
                })
                search.wasFiltered = true
                return
            }
        }

        search.results = [];
        search.wasFiltered = true
    }

    applyFilter(filter: string, criteria: any, search: SearchResults) {
            switch (filter) {
                case 'kind': {
                    this.filterByKind(criteria, search)
                    return
                }
                case 'labels': {
                    this.filterByFields(filter, criteria, search)
                    return
                }
                case 'error': {
                    this.filterByAlerts(filter, criteria, search)
                    return
                }
                case 'warn': {
                    this.filterByAlerts(filter, criteria, search)
                    return
                }
                case 'annotations': {
                    this.filterByFields(filter, criteria, search)
                    return
                }
                case 'markers': {
                    this.filterByMarkers(criteria, search)
                    return
                }
                default: {
                    this.searchByKeyword(criteria, search)
                    return
                }
            }
    }

    filterByMarkers(criteriaMarkers: string[], search: SearchResults) {
        const nodes = search.wasFiltered ? search.results : this._rawItems
        search.results = nodes.filter(
            (item: NodeItem) =>
                item.config!.markers &&
                criteriaMarkers.every((criteria) =>
                    item.config!.markers.some((marker: string) => criteria === marker)
                )
        )
        search.wasFiltered = true
    }

    filterByKind(value: string, search: SearchResults) {
        const nodes = search.wasFiltered ? search.results : this._rawItems
        search.results = nodes.filter((item: NodeItem) =>
            item.config!.kind === value
        )
        search.wasFiltered = true
    }

    filterByAlerts(condition: string, value: string, search: SearchResults) {
        const parsedValue: AlertsPayload = JSON.parse(value)
        const nodes = search.wasFiltered ? search.results : this._rawItems
        search.results = nodes.filter((item: NodeItem) => {
            const selfCounter = item.config!.selfAlertCount
            const counter = item.config!.alertCount

            return parsedValue.kind === 'at-least'
                ? counter[condition] as number >= parsedValue.count || selfCounter[condition] >= parsedValue.count
                : counter[condition] <= parsedValue.count && selfCounter[condition] <= parsedValue.count || !counter[condition] && !selfCounter[condition]
        })
        search.wasFiltered = true
    }

    filterByFields(condition: keyof NodeItem, value: string[], search: SearchResults) {
        const nodes: NodeItem[] = search.wasFiltered ? search.results : this._rawItems
        search.results = nodes.filter((item: NodeItem) => {
            let hasCriteria = value.every((filterCriteria) => {
                const { key, value }: { key: string; value: string} = JSON.parse(filterCriteria)
                return this.filterByFieldCriteria(item, condition, value, key)
        })
            return hasCriteria
        })
        search.wasFiltered = true
    }

    filterByFieldCriteria(item: NodeItem, condition: keyof NodeItem, criteria: string, type: string) {
        let isFound = false
        Object.entries(item[condition]).forEach(([key, value]) => {
            if (key === type && value === criteria) {
                return isFound = true
            }
        })
        return isFound
    }

    search(query: SearchQuery)
    {
        const search = new SearchResults()
        let response: {
            totalCount?: number
            results?: { dn: string }[]
        } = {}

        let filter: keyof SearchQuery
        for (filter in query as SearchQuery) {
            this.applyFilter(filter, query[filter], search)
        }

        const resultsArray = search.results

        response.totalCount = resultsArray.length
        response.results = resultsArray.slice(0, 200).map((el: NodeItem) => ({ dn: el.dn }))

        search.wasFiltered = false
        return response
    }

}
