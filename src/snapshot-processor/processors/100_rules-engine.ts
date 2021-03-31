import { Processor } from '../builder'

export default Processor()
    .order(100)
    .handler(({logger, state, tracker, context }) => {

        return context.ruleEngine.execute(state, tracker);

    })
