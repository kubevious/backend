import { Processor } from '../builder'

export default Processor()
    .order(200)
    .handler(({logger, state, tracker, context}) => {

        state.traverseNodes((dn, node) => {

            var childrenDns = state.getChildrenDns(dn);
            node.childrenCount = childrenDns.length;

        })

    })