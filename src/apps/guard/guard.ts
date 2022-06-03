import { ChangePackageMeta, ChangePackageRow, ValidationHistoryRow, ValidationState } from "@kubevious/data-models/dist/models/guard";
import { ValidationIssues } from "@kubevious/ui-middleware/dist/entities/guard";
import { ILogger } from "the-logger";
import { Promise } from "the-promise";
import { Context } from "../../context";
import { Database } from "../../db";


export class GuardLogic
{
    private _context : Context;
    private _logger : ILogger;
    private _dataStore: Database;

    constructor(context : Context)
    {
        this._context = context;
        this._logger = context.logger.sublogger("GuardLogic");
        this._dataStore = this._context.dataStore;
    }

    get logger() {
        return this._logger;
    }

    acceptChangePackage(change: ChangePackageRow)
    {
        // this._logger.info("[acceptChangePackage] change: ", change);

        return this._dataStore.dataStore.executeInTransaction([
            this._dataStore.guard.ChangePackage,
            this._dataStore.guard.ValidationQueue,
            this._dataStore.guard.ValidationHistory
        ], () => {

            const historyRow : ValidationHistoryRow = { 
                change_id: change.change_id,
                date: new Date(),
                state: ValidationState.scheduling
            };

            return Promise.resolve()
                .then(() => {
                    return this._dataStore.table(this._dataStore.guard.ChangePackage)
                        .create(change)
                        ;
                })
                .then(() => {
                    return this._dataStore.table(this._dataStore.guard.ValidationQueue)
                        .create({ 
                            change_id: change.change_id,
                            date: change.date
                        })
                        ;
                })
                .then(() => {
                    return this._dataStore.table(this._dataStore.guard.ValidationHistory)
                        .create({ 
                            change_id: change.change_id,
                            date: change.date,
                            state: ValidationState.pending
                        })
                        ;
                })
                .then(() => {
                    return this._dataStore.table(this._dataStore.guard.ValidationHistory)
                        .create(historyRow);
                })
                .then(() => {
                    return this._updateIntermediateState(change, {
                        date: new Date(historyRow.date).toISOString(),
                        state: historyRow.state
                    });
                });
        })

    }

    updateIntermediateState(historyRow: ValidationHistoryRow)
    {
        return this._query(historyRow.change_id)
            .then(changePackage => {
                if (!changePackage) {
                    return;
                }

                return Promise.resolve()
                    .then(() => {
                        return this._dataStore.table(this._dataStore.guard.ValidationHistory)
                            .create(historyRow);
                    })
                    .then(() => {
                        return this._updateIntermediateState(changePackage, {
                            date: new Date(historyRow.date).toISOString(),
                            state: historyRow.state
                        });
                    });
            })
    }

    updateFinalState(change_id: string)
    {
        return this._query(change_id)
            .then(changePackage => {
                if (!changePackage) {
                    return;
                }

                // this._logger.info("[updateFinalState] change package: ", changePackage);

                return this._queryFinalState(change_id)
                    .then(finalState => {
                        if (!finalState) {
                            return;
                        }

                        return Promise.resolve()
                            .then(() => {
                                return this._dataStore.table(this._dataStore.guard.ValidationHistory)
                                    .create({
                                        change_id: change_id,
                                        date: new Date(finalState.date!),
                                        state: finalState.state!
                                    });
                            })
                            .then(() => {
                                const statusBody : Record<string, any> = {
                                    state: finalState.state!,
                                    date: new Date(finalState.date!).toISOString(),
                                }
        
                                if (finalState.state == ValidationState.completed)
                                {
                                    statusBody.success = finalState.success ? true : false;
                                    statusBody.summary = finalState.summary!;
                                    statusBody.raisedIssues = this._makeK8sIssueList(finalState.newIssues ?? []);
                                    statusBody.clearedIssues = this._makeK8sIssueList(finalState.clearedIssues ?? []);
                                }
        
                                return this._updateIntermediateState(changePackage, statusBody);
                            })

                    })

            });
    }

    private _makeK8sIssueList(issues: ValidationIssues)
    {
        const k8sIssues : any[] = [];
        for(const item of issues)
        {
            for(const alert of item.alerts)
            {
                k8sIssues.push({
                    dn: item.dn,
                    msg: alert.msg,
                    severity: alert.severity
                })
            }
        }
        return k8sIssues;
    }


    private _updateIntermediateState(changePackage: Partial<ChangePackageRow>, statusBody: any)
    {
        if (changePackage.source?.kind !== 'k8s') {
            return;
        }

        return this._context.k8sHandler.updateValidationState(
            changePackage.source!.namespace!,
            changePackage.source!.name,
            statusBody
        )
    }

    private _query(change_id: string)
    {
        return this._dataStore.table(this._dataStore.guard.ChangePackage)
            .queryOne({ 
                change_id: change_id,
            });
    }

    private _queryFinalState(change_id: string)
    {
        return this._dataStore.table(this._dataStore.guard.ValidationState)
            .queryOne({ 
                change_id: change_id,
            });
    }

}
