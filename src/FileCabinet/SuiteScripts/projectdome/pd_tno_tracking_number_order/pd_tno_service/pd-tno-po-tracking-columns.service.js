/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author Project Dome - Rogério Gonçalves Rodrigues
 */

define([
    'N/log',
    'N/ui/serverWidget'
], function (
    log,
    serverWidget
) {

    function handlePurchaseOrderTrackingColumnsBeforeLoad(options) {
        try {
            if (!options || !options.context) {
                return;
            }

            var context = options.context;
            var record = context.newRecord;
            var form = context.form;

            if (!record || !form) {
                return;
            }

            if (record.type !== 'purchaseorder') {
                return;
            }

            var lineCount = record.getLineCount({
                sublistId: 'item'
            }) || 0;

            log.debug('Linha 37 - handlePurchaseOrderTrackingColumnsBeforeLoad - lineCount', lineCount);

            if (lineCount <= 0) {
                return;
            }

            var hasTracking = false;

            for (var i = 0; i < lineCount; i++) {
                var value = record.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_pd_tno_track_notification_id',
                    line: i
                });

                if (value) {
                    hasTracking = true;
                    break;
                }
            }

            if (!hasTracking) {
                return;
            }
            log.debug('Linha 61 - handlePurchaseOrderTrackingColumnsBeforeLoad - hasTracking', hasTracking);
            
            var sublist = form.getSublist({
                id: 'item'
            });
            
            if (!sublist) {
                return;
            }
            
            const deliveryDate = sublist.addField({
                id: 'custpage_pd_tno_estimated_delivery_date',
                type: serverWidget.FieldType.DATE,
                label: 'Estimated Delivery Date - Teste'
            });
            log.debug('Linha 76 - handlePurchaseOrderTrackingColumnsBeforeLoad - deliveryDate', deliveryDate);
            
            const trackingStatus = sublist.addField({
                id: 'custpage_pd_tno_tracking_status',
                type: serverWidget.FieldType.TEXT,
                label: 'Tracking Status- Teste'
            });
            log.debug('Linha 83 - handlePurchaseOrderTrackingColumnsBeforeLoad - trackingStatus', trackingStatus);

            log.debug('Linha 85 - Colunas criadas - Fim da script columns service')

            return true;

        } catch (error) {
            log.error('handlePurchaseOrderTrackingColumnsBeforeLoad - erro', error);
        }
    }

    return {
        handlePurchaseOrderTrackingColumnsBeforeLoad: handlePurchaseOrderTrackingColumnsBeforeLoad
    };
});
