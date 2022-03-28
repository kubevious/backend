import { Router } from '@kubevious/helper-backend/dist';
import { Context } from '../context';
import Joi from 'joi';

export interface ValueQuery {
    key: string
    criteria: string
}

export default function (router: Router, context: Context) {

    router.url('/api/v1/search');


    router
        .post('/search', function (req, res) {
            const criteria: SearchQuery = <SearchQuery>req.body;
            return context.searchEngine.search(criteria);
        })
        .bodySchema(
            Joi.object({
                criteria: Joi.string(),
                kinds: Joi.object(),
                errors: Joi.object({
                    value: Joi.object({
                        kind: Joi.string(),
                        count: Joi.number(),
                    })
                }),
                warnings: Joi.object({
                    value: Joi.object({
                        kind: Joi.string(),
                        count: Joi.number(),
                    })
                }),
                markers: Joi.object(),
                labels: Joi.object(),
                annotations: Joi.object(),
            }),
        );

    router
        .post('/labels', function (req, res) {
            const criteria : string = <string>req.body.criteria;
            return context.autocompleteBuilder.getLabels(criteria);
        })
        .bodySchema(
            Joi.object({
                criteria: Joi.string().allow('')
            }),
        );

    router
        .post('/labels/values', function (req, res) {
            const query : ValueQuery = <ValueQuery>req.body;
            return context.autocompleteBuilder.getLabelValues(query.key, query.criteria);
        })
        .bodySchema(
            Joi.object({
                key: Joi.string().required(),
                criteria: Joi.string().allow(''),
            }),
        );

    router
        .post('/annotations', function (req, res) {
            const criteria : string = <string>req.body.criteria;
            return context.autocompleteBuilder.getAnnotations(criteria);
        })
        .bodySchema(
            Joi.object({
                criteria: Joi.string().allow(''),
            }),
        );

    router
        .post('/annotations/values', function (req, res) {
            const query : ValueQuery = <ValueQuery>req.body;
            return context.autocompleteBuilder.getAnnotationValues(query.key, query.criteria);
        })
        .bodySchema(
            Joi.object({
                key: Joi.string().required(),
                criteria: Joi.string().allow(''),
            }),
        );
}
