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
        .post('/labels', function (req, res) {
            const criteria : string = <string>req.body.criteria;
            return context.autocompleteBuilder.getKeys('labels', criteria);
        })
        .bodySchema(
            Joi.object({
                criteria: Joi.string().allow('')
            }),
        );

    router
        .post('/labels/values', function (req, res) {
            const query : ValueQuery = <ValueQuery>req.body;
            return context.autocompleteBuilder.getValues('labels', query);
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
            return context.autocompleteBuilder.getKeys('annotations', criteria);
        })
        .bodySchema(
            Joi.object({
                criteria: Joi.string().allow(''),
            }),
        );

    router
        .post('/annotations/values', function (req, res) {
            const query : ValueQuery = <ValueQuery>req.body;
            return context.autocompleteBuilder.getValues('annotations', query);
        })
        .bodySchema(
            Joi.object({
                key: Joi.string().required(),
                criteria: Joi.string().allow(''),
            }),
        );
}
