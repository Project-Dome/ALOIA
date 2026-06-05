/** 
 * @NApiVersion     2.1
 * @NScriptType     UserEventScript
 * @NModuleScope    SameAccount
 * @author
 */

define([
    'N/record',
    'N/log',
    'N/ui/message',

    '../pd_cso_service/pd-cso-sales-order.service',
    '../pd_cso_service/pd-cso-purchase-requisition.service',
    '../pd_cso_service/pd-cso-purchase-order.service',

    '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-search.util.js',
    '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-record.util.js',
    '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js'
], function (
    record,
    log,
    message,

    sales_order_service,
    purchase_requisition_service,
    purchase_order_service,

    search_util,
    record_util
) {

    function beforeLoad(context) {
        try {
            const _contextType = context.type;
            const _cRecord = context.newRecord;

            log.debug({ title: 'beforeLoad - Tipo de contexto', details: _contextType });

            if (_contextType === context.UserEventType.CREATE) {
                log.debug({ title: 'beforeLoad - Ação CREATE detectada', details: _cRecord.id });

                const _purchaseRequisitionData = purchase_requisition_service.readData(_cRecord);
                log.debug({ title: 'beforeLoad - Dados da Requisição', details: JSON.stringify(_purchaseRequisitionData) });

                const _idSalesOrder = _purchaseRequisitionData && _purchaseRequisitionData.salesOrder;
                log.debug({ title: 'beforeLoad - ID da Sales Order vinculada', details: _idSalesOrder });

                if (!_idSalesOrder) {
                    log.debug({ title: 'beforeLoad - Nenhuma Sales Order vinculada, encerrando função', details: null });
                    return;
                }

                const _salesOrderOptions = sales_order_service.getSalesData(_idSalesOrder);
                log.debug({ title: 'beforeLoad - Opções da Sales Order', details: JSON.stringify(_salesOrderOptions) });

                const _salesOrderData = sales_order_service.readData(_salesOrderOptions);
                log.debug({ title: 'beforeLoad - Dados da Sales Order', details: JSON.stringify(_salesOrderData) });

                return;
            }

        } catch (error) {
            log.error({ title: 'beforeLoad - Erro de processamento', details: error });
        }
    }

    function afterSubmit(context) {
        try {
            const _cRecord = context.newRecord;
            log.debug({ title: 'afterSubmit - Registro submetido', details: _cRecord.id });

            const _purchaseRequisitionData = purchase_requisition_service.readData(_cRecord);
            log.debug({ title: 'afterSubmit - Dados da Requisição', details: JSON.stringify(_purchaseRequisitionData) });

            const _idSalesOrder = _purchaseRequisitionData && _purchaseRequisitionData.salesOrder;
            log.debug({ title: 'afterSubmit - ID da Sales Order vinculada', details: _idSalesOrder });

            if (!_idSalesOrder) {
                log.debug({ title: 'afterSubmit - Nenhuma Sales Order vinculada, encerrando função', details: null });
                return;
            }

            const _salesOrderOptions = sales_order_service.getSalesData(_idSalesOrder);
            log.debug({ title: 'afterSubmit - Opções da Sales Order', details: JSON.stringify(_salesOrderOptions) });

            const _salesOrderData = sales_order_service.readData(_salesOrderOptions);
            log.debug({ title: 'afterSubmit - Dados da Sales Order', details: JSON.stringify(_salesOrderData) });

            const _syncLinkedOrders = sales_order_service.syncLinkedOrders(_purchaseRequisitionData, _salesOrderData);
            log.debug({ title: 'afterSubmit - Resultado do syncLinkedOrders', details: JSON.stringify(_syncLinkedOrders) });

            const _updateSalesOrder = sales_order_service.updateSalesOrder(_syncLinkedOrders);
            log.debug({ title: 'afterSubmit - Resultado do updateSalesOrder', details: JSON.stringify(_updateSalesOrder) });

            const _updateRequistion = purchase_requisition_service.updateVendor(_purchaseRequisitionData);
            log.debug({ title: 'afterSubmit - Resultado do updateVendor', details: JSON.stringify(_updateRequistion) });

        } catch (error) {
            log.error({ title: 'afterSubmit - Erro de processamento', details: error });
        }
    }

    return {
        beforeLoad: beforeLoad,
        afterSubmit: afterSubmit
    };
});
