/**
 * @NApiVersion 2.1
 * @NModuleScope Public
 * @author Rogério Gonçalves Rodrigues
 */

define([
    'N/record',
    'N/log'
], function (
    record,
    log
) {

    /**
     * Atualiza um único customrecord_pd_tno_track_notification
     */
    function updateSingleNotification(notificationId, payload) {
        try {
            if (!notificationId || !payload) {
                return null;
            }

            var valuesToUpdate = {};

            Object.keys(payload).forEach(function (fieldId) {
                valuesToUpdate[fieldId] = payload[fieldId];
            });

            if (
                payload.custrecord_pd_tno_status &&
                String(payload.custrecord_pd_tno_status).toLowerCase() === 'delivered'
            ) {
                valuesToUpdate.isinactive = false;
            }

            record.submitFields({
                type: 'customrecord_pd_tno_track_notification',
                id: notificationId,
                values: valuesToUpdate,
                options: {
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                }
            });

            return true;

        } catch (error) {
            log.error('updateSingleNotification - erro', {
                notificationId: notificationId,
                error: error
            });
            return null;
        }
    }

    /**
     * Atualiza múltiplos customrecord_pd_tno_track_notification
     */
    function updateTrackNotifications(notifications) {
        try {
            if (!Array.isArray(notifications) || notifications.length === 0) {
                return null;
            }

            notifications.forEach(function (item) {

                if (!item.notificationId || !item.payload) {
                    return;
                }

                var valuesToUpdate = {};

                Object.keys(item.payload).forEach(function (fieldId) {
                    valuesToUpdate[fieldId] = item.payload[fieldId];
                });

                if (
                    item.payload.custrecord_pd_tno_status &&
                    String(item.payload.custrecord_pd_tno_status).toLowerCase() === 'delivered'
                ) {
                    valuesToUpdate.isinactive = false;
                }

                record.submitFields({
                    type: 'customrecord_pd_tno_track_notification',
                    id: item.notificationId,
                    values: valuesToUpdate,
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });
            });

            return true;

        } catch (error) {
            log.error('updateTrackNotifications - erro', error);
            return null;
        }
    }

    return {
        updateSingleNotification: updateSingleNotification,
        updateTrackNotifications: updateTrackNotifications
    };
});
