export interface SearchQuery {
    criteria?: string
    kinds?: CriteriaKinds
    errors?: AlertsPayload
    warnings?: AlertsPayload
    markers?: CriteriaMarkers
    labels?: CriteriaLabels
    annotations?: CriteriaAnnotations
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
