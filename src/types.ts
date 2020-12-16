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

export interface NodeItem {
    dn: string
    config: {
        kind: string
        alertCount: {
            [type: string]: number
        }
        selfAlertCount: {
            [type: string]: number
        }
        markers: string[]
    }
    labels: {
        [label: string]: string
    }
    annotations: {
        [annotation: string]: string
    }
}

export interface AlertsPayload {
    kind: string
    count: number
}
