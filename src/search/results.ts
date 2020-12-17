import { RegistryBundleNode } from "@kubevious/helpers/dist/registry-bundle-node"

export class SearchResults {
    private _wasFiltered: boolean
    private _results: RegistryBundleNode[]

    constructor() {
        this._wasFiltered = false
        this._results = []
    }


    set wasFiltered(value) {
        this._wasFiltered = value
    }

    set results(data) {
        this._results = data
    }

    get results () {
        return this._results
    }

    get wasFiltered() {
        return this._wasFiltered
    }
}
