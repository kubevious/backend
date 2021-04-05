import _ from 'the-lodash';
import { Promise, Resolvable } from 'the-promise';
import { ILogger } from 'the-logger' ;

import * as BufferUtils from '@kubevious/helpers/dist/buffer-utils';

import * as HashUtils from '@kubevious/helpers/dist/hash-utils';

import { Partitioning as HistoryPartitioning } from '@kubevious/helpers/dist/history';
import { DBSnapshot } from '@kubevious/helpers/dist/history/snapshot';
import { BaseSnapshotItem, DBRawDiffItem, DBRawSnapItem, DBRawSnapshot } from '@kubevious/helpers/dist/history/entities';

import { ConfigHash } from './entities';

import { HistoryAccessor } from './db-accessor';

import { Context } from '../context';
import { Database } from '../db';
import { RegistryBundleState } from '@kubevious/helpers/dist/registry-bundle-state';

import { HISTORY_TABLES } from './metadata';

export interface HandlerCallback
{
    finish: () => void;
}

export class HistoryProcessor
{
    private _logger : ILogger;
    private _context : Context;

    private _database : Database;
    private _dbAccessor : HistoryAccessor;

    private _latestSnapshot : DBSnapshot<SnapItemWithConfig> | null = null;
    private _currentState : ConfigState;
    private _interation : number = 0;
    private _isDbReady : boolean = false;
    private _configHashesDict : Record<string, boolean> = {};
    private _configHashesPartition? : number;
    private _isLockedForCleanup : boolean  = false;
    private _isProcessing : boolean  = false;

    private _processFinishListeners : (() => void)[] = [];
    private _dbCleanupWaiters: ((thenableOrResult?: Resolvable<void>) => void)[] = [];

    private _latestSnapshotAlerts? : AlertsSummary;

    constructor(context : Context)
    {
        this._context = context;
        this._database = context.database;

        this._logger = context.logger.sublogger('HistoryProcessor');
        this._dbAccessor = new HistoryAccessor(context);

        this._currentState = this._makeNewConfigState();

        this._database.onConnect(this._onDbConnected.bind(this));
    }

    get logger() {
        return this._logger;
    }

    get debugObjectLogger() {
        return this._context.debugObjectLogger;
    }

    get isDbReady() {
        return this._isDbReady;
    }

    lockForCleanup(cb: (handler: HandlerCallback) => void)
    {
        this._logger.info("[lockForCleanup] BEGIN");
        let handler = {
            finish: () => {
                this._logger.info("[lockForCleanup] FINISH");
                this._isLockedForCleanup = false;

                let waiters = this._dbCleanupWaiters;
                this._dbCleanupWaiters = [];
                for (let waiter of waiters)
                {
                    waiter();
                }
            }
        }

        this._isLockedForCleanup = true;
        if (!this._isProcessing) {
            cb(handler);
        } else {
            this._processFinishListeners.push(() => {
                cb(handler);
            });
        }
    }

    accept(state: RegistryBundleState)
    {
        return this._acquireProcessLock()
            .then(() => this._processState(state))
            .finally(() => {
                this._isProcessing = false;

                let waiters = this._processFinishListeners
                this._processFinishListeners = [];
                for(let x of waiters)
                {
                    x();
                }
            });
    }

    private _acquireProcessLock()
    {
        if (!this._isLockedForCleanup) {
            this._isProcessing = true;
            return Promise.resolve();
        } else {
           
            return Promise.construct<void>((resolve, reject) => {
                const completeTrigger : ((thenableOrResult?: Resolvable<void>) => void) = () => {
                    this._isProcessing = true;
                    resolve();
                }
                this._dbCleanupWaiters.push(completeTrigger);
            });
        }
    }

    private _processState(state: RegistryBundleState)
    {
        this._logger.info("[_processState] begin");
        const processableSnapshot = this._produceSnapshot(state);
        return this._processSnapshot(processableSnapshot)
    }

    private _processSnapshot(processableSnapshot: ProcessableSnapshot)
    {
        const snapshot = processableSnapshot.snapshot;
        const configHashes = processableSnapshot.configHashes;

        this.logger.info("[_processSnapshot] BEGIN. %s, Item Count: %s", snapshot.date.toISOString(), snapshot.count);

        if (!this._latestSnapshot) {
            return Promise.resolve();
        }

        return Promise.resolve()
            .then(() => this.debugObjectLogger.dump("history-snapshot", 0, snapshot))
            .then(() => {

                this._interation += 1;
                let partition = HistoryPartitioning.calculateDatePartition(snapshot.date);
                let tablesPartitionsData : TablesPartitionsInfo;

                this.logger.info("[_processSnapshot] Date: %s, Partition: %s", snapshot.date, partition);

                let itemsDelta = this._produceDelta(snapshot, this._latestSnapshot!);
                let deltaSummary = this._constructDeltaSummary(snapshot, itemsDelta);

                return Promise.resolve()
                    .then(() => this._queryDatabasePartitions())
                    .then(result => {
                        tablesPartitionsData = result;
                        this.logger.debug("[_processSnapshot] tablesPartitionsData:", tablesPartitionsData);

                        let list = _.values(tablesPartitionsData.byTable);
                        if (!_.every(list, x => x[partition])) {
                            this.logger.debug("[_processSnapshot] maxPartition: %s", tablesPartitionsData.maxPartition);
                            if (partition < tablesPartitionsData.maxPartition) {
                                this.logger.warn("[_processSnapshot] Existing partitions found. Reporting to latest partition. (%s -> %s)", partition, tablesPartitionsData.maxPartition);
                                partition = tablesPartitionsData.maxPartition;
                            }
                        }
                    })
                    .then(() => {
                        this._prepareConfigHashesCache(partition);
                    })
                    .then(() => this.debugObjectLogger.dump("history-diff-snapshot-", this._interation, snapshot))
                    .then(() => this.debugObjectLogger.dump("history-diff-latest-snapshot-", this._interation, this._latestSnapshot!))
                    .then(() => this.debugObjectLogger.dump("history-diff-items-delta-", this._interation, itemsDelta))
                    .then(() => {
                        return this._dbAccessor.executeInTransaction(() => {
                            return Promise.resolve()
                                .then(() => this._prepareDatabasePartitions(partition, tablesPartitionsData.byTable))
                                .then(() => this._persistConfigHashes(configHashes, partition))
                                .then(() => this._persistSnapshot(snapshot, partition))
                                .then(() => this._persistDiff(snapshot, partition, itemsDelta, deltaSummary))
                                .then(() => this._persistTimeline(snapshot, partition, deltaSummary))
                                .then(() => this._persistSummaries(snapshot, partition, deltaSummary))
                                .then(() => this._persistConfig())
                        });
                    })
            })
            .then(() => {
                this.logger.info("[_processSnapshot] END");

                this._latestSnapshot = snapshot;
            })
            .catch(reason => {
                this.logger.error(reason);
            });
    }

    private _prepareConfigHashesCache(partition: number)
    {
        if (this._configHashesPartition != partition)
        {
            this._configHashesDict = {};
            this._configHashesPartition = partition;
        }
    }

    private _persistConfigHashes(configHashes: ConfigHash[], partition: number)
    {
        let newHashes = configHashes.filter(x => !this._configHashesDict[<string>x.config_hash]);
        this.logger.info('[_persistConfigHashes] current hash count: %s', _.keys(this._configHashesDict).length);
        this.logger.info('[_persistConfigHashes] new hash count: %s', newHashes.length);
        return Promise.resolve()
            .then(() => {
                return this._dbAccessor.persistConfigHashes(newHashes, partition);
            })
            .then(() => {
                for(let x of newHashes)
                {
                    this._configHashesDict[<string>x.config_hash] = true;
                }
            });
    }

    private _persistSnapshot(snapshot: DBSnapshot<SnapItemWithConfig>, partition: number)
    {
        if (!this._shouldCreateNewDbSnapshot(snapshot, partition)) {
            return;
        }
        this.logger.info("[_persistSnapshot] BEGIN. Item Count: %s", snapshot.count, this._currentState);
        return Promise.resolve()
            .then(() => this._dbAccessor.fetchSnapshot(partition, snapshot.date))
            .then(dbSnapshot => {
                this.logger.info("[_persistSnapshot] ", dbSnapshot);

                this._resetSnapshotState();

                this._currentState.snapshot_id = dbSnapshot.id;
                this._currentState.snapshot_part = dbSnapshot.part;
                this._currentState.snapshot_date = dbSnapshot.date;
            })
            .then(() => {
                return this._dbAccessor.syncSnapshotItems(partition, this._currentState.snapshot_id!, snapshot);
            })
            .then(() => {
                this.logger.info("[_persistSnapshot] END");
            });
    }

    private _queryDatabasePartitions()
    {
        let tablesPartitionsData : TablesPartitionsInfo = {
            maxPartition: 0,
            byTable: {}
        };
        return Promise.serial(HISTORY_TABLES, tableName => {
            return this._database.queryPartitions(tableName)
                .then(partitions => {
                    partitions = _.filter(partitions, x => x.value != 0);
                    
                    tablesPartitionsData.byTable[tableName] = {};
                    for(let partitionInfo of partitions)
                    {
                        let partitionId = partitionInfo.value - 1;
                        tablesPartitionsData.byTable[tableName][partitionId] = true;

                        tablesPartitionsData.maxPartition = Math.max(partitionId, tablesPartitionsData.maxPartition);
                    }
                });
        })
        .then(() => tablesPartitionsData);
    }

    private _prepareDatabasePartitions(partition: number, tablePartitions: Record<string, TablePartitionMap>)
    {
        return Promise.serial(HISTORY_TABLES, x => this._prepareTablePartitions(x, partition, tablePartitions[x]));
    }

    private _prepareTablePartitions(tableName: string, partition: number, myPartitions: TablePartitionMap)
    {
        this.logger.verbose("[_prepareTablePartitions] %s :: %s", tableName, partition, myPartitions)
        if (myPartitions[partition]) {
            return;
        }
        return this._database.createPartition(tableName, 
            HistoryPartitioning.partitionName(partition),
            partition + 1);
    }

    private _shouldCreateNewDbSnapshot(snapshot: DBSnapshot<SnapItemWithConfig>, partition: number)
    {
        if (!this._currentState.snapshot_id) {
            return true;
        }

        if (partition != this._currentState.snapshot_part) {
            return true;
        }

        if (this._currentState.diff_count > 50) {
            return true;
        }

        return false;
    }

    private _persistDiff(snapshot: DBSnapshot<SnapItemWithConfig>, partition: number, itemsDelta: DBRawDiffItem[], deltaSummary: DeltaSummary)
    {
        this.logger.info('[_persistDiff] BEGIN. ', this._currentState);

        return Promise.resolve()
            .then(() => {
                return this._dbAccessor.fetchDiff(this._currentState.snapshot_id!,
                    partition,
                    snapshot.date,
                    this._currentState.diff_in_snapshot,
                    deltaSummary)
            })
            .then(dbDiff => {
                this._currentState.diff_id = dbDiff.id;
                this._currentState.diff_date = dbDiff.date;
                this._currentState.diff_in_snapshot = false;
                this._currentState.diff_count += 1;

                this._currentState.diff_item_count += itemsDelta.length;

                let diffSnapshot = new DBSnapshot<DBRawDiffItem>(null);
                diffSnapshot.addItems(itemsDelta);

                return this._dbAccessor.syncDiffItems(partition, dbDiff.id, diffSnapshot);
            })
            .then(() => {
                this.logger.info('[_persistDiff] END.');
            })
    }

    private _persistTimeline(snapshot: DBSnapshot<SnapItemWithConfig>, partition: number, deltaSummary: DeltaSummary)
    {
        this.logger.info('[_persistTimeline] BEGIN. ');
        return Promise.resolve()
            .then(() => {
                return this._dbAccessor.syncTimelineItems(partition, snapshot.date, deltaSummary);
            })
            .then(() => {
                this.logger.info('[_persistTimeline] END.');
            })
    }

    private _persistSummaries(snapshot: DBSnapshot<SnapItemWithConfig>, partition: number, deltaSummary: DeltaSummary)
    {
        this.logger.info('[_persistSummaries] BEGIN. ');
        return Promise.resolve()
            .then(() => {
                return this._dbAccessor.syncSummaryItems(partition, snapshot.date, deltaSummary.snapshot);
            })
            .then(() => {
                return this._dbAccessor.syncSummaryDeltaItems(partition, snapshot.date, deltaSummary.delta);
            })
            .then(() => {
                this.logger.info('[_persistSummaries] END.');
            })
    }

    private _constructDeltaSummary(snapshot: DBSnapshot<SnapItemWithConfig>, itemsDelta: DBRawDiffItem[])
    {
        let deltaSummary : DeltaSummary = {
            snapshot: this._constructSnapshotSummary(snapshot.getItems()),
            delta: this._constructSnapshotSummary(itemsDelta)
        }

        let currentSnapshotAlerts = this._constructAlertsSummary(snapshot);

        this.debugObjectLogger.dump("current-snapshot-alerts-", this._interation, currentSnapshotAlerts);

        const currentTotalAlerts = this._newAlertsDict();
        const currentByKindAlerts : Record<string, AlertCounter> = {};
        for(let kind of _.keys(currentSnapshotAlerts))
        {
            let dict = currentSnapshotAlerts[kind];
            currentByKindAlerts[kind] = this._newAlertsDict();
            for(let itemAlerts of _.values(dict))
            {
                this._appendAlertCounts(currentTotalAlerts, itemAlerts);
                this._appendAlertCounts(currentByKindAlerts[kind], itemAlerts);
            }
        }
        deltaSummary.snapshot.alerts = currentTotalAlerts;
        deltaSummary.snapshot.alertsByKind = currentByKindAlerts;

        let deltaAlertsDict = _.cloneDeep(currentTotalAlerts);
        let deltaAlertsByKindDict = _.cloneDeep(currentByKindAlerts);
        if (this._latestSnapshotAlerts)
        {
            for(let kind of _.keys(this._latestSnapshotAlerts))
            {
                if (!deltaAlertsByKindDict[kind]) {
                    deltaAlertsByKindDict[kind] = this._newAlertsDict();
                }
                let dict = this._latestSnapshotAlerts[kind];
                for(let itemAlerts of _.values(dict))
                {
                    this._subtractAlertCounts(deltaAlertsDict, itemAlerts);
                    this._subtractAlertCounts(deltaAlertsByKindDict[kind], itemAlerts);
                }
            }
        }
        deltaSummary.delta.alerts = deltaAlertsDict;
        deltaSummary.delta.alertsByKind = deltaAlertsByKindDict;

        this._latestSnapshotAlerts = currentSnapshotAlerts;

        return deltaSummary;
    }

    private _appendAlertCounts(counter: AlertCounter, other: AlertCounter)
    {
        counter.error += other.error;
        counter.warn += other.warn;
    }

    private _subtractAlertCounts(counter: AlertCounter, other: AlertCounter)
    {
        counter.error += other.error;
        counter.warn += other.warn;
    }

    private _newAlertsDict() : AlertCounter
    {
        return {
            error: 0,
            warn: 0
        }
    }

    private _constructSnapshotSummary(items: BaseSnapshotItem[])
    {
        let dns : Record<string, boolean> = {};
        let summary : SnapshotSummary= {
            items: 0,
            kinds: {},
            alerts: {},
            alertsByKind: {}
        };

        for(let item of items.filter(x => x.config_kind == 'alerts'))
        {
            if (!dns[item.dn])
            {
                dns[item.dn] = true;
                
                summary.items = summary.items + 1;

                if (!summary.kinds[item.kind])
                {
                    summary.kinds[item.kind] = 1;
                }
                else
                {
                    summary.kinds[item.kind] = summary.kinds[item.kind] + 1;
                }
            }
        }

        return summary;
    }

    private _constructAlertsSummary(snapshot: DBSnapshot<SnapItemWithConfig>) : AlertsSummary
    {
        let alertsDict : AlertsSummary = {};
        for(let item of snapshot.getItems().filter(x => x.config_kind == 'node'))
        {
            if (item.config.selfAlertCount)
            {
                for(let severity of _.keys(item.config.selfAlertCount))
                {
                    let count = item.config.selfAlertCount[severity];
                    if (count > 0)
                    {
                        if (!alertsDict[item.kind])
                        {
                            alertsDict[item.kind] = {};
                        }
                        if (!alertsDict[item.kind][item.dn])
                        {
                            alertsDict[item.kind][item.dn] = {
                                error: 0,
                                warn: 0
                            };
                        }
                        (<any>alertsDict[item.kind][item.dn])[severity] = count;
                    }
                }
            }
        }
        return alertsDict;
    }

    private _produceDelta(targetSnapshot: DBSnapshot<SnapItemWithConfig>, currentSnapshot: DBSnapshot<DBRawSnapItem>) : DBRawDiffItem[]
    {
        this.logger.info("[_produceDelta] target count: %s, current count: %s.",  targetSnapshot.count, currentSnapshot.count);

        this.debugObjectLogger.dump("produce-delta-target-snapshot-keys", this._interation, targetSnapshot.keys);
        this.debugObjectLogger.dump("produce-delta-current-snapshot-keys", this._interation, currentSnapshot.keys);

        let itemsDelta : DBRawDiffItem[] = [];

        for(let key of targetSnapshot.keys)
        {
            let targetItem = targetSnapshot.findById(key)!;
            let currentItem = currentSnapshot.findById(key);
            let shouldAdd = true;

            if (currentItem)
            {
                if (BufferUtils.areEqual(targetItem.config_hash, currentItem.config_hash))
                {
                    shouldAdd = false;
                }
            }

            if (shouldAdd)
            {
                itemsDelta.push({
                    present: 1,
                    dn: targetItem.dn,
                    kind: targetItem.kind,
                    config_kind: targetItem.config_kind,
                    name: targetItem.name,
                    config_hash: targetItem.config_hash
                });
            }
        }

        for(let key of currentSnapshot.keys)
        {
            let currentItem = currentSnapshot.findById(key)!;
            if (!targetSnapshot.findById(key))
            {
                let diffItem : DBRawDiffItem = {
                    present: 0,
                    dn: currentItem.dn,
                    kind: currentItem.kind,
                    config_kind: currentItem.config_kind,
                    name: currentItem.name,
                    config_hash: currentItem.config_hash
                }
                itemsDelta.push(diffItem);
            }
        }

        return itemsDelta;
    }

    private _persistConfig()
    {
        return Promise.resolve()
            .then(() => this._dbAccessor.updateConfig('STATE', this._currentState));
    }

    private _produceSnapshot(state: RegistryBundleState) : ProcessableSnapshot
    {
        this._logger.info("[_produceSnapshot] date: %s, count: %s", state.date.toISOString(), state.getCount());

        const configHashes : ConfigHash[] = [];
        const snapshot = new DBSnapshot<SnapItemWithConfig>(state.date);
        for(let node of state.nodeItems)
        {
            this._addSnapshotItem(snapshot, configHashes, node.config, {
                config_kind: 'node',
                dn: node.dn,
                kind: node.kind
            })
            
            {
                for(let props of _.values(node.propertiesMap))
                {
                    this._addSnapshotItem(snapshot, configHashes, props, {
                        config_kind: 'props',
                        dn: node.dn,
                        kind: node.kind,
                        name: props.id
                    });
                }
            }

            {
                if (node.selfAlerts.length > 0)
                {
                    this._addSnapshotItem(snapshot, configHashes, node.selfAlerts, {
                        config_kind: 'alerts',
                        dn: node.dn,
                        kind: node.kind
                    });
                }
            }
        }

        return {
            snapshot: snapshot,
            configHashes: configHashes
        }
    }

    private _addSnapshotItem(snapshot: DBSnapshot<SnapItemWithConfig>, configHashes : ConfigHash[], config: any, baseData: BaseSnapshotItem)
    {
        let configHash = HashUtils.calculateObjectHash(config);
        let item = <SnapItemWithConfig>baseData;
        item.config_hash = configHash;
        item.config = config;

        snapshot.addItem(item);

        configHashes.push({ 
            config_hash: configHash,
            config: config
        })
    }

    private _onDbConnected()
    {
        this._logger.info("[_onDbConnected] ...");
        this._latestSnapshot = null;
        return Promise.resolve()
            .then(() => this._dbAccessor.queryConfig('STATE'))
            .then((config : any) => {
                this._logger.info("[_onDbConnected] config: ", config);

                if (config) {
                    this._currentState = <ConfigState>config.value;
                }
                if (!this._currentState) {
                    this._currentState = this._makeNewConfigState();
                }

                this._logger.info("[_onDbConnected] state: ", this._currentState);
            })
            .then(() => {
                if (!this._currentState.diff_id) {
                    return null;
                }
                return this._dbAccessor.snapshotReader.reconstructDiffNodesShapshot(this._currentState.diff_id);
             })
            .then(snapshot => {
                if (!snapshot) {
                    this._latestSnapshot = new DBSnapshot<SnapItemWithConfig>(null);
                    this._resetSnapshotState();
                    this._logger.info("[_onDbConnected] no snapshot fetched.");
                } else {
                    this._latestSnapshot = snapshot;
                    this._logger.info("[_onDbConnected] reconstructed snapshot item count: %s", snapshot.count);
                }
            })
            .then(() => {
                this._latestSnapshotAlerts = this._constructAlertsSummary(this._latestSnapshot!);
                this._logger.info("[_onDbConnected] _latestSnapshotAlerts key count: %s", _.keys(this._latestSnapshotAlerts).length);
                this._logger.silly("[_onDbConnected] this._latestSnapshotAlerts: ", this._latestSnapshotAlerts);
            })
            .then(() => {
                return this.debugObjectLogger.dump("history-initial-latest-snapshot-", this._interation, this._latestSnapshot);
            })
            .then(() => {
                return this.debugObjectLogger.dump("history-initial-latest-snapshot-alerts-", this._interation, this._latestSnapshotAlerts);
            })
            .then(() => {
                this._isDbReady = true;
                this._logger.info("[_onDbConnected] IS READY");
            })
    }

    markDeletedPartition(partition: number)
    {
        if (this._currentState.snapshot_part == partition)
        {
            this._resetSnapshotState();
        }
    }

    setUsedHashesDict(dict: Record<string, boolean>)
    {
        this.logger.info("[setUsedHashesDict] size: %s", _.keys(dict).length);
        this._configHashesDict = dict;
    }

    private _resetSnapshotState()
    {
        this.logger.info('[_resetSnapshotState] ');

        this._currentState = this._makeNewConfigState();
    }

    private _makeNewConfigState() : ConfigState {
        return {
            snapshot_part: null,
            snapshot_id: null,
            snapshot_date: null,
            diff_id: null,
            diff_date: null,
            diff_in_snapshot: true,
            diff_count: 0,
            diff_item_count: 0,
        }
    }
    
}


interface TablesPartitionsInfo
{
    maxPartition: number,
    byTable: Record<string, TablePartitionMap>
}

type TablePartitionMap = Record<string, boolean>

interface DeltaSummary
{
    snapshot: SnapshotSummary,
    delta: SnapshotSummary,
}

type AlertsSummary = Record<string, Record<string, AlertCounter > >;
interface AlertCounter {
    error: number,
    warn: number
}
interface SnapshotSummary
{
    items: number,
    kinds: Record<string, number>,
    alerts: any,
    alertsByKind: any
}
interface ProcessableSnapshot
{
    configHashes : ConfigHash[],
    snapshot : DBSnapshot<SnapItemWithConfig>
}

export interface SnapItemWithConfig extends DBRawSnapItem {
    config: any
}

export interface ConfigState
{
    snapshot_part: number | null
    snapshot_id: number | null
    snapshot_date: string | null
    diff_id: number | null
    diff_date: string | null
    diff_in_snapshot: boolean
    diff_count: number 
    diff_item_count: number
}
