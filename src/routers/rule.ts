import _ from 'the-lodash';
import { Context } from '../context';
import { Router } from '@kubevious/helper-backend'
import Joi from 'joi';

import { RuleConfig, RulesImportData } from '@kubevious/ui-middleware/dist/services/rule'

export default function (router: Router, context: Context) {

    router.url('/api/v1/rule-engine');

    /**** Rule Configuration ***/

    // List Rules
    router.get('/rules/', (req, res) => {
        return context.ruleAccessor.queryAll();
    })

    // Get Rule
    router.get<{}, any, RuleQuery>('/rule', (req, res) => {
        return context.ruleAccessor.getRule(req.query.rule);
    })

    // Create Rule
    router.post<{}, RuleConfig, RuleQuery>('/rule', (req, res) => {
        
        return context.ruleEditor.createRule(req.body, req.query.rule);

    })

    // Delete Rule
    router.delete<{}, any, RuleQuery>('/rule', (req, res) => {

        return context.ruleEditor.deleteRule(req.query.rule);

    })

    // Export Rules
    router.get('/export-rules', (req, res) => {
        return context.ruleAccessor
            .exportRules();
    })

    // Import Rules
    router.post<{}, RulesImportData>('/import-rules', (req, res) => {

        return context.markerEditor
            .importMarkers(req.body.data, req.body.deleteExtra);

    })
    .bodySchema(
        Joi.object({
            data: {
                kind: Joi.string().valid('rules').required(),
                items: Joi.array().required().items(
                    Joi.object()
                )
            },
            deleteExtra: Joi.boolean().optional(),
        })
    )

    /**** Rule Operational ***/

    // List Rules Statuses
    router.get('/rules-statuses/', (req, res) => {
        return context.ruleAccessor.getRulesStatuses();
    })

    router.get<{}, any, RuleQuery>('/rule-result', (req, res) => {
        return context.ruleAccessor.getRuleResult(req.query.rule);
    })

}

interface RuleQuery
{
    rule: string
}

