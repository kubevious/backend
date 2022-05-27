import { DeltaAction, KubernetesObject, ResourceAccessor } from "k8s-super-client";
import { ILogger } from "the-logger";
import { Context } from "../context";

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

        return Promise.resolve()
            .then(() => {
                const body = {
                    apiVersion: 'kubevious.io/v1',
                    kind: 'ValidationState',
                    metadata: {
                        namespace: data.metadata.namespace!,
                        name: data.metadata.name,
                    },
                    status: {
                        state: 'Running'
                    }
                }
                return this._updateValidationState(body);
            })
            .then(() => {
                return this._changePackageClient?.delete(data.metadata.namespace!, data.metadata.name);
            });
    }

    private _updateValidationState(body: any)
    {
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