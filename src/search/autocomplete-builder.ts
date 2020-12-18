import { RegistryBundleState } from '@kubevious/helpers/dist/registry-bundle-state';
import _ from 'the-lodash'
import { ILogger } from 'the-logger/dist';
import { Context } from '../context';

type Counters = {
    [label: string]: {
        count: number;
        values: {
            [value: string]: number;
        };
    };
};

export interface NodeBundleItemConfig {
    labels: { config?: Record<string, string> };
    annotations: { config?: Record<string, string> };
}

type Dictionary = Record<string, Record<string, boolean>>

type ValuesPayload = { key: string, criteria: string }

export class AutocompleteBuilder {
    private _logger : ILogger;
    private _context: Context
    private _labelsDictionary: Dictionary
    private _annotationsDictionary: Dictionary
    private labelsCounters: Counters
    private annotationsCounters: Counters

    constructor(context: Context) {
        this._context = context
        this._logger = this._context.logger.sublogger("AutocompleteBuilder");

        this._labelsDictionary = {}
        this._annotationsDictionary = {}
        this.labelsCounters = {},
        this.annotationsCounters = {}
    }

    accept(state: RegistryBundleState) {
        for (var node of state.nodeItems) {
            const { labels, annotations }: NodeBundleItemConfig = node
            if (labels.config) {
                for (let [labelsKeys, labelsValues] of Object.entries(labels.config)) {
                    this._addToLabelsCounters(labelsKeys, labelsValues)
                    this._labelsDictionary[labelsKeys] = this._labelsDictionary[labelsKeys]
                        ? { ...this._labelsDictionary[labelsKeys], [labelsValues]: true }
                        : { [labelsValues]: true }
                }

            }
            if (annotations.config) {
                for (let [annotationsKeys, annotationsValues] of Object.entries(annotations.config)) {
                    this._addToAnnotationsCounters(annotationsKeys, annotationsValues)
                    this._annotationsDictionary[annotationsKeys] = this._annotationsDictionary[annotationsKeys]
                    ? { ...this._annotationsDictionary[annotationsKeys], [annotationsValues]: true }
                    : { [annotationsValues]: true }
                }
            }
        }

        this._logger.info("this._labelsDictionary: ", this._labelsDictionary);
    }

    getLabels(criteria: string) {
        return this._getKeys(this._labelsDictionary, criteria, this.labelsCounters)
    }

    getAnnotations(criteria: string) {
        return this._getKeys(this._annotationsDictionary, criteria, this.annotationsCounters)
    }

    private _getKeys(dictionary: Dictionary, criteria: string, counter: Counters) {
        let results: string[] = []

        Object.keys(dictionary).forEach((key: string) => {
            if (key.includes(criteria)) {
                results = results.some((resultKey: string) => resultKey === key)
                    ? results
                    : [...results, key]
            }
        })
        results = _.orderBy(results, x => counter[x].count, 'desc')

        return results
    }

    getLabelValues({ key, criteria }: ValuesPayload) {
        return this._getValues(this._labelsDictionary, key, criteria, this.labelsCounters)
    }

    getAnnotationValues({ key, criteria }: ValuesPayload) {
        return this._getValues(this._annotationsDictionary, key, criteria, this.annotationsCounters)
    }

    private _getValues(dictionary: Dictionary, key: string, criteria: string, counter: Counters) {
        let results: string[] = []
        Object.keys(dictionary[key]).forEach(value => {
            if (value && value.includes(criteria)) {
                results = results.some((resultVal: string) => resultVal === value)
                    ? results
                    : [...results, value]
            }
        })
        results = _.orderBy(results, x => counter[key].values[x], 'desc')
        return results
    }

    private _addToLabelsCounters(key: string, value: string) {
        this._increaseCounter(this.labelsCounters, key, value)
    }

    private _addToAnnotationsCounters(key: string, value: string) {
        this._increaseCounter(this.annotationsCounters, key, value)
    }

    private _increaseCounter(counter: Counters, key: string, value: string) {
        const currentKey = counter[key]
        let currentKeyCounter: number = currentKey ? +currentKey.count || 0 : 0
        let currentValueCounter: number = currentKey && currentKey.values ? currentKey.values[value] || 0 : 0
        counter[key] = {
            ...currentKey,
            count: ++currentKeyCounter,
            values: { ...currentKey?.values, [value]: ++currentValueCounter },
        };
    }

}
