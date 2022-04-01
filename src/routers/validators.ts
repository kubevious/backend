import _ from 'the-lodash';
import { ILogger } from 'the-logger';

import { Router } from '@kubevious/helper-backend'

import { Helpers } from '../server';
import { Context } from '../context';

import { ValidatorID, ValidatorSetting, DEFAULT_VALIDATION_CONFIG } from '@kubevious/entity-meta'
import { ValidatorIdBody, ValidatorItem } from '@kubevious/ui-middleware/dist/services/validator-config';

import Joi from 'joi';


export default function (router: Router, context: Context, logger: ILogger, { dataStore } : Helpers) {
    router.url('/api/v1/validators/');

    router.get('/', (req, res) => {

        return dataStore.table(dataStore.validation.Validator)
            .queryMany()
            .then(rows => {
                const dbConfig = _.makeDict(rows, x => x.validator_id!, x => x.setting!);
                return _.defaults(dbConfig, DEFAULT_VALIDATION_CONFIG);
            });
    })
    ;

    router.get<{}, any, ValidatorIdBody>('/get', (req, res) => {

        const id = req.query.validator as ValidatorID;
        return dataStore.table(dataStore.validation.Validator)
            .queryOne({ validator_id: id})
            .then(row => {
                const item : ValidatorItem = {
                    validator: id,
                    setting: row?.setting ?? (DEFAULT_VALIDATION_CONFIG[id] ?? ValidatorSetting.off)
                }
                return item;
            });
    })
    .querySchema(Joi.object({
        validator: Joi.string().required()
    }))
    ;

    router.post<{}, ValidatorItem>('/set', (req, res) => {

        return dataStore.table(dataStore.validation.Validator)
            .create({
                validator_id: req.body.validator,
                setting: req.body.setting,
            })
            .then(() => {});

    })
    .bodySchema(Joi.object({
        validator: Joi.string().required(),
        setting: Joi.string().required(),
    }))
    ;
    
}