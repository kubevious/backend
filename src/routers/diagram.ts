import _ from 'the-lodash';
import { ILogger } from 'the-logger';
import { Context } from '../context';
import { Router } from '@kubevious/helper-backend';
import Joi from 'joi';
import { Helpers } from '../server';

export default function (router: Router, context: Context, logger: ILogger, { dataStore } : Helpers) {

    router.url('/api/v1/diagram');


    router.get<{}, any, DnQuery>('/node', (req, res) => {
        const dn = req.query.dn;

        const snapshotReader = context.makeSnapshotReader(req.query.snapshot);
        return snapshotReader.queryNode(dn);
    })
    .querySchema(Joi.object({
        snapshot: Joi.string().required(),
        dn: Joi.string().required(),
    }))
    ;

    router.get<{}, any, DnQuery>('/children', (req, res) => {
        const dn = req.query.dn;

        const snapshotReader = context.makeSnapshotReader(req.query.snapshot);
        return snapshotReader.queryChildren(dn);
    })
    .querySchema(Joi.object({
        snapshot: Joi.string().required(),
        dn: Joi.string().required()
    }))
    ;

    router.get<{}, any, DnQuery>('/props', (req, res) => {
        const dn = req.query.dn;

        const snapshotReader = context.makeSnapshotReader(req.query.snapshot);
        return snapshotReader.queryProperties(dn);
    })
    .querySchema(Joi.object({
        snapshot: Joi.string().required(),
        dn: Joi.string().required()
    }))
    ;

    router.get<{}, any, DnQuery>('/alerts', (req, res) => {
        const dn = req.query.dn;

        const snapshotReader = context.makeSnapshotReader(req.query.snapshot);
        return snapshotReader.queryAlerts(dn);
    })
    .querySchema(Joi.object({
        snapshot: Joi.string().required(),
        dn: Joi.string().required()
    }))
    ;


    router.get<{}, any, DnQuery>('/self_alerts', (req, res) => {
        const dn = req.query.dn;

        const snapshotReader = context.makeSnapshotReader(req.query.snapshot);
        return snapshotReader.querySelfAlerts(dn);
    })
    .querySchema(Joi.object({
        snapshot: Joi.string().required(),
        dn: Joi.string().required()
    }))
    ;
    

}


interface DnQuery
{
    snapshot: string,
    dn: string
}