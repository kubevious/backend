import { RegistryBundleState } from '@kubevious/helpers/dist/registry-bundle-state';
import { Context } from '../context';

type Counters = {
    [key: string]: {
        [label: string]: {
            counter: number
            [value: string]: any
        }
    }
}

export class AutocompleteBuilder {
    private _context: Context
    private _labelsDictionary: Object[]
    private _annotationsDictionary: Object[]

    private counters: Counters

    constructor(context: Context) {
        this._context = context
        this._labelsDictionary = []
        this._annotationsDictionary = []
        this.counters = {
            labels: {},
            annotations: {}
        }
    }

    accept(state: RegistryBundleState) {
        for (var node of state.getNodes()) {
            const { labels, annotations } = state.getProperties(node.dn)
            const nodeLabels =
                labels && Object.keys(labels.config).length > 0
                    ? labels.config
                    : null
            const nodeAnnotations = annotations ? annotations.config : null
            if (nodeLabels) {
                this._labelsDictionary.push(nodeLabels)
                for (let [labelsKeys, labelsValues] of Object.entries(nodeLabels as {[key: string]: string})) {
                    this.addToCounters(labelsKeys, labelsValues, 'labels')
                }

            }
            if (nodeAnnotations) {
                this._annotationsDictionary.push(nodeAnnotations)
                for (let [annotationsKeys, annotationsValues] of Object.entries(nodeAnnotations as {[key: string]: string})) {
                    this.addToCounters(annotationsKeys, annotationsValues, 'annotations')
                }
            }
        }
    }

    getKeys(type: string, criteria: string) {
        let results: string[] = []
        const currentDictionary = type === 'labels' ? this._labelsDictionary : this._annotationsDictionary
        currentDictionary.map((label: Object) =>
            Object.keys(label).forEach((key: string) => {
                if (key.includes(criteria)) {
                    results = results.some((resultKey: string) => resultKey === key)
                        ? results
                        : [...results, key]
                }
            })
        )
        results = results.sort((a, b) => this.orderKeysByRelevance(a, b, type))
        return results
    }

    getValues(type: string, { key, criteria }: { key: string, criteria: string }) {
        let results: string[] = []
        const currentDictionary: any[] = type === 'labels' ? this._labelsDictionary : this._annotationsDictionary
        currentDictionary.map((label: {[key: string]: string}) => {
            if (label[key] && label[key].includes(criteria)) {
                results = results.some((resultVal: string) => resultVal === label[key])
                    ? results
                    : [...results, label[key]]
            }
        })
        results =  results.sort((a, b) => this.orderValuesByRelevance(a, b, key, type))
        return results
    }

    orderKeysByRelevance(a: string, b: string, type: string) {
        const keyCounterA: number = this.counters[type][a]
            ? +this.counters[type][a].counter
            : 0
        const keyCounterB: number = this.counters[type][b]
            ? +this.counters[type][b].counter
            : 0

        return keyCounterB - keyCounterA
    }

    orderValuesByRelevance(a: string, b: string, key: string, type: string) {
        const keyCounterA =
            this.counters[type][key] && this.counters[type][key][a]
                ? this.counters[type][key][a].counter
                : 0
        const keyCounterB =
            this.counters[type][key] && this.counters[type][key][b]
                ? this.counters[type][key][b].counter
                : 0
        return keyCounterB - keyCounterA
    }

    addToCounters(key: string, value: string, type: string) {
        const currentKey = this.counters[type][key]
        let currentKeyCounter: number = currentKey ? +currentKey.counter || 0 : 0
        let currentValueCounter: number = currentKey && currentKey[value] ? currentKey[value].counter || 0 : 0
        this.counters[type][key] = { ...currentKey, counter: ++currentKeyCounter }
        this.counters[type][key][value] = {
            counter: ++currentValueCounter
        }

    }
}
