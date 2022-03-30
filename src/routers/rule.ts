import _ from 'the-lodash';
import { Context } from '../context';
import { Router } from '@kubevious/helper-backend'
import Joi from 'joi';

export default function (router: Router, context: Context) {

    router.url('/api/v1/rule-engine');

    /**** Rule Configuration ***/

    // List Rules
    router.get('/rules/', (req, res) => {
        const result = context.ruleCache.queryRuleList();
        return result;
    })

    // Get Rule
    router.get<{}, any, RuleQuery>('/rule', (req, res) => {
        const result = context.ruleCache.queryRule(req.query.rule);
        return result;
    })

    // Create Rule
    router.post<{}, any, RuleQuery>('/rule', (req, res) => {
        let newRule : any;
        return context.ruleAccessor
            .createRule(req.body, { name: req.query.rule})
            .then(result => {
                newRule = result;
            })
            .finally(() => context.ruleCache.triggerListUpdate())
            .then(() => {
                return newRule;
            })
    })

    // Delete Rule
    router.delete<{}, any, RuleQuery>('/rule', (req, res) => {
        return context.ruleAccessor
            .deleteRule(req.query.rule)
            .finally(() => context.ruleCache.triggerListUpdate())
            .then(() => {
                return {};
            });
    })

    // Export Rules
    router.get('/rules/export', (req, res) => {
        return context.ruleAccessor
            .exportRules();
    })

    // Import Rules
    router.post('/rules/import', (req, res) => {
        return context.ruleAccessor
            .importRules(req.body.data, req.body.deleteExtra)
            .finally(() => context.ruleCache.triggerListUpdate())
            .then(() => {
                return {};
            });
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
        const result = context.ruleCache.queryRuleStatusList();
        return result;
    })

    router.get<{}, any, RuleQuery>('/rule-result', (req, res) => {
        const result = context.ruleCache.getRuleResult(req.query.rule);
        return result;
    })

}

interface RuleQuery
{
    rule: string
}

