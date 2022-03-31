import _ from 'the-lodash';
import { Promise } from 'the-promise';
import { Context } from '../context';
import { Router } from '@kubevious/helper-backend';
import { WebSocketKind } from '@kubevious/ui-middleware';

export default function (router: Router, context: Context) {
    router.url('/api/internal/socket');

    router.post<{}, InternalWebSocketReportBody>('/report', (req, res) => {

        return Promise.serial(req.body.items, x => {

            return context.websocket.invalidateAllOfAKind((<any>x).target);

        })
        .then(() => ({}));

    });
}

export interface InternalWebSocketItem {
    target: WebSocketKind
}

export interface InternalWebSocketReportBody {
    items: InternalWebSocketItem[]
}
