/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author Project Dome - Rogério Gonçalves Rodrigues
 */
define(
    [
        'N/log',
        'N/record',
        'N/runtime',

        './pd-cso-sales-order.service',

        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-search.util.js',
        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-record.util.js',

        '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js'
    ],
    function
        (
            log,
            record,
            runtime,

            sales_order_service,

            search_util,
            record_util
        ) {

        const TYPE = 'purchaseorder';

        const FIELDS = {
            buyer: { name: 'custbody_aae_buyer' },
            department: { name: 'department' },
            location: { name: 'location' },
            salesOrder: { name: 'custbody_pd_so_sales_order' },
            status: { name: 'status' },
            subsidiary: { name: 'subsidiary' },
            trandate: { name: 'trandate' },
            memo: { name: 'memo' },
            urgencyOrder: { name: 'custbody_aae_urgency_order', type: 'list' },
            vendor: { name: 'entity' },
            createdFrom: { name: 'createdfrom' },
            soQt: { name: 'custbody_so_qt' }

        };

        const ITEM_SUBLIST_ID = 'item';

        const ITEM_SUBLIST_FIELDS = {

            linkedOrder: { name: 'linkedorder' }, //^Purchase Requisition
            grossAmt: { name: 'grossamt' },
            item: { name: 'item' },
            partNumberCustomer: { name: 'custcol_pd_partnumbercustomer' },
            lineReference: { name: 'custcol_pd_cso_line_reference' },
            custPoReceipt: { name: 'custcol_aae_cust_po_receipt' },
            buyer: { name: 'custcol_aae_buyer_purchase_order' },
            finalCostPoUn: { name: 'custcol_pd_final_cost_po_un' },
            estimatedCostTot: { name: 'custcol_pd_estimated_cost_tot' },
            idSalesOrder: { name: 'custcol_pd_sales_order_linked' },
            rate: { name: 'rate' }
        };


        function getVendor(idPurchaseOrder) {

            const _objPurchOrd = record.load({
                type: record.Type.PURCHASE_ORDER,
                id: idPurchaseOrder,
            });

            const _vendorPO = _objPurchOrd.getValue('entity');
            log.debug(`Fornecedor PO: ${_vendorPO}`)

            return _vendorPO;
        }

        function getGrossAmout(idPurchaseOrder) {

            const _objPurchOrd = record.load({
                type: record.Type.PURCHASE_ORDER,
                id: idPurchaseOrder,
            });

            const _grossAmountPO = _objPurchOrd.getValue('grossamt');
            log.debug(`Gross Amount PO: ${_grossAmountPO}`)

            return _grossAmountPO
        }

        function getLinesGrossAmount(idPurchaseOrder) {
            const prMap = {};

            const poRec = record.load({
                type: record.Type.PURCHASE_ORDER,
                id: idPurchaseOrder,
                isDynamic: false
            });

            const lineCount = poRec.getLineCount({ sublistId: 'item' }) || 0;

            for (let i = 0; i < lineCount; i++) {
                const requisitionId = poRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'linkedorder',
                    line: i
                });

                if (!requisitionId) continue;

                const lineKey = poRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'lineuniquekey',
                    line: i
                });

                const grossAmtLine = Number(
                    poRec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'grossamt',
                        line: i
                    })
                ) || 0;

                if (!prMap[requisitionId]) prMap[requisitionId] = [];

                prMap[requisitionId].push({ lineKey, grossAmtLine });
            }

            log.debug('getLinesGrossAmount - resultado', prMap);
            return prMap;
        }

        function readData(options) {
            try {

                log.debug({ title: 'Linha 131 - readData - options', details: options })

                let _purchaseOrderData = record_util
                    .handler(options)
                    .data(
                        {
                            fields: FIELDS,
                            sublists: {
                                itemList: {
                                    name: ITEM_SUBLIST_ID,
                                    fields: ITEM_SUBLIST_FIELDS,
                                }
                            }
                        }
                    );

                return _purchaseOrderData;

            } catch (error) {
                log.error({ title: 'Linha 150 - readData - error', details: error });
            }
        }

        function propagateFinalCost(options) {
            try {
                const poRec = options && options.poRec;

                if (!poRec) {
                    log.error({
                        title: 'propagateFinalCost',
                        details: 'Parâmetro poRec não foi fornecido.'
                    });
                    return false;
                }

                const poData = readData(poRec);

                if (!poData || !poData.itemList || !poData.itemList.length) {
                    log.debug({
                        title: 'propagateFinalCost',
                        details: 'Sem itens válidos para processar.'
                    });
                    return false;
                }

                setFinalCostUnitFromPOToPR({ itemList: poData.itemList });
                setFinalCostUnitFromPOToSO({ itemList: poData.itemList });

                log.debug({
                    title: 'propagateFinalCost',
                    details: 'Propagação de custo unitário final concluída.'
                });

                return true;

            } catch (error) {
                log.debug({ title: 'Linha 186 -propagateFinalCost - error', details: error })
            }
        }


        function updateFinalCostPoUnFromRate(idPurchaseOrder) {
            try {
                const _purchOrdRec = record.load({
                    type: record.Type.PURCHASE_ORDER,
                    id: idPurchaseOrder,
                    isDynamic: false
                });

                const lineCount = _purchOrdRec.getLineCount({ sublistId: 'item' });

                for (let i = 0; i < lineCount; i++) {
                    const rate = parseFloat(_purchOrdRec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'rate',
                        line: i
                    })) || 0;

                    _purchOrdRec.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pd_final_cost_po_un',
                        line: i,
                        value: rate
                    });
                }

                _purchOrdRec.save({ ignoreMandatoryFields: true });

                return { success: true, idPurchaseOrder: idPurchaseOrder };

            } catch (e) {
                log.error({
                    title: 'Erro ao atualizar custcol_pd_final_cost_po_un com rate',
                    details: e
                });

                return { success: false, error: e, idPurchaseOrder: idPurchaseOrder };
            }
        }

        function purchaseOrderData(idPurchaseOrder) {

            log.debug({ title: 'Linha 233 - purchaseOrderData - idPurchaseOrder', details: idPurchaseOrder });

            const _purchOrderData = record.load({
                type: record.Type.PURCHASE_ORDER,
                id: idPurchaseOrder,
                isDynamic: false
            });

            return _purchOrderData;
        }

        function purchOrderRecords(idPurchaseOrder) {
            const purchOrdArr = [];

            const _purchOrdRec = record.load({
                type: record.Type.PURCHASE_ORDER,
                id: idPurchaseOrder,
                isDynamic: false
            });

            const lineCount = _purchOrdRec.getLineCount({ sublistId: 'item' });

            for (let i = 0; i < lineCount; i++) {

                const _finalCost = _purchOrdRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_pd_final_cost_po_un',
                    line: i
                });

                const _prLinked = _purchOrdRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'linkedorder',
                    line: i
                });

                const _soLinked = _purchOrdRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_pd_sales_order_linked',
                    line: i
                });

                const _lineRef = _purchOrdRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_pd_cso_line_reference',
                    line: i
                });

                purchOrdArr.push({

                    finalCostPoUn: _finalCost,
                    linkedOrder: _prLinked[0],
                    idSalesOrder: _soLinked,
                    lineReference: _lineRef
                });
            }

            return purchOrdArr;
        }

        // ^ - Função fluxo PO -> SO
        function buildPurchaseOrderToSalesOrderSyncPayload(options) {
            try {

                log.debug({
                    title: 'buildPurchaseOrderToSalesOrderSyncPayload - options',
                    details: options
                });

                const _purchaseOrderId = options.purchaseOrderId;
                const _salesOrderId = options.salesOrderId;

                if (!_purchaseOrderId) {
                    return null;
                }

                const _purchaseOrderRecord = record.load({
                    type: record.Type.PURCHASE_ORDER,
                    id: _purchaseOrderId,
                    isDynamic: false
                });

                const _purchaseOrderData = readData(_purchaseOrderRecord);

                if (!_purchaseOrderData) {
                    return null;
                }

                const _vendor = _purchaseOrderData.vendor && _purchaseOrderData.vendor.id
                    ? _purchaseOrderData.vendor.id
                    : _purchaseOrderData.vendor || '';

                const _buyer = _purchaseOrderData.buyer && _purchaseOrderData.buyer.id
                    ? _purchaseOrderData.buyer.id
                    : _purchaseOrderData.buyer || '';

                const _payload = {
                    purchaseOrderId: _purchaseOrderId,
                    salesOrderId: _salesOrderId,
                    vendor: _vendor,
                    buyer: _buyer,
                    lines: []
                };

                (_purchaseOrderData.itemList || []).forEach(function (_line) {
                    _payload.lines.push({
                        lineReference: _line.lineReference || '',
                        finalCostPo: _line.grossAmt || '',
                        finalCostPoUn: _line.rate || '',
                        buyer: _buyer
                    });
                });

                log.debug({
                    title: 'buildPurchaseOrderToSalesOrderSyncPayload - payload',
                    details: _payload
                });

                return _payload;

            } catch (error) {
                log.error({
                    title: 'buildPurchaseOrderToSalesOrderSyncPayload - error',
                    details: error
                });
            }
        }

        function populateFromSalesOrder(options) {
            try {
                const _poRecord = options && options.poRecord;

                if (!_poRecord) {
                    log.debug({
                        title: 'populateFromSalesOrder - poRecord não informado',
                        details: options
                    });
                    return false;
                }

                const _createdFrom = _poRecord.getValue({
                    fieldId: 'createdfrom'
                });

                if (!_createdFrom) {
                    log.debug({
                        title: 'populateFromSalesOrder - createdfrom vazio',
                        details: _poRecord.id || '[novo registro]'
                    });
                    return false;
                }

                // SO QT vindo da Purchase Requisition
                try {

                    const _purchaseRequisitionRecord = record.load({
                        type: record.Type.PURCHASE_REQUISITION,
                        id: _createdFrom,
                        isDynamic: false
                    });

                    const _soQt = _purchaseRequisitionRecord.getValue({
                        fieldId: FIELDS.soQt.name
                    });

                    if (_soQt !== null && _soQt !== undefined && _soQt !== '') {

                        _poRecord.setValue({
                            fieldId: FIELDS.soQt.name,
                            value: _soQt
                        });
                    }

                } catch (_e) {

                    log.debug({
                        title: 'populateFromSalesOrder - não foi possível obter SO QT da PR',
                        details: _e
                    });
                }


                const _salesOrderRecord = record.load({
                    type: record.Type.SALES_ORDER,
                    id: _createdFrom,
                    isDynamic: false
                });

                const _salesOrderData = sales_order_service.readData(_salesOrderRecord);

                if (!_salesOrderData || !_salesOrderData.itemList || !_salesOrderData.itemList.length) {
                    log.debug({
                        title: 'populateFromSalesOrder - SO sem itemList válida',
                        details: _createdFrom
                    });
                    return false;
                }

                // Indexa linhas da SO por lineReference
                let _salesOrderLineMap = {};

                (_salesOrderData.itemList || []).forEach(function (_line) {
                    const _lineReference = _line.lineReference || _line.custcol_pd_cso_line_reference;

                    if (_lineReference) {
                        _salesOrderLineMap[_lineReference] = _line;
                    }
                });

                const _lineCount = _poRecord.getLineCount({
                    sublistId: ITEM_SUBLIST_ID
                }) || 0;

                // Campo body da PO vinculado à SO
                if (FIELDS.salesOrder && FIELDS.salesOrder.name && _salesOrderData.id) {
                    try {
                        _poRecord.setValue({
                            fieldId: FIELDS.salesOrder.name,
                            value: _salesOrderData.id
                        });
                    } catch (_e) {
                        log.debug({
                            title: 'populateFromSalesOrder - não foi possível setar salesOrder no body',
                            details: _e
                        });
                    }
                }

                // Buyer body -> linha buyer da PO
                let _buyerBody = null;
                if (_salesOrderData.buyer) {
                    _buyerBody = _salesOrderData.buyer.id || _salesOrderData.buyer;
                }



                for (let i = 0; i < _lineCount; i++) {
                    try {
                        const _lineReference = _poRecord.getSublistValue({
                            sublistId: ITEM_SUBLIST_ID,
                            fieldId: ITEM_SUBLIST_FIELDS.lineReference.name,
                            line: i
                        });

                        if (!_lineReference) {
                            continue;
                        }

                        const _salesOrderLine = _salesOrderLineMap[_lineReference];

                        if (!_salesOrderLine) {
                            continue;
                        }

                        let _itemData = {};

                        // 1) item
                        if (ITEM_SUBLIST_FIELDS.item && _salesOrderLine.item) {
                            _itemData[ITEM_SUBLIST_FIELDS.item.name] =
                                _salesOrderLine.item.id || _salesOrderLine.item;
                        }

                        // 2) partNumberCustomer
                        if (ITEM_SUBLIST_FIELDS.partNumberCustomer && _salesOrderLine.partNumberCustomer) {
                            _itemData[ITEM_SUBLIST_FIELDS.partNumberCustomer.name] =
                                _salesOrderLine.partNumberCustomer;
                        }

                        // 3) lineReference
                        if (ITEM_SUBLIST_FIELDS.lineReference && _lineReference) {
                            _itemData[ITEM_SUBLIST_FIELDS.lineReference.name] = _lineReference;
                        }

                        // 4) custPoReceipt
                        if (ITEM_SUBLIST_FIELDS.custPoReceipt && _salesOrderData.custPoReceipt) {
                            _itemData[ITEM_SUBLIST_FIELDS.custPoReceipt.name] =
                                _salesOrderData.custPoReceipt;
                        }

                        // 5) buyer
                        if (ITEM_SUBLIST_FIELDS.buyer && _buyerBody) {
                            _itemData[ITEM_SUBLIST_FIELDS.buyer.name] = _buyerBody;
                        }

                        // 6) estimatedCostTot
                        if (ITEM_SUBLIST_FIELDS.estimatedCostTot && _salesOrderLine.estimatedCostTot) {
                            _itemData[ITEM_SUBLIST_FIELDS.estimatedCostTot.name] =
                                _salesOrderLine.estimatedCostTot;
                        }

                        // 7) idSalesOrder
                        if (ITEM_SUBLIST_FIELDS.idSalesOrder && _salesOrderData.id) {
                            _itemData[ITEM_SUBLIST_FIELDS.idSalesOrder.name] = _salesOrderData.id;
                        }

                        // 8) rate
                        if (ITEM_SUBLIST_FIELDS.rate) {
                            const _rateValue =
                                _salesOrderLine.rate ||
                                _salesOrderLine.estimatedRate ||
                                _salesOrderLine.lastPurchasePrice;

                            if (_rateValue !== null && _rateValue !== undefined && _rateValue !== '') {
                                _itemData[ITEM_SUBLIST_FIELDS.rate.name] = _rateValue;
                            }
                        }

                        // 9) linkedOrder
                        // Não preencher a partir da SO neste momento.
                        // Campo mantido fora da configuração porque pertence ao vínculo com PR.

                        // 10) grossAmt
                        // Não preencher na criação a partir da SO.
                        // Esse valor tende a ser final/resultado da própria PO.

                        // 11) finalCostPoUn
                        // Não preencher na criação a partir da SO.
                        // Esse valor será tratado depois no fluxo da própria PO.

                        Object.keys(_itemData).forEach(function (_fieldId) {
                            const _value = _itemData[_fieldId];

                            if (_value === null || _value === undefined || _value === '') {
                                return;
                            }

                            try {
                                _poRecord.setSublistValue({
                                    sublistId: ITEM_SUBLIST_ID,
                                    fieldId: _fieldId,
                                    line: i,
                                    value: _value
                                });
                            } catch (_setError) {
                                log.debug({
                                    title: 'populateFromSalesOrder - campo ignorado no setSublistValue',
                                    details: {
                                        line: i,
                                        fieldId: _fieldId,
                                        value: _value,
                                        error: _setError
                                    }
                                });
                            }
                        });

                    } catch (_lineError) {
                        log.debug({
                            title: 'populateFromSalesOrder - erro tratado por linha',
                            details: {
                                line: i,
                                error: _lineError
                            }
                        });
                    }
                }

                return true;

            } catch (error) {
                log.error({
                    title: 'populateFromSalesOrder - erro',
                    details: error
                });
                return false;
            }
        }

        function getSalesOrderIdFromPurchaseOrderBody(poData) {
            try {
                if (!poData) {
                    return null;
                }

                if (poData.salesOrder) {
                    return poData.salesOrder;
                }

                if (poData.createdFrom) {
                    return poData.createdFrom;
                }

                return null;

            } catch (error) {
                log.error({
                    title: 'getSalesOrderIdFromPurchaseOrderBody - error',
                    details: error
                });

                return null;
            }
        }

        return {
            getVendor: getVendor,
            getGrossAmout: getGrossAmout,
            getLinesGrossAmount: getLinesGrossAmount,
            readData: readData,
            propagateFinalCost: propagateFinalCost,
            updateFinalCostPoUnFromRate: updateFinalCostPoUnFromRate,
            purchaseOrderData: purchaseOrderData,
            purchOrderRecords: purchOrderRecords,
            buildPurchaseOrderToSalesOrderSyncPayload: buildPurchaseOrderToSalesOrderSyncPayload,
            populateFromSalesOrder: populateFromSalesOrder,
            getSalesOrderIdFromPurchaseOrderBody: getSalesOrderIdFromPurchaseOrderBody
        }
    });