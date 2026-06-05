/**
 * @NApiVersion 2.1
 * @NModuleScope public
 */

define(
    [
        'N/record',
        'N/log'
    ],
    function (
        record,
        log
    ) {

        function refreshTrackNotifications(payload) {
            try {
                if (!payload || !payload.items || !payload.items.length) {
                    return;
                }

                payload.items.forEach(function (item) {
                    try {
                        if (!item.notificationId) {
                            return;
                        }

                        var notificationRecord = record.load({
                            type: 'customrecord_pd_tno_track_notification',
                            id: item.notificationId,
                            isDynamic: false
                        });

                        var hasChanges = false;

                        var currentStatus = notificationRecord.getValue({
                            fieldId: 'custrecord_pd_tno_status'
                        }) || '';

                        var newStatus = item.status || '';

                        if (currentStatus !== newStatus) {
                            notificationRecord.setValue({
                                fieldId: 'custrecord_pd_tno_status',
                                value: newStatus
                            });
                            hasChanges = true;
                        }

                        var currentStatusDate = notificationRecord.getValue({
                            fieldId: 'custrecord_pd_tno_status_date'
                        }) || '';

                        var newStatusDate = item.latestSyncTime || '';

                        if (currentStatusDate !== newStatusDate) {
                            notificationRecord.setValue({
                                fieldId: 'custrecord_pd_tno_status_date',
                                value: newStatusDate
                            });
                            hasChanges = true;
                        }

                        var currentEstimatedDelivery = notificationRecord.getValue({
                            fieldId: 'custrecord_pd_tno_estimated_delivery_dat'
                        }) || '';

                        var newEstimatedDelivery = item.estimatedDeliveryDate || '';

                        if (currentEstimatedDelivery !== newEstimatedDelivery) {
                            notificationRecord.setValue({
                                fieldId: 'custrecord_pd_tno_estimated_delivery_dat',
                                value: newEstimatedDelivery
                            });
                            hasChanges = true;
                        }

                        var currentHistorical = notificationRecord.getValue({
                            fieldId: 'custrecord_pd_tno_historical'
                        }) || '';

                        var newHistorical = item.historical || '';

                        if (newHistorical && currentHistorical !== newHistorical) {
                            notificationRecord.setValue({
                                fieldId: 'custrecord_pd_tno_historical',
                                value: newHistorical
                            });
                            hasChanges = true;
                        }

                        if (hasChanges) {
                            notificationRecord.save({
                                enableSourcing: false,
                                ignoreMandatoryFields: true
                            });
                        }

                    } catch (itemError) {
                        log.error({
                            title: 'refreshTrackNotifications - erro ao processar notificationId ' + item.notificationId,
                            details: itemError
                        });
                    }
                });

            } catch (error) {
                log.error({
                    title: 'refreshTrackNotifications - erro inesperado',
                    details: error
                });
            }
        }

        return {
            refreshTrackNotifications: refreshTrackNotifications
        };
    }
);
