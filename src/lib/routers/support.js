const _ = require('the-lodash');

module.exports = {
    url: '/api/v1/support',

    setup: ({ router, context, logger }) => {

        router.post('/feedback', function (req, res) {
            return context.worlvious.reportFeedback(req.body.id, req.body.answers);
        });
    
    }
}