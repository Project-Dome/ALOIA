/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author
 * Project Dome - Rogério Gonçalves Rodrigues
 */

define([
    'N/record',
    'N/log'
], function (record, log) {

    function updatePORegisterReturn(payload) {
        try {

            if (!payload || !payload.idPurchaseOrder || !Array.isArray(payload.items)) {
                log.error({
                    title: 'updatePORegisterReturn',
                    details: 'Invalid payload.'
                });
                return false;
            }

            if (payload.items.length === 0) {
                log.debug({
                    title: 'updatePORegisterReturn',
                    details: 'No items to update.'
                });
                return true;
            }

            const purchaseOrderId = payload.idPurchaseOrder;

            const poRecord = record.load({
                type: record.Type.PURCHASE_ORDER,
                id: purchaseOrderId,
                isDynamic: false
            });

            const lineCount = poRecord.getLineCount({ sublistId: 'item' });

            // --- Mapeamento por lineReference ---
            const mapByReference = {};
            for (let i = 0; i < lineCount; i++) {
                const ref = poRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_pd_cso_line_reference',
                    line: i
                });

                if (ref) mapByReference[ref] = i;
            }

            log.debug('updatePORegisterReturn - lineReferenceMap', mapByReference);

            // --- Atualizar linhas ---
            let updatedLines = 0;

            payload.items.forEach(function (item) {

                const lineRef = item.lineReference;
                const datetime = item.datetime;

                // Novos campos opcionais
                const status = item.status || '';                    // Tracking Status
                const estimated = item.estimatedDelivery || null;    // Estimated Delivery Date (pode ser null/vazio)

                if (!lineRef) {
                    log.debug('updatePORegisterReturn - Item ignored', item);
                    return;
                }

                const lineIndex = mapByReference[lineRef];
                if (lineIndex === undefined) {
                    log.debug('updatePORegisterReturn - lineReference not found', lineRef);
                    return;
                }

                // === Tracking Informations (já existente) ===
                const message = 'Tracking registered successfully\n' + (datetime || '');
                poRecord.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_pd_track_informations',
                    line: lineIndex,
                    value: message
                });

                // === Tracking Status (novo, mas opcional) ===
                if (status) {
                    poRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pd_tno_tracking_status',
                        line: lineIndex,
                        value: status
                    });
                }

                // === Estimated Delivery Date (nova, mas opcional e não trava se vier null) ===
                if (estimated) {
                    poRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pd_tno_estimated_delivery_dat',
                        line: lineIndex,
                        value: estimated
                    });
                }

                updatedLines++;

                log.debug({
                    title: 'updatePORegisterReturn - Updated line',
                    details: {
                        lineIndex: lineIndex,
                        lineRef: lineRef,
                        message: message,
                        status: status,
                        estimatedDelivery: estimated
                    }
                });
            });

            if (updatedLines > 0) {
                const savedId = poRecord.save({ ignoreMandatoryFields: true });

                log.audit({
                    title: 'updatePORegisterReturn',
                    details: 'Updated ' + updatedLines + ' lines | PO ' + savedId
                });
            } else {
                log.debug({
                    title: 'updatePORegisterReturn',
                    details: 'No lines updated.'
                });
            }

            return true;

        } catch (error) {
            log.error({
                title: 'updatePORegisterReturn - Unexpected error',
                details: error
            });
            return false;
        }
    }

    return {
        updatePORegisterReturn: updatePORegisterReturn
    };

});
