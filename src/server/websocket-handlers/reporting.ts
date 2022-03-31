import { WebSocketKind } from '@kubevious/ui-middleware';
import { WebSocketHandler } from '../types'

export const REPORTING_HANDLERS : WebSocketHandler[] = [

    {
        kind: WebSocketKind.cluster_reporting_status,
        fetcher: ({ context }) => {

            return context.clusterStatusAccessor.getStatus();
        }
    },
    
];
