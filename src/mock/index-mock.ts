import _ from 'the-lodash';

import { Backend } from '@kubevious/helper-backend'

import { Context } from '../context'

const backend = new Backend("backend");

new Context(backend);

backend.run();
