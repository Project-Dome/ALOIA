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

        '../pd_cso_service/pd-cso-purchase-order.service',

        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-search.util.js',
        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-record.util.js',

        '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js'
    ],
    function (
        log,
        record,
        runtime,

        purchase_order_service,

        search_util,
        record_util
    ) {
        const TYPE = 'purchaserequisition';
        const SALES_ORDER_TYPE = 'salesorder';

        const FIELDS = {
            requestor: { name: 'entity' },
            receiveBy: { name: 'duedate' }, // PR recebe do SO.custbody_aae_cust_po_receipt
            date: { name: 'trandate' },
            memo: { name: 'memo' },
            subsidiary: { name: 'subsidiary' },
            department: { name: 'department' },
            location: { name: 'location' },
            createdFrom: { name: 'createdfrom' },
            salesOrder: { name: 'custbody_pd_so_sales_order' },
            approvalStatus: { name: 'approvalstatus' },
            buyer: { name: 'custbody_aae_buyer' },
            urgencyOrder: { name: 'custbody_aae_urgency_order' }, // só setar se houver valor
            calculateTax: { name: 'custbody_ste_use_tax' },
            soQt: { name: 'custbody_so_qt' }
        };

        const ITEM_SUBLIST_ID = 'item';

        const ITEM_SUBLIST_FIELDS = {
            customer: { name: 'customer' },
            estimatedAmount: { name: 'estimatedamount' },
            estimatedRate: { name: 'estimatedrate' },
            item: { name: 'item' },
            line: { name: 'line' },
            linkedOrder: { name: 'linkedorder' },
            poVendor: { name: 'custcol_aae_vendor_purchase_order' },
            quantity: { name: 'quantity' },
            rate: { name: 'rate' },
            lineUniqueKey: { name: 'lineuniquekey' },
            units: { name: 'units' },
            poVendorFinal: { name: 'custcol_pd_pow_purchord_vendor', type: 'list' },
            memoLine: { name: 'custcol_pd_memoline' },
            partNumberCustomer: { name: 'custcol_pd_partnumbercustomer' },
            estimatedCostPo: { name: 'custcol_aae_estimated_cost_po' },
            slaPurchaseOrder: { name: 'custcol_aae_sla_purchase_order' }, // (linha → linha)
            promiseDate: { name: 'custcol_atlas_promise_date' },      // (linha → linha)
            finalCostPo: { name: 'custcol_aae_final_cost_po' },
            statusItem: { name: 'custcol_pd_aae_status_item' },
            lineReference: { name: 'custcol_pd_cso_line_reference' },
            custPoReceipt: { name: 'custcol_aae_cust_po_receipt' },
            finalCostPoUn: { name: 'custcol_pd_final_cost_po_un' },
            estimatedCostTot: { name: 'custcol_pd_estimated_cost_tot' }

        };

        const SO_BODY_FIELDS = {
            custPoReceipt: 'custbody_aae_cust_po_receipt' // (corpo SO → duedate PR)
        };

        const APPROVAL_STATUS = 1;  // 1 = Pending Approval // 2 = Approved

        // ---------- helpers ----------
        function num(val, fallback) {
            if (val === '' || val === null || val === undefined) return Number(fallback || 0);
            var n = Number(val);
            return isNaN(n) ? Number(fallback || 0) : n;
        }

        function getLineFieldFromSalesOrderLine(salesOrderId, lineUniqueKey, fieldId) {
            try {
                if (!salesOrderId || !lineUniqueKey || !fieldId) return null;

                var so = record.load({
                    type: SALES_ORDER_TYPE,
                    id: salesOrderId,
                    isDynamic: false
                });

                var line = so.findSublistLineWithValue({
                    sublistId: 'item',
                    fieldId: 'lineuniquekey',
                    value: String(lineUniqueKey)
                });

                if (line === -1) return null;

                return so.getSublistValue({
                    sublistId: 'item',
                    fieldId: fieldId,
                    line: line
                });

            } catch (e) {
                log.error({ title: 'getLineFieldFromSalesOrderLine - erro', details: { salesOrderId, lineUniqueKey, fieldId, e } });
                return null;
            }
        }

        function getSlaFromSalesOrderLine(salesOrderId, lineUniqueKey) {
            return getLineFieldFromSalesOrderLine(salesOrderId, lineUniqueKey, ITEM_SUBLIST_FIELDS.slaPurchaseOrder.name);
        }
        function getPromiseFromSalesOrderLine(salesOrderId, lineUniqueKey) {
            return getLineFieldFromSalesOrderLine(salesOrderId, lineUniqueKey, ITEM_SUBLIST_FIELDS.promiseDate.name);
        }

        function getSoBodyField(salesOrderId, fieldId) {
            try {
                if (!salesOrderId || !fieldId) return null;
                var so = record.load({
                    type: SALES_ORDER_TYPE,
                    id: salesOrderId,
                    isDynamic: false
                });
                return so.getValue({ fieldId: fieldId });
            } catch (e) {
                log.error({ title: 'getSoBodyField - erro', details: { salesOrderId, fieldId, e } });
                return null;
            }
        }

        // ---------- API ----------
        function getByStatus(idPurchaseRequisition) {
            try {
                const _objRequisition = record.load({
                    type: TYPE,
                    id: idPurchaseRequisition,
                    isDynamic: true,
                });
                return _objRequisition.getValue('status');
            } catch (error) {
                log.error({ title: 'getByStatus - erro', details: error });
            }
        }

        function getRequisitionData(idPurchaseRequisition) {
            try {
                return record.load({
                    type: TYPE,
                    id: idPurchaseRequisition,
                    isDynamic: true,
                });
            } catch (error) {
                log.error({ title: 'getRequisitionData - erro', details: error });
            }
        }

        function readData(options) {
            try {
                return record_util
                    .handler(options)
                    .data({
                        fields: FIELDS,
                        sublists: {
                            itemList: {
                                name: ITEM_SUBLIST_ID,
                                fields: ITEM_SUBLIST_FIELDS,
                            }
                        }
                    });
            } catch (error) {
                log.error({ title: 'readData - erro', details: error });
            }
        }

        function createPurchaseRequisition(options) {
            try {
                // ====== monta dados para o set em lote ======
                let _purchaseRequisitionData = {};
                let _itemListForCreate = [];
                let _rateFixList = []; // para o pós-ajuste (mesma ordem das linhas criadas)

                log.debug({ title: 'createPurchaseRequisition - options', details: options })

                // ----- body -----
                _purchaseRequisitionData[FIELDS.requestor.name] = options.salesRep;
                _purchaseRequisitionData[FIELDS.date.name] = options.trandate;
                _purchaseRequisitionData[FIELDS.memo.name] = options.memo;
                _purchaseRequisitionData[FIELDS.subsidiary.name] = options.subsidiary;
                _purchaseRequisitionData[FIELDS.department.name] = options.department;
                _purchaseRequisitionData[FIELDS.location.name] = options.location;
                _purchaseRequisitionData[FIELDS.salesOrder.name] = options.id;
                _purchaseRequisitionData[FIELDS.approvalStatus.name] = APPROVAL_STATUS;
                _purchaseRequisitionData[FIELDS.buyer.name] = options.buyer;

                // urgência: só setar se houver valor (evita INVALID_FLD_VALUE null)
                if (options.urgencyOrder !== null && options.urgencyOrder !== undefined && options.urgencyOrder !== '') {
                    _purchaseRequisitionData[FIELDS.urgencyOrder.name] = options.urgencyOrder;
                }

                if (options.soQt !== null && options.soQt !== undefined && options.soQt !== '') {
                    _purchaseRequisitionData[FIELDS.soQt.name] = options.soQt;
                }

                // due date da PR <= SO.custbody_aae_cust_po_receipt
                var custPoReceipt = getSoBodyField(options.id, SO_BODY_FIELDS.custPoReceipt);
                if (custPoReceipt != null && custPoReceipt !== '') {
                    _purchaseRequisitionData[FIELDS.receiveBy.name] = custPoReceipt;
                }

                // ----- linhas -----
                log.debug({ title: 'Linha 217 - createPurchaseRequisition - options.itemList', details: options.itemList });
                (options.itemList || []).forEach((item) => {
                    log.debug({ title: 'Linha 219 - createPurchaseRequisition - dontCreateRequisition', details: item.dontCreateRequisition });
                    if (item.dontCreateRequisition === true) return;

                    const estCost = num(item.estimatedCostPo, 0);
                    const rateVal = num(item.lastPurchasePrice, estCost);
                    const estRate = num(item.estimatedCostPo, 0);
                    const qtyForAmt = num(item.quantity, 0);

                    let _itemData = {};
                    _itemData[ITEM_SUBLIST_FIELDS.item.name] = item.item.id;
                    _itemData[ITEM_SUBLIST_FIELDS.estimatedCostPo.name] = estCost;
                    _itemData[ITEM_SUBLIST_FIELDS.estimatedRate.name] = estRate;
                    _itemData[ITEM_SUBLIST_FIELDS.rate.name] = rateVal;
                    _itemData[ITEM_SUBLIST_FIELDS.units.name] = item.units;
                    _itemData[ITEM_SUBLIST_FIELDS.memoLine.name] = item.memoLine;
                    _itemData[ITEM_SUBLIST_FIELDS.partNumberCustomer.name] = item.partNumberCustomer;
                    _itemData[ITEM_SUBLIST_FIELDS.quantity.name] = item.quantity;
                    _itemData[ITEM_SUBLIST_FIELDS.customer.name] = options.customerId;
                    _itemData[ITEM_SUBLIST_FIELDS.poVendor.name] = item.poVendor.id;
                    _itemData[ITEM_SUBLIST_FIELDS.estimatedAmount.name] = qtyForAmt * estRate;
                    _itemData[ITEM_SUBLIST_FIELDS.estimatedCostTot.name] = qtyForAmt * estRate;
                    _itemData[ITEM_SUBLIST_FIELDS.lineReference.name] = item.lineReference || item[ITEM_SUBLIST_FIELDS.lineReference.name];
                    _itemData[ITEM_SUBLIST_FIELDS.custPoReceipt.name] = options.custPoReceipt;



                    // SLA / Promise
                    var luk = item.lineUniqueKey || item.lineuniquekey || item[ITEM_SUBLIST_FIELDS.lineUniqueKey.name];
                    var sla = item.slaPurchaseOrder;
                    if (sla == null || sla === '') sla = getSlaFromSalesOrderLine(options.id, luk);
                    if (sla != null && sla !== '') _itemData[ITEM_SUBLIST_FIELDS.slaPurchaseOrder.name] = sla;

                    var promise = item.promiseDate || item[ITEM_SUBLIST_FIELDS.promiseDate.name];
                    if (promise == null || promise === '') promise = getPromiseFromSalesOrderLine(options.id, luk);
                    if (promise != null && promise !== '') _itemData[ITEM_SUBLIST_FIELDS.promiseDate.name] = promise;

                    // + NOVO: status do item vindo da SO (mesma linha)
                    var statusFromSoLine = getLineFieldFromSalesOrderLine(options.id, luk, ITEM_SUBLIST_FIELDS.statusItem.name);
                    if (statusFromSoLine !== null && statusFromSoLine !== '') {
                        var statusVal = isFinite(+statusFromSoLine) ? +statusFromSoLine : statusFromSoLine;
                        _itemData[ITEM_SUBLIST_FIELDS.statusItem.name] = statusVal;
                    }

                    _itemListForCreate.push(_itemData);
                    _rateFixList.push({ estimatedRate: estRate, rate: rateVal });
                });


                _purchaseRequisitionData.sublists = {};
                _purchaseRequisitionData.sublists[ITEM_SUBLIST_ID] = _itemListForCreate;

                // ====== cria via record_util (como antes) ======
                let _specialRequisitionRecord = record.create({ type: TYPE, isDynamic: true });

                const prId = record_util
                    .handler(_specialRequisitionRecord)
                    .set(_purchaseRequisitionData)
                    .save({ ignoreMandatoryFields: false });

                log.audit({ title: 'PR criada (fase 1)', details: prId });

                // ====== pós-ajuste: reforça estimatedrate/rate por último ======
                try {
                    let prDyn = record.load({ type: TYPE, id: prId, isDynamic: true });
                    const lineCount = prDyn.getLineCount({ sublistId: 'item' }) || 0;

                    for (let i = 0; i < lineCount; i++) {
                        const fix = _rateFixList[i];
                        if (!fix) continue; // segurança

                        prDyn.selectLine({ sublistId: 'item', line: i });

                        prDyn.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: ITEM_SUBLIST_FIELDS.estimatedRate.name,
                            value: fix.estimatedRate,
                            ignoreFieldChange: true
                        });

                        prDyn.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: ITEM_SUBLIST_FIELDS.rate.name,
                            value: fix.rate,
                            ignoreFieldChange: true
                        });

                        // + NOVO: recalcular estimatedamount = quantity * estimatedrate (já setado acima)
                        const qtySet = num(prDyn.getCurrentSublistValue({ sublistId: 'item', fieldId: ITEM_SUBLIST_FIELDS.quantity.name }), 0);
                        const estRateSet = num(prDyn.getCurrentSublistValue({ sublistId: 'item', fieldId: ITEM_SUBLIST_FIELDS.estimatedRate.name }), 0);

                        prDyn.setCurrentSublistValue({
                            sublistId: 'item',
                            fieldId: ITEM_SUBLIST_FIELDS.estimatedAmount.name,
                            value: qtySet * estRateSet,
                            ignoreFieldChange: true
                        });

                        // snapshot opcional
                        log.debug({
                            title: `rate patch - linha ${i}`,
                            details: {
                                estimatedRate_set: prDyn.getCurrentSublistValue({ sublistId: 'item', fieldId: ITEM_SUBLIST_FIELDS.estimatedRate.name }),
                                rate_set: prDyn.getCurrentSublistValue({ sublistId: 'item', fieldId: ITEM_SUBLIST_FIELDS.rate.name }),
                                qty_set: qtySet,
                                estimatedAmount: prDyn.getCurrentSublistValue({ sublistId: 'item', fieldId: ITEM_SUBLIST_FIELDS.estimatedAmount.name })
                            }
                        });

                        prDyn.commitLine({ sublistId: 'item' });
                    }

                    const prId2 = prDyn.save({ enableSourcing: true, ignoreMandatoryFields: true });
                    log.audit({ title: 'PR salva (fase 2, rate fix)', details: prId2 });
                } catch (patchErr) {
                    log.error({ title: 'rate patch - erro ao reforçar estimatedrate/rate', details: patchErr });
                }

                return prId;

            } catch (error) {
                log.error({ title: 'createPurchaseRequisition - erro', details: error });
            }
        }

        function getLineItem(salesOrderData, requisitionData) {
            try {
                // refs atuais da SO
                let _soRefs = {};
                (salesOrderData.itemList || []).forEach(function (l) {
                    let _r = l && (l.lineReference || l.custcol_pd_cso_line_reference);
                    if (_r) { _soRefs[_r] = true; }
                });

                // refs da PR que não existem mais na SO
                let _refsToRemove = [];
                (requisitionData.itemList || []).forEach(function (l) {
                    let _r = l && (l.lineReference || l.custcol_pd_cso_line_reference);
                    if (_r && !_soRefs[_r]) {
                        _refsToRemove.push(_r);
                    }
                });

                return _refsToRemove;
            } catch (error) {
                log.error({ title: 'getLineItem - erro', details: error });
                return [];
            }
        }


        function removeLine(idPurchaseRequisition, refsToRemove) {
            try {
                // Guarda de segurança
                if (!idPurchaseRequisition || !refsToRemove || refsToRemove.length === 0) {
                    log.debug({
                        title: 'removeLine - nada a remover',
                        details: { idPurchaseRequisition: idPurchaseRequisition, refsToRemove: refsToRemove }
                    });
                    return { updated: false, id: idPurchaseRequisition };
                }

                // Carrega a PR em modo padrão (não dinâmico)
                let _recordPR = record.load({
                    type: TYPE,                 // sua constante do tipo (purchase requisition)
                    id: idPurchaseRequisition,
                    isDynamic: false
                });

                log.debug({
                    title: 'removeLine - início',
                    details: 'Refs a remover: ' + JSON.stringify(refsToRemove)
                });

                let _removedAny = false;

                // Para cada referência, procura a linha e remove; repete enquanto existir
                (refsToRemove || []).forEach(function (_ref) {
                    if (!_ref) return;

                    let _idx = _recordPR.findSublistLineWithValue({
                        sublistId: ITEM_SUBLIST_ID, // normalmente 'item'
                        fieldId: ITEM_SUBLIST_FIELDS.lineReference.name,
                        value: _ref
                    });

                    while (_idx !== -1) {
                        _recordPR.removeLine({
                            sublistId: ITEM_SUBLIST_ID,
                            line: _idx,
                            ignoreRecalc: true
                        });
                        _removedAny = true;

                        // Rebusca, pois os índices mudaram após a remoção
                        _idx = _recordPR.findSublistLineWithValue({
                            sublistId: ITEM_SUBLIST_ID,
                            fieldId: ITEM_SUBLIST_FIELDS.lineReference.name,
                            value: _ref
                        });
                    }
                });

                if (_removedAny) {
                    let _savedId = _recordPR.save({
                        enableSourcing: true,
                        ignoreMandatoryFields: true
                    });
                    log.debug({ title: 'removeLine - PR salva', details: _savedId });
                    return { updated: true, id: _savedId };
                }

                log.debug({
                    title: 'removeLine - nenhuma linha localizada',
                    details: refsToRemove
                });
                return { updated: false, id: idPurchaseRequisition };

            } catch (error) {
                log.error({ title: 'removeLine - erro', details: error });
                throw error;
            }
        }

        function itemsToInsert(salesOrderData, requistionData) {
            try {

                const _itemSales = salesOrderData.itemList || [];
                const _itemRequistion = requistionData.itemList || [];

                // Set de refs presentes na PR
                let _prRefSet = new Set(
                    _itemRequistion
                        .map(r => r[ITEM_SUBLIST_FIELDS.lineReference.name])
                        .filter(Boolean)
                );

                const _hasRefs = _prRefSet.size > 0;

                // Se há refs, compara por ref; senão, usa a lógica antiga (legado)
                let _itemsToInsert = _itemSales.filter(salesItem => {
                    if (_hasRefs && salesItem[ITEM_SUBLIST_FIELDS.lineReference.name]) {
                        return !_prRefSet.has(salesItem[ITEM_SUBLIST_FIELDS.lineReference.name]);
                    }

                    // Fallback legado
                    return !_itemRequistion.some(reqItem =>
                        reqItem.item === salesItem.item.id &&
                        reqItem.quantity === salesItem.quantity &&
                        reqItem.poVendor === salesItem.poVendor.id
                    );
                });

                return _itemsToInsert;

            } catch (error) {
                log.error({ title: 'itemsToInsert - erro', details: error });
            }
        }

        function insertionLine(purchaseRequisitionId, itemList, customerId) {
            try {
                const _purchaseRequisitionRecord = record.load({
                    type: TYPE,
                    id: purchaseRequisitionId,
                    isDynamic: true
                });

                log.debug({ title: 'linha 484 - insertionLine - purchaseRequisitionId', details: purchaseRequisitionId });

                const _existingLineRefs = new Set();
                const _lineCount = _purchaseRequisitionRecord.getLineCount({ sublistId: ITEM_SUBLIST_ID });

                log.debug({ title: 'linha 489 - insertionLine - _lineCount', details: _lineCount });

                for (let _i = 0; _i < _lineCount; _i++) {
                    const _lineRef = _purchaseRequisitionRecord.getSublistValue({
                        sublistId: ITEM_SUBLIST_ID,
                        fieldId: ITEM_SUBLIST_FIELDS.lineReference.name,
                        line: _i
                    });
                    if (_lineRef) {
                        _existingLineRefs.add(_lineRef);
                    }
                }

                const _newItems = itemList.filter(_line =>
                    !_line.dontCreateRequisition &&
                    !!_line.lineReference &&
                    !_existingLineRefs.has(_line.lineReference)
                );

                log.audit({
                    title: 'insertionLine - Novos itens a inserir',
                    details: `Total: ${_newItems.length}`
                });

                _newItems.forEach(_line => {
                    _purchaseRequisitionRecord.selectNewLine({ sublistId: ITEM_SUBLIST_ID });

                    _purchaseRequisitionRecord.setCurrentSublistValue({
                        sublistId: ITEM_SUBLIST_ID,
                        fieldId: ITEM_SUBLIST_FIELDS.item.name,
                        value: _line.item
                    });

                    _purchaseRequisitionRecord.setCurrentSublistValue({
                        sublistId: ITEM_SUBLIST_ID,
                        fieldId: ITEM_SUBLIST_FIELDS.quantity.name,
                        value: _line.quantity
                    });

                    if (_line.estimatedRate) {
                        _purchaseRequisitionRecord.setCurrentSublistValue({
                            sublistId: ITEM_SUBLIST_ID,
                            fieldId: ITEM_SUBLIST_FIELDS.estimatedRate.name,
                            value: _line.estimatedRate
                        });
                    }

                    _purchaseRequisitionRecord.setCurrentSublistValue({
                        sublistId: ITEM_SUBLIST_ID,
                        fieldId: ITEM_SUBLIST_FIELDS.customer.name,
                        value: customerId
                    });

                    _purchaseRequisitionRecord.setCurrentSublistValue({
                        sublistId: ITEM_SUBLIST_ID,
                        fieldId: ITEM_SUBLIST_FIELDS.lineReference.name,
                        value: _line.lineReference
                    });

                    if (_line.memoLine) {
                        _purchaseRequisitionRecord.setCurrentSublistValue({
                            sublistId: ITEM_SUBLIST_ID,
                            fieldId: ITEM_SUBLIST_FIELDS.memoLine.name,
                            value: _line.memoLine
                        });
                    }

                    if (_line.partNumberCustomer) {
                        _purchaseRequisitionRecord.setCurrentSublistValue({
                            sublistId: ITEM_SUBLIST_ID,
                            fieldId: ITEM_SUBLIST_FIELDS.partNumberCustomer.name,
                            value: _line.partNumberCustomer
                        });
                    }

                    const _sla = getSlaFromSalesOrderLine(_line.salesOrder, _line.lineUniqueKey);
                    if (_sla) {
                        _purchaseRequisitionRecord.setCurrentSublistValue({
                            sublistId: ITEM_SUBLIST_ID,
                            fieldId: ITEM_SUBLIST_FIELDS.slaPurchaseOrder.name,
                            value: _sla
                        });
                    }

                    const _promiseDate = getPromiseFromSalesOrderLine(_line.salesOrder, _line.lineUniqueKey);
                    if (_promiseDate) {
                        _purchaseRequisitionRecord.setCurrentSublistValue({
                            sublistId: ITEM_SUBLIST_ID,
                            fieldId: ITEM_SUBLIST_FIELDS.promiseDate.name,
                            value: _promiseDate
                        });
                    }

                    _purchaseRequisitionRecord.commitLine({ sublistId: ITEM_SUBLIST_ID });
                });

                _purchaseRequisitionRecord.save();

                log.audit({
                    title: 'insertionLine - Finalizado com sucesso',
                    details: `Itens inseridos: ${_newItems.length}`
                });

            } catch (_error) {
                log.error({
                    title: 'Erro em insertionLine',
                    details: _error
                });
                throw _error;
            }
        }


        function hasDifferences(actualItemSales, oldItemSales) {
            try {

                const _actual = actualItemSales || [];
                const _old = oldItemSales || [];

                // Indexa o "old" por lineReference quando existir
                let _oldByRef = {};
                let _oldHasRef = false;

                _old.forEach(o => {
                    const _ref = o[ITEM_SUBLIST_FIELDS.lineReference.name];
                    if (_ref) {
                        _oldHasRef = true;
                        _oldByRef[_ref] = o;
                    }
                });

                // Se não há ref no conjunto "old" (legado), cai na lógica antiga por índice
                if (!_oldHasRef) {
                    return _actual.some((a, index) => {
                        let _o = _old[index];
                        if (!_o) return true;
                        return (
                            a.item.id !== _o.item.id ||
                            a.quantity !== _o.quantity ||
                            a.poVendor.id !== _o.poVendor.id ||
                            a.units !== _o.units
                        );
                    });
                }

                // Com referência: compara por ref (independe de ordem)
                return _actual.some(a => {
                    const _ref = a[ITEM_SUBLIST_FIELDS.lineReference.name];
                    if (!_ref || !_oldByRef[_ref]) return true; // nova linha ou sem ref antiga
                    const _o = _oldByRef[_ref];
                    return (
                        a.item.id !== _o.item.id ||
                        a.quantity !== _o.quantity ||
                        a.poVendor.id !== _o.poVendor.id ||
                        a.units !== _o.units
                    );
                });

            } catch (error) {
                log.error({ title: 'hasDifferences - erro', details: error });
            }
        }

        function changedItemsList(actualItemSales, oldItemSales) {
            try {

                const _actual = actualItemSales || [];
                const _old = oldItemSales || [];

                // Indexa old por referência quando existir
                let _oldByRef = {};
                let _oldHasRef = false;

                _old.forEach(o => {
                    const _ref = o[ITEM_SUBLIST_FIELDS.lineReference.name];
                    if (_ref) {
                        _oldHasRef = true;
                        _oldByRef[_ref] = o;
                    }
                });

                if (!_oldHasRef) {
                    // Fallback legado por índice
                    return _actual
                        .map((a, index) => {
                            let _o = _old[index];
                            if (!_o) return { index, ...a };
                            let _diff =
                                a.item.id !== _o.item.id ||
                                a.quantity !== _o.quantity ||
                                a.poVendor.id !== _o.poVendor.id ||
                                a.units !== _o.units;
                            return _diff ? { index, ...a } : null;
                        })
                        .filter(Boolean);
                }

                // Com referência: monta a lista por ref (index aqui é apenas compatibilidade)
                return _actual
                    .map((a, index) => {
                        const _ref = a[ITEM_SUBLIST_FIELDS.lineReference.name];
                        const _o = _ref ? _oldByRef[_ref] : null;
                        if (!_o) return { index, ...a }; // nova linha (considera alterada)
                        let _diff =
                            a.item.id !== _o.item.id ||
                            a.quantity !== _o.quantity ||
                            a.poVendor.id !== _o.poVendor.id ||
                            a.units !== _o.units;
                        return _diff ? { index, ...a } : null;
                    })
                    .filter(Boolean);

            } catch (error) {
                log.error({ title: 'changedItemsList - erro', details: error });
            }
        }

        function updatedRequistion(idPurchaseRequisition, itemsToUpdate) {
            try {

                let _requistionObj = record.load({
                    type: TYPE,
                    id: idPurchaseRequisition,
                    isDynamic: false,
                });

                (itemsToUpdate || []).forEach(item => {
                    // Prioriza localizar pela referência estável
                    let _ref = item[ITEM_SUBLIST_FIELDS.lineReference.name];
                    let _lineIndex = -1;

                    if (_ref) {
                        _lineIndex = _requistionObj.findSublistLineWithValue({
                            sublistId: 'item',
                            fieldId: ITEM_SUBLIST_FIELDS.lineReference.name,
                            value: _ref
                        });
                    }

                    // Fallback (legado): usar o "index" recebido (padrão antigo)
                    if (_lineIndex === -1 && typeof item.index === 'number') {
                        _lineIndex = item.index;
                    }

                    if (_lineIndex === -1) {
                        log.debug({ title: 'updatedRequistion - linha não encontrada', details: { ref: _ref, item } });
                        return; // não encontrou; evita quebrar
                    }

                    // Atualiza campos principais
                    _requistionObj.setSublistValue({
                        sublistId: 'item',
                        fieldId: ITEM_SUBLIST_FIELDS.item.name,
                        line: _lineIndex,
                        value: item.item.id
                    });

                    _requistionObj.setSublistValue({
                        sublistId: 'item',
                        fieldId: ITEM_SUBLIST_FIELDS.quantity.name,
                        line: _lineIndex,
                        value: item.quantity
                    });

                    _requistionObj.setSublistValue({
                        sublistId: 'item',
                        fieldId: ITEM_SUBLIST_FIELDS.poVendor.name,
                        line: _lineIndex,
                        value: item.poVendor.id
                    });
                });

                let _updatedRequistion = _requistionObj.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });

                return _updatedRequistion;


            } catch (error) {
                log.error({ title: 'updatedRequistion - erro', details: error });
            }
        }

        function updateVendor(options) {
            let _objPurchReq = record.load({
                type: TYPE,
                id: options.id,
                isDynamic: false,
            });

            options.itemList.forEach((item, index) => {
                const _hasPurchaseOrderLinked = !(item.linkedOrder === '' || item.linkedOrder === null || item.linkedOrder === undefined);
                if (_hasPurchaseOrderLinked) {
                    const _idVendor = purchase_order_service.getVendor(item.linkedOrder);
                    _objPurchReq.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pd_pow_purchord_vendor',
                        line: index,
                        value: _idVendor
                    });
                }
            });

            _objPurchReq.save();
            return `Purchase Requisition #${options.id} foi atualizada.`;
        }

        // TODO---------- INÍCIO: ADIÇÃO - updateFinalCost (Purchase Requisition Service) ----------

        function updateFinalCost(idPurchaseRequisition, options) {
            try {

                log.debug({ title: 'Linha 580 - updateFinalCost - idPurchaseRequisition', details: idPurchaseRequisition[0] });
                log.debug({ title: 'Linha 581 - updateFinalCost - purchaseOrderItems', details: options });

                let _requistionObj = record.load({
                    type: TYPE,
                    id: idPurchaseRequisition[0],
                    isDynamic: false,
                });

                const _idPurchaseOrder = options.id;
                const _numLines = _requistionObj.getLineCount({ sublistId: 'item' });

                options.itemList.forEach((item, index) => {
                    const _linkedOrderPO = item.linkedOrder[0];
                    const _grossAmtPO = item.grossAmt
                    const _itemPO = item.item;
                    const _partNumberCustomerPO = item.partNumberCustomer

                    // log.debug({ title: 'Linha 599 - updateFinalCost - item', details: item });
                    // log.debug({ title: 'Linha 600 - updateFinalCost - index', details: index });
                    log.debug({ title: 'Linha 601 - updateFinalCost - _linkedOrderPO', details: _linkedOrderPO });
                    // log.debug({ title: 'Linha 602 - updateFinalCost - _grossAmtPO', details: _grossAmtPO });
                    // log.debug({ title: 'Linha 603 - updateFinalCost - _itemPO', details: _itemPO });
                    log.debug({ title: 'Linha 604 - updateFinalCost - _partNumberCustomerPO', details: _partNumberCustomerPO });

                    for (let i = 0; i < _numLines; i++) {

                        const _itemPR = _requistionObj.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                        const _partNumberCustomerPR = _requistionObj.getSublistValue({ sublistId: 'item', fieldId: 'custcol_pd_partnumbercustomer', line: i });
                        const _linkedOrderPR = _requistionObj.getSublistValue({ sublistId: 'item', fieldId: 'linkedorder', line: i });

                        log.debug({ title: 'Linha 611 - updateFinalCost - _partnumbercustomerPR', details: _partNumberCustomerPR });

                        if ((_itemPR == _itemPO) && (idPurchaseRequisition[0] == _linkedOrderPO) && (_partNumberCustomerPR == _partNumberCustomerPO)) {

                            // log.debug({ title: 'Linha 624 - updateFinalCost - _itemPR', details: _itemPR });
                            // log.debug({ title: 'Linha 625 - updateFinalCost - _partnumbercustomerPR', details: _partNumberCustomerPR });
                            // log.debug({ title: 'Linha 626 - updateFinalCost - _linkedOrderPR', details: _linkedOrderPR });
                            log.debug({ title: 'Linha 627 - updateFinalCost - _grossAmtPO', details: _grossAmtPO });
                            log.debug(`Linha 628 - updateFinalCost - line: ${i}`);

                            let _setFinalCost = _requistionObj.setSublistValue({
                                sublistId: 'item',
                                fieldId: 'custcol_aae_final_cost_po',
                                line: i,
                                value: _grossAmtPO
                            });
                        }

                    }
                })

                _requistionObj.save();

                return true;

            } catch (error) {
                log.error({ title: 'updateFinalCost - erro ', details: error });
            }
        }
        //TODO ---------- FIM: ADIÇÃO - updateFinalCost (Purchase Requisition Service) ----------



        function setFinalCostUnitFromPOToPR(options) {
            const recId = options.recId;
            const values = options.values;

            if (!recId || !Array.isArray(values) || values.length === 0) {
                return;
            }

            try {
                const prRec = record.load({
                    type: record.Type.PURCHASE_REQUISITION,
                    id: recId,
                    isDynamic: false
                });

                const lineCount = prRec.getLineCount({ sublistId: 'item' });

                const costMap = {};
                for (let i = 0; i < values.length; i++) {
                    const lineRef = values[i].lineRef;
                    const finalCost = values[i].finalCost;

                    if (lineRef && finalCost != null) {
                        costMap[lineRef] = finalCost;
                    }
                }

                for (let i = 0; i < lineCount; i++) {
                    const ref = prRec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pd_cso_line_reference',
                        line: i
                    });

                    if (ref && costMap[ref] != null) {
                        prRec.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pd_final_cost_po_un',
                            line: i,
                            value: costMap[ref]
                        });
                    }
                }

                prRec.save({ ignoreMandatoryFields: true });
                return true;

            } catch (e) {
                log.error({
                    title: 'Erro ao atualizar Final Cost na PR',
                    details: e
                });
            }
        }

        function filterItemsToPR(options) {
            const _filteredSalesOrder = Object.assign({}, options);

            if (!_filteredSalesOrder || !_filteredSalesOrder.itemList) {
                return _filteredSalesOrder;
            }

            const _validItems = _filteredSalesOrder.itemList.filter(function (_item) {
                return _item.dontCreateRequisition !== true;
            });

            _filteredSalesOrder.itemList = _validItems;

            return _filteredSalesOrder;
        }

        function updateBuyer(idPurchaseRequisition, buyer) {
            try {

                log.debug({
                    title: 'updateBuyer - entrada',
                    details: {
                        idPurchaseRequisition: idPurchaseRequisition,
                        buyer: buyer
                    }
                });

                let _prRecord = record.load({
                    type: TYPE,
                    id: idPurchaseRequisition,
                    isDynamic: false
                });

                _prRecord.setValue({
                    fieldId: FIELDS.buyer.name, // 'custbody_aae_buyer'
                    value: buyer
                });

                _prRecord.save({
                    enableSourcing: true,
                    ignoreMandatoryFields: true
                });

                log.audit({
                    title: 'updateBuyer - PR atualizada',
                    details: `PR ${idPurchaseRequisition} atualizada com buyer ${buyer}`
                });

                return true;

            } catch (error) {
                log.error({
                    title: 'updateBuyer - erro',
                    details: error
                });
            }
        }


        return {
            changedItemsList: changedItemsList,
            createPurchaseRequisition: createPurchaseRequisition, // ← com proteção de urgência + pós-ajuste de rate
            getByStatus: getByStatus,
            getRequisitionData: getRequisitionData,
            getLineItem: getLineItem,
            hasDifferences: hasDifferences,
            itemsToInsert: itemsToInsert,
            insertionLine: insertionLine,
            readData: readData,
            removeLine: removeLine,
            updatedRequistion: updatedRequistion,
            updateVendor: updateVendor,
            updateFinalCost: updateFinalCost,
            setFinalCostUnitFromPOToPR: setFinalCostUnitFromPOToPR,
            filterItemsToPR: filterItemsToPR,
            updateBuyer: updateBuyer

        };
    });
