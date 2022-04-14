import { ILogger } from 'the-logger';

import { Router } from '@kubevious/helper-backend'

import { Context } from '../context';

import Joi from 'joi';
import { SearchKeyAutocompletion, SearchQuery, SearchValueAutocompletion } from '../types/search';

export default function (router: Router, context: Context) {

    router.url('/api/v1/search/');

    router.post<{}, SearchQuery>('/results', (req, res) => {
        return context.searchEngine.execute(req.body);
    })
    .bodySchema(
        Joi.object({
            criteria: Joi.string(),
            kind: Joi.object(),
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
    )
    ;


    router.post<{}, SearchKeyAutocompletion>('/labels', (req, res) => {
        return context.searchEngine.runLabelKeyAutocompletion(req.body);
    })
    .bodySchema(
        Joi.object({
            criteria: Joi.string().allow('')
        }),
    );


    router.post<{}, SearchValueAutocompletion>('/labels/values', (req, res) => {

        return context.searchEngine.runLabelValueAutocompletion(req.body);
    })
    .bodySchema(
        Joi.object({
            key: Joi.string().required(),
            criteria: Joi.string().allow(''),
        }),
    );

    

    router.post<{}, SearchKeyAutocompletion>('/annotations', (req, res) => {
        return context.searchEngine.runAnnoKeyAutocompletion(req.body);
    })
    .bodySchema(
        Joi.object({
            criteria: Joi.string().allow('')
        }),
    );


    router.post<{}, SearchValueAutocompletion>('/annotations/values', (req, res) => {

        return context.searchEngine.runAnnoValueAutocompletion(req.body);
    })
    .bodySchema(
        Joi.object({
            key: Joi.string().required(),
            criteria: Joi.string().allow(''),
        }),
    );

}