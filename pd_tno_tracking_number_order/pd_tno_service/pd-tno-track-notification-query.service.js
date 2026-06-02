/**
 * @NApiVersion 2.1
 * @NModuleScope SameAccount
 * @author Rogério Gonçalves Rodrigues - Project Dome
 */

define([
    'N/query',
    'N/log'
], function (
    query,
    log
) {

    //^ Início - Function PO - excluir  após validação
    function existsNotification(trackingNumber) {
        log.debug('linha 17 - existsNotification - trackingNumber', trackingNumber);

        try {
            if (!trackingNumber) {
                return {
                    exists: false,
                    notificationId: null
                };
            }

            var sql = `
                SELECT id
                FROM customrecord_pd_tno_track_notification
                WHERE TRIM(name) = TRIM(?)
                ORDER BY id DESC
            `;

            var resultSet = query.runSuiteQL({
                query: sql,
                params: [trackingNumber]
            });

            var results = resultSet.asMappedResults() || [];
            log.debug('linha 40 - existsNotification - results', results);

            if (results.length > 0 && results[0].id) {
                return {
                    exists: true,
                    notificationId: Number(results[0].id)
                };
            }

            return {
                exists: false,
                notificationId: null
            };

        } catch (e) {
            log.error({
                title: 'existsNotification - erro',
                details: e
            });

            return {
                exists: false,
                notificationId: null
            };
        }
    }
    //^ Fim - Function PO - excluir  após validação



    //* Início- Atuando inbound shipment 
    function getInboundTrackingNotification(inboundShipmentId) {
        try {
            if (!inboundShipmentId) {
                return null;
            }

            var sql = `
                SELECT 
                    ibs.custrecord_tracking,
                    trk.id AS id_17_trk_notif,
                    trk.name,
                    trk.custrecord_pd_tno_carrier,
                    car.name AS carrier,
                    car.custrecord_pd_17track_carrier_code
                FROM inboundShipment ibs
                INNER JOIN customrecord_pd_tno_track_notification trk 
                ON trk.id = ibs.custrecord_tracking
                INNER JOIN customrecord_pd_17track_carriers car 
                ON car.id = trk.custrecord_pd_tno_carrier
                WHERE ibs.id = ?
        `;

            var resultSet = query.runSuiteQL({
                query: sql,
                params: [inboundShipmentId]
            });

            var results = resultSet.asMappedResults() || [];

            if (!results.length) {
                return null;
            }

            return {
                trackingRecordId: results[0].custrecord_tracking,
                notificationId: results[0].id_17_trk_notif,
                trackingNumber: results[0].name,
                carrierId: results[0].custrecord_pd_tno_carrier,
                carrierName: results[0].carrier,
                carrierCode: results[0].custrecord_pd_17track_carrier_code
            };

        } catch (e) {
            log.error({
                title: 'getInboundTrackingNotification - erro',
                details: e
            });

            return null;
        }
    }
    //* fim - Atuando inbound shipment 

    function getTrackNotificationData(notificationId) {
        try {
            if (!notificationId) {
                return null;
            }

            var sql = `
            SELECT
                trk.id AS id_17_trk_notif,
                trk.name AS tracking_number,
                trk.custrecord_pd_tno_carrier,
                car.name AS carrier,
                car.custrecord_pd_17track_carrier_code AS carrier_code
            FROM customrecord_pd_tno_track_notification trk
            INNER JOIN customrecord_pd_17track_carriers car 
                ON car.id = trk.custrecord_pd_tno_carrier
            WHERE trk.id = ?
        `;

            var resultSet = query.runSuiteQL({
                query: sql,
                params: [notificationId]
            });

            var results = resultSet.asMappedResults() || [];

            if (!results.length) {
                return null;
            }

            return {
                notificationId: results[0].id_17_trk_notif,
                trackingNumber: results[0].tracking_number,
                carrierId: results[0].custrecord_pd_tno_carrier,
                carrierName: results[0].carrier,
                carrierCode: results[0].carrier_code
            };

        } catch (e) {
            log.error({
                title: 'getTrackNotificationData - erro',
                details: e
            });

            return null;
        }
    }


    function getAllActiveNotificationsByTrackingNumber(trackingNumber) {
        try {
            if (!trackingNumber) {
                return [];
            }

            var sql = `
                SELECT id
                FROM customrecord_pd_tno_track_notification
                WHERE name = ?
                AND isinactive = 'F'
                ORDER BY id DESC
            `;

            var resultSet = query.runSuiteQL({
                query: sql,
                params: [trackingNumber]
            });

            var results = resultSet.asMappedResults() || [];

            return results.map(function (_r) { return Number(_r.id); });

        } catch (e) {
            log.error({
                title: 'getAllActiveNotificationsByTrackingNumber - erro',
                details: e
            });
            return [];
        }
    }

    return {
        existsNotification: existsNotification,
        getAllActiveNotificationsByTrackingNumber: getAllActiveNotificationsByTrackingNumber,
        getInboundTrackingNotification: getInboundTrackingNotification,
        getTrackNotificationData: getTrackNotificationData
    };
});
