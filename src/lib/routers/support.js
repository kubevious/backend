const _ = require('the-lodash');

module.exports = {
    url: '/api/v1/support',

    setup: ({ router, context, logger }) => {

        router.get('/notifications', function (req, res) {
            return context.notificationsApp.notificationItems;
        });

        router.post('/notification/snooze', function (req, res) {
            return context.notificationsApp.snooze(
                req.body.kind,
                req.body.id,
                req.body.days
            )
            .then(() => ({}));
        });

        router.post('/feedback', function (req, res) {
            return context.worldvious.reportFeedback(req.body.id, req.body.answers)
                .then(() => {
                    return context.notificationsApp.snooze(
                        req.body.kind,
                        req.body.id,
                        null
                    )
                })
                .then(() => ({}));
        });
    
    }
}