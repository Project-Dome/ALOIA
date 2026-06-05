/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 * @author Project Dome - Rogério Gonçalves Rodrigues
 */

define([
    'N/query',
    'N/log'
], function (
    query,
    log
) {


    function canProcessNotification(notificationId) {
        try {
            if (!notificationId) {
                return false;
            }

            var sql = `
                SELECT
                    isinactive
                FROM
                    customrecord_pd_tno_track_notification
                WHERE
                    id = ?
            `;

            var resultSet = query.runSuiteQL({
                query: sql,
                params: [notificationId]
            });

            var results = resultSet.asMappedResults();

            if (!results || results.length === 0) {
                return false;
            }

            // isinactive = 'T' ou 'F'
            return results[0].isinactive !== 'T';

        } catch (error) {
            log.error('canProcessNotification - erro', {
                notificationId: notificationId,
                error: error
            });
            return false;
        }
    }

    return {
        canProcessNotification: canProcessNotification
    };
});
