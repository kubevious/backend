import _ from 'the-lodash';
import { Context } from '../context';
import { Router } from '@kubevious/helper-backend'
import Joi from 'joi';

export default function (router: Router, context: Context) {

    router.url('/api/v1/diagram');
    
    router.get('/tree', function (req, res) {
        var state = context.registry.getCurrentState();
        return state.getTree();
    })

    router.get('/node', function (req, res) {
        const dn : string = <string>req.query.dn;
        let includeChildren : boolean = false;
        if (req.query['inc-children'] == 'true') {
            includeChildren = true;
        }
        var state = context.registry.getCurrentState();
        return state.getNode(dn, includeChildren);
    })
    .querySchema(
        Joi.object({
            dn: Joi.string().required(),
            'inc-children': Joi.boolean().optional()
        })
    );

    router.get('/children', function (req, res) {
        const dn : string = <string>req.query.dn;
        var state = context.registry.getCurrentState();
        return state.getChildren(dn)
    })
    .querySchema(
        Joi.object({
            dn: Joi.string().required()
        })
    );

    router.get('/props', function (req, res) {
        const dn : string = <string>req.query.dn;
        var state = context.registry.getCurrentState();
        var props = state.getProperties(dn);
        props = _.values(props);
        return props;
    })
    .querySchema(
        Joi.object({
            dn: Joi.string().required()
        })
    );

    router.get('/alerts', function (req, res) {
        const dn : string = <string>req.query.dn;
        var state = context.registry.getCurrentState();
        var alerts = state.getHierarchyAlerts(dn);
        return alerts;
    })
    // .querySchema(
    //     Joi.object({
    //         dn: Joi.string().required()
    //     })
    // );


    /*************************/

    router.get('/search', function (req, res) {
        const criteria : string[] = <string[]>req.query.criteria;
        return context.searchEngine.search(criteria);
    })
    // .querySchema(
    //     Joi.object({
    //         criteria: Joi.array().items(Joi.string()).required()
    //     })
    // );

}
