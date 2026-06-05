/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author Project Dome - Rogério Gonçalves Rodrigues
 */
define(
    [
        'N/log',
        'N/record',
        './pd-iss-purchase-order.service'
    ],
    function (
        log,
        record,
        purchase_order_service
    ) {

        const TYPE = 'inboundShipment';

        const ITEM_SUBLIST_ID = 'items';

        const ITEM_SUBLIST_FIELDS = {
            purchaseOrder: { name: 'purchaseorder' },
            itemId: { name: 'itemid' },
            originSalesOrder: { name: 'custrecord_pd_origin_salesorder' },
            partNumberVendor: { name: 'custrecord_pd_partnumbervendor' }
        };

        function syncLinesFromPurchaseOrder(options) {
            try {

                const _inboundShipmentId = options.id;
                const _lineCount = options.getLineCount({ sublistId: ITEM_SUBLIST_ID });

                log.debug({ title: 'syncLinesFromPurchaseOrder - lineCount', details: _lineCount });

                const _updates = [];

                for (let _i = 0; _i < _lineCount; _i++) {

                    try {

                        const _poId = options.getSublistValue({
                            sublistId: ITEM_SUBLIST_ID,
                            fieldId: ITEM_SUBLIST_FIELDS.purchaseOrder.name,
                            line: _i
                        });

                        if (!_poId) {
                            log.debug({
                                title: `syncLinesFromPurchaseOrder - linha ${_i}`,
                                details: 'Sem PO vinculada, linha ignorada'
                            });
                            continue;
                        }

                        const _poRecord = record.load({
                            type: record.Type.PURCHASE_ORDER,
                            id: _poId,
                            isDynamic: false
                        });

                        const _poData = purchase_order_service.readData(_poRecord);

                        if (!_poData) continue;

                        const _lineUpdates = {};

                        const _currentOriginSO = options.getSublistValue({
                            sublistId: ITEM_SUBLIST_ID,
                            fieldId: ITEM_SUBLIST_FIELDS.originSalesOrder.name,
                            line: _i
                        });

                        if (_poData.createdFrom && String(_currentOriginSO) !== String(_poData.createdFrom)) {
                            _lineUpdates[ITEM_SUBLIST_FIELDS.originSalesOrder.name] = _poData.createdFrom;
                        }

                        const _itemId = options.getSublistValue({
                            sublistId: ITEM_SUBLIST_ID,
                            fieldId: ITEM_SUBLIST_FIELDS.itemId.name,
                            line: _i
                        });

                        if (_itemId) {
                            const _poItem = (_poData.itemList || []).find(item => String(item.item) === String(_itemId));
                            const _currentPartNumber = options.getSublistValue({
                                sublistId: ITEM_SUBLIST_ID,
                                fieldId: ITEM_SUBLIST_FIELDS.partNumberVendor.name,
                                line: _i
                            });

                            if (_poItem && _poItem.partNumberVendor && String(_currentPartNumber) !== String(_poItem.partNumberVendor)) {
                                _lineUpdates[ITEM_SUBLIST_FIELDS.partNumberVendor.name] = _poItem.partNumberVendor;
                            }
                        }

                        if (Object.keys(_lineUpdates).length > 0) {
                            _updates.push({ line: _i, fields: _lineUpdates });
                        }

                    } catch (_lineError) {
                        log.error({ title: `syncLinesFromPurchaseOrder - erro na linha ${_i}`, details: _lineError });
                    }
                }

                if (_updates.length === 0) {
                    log.debug({ title: 'syncLinesFromPurchaseOrder', details: 'Nenhuma atualização necessária' });
                    return;
                }

                log.debug({ title: 'syncLinesFromPurchaseOrder - updates', details: _updates });

                const _inboundShipmentRecord = record.load({
                    type: TYPE,
                    id: _inboundShipmentId,
                    isDynamic: false
                });

                _updates.forEach(function (_update) {
                    Object.keys(_update.fields).forEach(function (_fieldId) {
                        _inboundShipmentRecord.setSublistValue({
                            sublistId: ITEM_SUBLIST_ID,
                            fieldId: _fieldId,
                            line: _update.line,
                            value: _update.fields[_fieldId]
                        });
                    });
                });

                _inboundShipmentRecord.save({ ignoreMandatoryFields: true });

            } catch (_error) {
                log.error({ title: 'syncLinesFromPurchaseOrder - error', details: _error });
            }
        }

        function isValidAction(contextType) {
            return contextType === 'create' || contextType === 'edit';
        }

        return {
            isValidAction: isValidAction,
            syncLinesFromPurchaseOrder: syncLinesFromPurchaseOrder
        };
    }
);
