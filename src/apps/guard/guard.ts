import { ChangePackageRow, ValidationState } from "@kubevious/data-models/dist/models/guard";
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
            return Promise.resolve()
                .then(() => {
                    return this._dataStore.table(this._dataStore.guard.ChangePackage)
                        .create(change)
                        ;
                })
                .then(() => {
                    return this._dataStore.table(this._dataStore.guard.ValidationQueue)
                        .create({ 
                            namespace: change.namespace,
                            name: change.name,
                            date: change.date
                        })
                        ;
                })
                .then(() => {
                    return this._dataStore.table(this._dataStore.guard.ValidationHistory)
                        .create({ 
                            namespace: change.namespace,
                            name: change.name,
                            date: change.date,
                            state: ValidationState.pending
                        })
                        ;
                })
                .then(() => {
                    return this._dataStore.table(this._dataStore.guard.ValidationHistory)
                        .create({ 
                            namespace: change.namespace,
                            name: change.name,
                            date: new Date(),
                            state: ValidationState.scheduling
                        })
                        ;
                })
        })

    }

}
