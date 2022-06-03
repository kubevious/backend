import _ from 'the-lodash';
import { Promise } from 'the-promise';
import { Context } from '../context';
import { Router } from '@kubevious/helper-backend';
import { ValidationHistoryRow, ValidationState } from '@kubevious/data-models/dist/models/guard';

export default function (router: Router, context: Context) {
    router.url('/api/internal/guard');

    router.post<{}, ValidationHistoryRow>('/update_state', (req, res) => {

        context.logger.error("UPDATE STATE: ", req.body);
        
        return context.guardLogic.updateIntermediateState({
                change_id: req.body.change_id,
                date: new Date(req.body.date),
                state: req.body.state
            })
            .then(() => ({}));

    });

    router.post<{}, ChangeIdBody>('/update_final_state', (req, res) => {

        context.logger.error("UPDATE FINAL: ", req.body);

        return context.guardLogic.updateFinalState(req.body.change_id)
            .then(() => ({}));

    });

}

export interface ChangeIdBody {
    id: string;
}