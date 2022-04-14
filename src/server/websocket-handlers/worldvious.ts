import { WebSocketKind } from '@kubevious/ui-middleware';
import { WebSocketHandler } from '../types'

export const WORLDVIOUS_HANDLERS : WebSocketHandler[] = [

    {
        kind: WebSocketKind.worldvious_updates,
        fetcher: ({ context }) => {

            return context.notificationsApp.notificationsInfo;
        }
    },


];
