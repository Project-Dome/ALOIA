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

     function updatePOTrackingInformation(payload) {
        try {

            // ====== validação geral do payload recebido ======
            if (!payload || !payload.idPurchaseOrder || !Array.isArray(payload.items)) {
                log.error({
                    title: 'updatePOTrackingInformation',
                    details: 'Payload inválido recebido para atualização.'
                });
                return false;
            }

            if (payload.items.length === 0) {
                log.debug({
                    title: 'updatePOTrackingInformation',
                    details: 'Nenhum item no payload para atualização. Nada será processado.'
                });
                return true; // nada a fazer, mas não é erro
            }

            // ====== carregar a purchase order ======
            const purchaseOrderId = payload.idPurchaseOrder;

            const purchaseOrderRecord = record.load({
                type: record.Type.PURCHASE_ORDER,
                id: purchaseOrderId,
                isDynamic: false
            });

            const purchaseOrderLineCount = purchaseOrderRecord.getLineCount({
                sublistId: 'item'
            });

            log.debug({
                title: 'updatePOTrackingInformation',
                details: 'Quantidade de linhas na PO: ' + purchaseOrderLineCount
            });

            // ====== indexa as linhas da PO usando lineReference ======
            const purchaseOrderLineMap = {};

            for (let index = 0; index < purchaseOrderLineCount; index++) {

                const currentLineReference = purchaseOrderRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_pd_cso_line_reference',
                    line: index
                });

                if (currentLineReference) {
                    purchaseOrderLineMap[currentLineReference] = index;
                }
            }

            log.debug({
                title: 'updatePOTrackingInformation',
                details: 'Mapa de lineReference montado: ' + JSON.stringify(purchaseOrderLineMap)
            });

            // ====== percorre os itens do payload e atualiza a PO ======
            let updatedLines = 0;

            payload.items.forEach(function (item, idx) {

                const itemLineReference = item && item.lineReference;
                const itemStatus = item && item.status;
                const itemCarrier = item && item.carrier;
                const itemLatestSyncTime = item && item.latestSyncTime;
                const itemEstimatedDeliveryDate = item && item.estimatedDeliveryDate;

                // --- validações por item (não interrompem o fluxo) ---
                if (!itemLineReference) {
                    log.debug({
                        title: 'updatePOTrackingInformation - item ignorado',
                        details: 'Item #' + idx + ' sem lineReference. Payload do item: ' + JSON.stringify(item)
                    });
                    return;
                }

                const mappedLineIndex = purchaseOrderLineMap[itemLineReference];

                if (mappedLineIndex === undefined) {
                    log.debug({
                        title: 'updatePOTrackingInformation - lineReference não encontrado',
                        details: 'LineReference não encontrado na Purchase Order: ' + itemLineReference
                    });
                    return;
                }

                // Podemos aceitar status, carrier e latestSyncTime mesmo que algum esteja vazio,
                // mas é bom deixar logado se vierem totalmente vazios.
                if (!itemStatus && !itemCarrier && !itemLatestSyncTime) {
                    log.debug({
                        title: 'updatePOTrackingInformation - item sem dados relevantes',
                        details: 'Item #' + idx + ' com lineReference ' + itemLineReference +
                            ' não possui status/carrier/latestSyncTime preenchidos.'
                    });
                    return;
                }

                // ====== monta a estrutura chave/valor para armazenar ======
                // Mantendo o formato já utilizado no desenvolvimento:
                // "carrier: X, status: Y, latestSyncTime: Z"

                const itemStatusSplit = (itemStatus || '').split('-');

                const trackingInformationFormatted = (itemStatusSplit[0] || '') + '\n\n' + (itemLatestSyncTime || '');

                // ====== seta o valor na coluna custcol_pd_track_informations ======
                purchaseOrderRecord.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_pd_track_informations',
                    line: mappedLineIndex,
                    value: trackingInformationFormatted
                });

                // ====== novo: coluna de Tracking Status dedicada ======
                if (itemStatus) {
                    purchaseOrderRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pd_tno_tracking_status',
                        line: mappedLineIndex,
                        value: itemStatus
                    });
                }

                // ====== novo: coluna de Estimated Delivery Date ======
                if (itemEstimatedDeliveryDate) {
                    try {
                        var jsDate = new Date(itemEstimatedDeliveryDate);
                        if (!isNaN(jsDate.getTime())) {
                            purchaseOrderRecord.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_pd_tno_estimated_delivery_dat',
                                line: mappedLineIndex,
                                value: jsDate
                            });
                        } else {
                            log.debug({
                                title: 'updatePOTrackingInformation - estimatedDeliveryDate inválida',
                                details: {
                                    lineReference: itemLineReference,
                                    estimatedDeliveryDate: itemEstimatedDeliveryDate
                                }
                            });
                        }
                    } catch (e) {
                        log.error({
                            title: 'updatePOTrackingInformation - erro ao setar estimatedDeliveryDate',
                            details: {
                                lineReference: itemLineReference,
                                estimatedDeliveryDate: itemEstimatedDeliveryDate,
                                error: e
                            }
                        });
                    }
                }

                updatedLines++;

                log.debug({
                    title: 'updatePOTrackingInformation - linha atualizada',
                    details: {
                        linhaAtualizada: mappedLineIndex,
                        lineReference: itemLineReference,
                        valorSetado: trackingInformationFormatted
                    }
                });
            });

            // ====== salvar a purchase order somente se houve atualização ======
            if (updatedLines > 0) {
                const updatedPurchaseOrderId = purchaseOrderRecord.save({
                    ignoreMandatoryFields: true
                });

                log.audit({
                    title: 'updatePOTrackingInformation',
                    details: 'Purchase Order atualizada com sucesso. ID: ' + updatedPurchaseOrderId +
                        ' | Linhas atualizadas: ' + updatedLines
                });
            } else {
                log.debug({
                    title: 'updatePOTrackingInformation',
                    details: 'Nenhuma linha foi atualizada na Purchase Order. Save não executado.'
                });
            }

            return true;

        } catch (error) {

            log.error({
                title: 'updatePOTrackingInformation - Erro inesperado na atualização da Purchase Order',
                details: error
            });
            return false;
        }
    }


    return {
        updatePOTrackingInformation: updatePOTrackingInformation
    };

});
