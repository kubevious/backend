import _ from 'the-lodash';
import { Context } from '../context';
import { Router } from '@kubevious/helper-backend'
import Joi from 'joi';

import { MarkersImportData } from '@kubevious/ui-middleware/dist/services/marker'

export default function (router: Router, context: Context) {

    router.url('/api/v1/rule-engine');

    /**** Marker Configuration ***/

    // List Makers
    router.get('/markers/', (req, res) => {

        return context.markerAccessor.queryAll()
            .then(rows => {
                return rows.map(x => {
                    return {
                        name: x.name,
                        shape: x.shape,
                        color: x.color
                    };
                })
            });

    })

    // Get Marker
    router.get<{}, any, MarkerQuery>('/marker', (req, res) => {

        return context.markerAccessor.getMarker(req.query.marker);
    })

    // Create Marker
    router.post<{}, any, MarkerQuery>('/marker', (req, res) => {

        return context.markerEditor.createMarker(req.body, req.query.marker);

    })

    // Delete Marker
    router.delete<{}, any, MarkerQuery>('/marker', (req, res) => {

        return context.markerEditor.deleteMarker(req.query.marker);

    })

    // Export Makers
    router.get('/export-markers', (req, res) => {
        return context.markerAccessor
            .exportMarkers();
    })

    // Import Makers
    router.post<{}, MarkersImportData>('/import-markers', (req, res) => {

        return context.markerEditor
            .importMarkers(req.body.data, req.body.deleteExtra);

    })
    .bodySchema(
        Joi.object({
            data: {
                kind: Joi.string().valid('markers').required(),
                items: Joi.array().required().items(
                    Joi.object()
                )
            },
            deleteExtra: Joi.boolean().optional(),
        })
    )

    /**** Marker Operational ***/

    // List Marker Statuses
    router.get('/markers-statuses', (req, res) => {
        return context.markerAccessor.getMarkersStatuses();
    })
    
    // Get Marker Result
    router.get<{}, any, MarkerQuery>('/marker-result', (req, res) => {
        return context.markerAccessor.getMarkerResult(req.query.marker);
    })

}


interface MarkerQuery
{
    marker: string
}
