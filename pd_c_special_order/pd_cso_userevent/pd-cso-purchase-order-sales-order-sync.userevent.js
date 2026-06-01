/**
 * @NApiVersion     2.1
 * @NScriptType     UserEventScript
 * @NModuleScope    SameAccount
 * @author          Project Dome - Rogério Gonçalves Rodrigues
 */

define([

    'N/log',
    // 'N/record',
    '../pd_cso_service/pd-cso-purchase-order.service',
    '../pd_cso_service/pd-cso-sales-order.service'

], function (

    log,
    // record,
    purchase_order_service,
    sales_order_service
) {

    function afterSubmit(context) {
        try {

            if (
                context.type !== context.UserEventType.CREATE &&
                context.type !== context.UserEventType.EDIT
            ) {
                return;
            }

            const _newRecord = context.newRecord;
            const _purchaseOrderId = _newRecord.id;

            const _purchaseOrderData = purchase_order_service.readData(_newRecord);

            const _salesOrderId = purchase_order_service.getSalesOrderIdFromPurchaseOrderBody(_purchaseOrderData);


            log.debug({
                title: 'PO -> SO Sync | Início',
                details: {
                    eventType: context.type,
                    purchaseOrderId: _purchaseOrderId,
                    _salesOrderId: _salesOrderId
                }
            });

            if (!_purchaseOrderId) {
                return;
            }

            if (!_salesOrderId) {
                log.debug({
                    title: 'PO -> SO Sync | Sales Order não encontrada',
                    details: _purchaseOrderId
                });
                return;
            }

            if (!sales_order_service.isSalesOrder(_salesOrderId)) {
                log.debug({
                    title: 'PO -> SO Sync | Origem não é Sales Order',
                    details: _salesOrderId
                });
                return;
            }

            const _purchaseOrderSyncPayload =
                purchase_order_service.buildPurchaseOrderToSalesOrderSyncPayload({
                    purchaseOrderId: _purchaseOrderId,
                    salesOrderId: _salesOrderId
                });

            sales_order_service.applyPurchaseOrderToSalesOrderSync(
                _purchaseOrderSyncPayload
            );

            log.debug({
                title: 'PO -> SO Sync | Fim',
                details: {
                    purchaseOrderId: _purchaseOrderId,
                    salesOrderId: _salesOrderId
                }
            });

        } catch (error) {
            log.error({
                title: 'PO -> SO Sync | Erro',
                details: error
            });
        }
    }

    return {
        afterSubmit: afterSubmit
    };

});