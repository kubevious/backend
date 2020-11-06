const _ = require('the-lodash');
const uuidParse = require('uuid-parse');
const moment = require('moment');

module.exports = {
    url: '/api/v1/support',

    setup: ({ router, context, logger }) => {

        router.get('/notifications', function (req, res) {
            return context.notificationsApp.notificationItems;
        });

        router.post('/notification/snooze', function (req, res) {
            return context.notificationsApp.snooze(
                req.body.kind,
                req.body.feedback,
                req.body.days
            )
            .then(() => ({}));
        });

        router.post('/feedback', function (req, res) {
            return context.worldvious.reportFeedback(req.body.id, req.body.answers);
        });
    
    }
}