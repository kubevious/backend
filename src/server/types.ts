import { Resolvable } from "the-promise";
import { Context } from "../context";

export enum WebSocketKind
{
    node = 'node',
    children = 'children',
    props = 'props',
    alerts = 'alerts',

    latest_snapshot_id = 'latest_snapshot_id',

    rules_list = 'rules-list',
    rules_statuses = 'rules-statuses',
    rule_result = 'rule-result',
    markers_list = 'markers-list',
    markers_statuses = 'markers-statuses',
    marker_result = 'marker-result',

    cluster_reporting_status = 'cluster_reporting_status'
}


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
