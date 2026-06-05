/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author Project Dome - Rogério Gonçalves Rodrigues
 */

define([
    'N/record',
    'N/log'
], function (
    record,
    log
) {

    function formatDateToMDYYYY(dateObj) {
        if (!dateObj || Object.prototype.toString.call(dateObj) !== '[object Date]') {
            return null;
        }

        var mm = String(dateObj.getMonth() + 1).padStart(2, '0');
        var dd = String(dateObj.getDate()).padStart(2, '0');
        var yyyy = dateObj.getFullYear();

        return mm + '/' + dd + '/' + yyyy;
    }

    function parseDate(value) {
        if (!value) return null;

        if (Object.prototype.toString.call(value) === '[object Date]') {
            return value;
        }

        var str = String(value).split('T')[0];
        var parts = str.split('-');

        if (parts.length === 3) {
            return new Date(
                parseInt(parts[0], 10),
                parseInt(parts[1], 10) - 1,
                parseInt(parts[2], 10)
            );
        }

        return null;
    }

    function getTrackNotificationParams(purchaseOrderId, payloadFinal) {
        try {
            if (!purchaseOrderId || !payloadFinal || !Array.isArray(payloadFinal.items)) {
                return null;
            }

            var purchaseOrder = record.load({
                type: record.Type.PURCHASE_ORDER,
                id: purchaseOrderId,
                isDynamic: false
            });

            var lineCount = purchaseOrder.getLineCount({ sublistId: 'item' });
            if (!lineCount) {
                return {
                    purchaseOrderId: purchaseOrderId,
                    createItems: [],
                    updateItems: []
                };
            }

            var payloadByLineRef = {};
            payloadFinal.items.forEach(function (item) {
                if (item && item.lineReference) {
                    payloadByLineRef[String(item.lineReference)] = item;
                }
            });

            var createItems = [];
            var updateItems = [];

            for (var line = 0; line < lineCount; line++) {

                var lineReference = purchaseOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_pd_cso_line_reference',
                    line: line
                });

                if (!lineReference) continue;

                var trackingNumber = purchaseOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_pd_tno_track_nmb_order_line',
                    line: line
                });

                var carrier = purchaseOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_pd_17track_tracking_carrier',
                    line: line
                });

                if (!trackingNumber || !carrier) continue;

                var notificationId = purchaseOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_pd_tno_track_notification_id',
                    line: line
                });

                var status = purchaseOrder.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_pd_tno_tracking_status',
                    line: line
                }) || '';

                var payloadItem = payloadByLineRef[String(lineReference)] || null;

                // ============================
                // STATUS DATE (base)
                // ============================
                var statusDate = new Date();

                // ============================
                // ESTIMATED DELIVERY DATE
                // ============================
                var estimatedDateObj = null;
                var estimatedDateText = null;

                if (payloadItem && payloadItem.estimatedDeliveryDate) {
                    estimatedDateObj = parseDate(payloadItem.estimatedDeliveryDate);
                }

                if (!estimatedDateObj) {
                    estimatedDateObj = statusDate;
                } else {
                    estimatedDateText = formatDateToMDYYYY(estimatedDateObj);
                }

                // ============================
                // NAME (independente)
                // ============================
                var name = status;
                if (estimatedDateText) {
                    name = status + ' - Estimated Date: ' + estimatedDateText;
                }

                var baseData = {
                    name: name,
                    trackingNumber: trackingNumber,
                    carrier: carrier,
                    status: status,
                    statusDate: statusDate,
                    estimatedDeliveryDate: estimatedDateObj,
                    historical: payloadItem ? payloadItem.historical : null,
                    originTransaction: purchaseOrderId
                };

                if (!notificationId) {
                    createItems.push(baseData);
                } else {
                    updateItems.push({
                        notificationId: notificationId,
                        name: baseData.name,
                        status: baseData.status,
                        statusDate: baseData.statusDate,
                        estimatedDeliveryDate: baseData.estimatedDeliveryDate,
                        historical: baseData.historical
                    });
                }
            }

            return {
                purchaseOrderId: purchaseOrderId,
                createItems: createItems,
                updateItems: updateItems
            };

        } catch (error) {
            log.error('getTrackNotificationParams - erro', error);
            return null;
        }
    }

    return {
        getTrackNotificationParams: getTrackNotificationParams
    };
});