const _ = require('the-lodash');

module.exports = function(meta) {
    meta
    .table('notification_snooze')
        .key('kind')
            .settable()
        .key('feedback')
            .settable()
        .field('snooze')
}