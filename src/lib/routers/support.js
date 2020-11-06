const _ = require('the-lodash');

module.exports = {
    url: '/api/v1/support',

    setup: ({ router, context, logger }) => {

        router.get('/notifications', function (req, res) {
            return context.worldvious.notificationItems;
        });

        router.post('/feedback', function (req, res) {
            return context.worldvious.reportFeedback(req.body.id, req.body.answers);
        });
    
    }
}