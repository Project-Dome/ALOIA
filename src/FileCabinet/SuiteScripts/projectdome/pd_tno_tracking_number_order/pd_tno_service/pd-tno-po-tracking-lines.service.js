/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author Project Dome - Rogério Gonçalves Rodrigues
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

        function getTrackingLines(purchaseOrderId) {
            try {
                const trackingLines = [];

                const poRecord = record.load({
                    type: record.Type.PURCHASE_ORDER,
                    id: purchaseOrderId,
                    isDynamic: false
                });

                const itemCount = poRecord.getLineCount({
                    sublistId: 'item'
                });

                for (let i = 0; i < itemCount; i++) {
                    const trackingNumber = poRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pd_tno_track_nmb_order_line',
                        line: i
                    });

                    const carrier = poRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pd_17track_tracking_carrier',
                        line: i
                    });

                    const notificationId = poRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pd_tno_track_notification_id',
                        line: i
                    });

                    if (trackingNumber && carrier && notificationId) {
                        trackingLines.push({
                            line: i,
                            trackingNumber: trackingNumber,
                            carrier: carrier,
                            notificationId: notificationId
                        });
                    }
                }

                return trackingLines;

            } catch (error) {
                log.error('getTrackingLines - erro', error);
                return [];
            }
        }


        return {
            getTrackingLines: getTrackingLines
        };
    }
);
