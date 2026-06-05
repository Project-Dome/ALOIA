/**
 * @NApiVersion 2.1
 * @NScriptType UserEventScript
 * @NModuleScope SameAccount
 * @author Project Dome - Rogério Gonçalves Rodrigues
 */

define([
    'N/log',

    '../pd_pow_service/pd-pow-sales-order.service',

    '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-search.util.js',
    '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-record.util.js',

    '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js'
], function (
    log,

    sales_order_service,

    search_util,
    record_util
) {

    function afterSubmit(context) {
        try {
            const UE = context.UserEventType;
            const type = context.type;

            if (type !== UE.CREATE && type !== UE.EDIT) return;

            const newRecord = context.newRecord;
            const salesOrderId = newRecord.id;
            const buyer = newRecord.getValue({ fieldId: 'custbody_aae_buyer' });

            if (buyer) {
                log.debug({
                    title: 'Buyer encontrado',
                    details: buyer
                });
                return;
            }

            log.debug({
                title: 'Buyer vazio',
                details: 'O campo custbody_aae_buyer não possui valor.'
            });

            sales_order_service.assignBuyerToSO(salesOrderId);

        } catch (error) {
            log.error({
                title: 'Erro no afterSubmit',
                details: error
            });
        }
    }

    return {
        afterSubmit: afterSubmit
    };
    
});