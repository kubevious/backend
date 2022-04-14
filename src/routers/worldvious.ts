import _ from 'the-lodash';
import { Context } from '../context';
import { Router } from '@kubevious/helper-backend'

import {
    WorldviousNotificationKind,
    WorldviousFeedbackSubmitData,
    WorldviousFeedbackSnoozeData,
   } from '@kubevious/ui-middleware/dist/services/worldvious';


export default function (router: Router, context: Context) {

    router.url('/api/v1/support');
    
    router.get('/notifications-info', function (req, res) {
        return context.notificationsApp.notificationsInfo;
    });

    router.get('/notifications', function (req, res) {
        return context.notificationsApp.notifications;
    });

    router.post<{}, WorldviousFeedbackSnoozeData>('/notification/snooze', function (req, res) {
        return context.notificationsApp.snooze(
            req.body.kind,
            req.body.id,
            req.body.days
        )
        .then(() => ({}));
    });

    router.post<{}, WorldviousFeedbackSubmitData>('/feedback', (req, res) => {

        const data = req.body as WorldviousFeedbackSubmitData;

        return Promise.resolve()
            .then(() => context.worldvious.reportFeedback(data))
            .then(() => {
                return context.notificationsApp.snooze(
                    WorldviousNotificationKind.feedbackRequest,
                    req.body.id
                )
            })
            .then(() => ({}));
    });
}