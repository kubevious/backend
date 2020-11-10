const _ = require('the-lodash');

module.exports = {
    url: '/',

    setup: ({ router, context, logger }) => {

        router.get('/', function (req, res) {
            return {};
        });
    
        router.get('/api/v1/version', function (req, res) {
            return {
                version: require('../../version')
            };
        });

        router.get('/api/v1/metrics', function (req, res) {
            let metrics = [];
            metrics = _.concat(metrics, context.collector.extractMetrics());

            return {
                metrics: metrics
            };
        });
    
    }

}