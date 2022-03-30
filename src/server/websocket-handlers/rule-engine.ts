// import { WebSocketNameFetcher, ClusterWebSocketNameFetcher } from '@kubevious/saas-data-models'
import { WebSocketKind } from '../types'
import { WebSocketHandler } from '../types'

export const RULE_ENGINE_HANDLERS : WebSocketHandler[] = [

    {
        kind: [
            WebSocketKind.rules_list
        ],
        fetcher: ({ context }) => {
            return context.ruleAccessor.queryAll();
        }
    },

    {
        kind: [
            WebSocketKind.rules_statuses
        ],
        fetcher: ({ context }) => {
            return context.ruleAccessor.getRulesStatuses();
        }
    },

    {
        kind: [
            WebSocketKind.rule_result
        ],
        fetcher: ({ target, context }) => {
            return context.ruleAccessor.getRuleResult((<any>target).name);
        }
    },

    {
        kind: [
            WebSocketKind.markers_list
        ],
        fetcher: ({ context }) => {
            return context.markerAccessor.queryAll();
        },
    },

    {
        kind: [
            WebSocketKind.markers_statuses
        ],
        fetcher: ({ context }) => {
            return context.markerAccessor.getMarkersStatuses();
        },
    },


    {
        kind: [
            WebSocketKind.marker_result
        ],
        fetcher: ({ target, context }) => {
            return context.markerAccessor.getMarkerResult((<any>target).name);
        }
    }

];
