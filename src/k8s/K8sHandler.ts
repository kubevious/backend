import _ from 'the-lodash';
import { ChangePackageChart, ChangePackageDeletion, ChangePackageRow, ChangePackageSummary } from "@kubevious/data-models/dist/models/guard";
import { DeltaAction, KubernetesObject, ResourceAccessor } from "k8s-super-client";
import { ILogger } from "the-logger";
import { Context } from "../context";

import zlib from "fast-zlib";
import * as yaml from 'js-yaml';

export class K8sHandler
{
    private _context : Context;
    private _logger : ILogger;

    private _changePackageClient : ResourceAccessor | null = null;
    private _validationStateClient : ResourceAccessor | null = null;

    constructor(context : Context)
    {
        this._context = context;
        this._logger = context.logger.sublogger("K8sHandler");
    }

    init()
    {
        this._logger.info("[init]...");

        if (!this._context.k8sClient) {
            this._logger.error("[K8sHandler] k8s Client Missing.");
            return;
        }

        this._changePackageClient = this._context.k8sClient.client('ChangePackage', 'kubevious.io');
        if (!this._changePackageClient) {
            this._logger.error("ChangePackage NOT PRESENT");
            return;
        }

        this._validationStateClient = this._context.k8sClient.client('ValidationState', 'kubevious.io');
        if (!this._validationStateClient) {
            this._logger.error("ValidationState NOT PRESENT");
            return;
        }

        this._changePackageClient.watchAll(
            null,
            this._handleChangePackage.bind(this),
            () => {},
            () => {},
            );
    }

    private _handleChangePackage(action: DeltaAction, data: KubernetesObject)
    {
        if (action === DeltaAction.Deleted) {
            return;
        }

        this._logger.info("[_handleChangePackage] %s :: %s", data.metadata.namespace, data.metadata.name);

        const charts : ChangePackageChart[] = 
            _.map((data.data as any).changes ?? [], x => ({
                namespace: x.namespace,
                name: x.name,
            }));

        const changes : KubernetesObject[] = 
            _.flatten(
                _.map((data.data as any).changes ?? [], (x: any) => {
                    const yamlData = unzip(x.data);
                    return yamlData as KubernetesObject[];
                })
            );    
            
        // this._logger.info("[_handleChangePackage] changes: ", changes);
            
        const deletions : ChangePackageDeletion[] = 
            _.map((data.data as any).deletions ?? [], x => ({
                apiVersion: x.apiVersion,
                kind: x.kind,
                namespace: x.namespace,
                name: x.name,
            }));

        const change: ChangePackageRow = {
            namespace: data.metadata.namespace!,
            name: data.metadata.name,
            date: new Date(),
            summary: { 
                createdCount: changes.length,
                deletedCount: deletions.length,
            },
            charts: charts,
            changes: changes,
            deletions: deletions
        }

        Promise.resolve(null)
            .then(() => this._context.guardLogic.acceptChangePackage(change))
            .then(() => this._updateValidationState(change.namespace, change.name, 'Scheduling'))
            .then(() => this._changePackageClient?.delete(data.metadata.namespace!, data.metadata.name))
            ;
        
    }

    private _updateValidationState(namespace: string, name: string, state: string)
    {
        const body = {
            apiVersion: 'kubevious.io/v1',
            kind: 'ValidationState',
            metadata: {
                namespace: namespace,
                name: name,
            },
            status: {
                state: state
            }
        }
        return this._validationStateClient!.query(body.metadata.namespace!, body.metadata.name!)
            .then(existingBody => {
                if (existingBody) {
                    existingBody.status = body.status;
                    return this._validationStateClient!.update(body.metadata.namespace!, body.metadata.name!, existingBody);
                } else {
                    return this._validationStateClient!.create(body.metadata.namespace!, body);
                }
            });
    }

}


function unzip(str: string)
{
    const buf = Buffer.from(str, 'base64');
    const gunzip = new zlib.Gunzip();
    
    const strData = gunzip.process(buf).toString();
    const yamlData = yaml.loadAll(strData);
    return yamlData as any[];
}