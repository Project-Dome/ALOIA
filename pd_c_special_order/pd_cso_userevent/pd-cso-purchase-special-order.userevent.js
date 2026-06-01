/**
 * @NApiVersion     2.1
 * @NScriptType     UserEventScript
 * @NModuleScope    SameAccount
 * @author          Project Dome - Rogério Gonçalves Rodrigues
 */

define([
    'N/record',
    'N/log',

    '../pd_cso_service/pd-cso-purchase-order.service'

], function (
    record,
    log,
    purchase_order_service

) {

    function afterSubmit(context) {

        try {

            if (
                context.type !== context.UserEventType.CREATE &&
                context.type !== context.UserEventType.EDIT
            ) {
                return;
            }

            const poRec = context.newRecord;

            purchase_order_service.populateFromSalesOrder({
                poRecord: poRec
            });

        } catch (e) {
            log.error('beforeSubmit error', e);
        }
    }

    return {
        afterSubmit: afterSubmit
    };

});