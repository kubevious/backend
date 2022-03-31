import _ from 'the-lodash';
import { ILogger } from 'the-logger';
import { Context } from '../context';
import { Router } from '@kubevious/helper-backend';
import { Helpers } from '../server';

export default function (router: Router, context: Context,  logger: ILogger, { dataStore } : Helpers) {

    router.url('/api/v1/cluster');

    router.get('/reporting_status', (req, res) => {

        return context.clusterStatusAccessor.getStatus();
        
    })
    ;
    
}