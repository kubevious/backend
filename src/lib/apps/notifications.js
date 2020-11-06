const Promise = require('the-promise');
const _ = require('the-lodash');
const uuidParse = require('uuid-parse');
const moment = require('moment');

class Notifications
{
    constructor(context)
    {
        this.context = context;
        this.logger = context.logger.sublogger('NotificationsApp');
        this._worldvious = this.context.worldvious;
        this._allNotifications = [];
        this._notifications = [];
        this._snooseDict = {};
        this._isDictLoaded = false;

        this.context.database.onConnect(this._onDbConnected.bind(this));
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

    snooze(kind, id, days)
    {
        const dbData = {
            kind: kind,
            feedback: Buffer.from(uuidParse.parse(id)),
            snooze: null
        };
        if (days) {
            dbData.snooze = moment().add(days, 'days').toDate();
        }

        return this.context.database.dataStore.table('notification_snooze')
            .createOrUpdate(dbData)
            .then(() => {
                return this._loadSnoozedNotifications();
            });
    }

    _onDbConnected()
    {
        this.logger.info("[_onDbConnected] ...");
        return Promise.resolve()
            .then(() => this._loadSnoozedNotifications());
    }

    _loadSnoozedNotifications()
    {
        return this.context.database.dataStore.table('notification_snooze')
            .queryMany()
            .then(results => {
                this._isDictLoaded = true;
                for(let item of results)
                {
                    item.feedback = uuidParse.unparse(item.feedback);
                }
                this._snooseDict = _.makeDict(results, 
                    x => this._makeKey(x.kind, x.feedback),
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

    _decideNotifications()
    {
        if (!this._isDictLoaded) {
            return;
        }
        this.logger.info("Current Notifications: %s ", this._allNotifications.length);

        const now = moment();
        this._notifications = 
            this._allNotifications.filter(x => {
                const key = this._makeKey(x.kind, x.id);
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

        this.context.websocket.update({ kind: 'notifications' }, {
            notifications: this._notifications
        });
        this.context.websocket.update({ kind: 'notifications-info' }, {
            count: this._notifications.length
        });
    }

    _makeKey(kind, id)
    {
        return `${kind}-${id}`;
    }

}

module.exports = Notifications;