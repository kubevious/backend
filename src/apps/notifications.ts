import _ from 'the-lodash';
import { Promise } from 'the-promise';
import { ILogger } from 'the-logger' ;

import { parse as uuidParse, unparse as uuidUnparse } from 'uuid-parse'

import moment from 'moment';

import { Context } from '../context';
import { WorldviousClient, NotificationItem, FeedbackRequest } from '@kubevious/worldvious-client';
import { NotificationSnoozeRow } from '@kubevious/data-models/dist/models/notification';

import { Database } from '../db/index';


export class NotificationsApp
{
    private context : Context;
    private _dataStore : Database;
    private _logger : ILogger;
    
    private _worldvious : WorldviousClient;

    private _isDictLoaded = false;
    private _allNotifications : NotificationItem[] = [];
    private _notifications : NotificationItem[] = [];
    private _snooseDict : Record<string, { isRead? : boolean, snoozeTill? : moment.Moment } > = {};

    constructor(context : Context)
    {
        this.context = context;
        this._logger = context.logger.sublogger('NotificationsApp');

        this._dataStore = context.dataStore;
        
        this._worldvious = this.context.worldvious;
       
        this.context.database.onConnect(this._onDbConnected.bind(this));
    }

    get logger() {
        return this._logger;
    }

    get notificationItems() {
        return this._notifications;
    }

    init()
    {
        this._worldvious.onNotificationsChanged(notifications => {
            this._allNotifications = notifications;
            this._decideNotifications();
        });
    }

    snooze(kind: string, id: string, days?: number)
    {
        const dbData : Partial<NotificationSnoozeRow> = {
            kind: kind,
            feedback: Buffer.from(uuidParse(id)),
        };
        if (days) {
            dbData.snooze = moment().add(days, 'days').toDate();
        }

        return this._dataStore.dataStore.table(this._dataStore.notification.NotificationSnooze)
            .create(dbData)
            .then(() => {
                return this._loadSnoozedNotifications();
            });
    }

    private _onDbConnected()
    {
        this.logger.info("[_onDbConnected] ...");
        return Promise.resolve()
            .then(() => this._loadSnoozedNotifications());
    }

    private _loadSnoozedNotifications()
    {
        return this._dataStore.dataStore.table(this._dataStore.notification.NotificationSnooze)
            .queryMany()
            .then(results => {
                this._isDictLoaded = true;

                this._snooseDict = _.makeDict(results, 
                    x => this._makeKey(x.kind!, uuidUnparse(x.feedback!)),
                    x => {
                        if (x.snooze == null) {
                            return { isRead : true }
                        }
                        return { snoozeTill : moment(x.snooze) }
                    });

                this._decideNotifications()
            })
            ;
    }

    private _decideNotifications()
    {
        if (!this._isDictLoaded) {
            return;
        }
        this.logger.info("Current Notifications: %s ", this._allNotifications.length);

        const now = moment();
        this._notifications = 
            this._allNotifications.filter(x => {
                const notif = <FeedbackRequest>x;
                const key = this._makeKey(notif.kind, notif.id);
                const snoozeInfo = this._snooseDict[key];
                if (snoozeInfo) {
                    if (snoozeInfo.isRead) {
                        return false;
                    }
                    if (now.isBefore(snoozeInfo.snoozeTill)) {
                        return false;
                    }
                }
                return true;
            });
        this.logger.info("Visible Notifications: %s ", this._notifications.length);

        this.context.websocket.notifyAll({ kind: 'notifications' }, {
            notifications: this._notifications
        });
        this.context.websocket.notifyAll({ kind: 'notifications-info' }, {
            count: this._notifications.length
        });

    }

    private _makeKey(kind: string, id: string)
    {
        return `${kind}-${id}`;
    }

}