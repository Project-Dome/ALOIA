/**
 * @NApiVersion     2.1
 * @NScriptType     UserEventScript
 * @NModuleScope    SameAccount
 * @author          Project Dome - Rogério Gonçalves Rodrigues
 */

define(
    [
        'N/log',
        'N/ui/serverWidget',

        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-search.util.js',
        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-record.util.js',

        '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js'
    ],
    function (
        log,
        serverWidget,

        search_util,
        record_util
    ) {

        function beforeLoad(context) {

            try {

                // Executa somente em VIEW
                if (context.type !== context.UserEventType.VIEW) {
                    log.debug('Botão não será renderizado - modo diferente de VIEW.');
                    return;
                }

                const form = context.form;
                const newRecord = context.newRecord;

                const salesOrderId = newRecord.id;

                // Validação — registro precisa existir
                if (!salesOrderId) {
                    log.debug('Botão não será renderizado - registro sem ID.');
                    return;
                }

                // Validação — já existe PR vinculada?
                const purchaseRequisition = newRecord.getValue({
                    fieldId: 'custbody_pd_cso_linked_requistion'
                });

                if (purchaseRequisition) {
                    log.debug({
                        title: 'Botão não renderizado',
                        details: `PR já vinculada: ${purchaseRequisition}`
                    });
                    return;
                }

                // Vincula Client Script
                form.clientScriptModulePath = '../pd_cso_client/pd-cso-create-purchase-requisition.client.js';


                // Adiciona botão
                form.addButton({
                    id: 'custpage_pd_create_purchase_requisition',
                    label: 'Create Purchase Requisition',
                    functionName: 'createPurchaseRequisition'
                });

                log.debug({
                    title: 'Botão renderizado com sucesso',
                    details: `Sales Order ID: ${salesOrderId}`
                });

            } catch (error) {
                log.error({
                    title: 'Erro ao renderizar botão',
                    details: error
                });
            }
        }

        return {
            beforeLoad: beforeLoad
        }

    });