/**
 * @NApiVersion     2.1
 * @NScriptType     Suitelet
 * @NModuleScope    SameAccount
 * @author          Project Dome - Rogério Gonçalves Rodrigues
 */

define(
    [
        'N/log',
        'N/record',

        '../pd_cso_service/pd-cso-sales-order.service',
        '../pd_cso_service/pd-cso-purchase-requisition.service'
    ],
    function (
        log,
        record,

        sales_order_service,
        purchase_requisition_service
    ) {

        function onRequest(context) {

            try {

                const request = context.request;
                const response = context.response;

                const salesOrderId = request.parameters.salesOrderId;

                log.debug({
                    title: 'Suitelet - Create PR - salesOrderId',
                    details: salesOrderId
                });

                // Validação — Sales Order obrigatória
                if (!salesOrderId) {
                    response.write(JSON.stringify({
                        success: false,
                        message: 'Sales Order não informada.'
                    }));
                    return;
                }

                // Carrega Sales Order
                let soRecord = record.load({
                    type: record.Type.SALES_ORDER,
                    id: salesOrderId,
                    isDynamic: false
                });

                // Lê dados da SO
                const soData = sales_order_service.readData(soRecord);

                // Verifica se já existe PR vinculada
                const prLinked = soData.purchaseRequisition?.id;

                if (prLinked) {
                    response.write(JSON.stringify({
                        success: false,
                        message: 'Purchase Requisition já existe.'
                    }));
                    return;
                }

                // Filtra itens válidos
                const filteredSO = purchase_requisition_service.filterItemsToPR(soData);

                // Valida itens
                const isValid = sales_order_service.validateItems(filteredSO.itemList);

                if (!isValid) {
                    response.write(JSON.stringify({
                        success: false,
                        message: 'Itens inválidos para criação da PR.'
                    }));
                    return;
                }

                // Cria Purchase Requisition
                const prCreatedId = purchase_requisition_service.createPurchaseRequisition(filteredSO);

                log.debug({
                    title: 'PR criada',
                    details: prCreatedId
                });

                // Atualiza Sales Order com vínculo
                sales_order_service.upadtePurchaseRequistion(
                    salesOrderId,
                    prCreatedId
                );

                // Retorno sucesso
                response.write(JSON.stringify({
                    success: true,
                    purchaseRequisitionId: prCreatedId
                }));

            } catch (error) {

                log.error({
                    title: 'Erro Suitelet - Create Purchase Requisition',
                    details: error
                });

                context.response.write(JSON.stringify({
                    success: false,
                    message: 'Erro ao criar Purchase Requisition.'
                }));
            }
        }

        return {
            onRequest: onRequest
        }

    });