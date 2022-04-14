import { Resolvable } from "the-promise";
import { Context } from "../context";
import { WebSocketKind } from '@kubevious/ui-middleware';

export interface HasKind
{
    kind: string
}


export type SocketContext = {};
export type SocketLocals =  {};

export interface WSTargetExtrasBuilderParams
{
    target: HasKind,
    context: Context
}

export type TargetExtrasBuilder = (params: WSTargetExtrasBuilderParams) => Record<string, any> | null;


export interface WSFetcherParams
{
    target: HasKind,
    context: Context,
}

export type FetchHandler = (params: WSFetcherParams) => Resolvable<any>;

export interface WebSocketHandler
{
    kind: WebSocketKind | WebSocketKind[],
    contextFields?: string[],
    targetExtrasBuilder?: TargetExtrasBuilder,
    fetcher: FetchHandler,
}
