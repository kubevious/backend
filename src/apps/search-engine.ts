
import { ILogger } from 'the-logger';
import _ from 'the-lodash';

import { Context } from '../context'

import { RedisClient } from '@kubevious/helper-redis';
import { AlertsPayload, CriteriaLabels, SearchKeyAutocompletion, SearchQuery, SearchResultItem, SearchValueAutocompletion } from '../types/search';
import { RedisSearchNameFetcher } from '@kubevious/data-models';

export class SearchEngine
{
    private logger: ILogger;
    private _redisearch: RedisClient;
    private _itemResults : SearchResultItem[][] = [];

    private _nameFetcher : RedisSearchNameFetcher;

    private _nodeIndexName: string;

    constructor(context: Context)
    {
        this.logger = context.logger.sublogger('SearchEngine');
        this._redisearch = context.redis;

        this._nameFetcher = new RedisSearchNameFetcher();

        this._nodeIndexName = `idx.${this._nameFetcher.nodeKeyPrefix}`;
    }

    execute(query: SearchQuery)
    {
        this.logger.silly("[execute] query: ", query);

        this._itemResults = [];

        return this._checkIndexExists()
            .then(exists => {
                if (exists) {
                    return Promise.resolve()
                        .then(() => {
                            return this._getNodeResults(query)
                                .then(result => {
                                    this._addItemResult(result);
                                })
                        })
                        .then(() => {
                            return this._getDictQueryResults(this._nameFetcher.labelSearchIndex, query.labels)
                                .then(result => {
                                    this._addItemResult(result);
                                })
                        })
                        .then(() => {
                            return this._getDictQueryResults(this._nameFetcher.annoSearchIndex, query.annotations)
                                .then(result => {
                                    this._addItemResult(result);
                                })
                        })
                }
            })
            .then(() => {
                if (this._itemResults.length == 0) {
                    return {
                        results: [],
                        totalCount: 0,
                        wasFiltered: false
                    };
                }

                const items = this._getItems(this._itemResults);

                return {
                    results: items,
                    totalCount: items.length,
                    wasFiltered: true
                };
            });
    }



    runLabelKeyAutocompletion(query: SearchKeyAutocompletion)
    {
        return this._runKeyAutocompletion(
            this._nameFetcher.labelSearchIndex,
            query
        );
    }

    runLabelValueAutocompletion(query: SearchValueAutocompletion)
    {
        return this._runValueAutocompletion(
            this._nameFetcher.labelSearchIndex,
            query
        );
    }

    runAnnoKeyAutocompletion(query: SearchKeyAutocompletion)
    {
        return this._runKeyAutocompletion(
            this._nameFetcher.annoSearchIndex,
            query
        );
    }

    runAnnoValueAutocompletion(query: SearchValueAutocompletion)
    {
        return this._runValueAutocompletion(
            this._nameFetcher.annoSearchIndex,
            query
        );
    }

    private _addItemResult(result: SearchResultItem[] | null)
    {
        if (_.isNotNullOrUndefined(result)) {
            this._itemResults.push(result!)
        }
    }

    private _runKeyAutocompletion(indexName: string, query: SearchKeyAutocompletion) : Promise<string[]>
    {
        const parts : string[] = [];

        if (query.criteria) {
            this._addTextFilter('key', query.criteria, parts);
        }

        if (parts.length == 0) {
            return Promise.resolve([]);
        }

        const queryString = parts.join(" ");

        return Promise.resolve()
            .then(() => {
                return this._redisearch.redisearch.index(indexName)
                    .aggregate(queryString, {
                        groupBy: ['key']
                    })
            })
            .then(result => {
                // this.logger.error("[runKeyAutocompletion] %s :: RESULT: ", indexName, result);
                return _.map(result, x => x['key']);
            })
    }

    private _runValueAutocompletion(indexName: string, query: SearchValueAutocompletion) : Promise<string[]>
    {
        const parts : string[] = [];

        if (query.key) {
            this._addTextFilter('key', query.key, parts);
        }
        if (query.criteria) {
            this._addTextFilter('value', query.criteria, parts);
        }

        if (parts.length == 0) {
            return Promise.resolve([]);
        }

        const queryString = parts.join(" ");

        return Promise.resolve()
            .then(() => {
                return this._redisearch.redisearch.index(indexName)
                    .aggregate(queryString, {
                        groupBy: ['value']
                    })
            })
            .then(result => {
                this.logger.debug("[runValueAutocompletion] %s :: RESULT: ", indexName, result);
                return _.map(result, x => x['value']);
            })
    }

    private _getItems(itemResults : SearchResultItem[][]) : SearchResultItem[]
    {
        if (itemResults.length == 1) {
            return itemResults[0];
        }
        const items = _.intersectionWith(
            ...itemResults,
            (a: SearchResultItem, b: SearchResultItem) => {
                return (a.dn === b.dn) && (a.clusterId == b.clusterId);
            }
        );
        return items;
    }

    private _checkIndexExists()
    {
        return this._redisearch.redisearch.index(this._nodeIndexName)
            .info()
            .then(result => {
                return _.isNotNullOrUndefined(result);
            })
    }

    private _getNodeResults(query: SearchQuery) : Promise<SearchResultItem[] | null>
    {
        const parts : string[] = [];

        if (query.kind)
        {
            for(const kind of _.keys(query.kind))
            {
                parts.push(`@kind:{${kind}}`);
            }
        }

        if (query.criteria)
        {
            this._addTextFilter('text', query.criteria, parts);
        }

        if (query.markers) {
            for(const marker of _.keys(query.markers)) {
                parts.push(`@markers:{${escapeTag(marker)}}`);
            }
        }

        if (query.errors) {
            this._addNumberFilter('error', query.errors!, parts);
        }

        if (query.warnings) {
            this._addNumberFilter('warn', query.warnings!, parts);
        }

        if (parts.length == 0) {
            return Promise.resolve(null);
        }

        const queryString = parts.join(" ");
        this.logger.debug("[_getNodeResults] indexName: %s, queryString: %s", this._nodeIndexName, queryString);

        return Promise.resolve()
            .then(() => {
                return this._redisearch.redisearch.index(this._nodeIndexName)
                    .search(queryString, {
                        fields: ['dn', 'clusterId']
                    })
            })
            .then(result => {
                const items = result.items.map(x => {
                    return {
                        dn: x.value['dn'],
                        clusterId: x.value['clusterId']
                    }
                });

                this.logger.debug("[_getNodeResults] RESULT COUNT: ", items.length);
                this.logger.silly("[_getNodeResults] RESULT: ", items);
                return items;
            })
    }

    private _getDictQueryResults(indexName: string, query?: CriteriaLabels) : Promise<SearchResultItem[] | null>
    {
        const parts : string[] = [];

        if (query) {
            for(const key of _.keys(query))
            {
                this._addTextFilter('key', key, parts);

                const value = query[key];
                this._addTextFilter('value', value, parts);
            }
        }

        if (parts.length == 0) {
            return Promise.resolve(null);
        }

        const queryString = parts.join(" ");

        return Promise.resolve()
            .then(() => {
                return this._redisearch.redisearch.index(indexName)
                    .search(queryString, {
                        fields: ['dn', 'clusterId']
                    })
            })
            .then(result => {
                const items = result.items.map(x => {
                    return {
                        dn: x.value['dn'],
                        clusterId: x.value['clusterId']
                    }
                });

                return items;
            })
    }

    private _addNumberFilter(name: string, alert: AlertsPayload, parts: string[])
    {
        if (!alert.value) {
            return;
        }

        const count = alert.value.count || 0;

        if (alert.value.kind === 'at-least') {
            parts.push(`@${name}:[${count} +inf]`);
        }

        if (alert.value.kind === 'at-most') {
            parts.push(`@${name}:[0 ${count}]`);
        }
    }

    private _addTextFilter(field: string, value: string, parts : string[])
    {
        const valueParts = value.split(/[\s-+*/=~|.:(){}\[\]\'\"`]+/);

        for(const valuePart of valueParts)
        {
            let str = valuePart;
            str = escapeString(str);
            this._addTextFilterRaw(field, str, parts);
        }
    }

    private _addTextFilterRaw(field: string, value: string, parts : string[])
    {
        if (value.length < 2) {
            return;
        }
        parts.push(`@${field}:(${value}|${value}*|%${value}%)`);
    }
    
}

const ESCAPE_CHARS = [
    '-',
    '=',
    '~',
    ':'
]

const REMOVE_CHARS = [
    '(',
    ')',
    '{',
    '}',
    '[',
    ']',
    ']',
    '\'',
    '"',
]


function escapeString(s : string) : string
{
    for(const ch of REMOVE_CHARS)
    {
        s = _.replaceAll(s, `\\${ch}`, '');
    }
    for(const ch of ESCAPE_CHARS)
    {
        s = _.replaceAll(s, `\\${ch}`, `\\${ch}`);
    }
    return s;
}


const TAG_ESCAPE_CHARS = [
    '-',
    '\'',
    '"'
]

function escapeTag(s : string) : string
{
    for(const ch of TAG_ESCAPE_CHARS)
    {
        s = _.replaceAll(s, `\\${ch}`, `\\${ch}`);
    }
    return s;
}