import _ from 'the-lodash';
import { Context } from '../context';
import { Router } from '@kubevious/helper-backend'
import Joi from 'joi';

import * as DateUtils from '@kubevious/helpers/dist/date-utils';
import { Snapshot } from '@kubevious/helpers/dist/history';

import { parentDn as makeParentDn } from '@kubevious/helpers/dist/dn-utils';

export default function (router: Router, context: Context) {

    router.url('/api/v1/history');
    
    router.get('/timeline', function(req, res) {
        var dateFrom = null;
        if (req.query.from) {
            dateFrom = DateUtils.makeDate(req.query.from);
        }
        var dateTo = null;
        if (req.query.to) {
            dateTo = DateUtils.makeDate(req.query.to);
        }

        return context.historySnapshotReader.queryTimeline(dateFrom, dateTo)
            .then(data => {
                var result = data.map(x => {
                    return {
                        date: x.date,
                        changes: x.changes,
                        error: x.error,
                        warn: x.warn
                    }
                });

                return context.seriesResamplerHelper.process(result);
            });
    });


    router.get('/snapshot', function(req, res) {
        var date = DateUtils.makeDate(req.query.date); 

        return context.historySnapshotReader.querySnapshotForDate(date, 'node')
            .then(snapshot => {
                if (!snapshot) {
                    return {};
                }
                return generateTree(snapshot);
            })
    })
    .querySchema(
        Joi.object({
            date: Joi.string().required()
        })
    )
    ;

    router.get('/props', function(req, res) {
        const scopeDn : string = <string>req.query.dn;

        var date = DateUtils.makeDate(req.query.date); 
        return context.historySnapshotReader.queryDnSnapshotForDate(scopeDn, date, ['props'])
            .then(snapshot => {
                var result = [];
                if (snapshot) 
                {
                    for(var item of snapshot.getItems())
                    {
                        if (item.config_kind == 'props')
                        {
                            result.push(item.config);
                        }
                    }
                }
                return result;
            })
    })
    .querySchema(
        Joi.object({
            dn: Joi.string().required(),
            date: Joi.string().required()
        })
    );

    router.get('/alerts', function(req, res) {
        const scopeDn : string = <string>req.query.dn;
        var date = DateUtils.makeDate(req.query.date); 
        return context.historySnapshotReader.queryScopedSnapshotForDate(scopeDn, date, ['alerts'])
            .then(snapshot => {
                var result : Record<string, any> = {};
                if (snapshot) 
                {
                    for(var item of snapshot.getItems())
                    {
                        if (item.config_kind == 'alerts')
                        {
                            result[item.dn] = item.config;
                        }
                    }
                }
                return result;
            });
    })
    .querySchema(
        Joi.object({
            dn: Joi.string().required(),
            date: Joi.string().required()
        })
    )

    router.post('/cleanup', function (req, res) {
        return context.historyCleanupProcessor.processCleanup()
    })


    function generateTree(snapshot: Snapshot)
    {
        var lookup : Record<string, any> = {};

        let makeNode = (dn: string, config: any) => {
            var node = _.clone(config);
            node.children = [];
            lookup[dn] = node;
        };

        for (var item of snapshot.getItems().filter(x => x.config_kind == 'node'))
        {
            makeNode(item.dn, item.config);
        }

        let getNode = (dn: string) => {
            var node = lookup[dn];
            if (!node) {
                node = {
                    children: []
                };
                lookup[dn] = node;
                markParent(dn);
            }
            return node;
        };

        let markParent = (dn: string) => {
            var node = lookup[dn];

            var parentDn = makeParentDn(dn);
            if (parentDn.length > 0) {
                var parentNode = getNode(parentDn);
                parentNode.children.push(node);
            }
        };

        for (var item of snapshot.getItems().filter(x => x.config_kind == 'node'))
        {
            markParent(item.dn);
        }

        var rootNode = lookup['root'];
        if (!rootNode) {
            rootNode = null;
        }

        return rootNode;
    }
}
