/**
 * @NApiVersion     2.1
 * @NScriptType     UserEventScript
 * @NModuleScope    SameAccount
 * @author Project Dome - Rogério Gonçalves Rodrigues
 */

define([
    'N/runtime',
    'N/record',
    'N/log',

    '../pd_cso_service/pd-cso-purchase-order.service',
    '../pd_cso_service/pd-cso-purchase-requisition.service',
    '../pd_cso_service/pd-cso-sales-order.service'
], function (
    runtime,
    record,
    log,

    purchase_order_service,
    purchase_requisition_service,
    sales_order_service
) {

    function afterSubmit(context) {
        if (context.type !== context.UserEventType.CREATE &&
            context.type !== context.UserEventType.EDIT) {
            return;
        }

        const newRecord = context.newRecord;
        const purchaseOrderId = newRecord.id;

        try {
            const purchaseOrderData = purchase_order_service.purchOrderRecords(purchaseOrderId);
            log.debug({ title: 'afterSubmit - purchaseOrderData', details: purchaseOrderData });

            const prMap = {};
            const soMap = {};

            for (let i = 0; i < purchaseOrderData.length; i++) {
                const item = purchaseOrderData[i];

                const prId = item.linkedOrder;
                const soId = item.idSalesOrder;
                const lineRef = item.lineReference;
                const finalCost = item.finalCostPoUn;

                if (prId && lineRef && finalCost != null) {
                    if (!prMap[prId]) {
                        prMap[prId] = [];
                    }

                    prMap[prId].push({
                        lineRef: lineRef,
                        finalCost: finalCost
                    });
                }

                if (soId && lineRef && finalCost != null) {
                    if (!soMap[soId]) {
                        soMap[soId] = [];
                    }

                    soMap[soId].push({
                        lineRef: lineRef,
                        finalCost: finalCost
                    });
                }
            }

            log.debug({ title: 'afterSubmit - prMap', details: prMap });
            log.debug({ title: 'afterSubmit - soMap', details: soMap });

            for (const prId in prMap) {
                purchase_requisition_service.setFinalCostUnitFromPOToPR({
                    recId: prId,
                    values: prMap[prId]
                });
            }

            for (const soId in soMap) {
                sales_order_service.setFinalCostUnitFromPOToSO({
                    recId: soId,
                    values: soMap[soId]
                });
            }

            log.debug('afterSubmit - Fim do processamento');

        } catch (error) {
            log.error({
                title: 'Erro no afterSubmit - Propagação para PR/SO',
                details: error
            });
        }
    }



    return {
        afterSubmit: afterSubmit
    };
});
