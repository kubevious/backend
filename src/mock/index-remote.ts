import _ from 'the-lodash';
import { Promise } from 'the-promise';
import * as yaml from 'js-yaml';
import { exec } from "child_process";
import { AgentOptions } from 'https';
import { readFileSync } from 'fs';
import { basename } from "path";

import { Backend } from '@kubevious/helper-backend'
import { KubernetesClient, KubernetesClientConfig } from 'k8s-super-client';

import { Context } from '../context'

const backend = new Backend("backend");

const logger = backend.logger;


function connectToK8sCluster()
{
    const kubeConfigPath = process.env.KUBECONFIG ?? `${process.env.HOME}/.kube/config`;
    logger.info("KUBE CONFIG FILE: %s", kubeConfigPath);

    const kubeConfigContents = readFileSync(kubeConfigPath, 'utf8');

    const kubeConfig = yaml.loadAll(kubeConfigContents)[0] as any;
    
    const contexts = _.makeDict(kubeConfig.contexts, x => x.name, x => x.context);
    logger.info("CONTEXTS: ", _.keys(contexts));

    const users = _.makeDict(kubeConfig.users, x => x.name, x => x.user);
    const clusters = _.makeDict(kubeConfig.clusters, x => x.name, x => x.cluster);

    const selectedContextName : string = 
        process.env.KUBE_CONTEXT_NAME ??
        kubeConfig['current-context'] ??
         _.keys(contexts)[0] ?? 'default';
    logger.info("SELECTED CONTEXT: %s", selectedContextName);

    const k8sContext = contexts[selectedContextName];
    logger.info("CONTEXT CONFIG: ", k8sContext);
    if (!k8sContext) {
        throw new Error(`Unknown context ${selectedContextName}`);
    }

    const user = users[k8sContext.user];
    // logger.info("USER CONFIG: ", user);

    const cluster = clusters[k8sContext.cluster];
    // logger.info("CLUSTER CONFIG: ", cluster);
    
    return fetchConnectConfig(user, cluster)
        .then(clientConfig => {
            // logger.info("CONNECT CONFIG: ", clientConfig);

            const k8sLogger = logger.sublogger('k8s');
            const client = new KubernetesClient(k8sLogger, clientConfig);

            return client.init()
                .then(() => {
                    return client;
                });
        })
}

new Context(backend, connectToK8sCluster);

backend.run();

function fetchConnectConfig(userConfig: any, clusterConfig: any)
{
    const clientConfig : KubernetesClientConfig = {
        server: clusterConfig.server,
        httpAgent: {}
    }

    const agentOptions: AgentOptions = {};
    clientConfig.httpAgent = agentOptions;

    if (userConfig['client-certificate']) {
        agentOptions.cert = readFileSync(userConfig['client-certificate'], 'utf8')
    }

    if (userConfig['client-key']) {
        agentOptions.key = readFileSync(userConfig['client-key'], 'utf8')
    }

    return Promise.resolve()
        .then(() => fetchCA(clusterConfig))
        .then(value => {
            if (value) {
                agentOptions.ca = value;
            }
        })
        .then(() => fetchClientCert(userConfig))
        .then(value => {
            if (value) {
                agentOptions.cert = value;
            }
        })
        .then(() => fetchClientKey(userConfig))
        .then(value => {
            if (value) {
                agentOptions.key = value;
            }
        })
        .then(() => fetchToken(userConfig))
        .then(value => {
            if (value) {
                clientConfig.token = value;
            }
        })
        .then(() => clientConfig)
}

function fetchCA(clusterConfig: any) {
    if (clusterConfig['certificate-authority-data']) {
        return base64Decode(clusterConfig['certificate-authority-data']);
    } else if (clusterConfig['certificate-authority']) {
        return readFileSync(clusterConfig['certificate-authority'], 'utf8');
    }
}

function fetchClientCert(userConfig: any) {
    if (userConfig['client-certificate-data']) {
        return base64Decode(userConfig['client-certificate-data']);
    } else if (userConfig['client-certificate']) {
        return readFileSync(userConfig['client-certificate'], 'utf8');
    }
}

function fetchClientKey(userConfig: any) {
    if (userConfig['client-key-data']) {
        return base64Decode(userConfig['client-key-data']);
    } else if (userConfig['client-key']) {
        return readFileSync(userConfig['client-key'], 'utf8');
    }
}

function fetchToken(userConfig: any) {
    if (userConfig.token) {
        return userConfig.token;
    }

    if (userConfig.exec) {
        if (userConfig.exec.command) {
        return executeTool(
            userConfig.exec.command,
            userConfig.exec.args,
            userConfig.exec.env
        ).then((result) => {
            const doc = JSON.parse(result);
            return doc.status.token;
        });
        }
    }

    if (userConfig["auth-provider"]) {
        if (userConfig["auth-provider"]["config"]) {
            const authConfig = userConfig["auth-provider"]["config"];
            if (authConfig["cmd-path"]) {
                return executeTool(
                    authConfig["cmd-path"],
                    authConfig["cmd-args"]
                    )
                    .then((result) => {
                        const doc = JSON.parse(result);
                        let tokenKey = authConfig["token-key"];
                        tokenKey = _.trim(tokenKey, "{}.");
                        const token = _.get(doc, tokenKey);
                        return token;
                    });
            }

            if (authConfig["access-token"]) {
                return authConfig["access-token"];
            }
        }
    }
}

function executeTool(toolPath: string, args: string, envArray?: any[])
{
    const toolName = basename(toolPath);

    let envDict = {};
    if (envArray) {
        envDict = _.makeDict(
        envArray,
        (x) => x.name,
        (x) => x.value
        );
    }
    return executeCommand(toolName, args, envDict);
}


function executeCommand(
    program: string,
    args: string,
    envDict?: {}
) : Promise<string>
{
    const options: Options = {};
    options.timeout = 20 * 1000;
    if (_.isArray(args)) {
        args = args.join(" ");
    }
    let cmd = program;
    if (args && args.length > 0) {
        cmd = program + " " + args;
    }
    if (envDict) {
        envDict = _.defaults(envDict, process.env);
        options.env = envDict;
    }

    logger.info("[_executeCommand] running: %s, options:", cmd, options);
    return Promise.construct((resolve, reject) => {
        exec(cmd, options, (error, stdout, stderr) => {
        if (error) {
            logger.error("[_executeCommand] failed: %s", error.message);
            logger.error("[_executeCommand] cmd: %s", error.cmd);
            logger.error("[_executeCommand] killed: %s", error.killed);
            logger.error("[_executeCommand] signal: %s", error.signal);
            logger.error("[_executeCommand] code: %s", error.code);
            logger.error("[_executeCommand] stdout: %s", stdout);
            logger.error("[_executeCommand] stderr: %s", stderr);
            reject(error);
        } else {
            logger.info("[_executeCommand] result: ", stdout);
            resolve(stdout);
        }
        });
    });
}


export interface Options {
    timeout?: number;
    env?: {};
}

function base64Decode(str: string)
{
    return Buffer.from(str, 'base64').toString('ascii');
}