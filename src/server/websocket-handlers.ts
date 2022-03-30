// import { WebSocketNameFetcher, ClusterWebSocketNameFetcher } from '@kubevious/saas-data-models'
import { WebSocketKind } from './types'
// import { ClusterStatusAccessor } from '@kubevious/saas-data-models';
// import { ClustersAccessor } from '../app/clusters-accessor';

// import { MarkersAccessor } from '../app/markers-accessor';
// import { RulesAccessor } from '../app/rules-accessor';
import { WebSocketHandler } from './types'

// import * as BufferUtils from '@kubevious/helpers/dist/buffer-utils';
// import { ProjectSummaryAccessor } from '../app/project-summary-accessor';

export const HANDLERS : WebSocketHandler[] = [

    // {
    //     kind: [
    //         WebSocketKind.project_summary
    //     ],
    //     targetExtrasBuilder: (target, socketLocals, socketContext, context) => {
    //         if (!socketLocals.projectIdStr) {
    //             return null;
    //         }
    //         return {
    //             'projectId': socketLocals.projectIdStr
    //         }
    //     },
    //     fetcher: (target, socketLocals, socketContext, context) => {
    //         if (!socketLocals.projectDataStore) {
    //             return null;
    //         }
    //         const accessor = new ProjectSummaryAccessor(context, socketLocals.projectDataStore);
    //         return accessor.getSummary();
    //     },
    //     redisKeyConstructor: (target, socketLocals, socketContext, context) => {
    //         const nameFetcher = new WebSocketNameFetcher(socketLocals.projectIdStr);
    //         return nameFetcher.projectSummary();
    //     }
    // },

    // {
    //     kind: [
    //         WebSocketKind.clusters_list
    //     ],
    //     targetExtrasBuilder: (target, socketLocals, socketContext, context) => {
    //         if (!socketLocals.projectIdStr) {
    //             return null;
    //         }
    //         return {
    //             'projectId': socketLocals.projectIdStr
    //         }
    //     },
    //     fetcher: (target, socketLocals, socketContext, context) => {
    //         if (!socketLocals.projectDataStore) {
    //             return null;
    //         }
    //         const accessor = new ClustersAccessor(context, socketLocals.projectDataStore);
    //         return accessor.getClusters();
    //     },
    //     redisKeyConstructor: (target, socketLocals, socketContext, context) => {
    //         const nameFetcher = new WebSocketNameFetcher(socketLocals.projectIdStr);
    //         return nameFetcher.clustersList();
    //     }
    // },

    // {
    //     kind: [
    //         WebSocketKind.cluster_reporting_status
    //     ],
    //     targetExtrasBuilder: (target, socketLocals, socketContext, context) => {
    //         if (!socketLocals.projectIdStr) {
    //             return null;
    //         }
    //         return {
    //             'projectId': socketLocals.projectIdStr
    //         }
    //     },
    //     fetcher: (target, socketLocals, socketContext, context) => {
    //         if (!socketLocals.projectDataStore) {
    //             return null;
    //         }
    //         const clusterId = (<any>target).clusterId;
    //         if (!clusterId) {
    //             return null;
    //         }
    //         const clusterIdBuffer = BufferUtils.parseUUID(clusterId);
    //         if (!clusterIdBuffer) {
    //             return null;
    //         }

    //         const clusterDataStore = socketLocals.projectDataStore.scope({ cluster_id: clusterIdBuffer });

    //         const accessor = new ClusterStatusAccessor(context.logger,
    //             context.dataStore.snapshots,
    //             context.redis,
    //             {
    //                 projectIdStr: socketLocals.projectIdStr,
    //                 clusterIdStr: clusterId,
    //                 clusterDataStore: clusterDataStore
    //             });
    //         return accessor.getStatus();
    //     },
    //     redisKeyConstructor: (target, socketLocals, socketContext, context) => {
    //         let clusterId : string = (<any>target).clusterId;
    //         if (!clusterId) {
    //             return null;
    //         }
    //         const nameFetcher = new ClusterWebSocketNameFetcher(socketLocals.projectIdStr, clusterId);
    //         return nameFetcher.reportingStatus();
    //     }
    // },

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
