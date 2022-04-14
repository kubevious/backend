export interface SearchQuery {
    criteria?: string
    kind?: CriteriaKinds
    errors?: AlertsPayload
    warnings?: AlertsPayload
    markers?: CriteriaMarkers
    labels?: CriteriaLabels
    annotations?: CriteriaAnnotations
}

export interface SearchKeyAutocompletion {
    criteria?: string
}

export interface SearchValueAutocompletion {
    key: string
    criteria?: string
}

export interface AlertsPayload {
    value: {
        kind: string
        count: number
    }
}

export type CriteriaMarkers = {
    [marker:string]: boolean
}

export type CriteriaLabels = {
    [label:string]: string
}

export type CriteriaAnnotations = {
    [annotation:string]: string
}

export type CriteriaKinds = {
    [kind:string]: boolean
}

export interface SearchResultItem {
    dn: string,
    clusterId: string
}

export interface SearchResult {
    results: SearchResultItem[],
    totalCount: number,
    wasFiltered: boolean
}