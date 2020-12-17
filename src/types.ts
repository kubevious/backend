export interface SearchQuery {
    criteria?: string
    kind?: string
    error?: AlertsPayload
    warn?: AlertsPayload
    markers?: string[]
    labels?: {
        [name: string]: string
    }[]
    annotations?: {
        [name: string]: string
    }[]
}

export interface AlertsPayload {
    kind: string
    count: number
}

export enum Filters {
    kind = 'kind',
    labels = 'labels',
    error = 'error',
    warn = 'warn',
    annotations = 'annotations',
    markers = 'markers',
    criteria = 'criteria'
}
