import { WebSocketKind } from '../types'
import { WebSocketHandler } from '../types'

export const DIAGRAM_HANDLERS : WebSocketHandler[] = [

    {
        kind: WebSocketKind.latest_snapshot_id,
        fetcher: ({ context }) => {

            return context.configAccessor.getLatestSnapshotId();
        }
    },

    {
        kind: [
            WebSocketKind.node,
            WebSocketKind.children,
            WebSocketKind.props,
            WebSocketKind.alerts
        ],
        contextFields: ['snapshotId'],
        fetcher: ({target, context}) => {

            return context.diagramDataFetcher.resolveDiagramItem(target);

        }
    },

];
