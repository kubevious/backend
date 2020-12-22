import _ from 'the-lodash';
import { RegistryStateNode } from '@kubevious/helpers/dist/registry-state-node';
import { Alert, AlertCounter, SnapshotConfigKind, SnapshotNodeConfig, SnapshotPropsConfig } from '@kubevious/helpers/dist/snapshot/types'
import { Processor } from '../builder'

export default Processor()
    .order(200)
    .handler(({logger, state, tracker, context }) => {

        state.addNewItem({
            dn: 'summary',
            kind: 'summary',
            config_kind: SnapshotConfigKind.node,
            config: <SnapshotNodeConfig> {
                kind: 'summary',
                rn: 'summary',
                name: 'summary'
            }
        });

        state.addNewItem({
            dn: 'summary',
            kind: 'summary',
            config_kind: SnapshotConfigKind.props,
            config: <SnapshotPropsConfig> {
                kind: 'counters',
                id: 'app-counters',
                title: 'Configuration Summary',
                order: 10,
                config: [{
                    title: 'Namespaces',
                    value: state.countByKind('ns')
                }, {
                    title: 'Applications',
                    value: state.countByKind('app')
                }, {
                    title: 'Pods',
                    value: state.countByKind('pod')
                }]
            }
        });

        state.addNewItem({
            dn: 'summary',
            kind: 'summary',
            config_kind: SnapshotConfigKind.props,
            config: <SnapshotPropsConfig> {
                kind: 'counters',
                id: 'infra-counters',
                title: 'Infrastructure Summary',
                order: 11,
                config: [{
                    title: 'Nodes',
                    value: state.countByKind('node')
                }, {
                    title: 'Volumes',
                    value: state.countByKind('vol')
                }, 
                getClusterCPU(), 
                getClusterRAM()
                ]
            }
        });

        state.addNewItem({
            dn: 'summary',
            kind: 'summary',
            config_kind: SnapshotConfigKind.props,
            config: <SnapshotPropsConfig> {
                kind: 'object-list',
                id: 'top-issue-namespaces',
                title: 'Top Namespaces with Issues',
                order: 12,
                config: getTopNamespacesWithIssues()
            }
        });

        state.addNewItem({
            dn: 'summary',
            kind: 'summary',
            config_kind: SnapshotConfigKind.props,
            config: <SnapshotPropsConfig> {
                kind: 'alert-target-list',
                id: 'top-issues',
                title: 'Top Issues',
                order: 13,
                config: getTopIssues()
            }
        });

        /***********/

        function getTopNamespacesWithIssues()
        {
            const namespaces = state.findByKind('ns');

            const namespaceInfos : { dn: string, counters: NamespaceAlertCounters }[] = [];

            for(let ns of _.values(namespaces))
            {
                let counters: NamespaceAlertCounters = {
                    totalIssues: 0,
                    alertCount: {
                        error: 0,
                        warn: 0
                    }
                }
                
                extractNamespaceAlerts(ns, counters);

                counters.totalIssues = counters.alertCount.error * 2 + counters.alertCount.warn;

                namespaceInfos.push({
                    dn: ns.dn,
                    counters: counters
                });
            }

            let orderedNamespaces = _.orderBy(namespaceInfos, x => x.counters.totalIssues, 'desc');

            let topNamespaces = _.take(orderedNamespaces, 3);

            return topNamespaces.map(x => {
                return {
                    dn: x.dn,
                    alertCount: x.counters.alertCount
                }
            });
        }

        function getTopIssues()
        {
            let alertDict: Record<string, { alert: Alert, targets: string[] } > = {};

            for(let node of state.getNodes())
            {
                let alerts = state.getAlerts(node.dn);

                for(let alert of alerts)
                {
                    let alertKey = getAlertKey(alert);
                    if (!alertDict[alertKey]) {
                        alertDict[alertKey] = {
                            alert: alert,
                            targets: []
                        };
                    } 
    
                    alertDict[alertKey].targets.push(node.dn);
                }
            }

            let orderedAlerts = _.orderBy(_.values(alertDict), x => x.targets.length, 'desc');
            
            let topAlerts = _.take(orderedAlerts, 3);

            return topAlerts;
        }

        function extractNamespaceAlerts(node: RegistryStateNode, counters: NamespaceAlertCounters)
        {
            for(let alert of node.selfAlerts)
            {
                (<Record<string, number>> <any> counters.alertCount) [alert.severity] += 1;

            }

            for(let childDn of state.getChildrenDns(node.dn))
            {
                let childNode = state.getNode(childDn)!;
                extractNamespaceAlerts(childNode, counters);
            }
        }

        function getAlertKey(alert: Alert)
        {
            return [alert.severity, alert.msg, _.stableStringify(alert.source)].join('-');
        }

        function getClusterCPU()
        {
            const value = getInfraCapacity('cpu allocatable') as string;

            const cpuPers = parseFloat(value.replace('%', ''));
            const coreCount = (Math.round(cpuPers) / 100);

            return {
                title: 'CPU Cores',
                value: coreCount
            }
        }

        function getClusterRAM()
        {
            let counterValue : any;
            let counterUnit : any;

            const value = getInfraCapacity('memory allocatable') as string;
            if (!value) {
                counterValue = '?';
            } else {
                const parts = value.split(' ');
                counterValue = parseFloat(parts[0]);
                counterUnit = parts[1];
            }

            return {
                title: 'Cluster RAM',
                value: counterValue,
                unit: counterUnit
            }
        }

        function getInfraCapacity(key: string)
        {
            const item = state.findByDn('root/infra-[Infrastructure]/nodes-[Nodes]');
            if (!item) {
                return '?';
            }
            const config = item.getProperties('cluster-resources');
            if (!config) {
                return '?';
            }
            const value = config.config[key];
            return value;
        }

    })


interface NamespaceAlertCounters
{
    totalIssues: number;
    alertCount: AlertCounter;
}