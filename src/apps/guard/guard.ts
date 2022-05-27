import { ChangePackageRow } from "@kubevious/data-models/dist/models/guard";
import { ILogger } from "the-logger";
import { Promise } from "the-promise";
import { Context } from "../../context";


export class GuardLogic
{
    private _context : Context;
    private _logger : ILogger;

    constructor(context : Context)
    {
        this._context = context;
        this._logger = context.logger.sublogger("GuardLogic");
    }

    get logger() {
        return this._logger;
    }

    acceptChangePackage(change: ChangePackageRow)
    {
        this._logger.info("[acceptChangePackage] change: ", change);

    }

}
