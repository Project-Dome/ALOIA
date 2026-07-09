/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author Project Dome - Rogério Gonçalves Rodrigues
 */

define([

    'N/record',
    'N/log',
    'N/error',
    'N/runtime',
    'N/search',

    '../pd_cso_service/pd-cso-purchase-order.service',
    '../../pd_purchasing_owner/pd_pow_service/pd-pow-sales-order.service',

    '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-search.util.js',
    '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-record.util.js',

    '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js'

], function (
    record,
    log,
    error,
    runtime,
    search,

    purchase_order_service,
    sales_order_pow_service,

    search_util,
    record_util

) {
    const TYPE = 'salesorder';
    const FIELDS = {
        customerId: { name: 'entity' },
        department: { name: 'department' },
        location: { name: 'location' },
        subsidiary: { name: 'subsidiary' },
        trandate: { name: 'trandate' },
        status: { name: 'status' },
        orderStatus: { name: 'orderstatus' },
        // purchaseRequisition: { name: 'custbody_pd_so_purchase_requisition', type: 'list' }, //todo: anterior fieldId
        purchaseRequisition: { name: 'custbody_pd_cso_linked_requistion', type: 'list' },
        // createPurchaseRequisition: { name: 'custbody_pd_so_create_purchase_requis' },
        dontCreateRequisition: { name: 'custbody_pd_cso_dont_create_req' },
        salesRep: { name: 'salesrep' },
        memo: { name: 'memo' },
        urgencyOrder: { name: 'custbody_aae_urgency_order', type: 'list' },
        custPoReceipt: { name: 'custbody_aae_cust_po_receipt' },
        buyer: { name: 'custbody_aae_buyer', type: 'list' },
        soQt: { name: 'custbody_so_qt' }
    };

    const ITEM_SUBLIST_ID = 'item';

    const ITEM_SUBLIST_FIELDS = {
        id: { name: 'internalid' },
        item: { name: 'item', type: 'list' },
        amount: { name: 'amount' },
        department: { name: 'department' },
        lastPurchasePrice: { name: 'lastpurchaseprice' },
        line: { name: 'line' },
        lineUniqueKey: { name: 'lineuniquekey' },
        location: { name: 'location' },
        promiseDate: { name: 'custcol_atlas_promise_date' },
        poVendor: { name: 'custcol_aae_vendor_purchase_order', type: 'list' },
        purchaseOrderLinked: { name: 'custcol_aae_purchase_order_linked' },
        purchaseRequisition: { name: 'custcol_aae_purchaserequisition', type: 'list' },
        buyerRequisitionPo: { name: 'custcol_aae_buyer_purchase_order', type: 'list' },
        estimatedCostPo: { name: 'custcol_aae_estimated_cost_po' },
        slaPo: { name: 'custcol_aae_sla_purchase_order' },
        purchaseOrder: { name: 'custcol_aae_purchaseorder', type: 'list' },
        quantity: { name: 'quantity' },
        units: { name: 'units' },
        poVendorFinal: { name: 'custcol_pd_pow_purchord_vendor', type: 'list' },
        memoLine: { name: 'custcol_pd_memoline' },
        dontCreateRequisition: { name: 'custcol_pd_cso_dont_create_purchreq' },
        partNumberCustomer: { name: 'custcol_pd_partnumbercustomer' },
        lineReference: { name: 'custcol_pd_cso_line_reference' },
        statusItem: { name: 'custcol_pd_aae_status_item' },
        estimatedRate: { name: 'estimatedrate' },
        finalCostPoUn: { name: 'custcol_pd_final_cost_po_un' },
        estimatedCostTot: { name: 'custcol_pd_estimated_cost_tot' }
    };

    function readData(options) {
        try {

            let _invoiceData = record_util
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

            log.audit({ title: 'linha 100 - readData - _invoiceData', details: _invoiceData });

            return _invoiceData;

        } catch (error) {
            log.error({ title: 'Linha 105 - readData - error', details: error });
        }
    }

    function updateSalesOrder(options) {

        try {
            log.debug({ title: 'Linha 112 - updateSalesOrder -  options', details: options });
            log.debug({ title: 'Linha 113 - updateSalesOrder - id sales order', details: options.id });

            let _objSalesOrder = record.load({
                type: TYPE,
                id: options.id,
                isDynamic: false,
            });

            options.itemList.forEach((line, index) => {
                // só processa se o campo purchaseOrderLinked vier preenchido
                const _hasPurchaseOrderLinked = !isNullOrEmpty(line.purchaseOrderLinked);

                if (_hasPurchaseOrderLinked) {
                    const _purchaseOrderLinked = line.purchaseOrderLinked;

                    //log.debug({ title: 'Linha 128 - Índice da linha', details: index });
                    //log.debug({ title: 'Linha 129 - purchaseOrderLinked recebido', details: _purchaseOrderLinked });

                    // lê o valor atual da coluna custcol_aae_purchaseorder na Sales Order
                    let _currentValue = _objSalesOrder.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_aae_purchaseorder',
                        line: index
                    });

                    const _isEmpty = isNullOrEmpty(_currentValue);

                    //log.debug({ title: 'Linha 140 - Valor atual em custcol_aae_purchaseorder', details: _currentValue });
                    //log.debug({ title: 'Linha 141 - Está vazio?', details: _isEmpty });

                    const _idVendor = purchase_order_service.getVendor(_purchaseOrderLinked)

                    // só grava se ainda estiver vazio
                    if (_isEmpty) {
                        _objSalesOrder.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_aae_purchaseorder',
                            line: index,
                            value: _purchaseOrderLinked
                        });

                        _objSalesOrder.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pd_pow_purchord_vendor',
                            line: index,
                            value: _idVendor
                        });

                        /*log.debug({
                            title: `Linha 162 - Linha ${index} atualizada`,
                            details: `custcol_aae_purchaseorder = ${_purchaseOrderLinked}`
                        });
                        log.debug({
                            title: `Linha 163 - Linha ${index} atualizada`,
                            details: `custcol_pd_pow_purchord_vendor = ${_idVendor}`
                        });*/
                    } else {
                        /*log.debug({
                            title: `Linha 171 - Linha ${index} não alterada`,
                            details: `já existe valor em custcol_aae_purchaseorder (${_currentValue})`
                        });*/
                    }
                }
            });

            _objSalesOrder.save();
            log.debug({ title: 'Linha 170 - updateSalesOrder - salvou dados da SO', details: `id sales order: ${options.id}.` });

            return true;

        } catch (error) {
            log.error({ title: 'Linha 184 - updateSalesOrder - error', details: error });
        }

    }

    function upadtePurchaseRequistion(idSalesOrder, idPurchaseRequisition) {

        try {

            /*log.debug({
                title: 'upadtePurchaseRequistion - Valores de atualização',
                details: `id da Sales Order: ${idSalesOrder} 
                id da Requisition: ${idPurchaseRequisition}.`
            });*/

            let _salesOrderObj = record.load({
                type: TYPE,
                id: idSalesOrder,
                isDynamic: true,
            });

            _salesOrderObj.setValue({
                fieldId: 'custbody_pd_cso_linked_requistion',
                value: idPurchaseRequisition
            });
            _salesOrderObj.save();

            return true;

        } catch (error) {
            log.error({ title: 'Linha 194 - upadtePurchaseRequistion - error', details: error });
        }

    }

    // TODO: DESENVOLVENDO ATUALIZAÇÃO DOS ITENS
    function getSalesData(idSalesOrder) {

        try {
            //log.debug({ title: ' getSalesData - Id Requisition', details: idSalesOrder });

            let _salesOrderData = record.load({
                type: TYPE,
                id: idSalesOrder,
                isDynamic: true,
            })

            return _salesOrderData;

        } catch (error) {
            log.error({ title: 'Linha 169 - getSalesData - Erro de processameto ', details: error })
        }
    }



    function validateItems(options) {

        return options.every(item => {
            return item?.poVendor?.id &&
                // item?.buyerRequisitionPo?.id &&
                item?.estimatedCostPo !== undefined && item?.estimatedCostPo !== "" &&
                item?.slaPo !== undefined && item?.slaPo !== "";
        });

    }

    // TODO---------- INÍCIO: ADIÇÃO - updateBuyer (Purchase Requisition Service) ----------

    function updateFinalBuyer(options) {
        try {

            const _idPurchaseOrder = options.id;
            const _idSalesOrder = options.salesOrder

            log.debug({ title: 'Linha 285 - updateFinalBuyer - purchaseOrderItems', details: options });
            log.debug({ title: 'Linha 286 - updateFinalBuyer - _idPurchaseOrder', details: _idPurchaseOrder });
            log.debug({ title: 'Linha 288 - updateFinalBuyer - _idSalesOrder', details: _idSalesOrder });

            let _salesOrderObj = record.load({
                type: TYPE,
                id: _idSalesOrder,
                isDynamic: false,
            });

            const _numLines = _salesOrderObj.getLineCount({ sublistId: 'item' });

            options.itemList.forEach((item, index) => {

                const _itemPO = item.item;
                const _partNumberCustomerPO = item.partNumberCustomer

                // log.debug({ title: 'Linha 305 - updateFinalBuyer - item', details: item });
                // log.debug({ title: 'Linha 306 - updateFinalBuyer - index', details: index });
                // log.debug({ title: 'Linha 307- updateFinalBuyer - _itemPO', details: _itemPO });
                // log.debug({ title: 'Linha 308 - updateFinalBuyer - _partNumberCustomerPO', details: _partNumberCustomerPO });

                for (let i = 0; i < _numLines; i++) {

                    const _itemSO = _salesOrderObj.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                    const _partNumberCustomerSO = _salesOrderObj.getSublistValue({ sublistId: 'item', fieldId: 'custcol_pd_partnumbercustomer', line: i });
                    const _purchaseOrderSO = _salesOrderObj.getSublistValue({ sublistId: 'item', fieldId: 'custcol_aae_purchaseorder', line: i });


                    if ((_purchaseOrderSO == _idPurchaseOrder) && (_partNumberCustomerSO == _partNumberCustomerPO) && (_itemSO == _itemPO)) {

                        const _idFinalBuyer = options.buyer

                        log.debug({ title: 'Linha 321 - updateFinalBuyer - _itemSO', details: _itemSO });
                        log.debug({ title: 'Linha 322 - updateFinalBuyer - _partNumberCustomerSO', details: _partNumberCustomerSO });
                        log.debug({ title: 'Linha 323 - updateFinalBuyer - _purchaseOrderSO', details: _purchaseOrderSO });
                        log.debug({ title: 'Linha 324 - updateFinalBuyer - _idFinalBuyer', details: _idFinalBuyer });

                        let _setFinalCost = _salesOrderObj.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_aae_buyer_purchase_order',
                            line: i,
                            value: _idFinalBuyer
                        });

                    }
                }
            })

            _salesOrderObj.save();

            return true;

        } catch (error) {
            log.error({ title: 'updateBuyer - erro ', details: error });
        }
    }
    //TODO ---------- FIM: ADIÇÃO - updateBuyer (Purchase Requisition Service) ----------

    function updateFinalCostFromPO(options) {
        try {
            // options é o _purchaseOrderData vindo do service do PO (readData)
            const _idPurchaseOrder = options.id;
            const _idSalesOrder = options.salesOrder; // vem do body field custbody_pd_so_sales_order

            if (!_idSalesOrder) return true; // nada a fazer se o PO não aponta para uma SO

            let _salesOrderObj = record.load({
                type: TYPE,
                id: _idSalesOrder,
                isDynamic: false,
            });

            const _numLines = _salesOrderObj.getLineCount({ sublistId: 'item' }) || 0;

            // Para cada linha do PO, tente achar a linha correspondente na SO
            (options.itemList || []).forEach((poLine) => {
                const _poItem = poLine.item;
                const _poPnCustomer = poLine.partNumberCustomer;
                const _poGrossAmt = Number(poLine.grossAmt) || 0;

                for (let i = 0; i < _numLines; i++) {
                    const soItem = _salesOrderObj.getSublistValue({ sublistId: 'item', fieldId: 'item', line: i });
                    const soPn = _salesOrderObj.getSublistValue({ sublistId: 'item', fieldId: 'custcol_pd_partnumbercustomer', line: i });
                    const soLinkedPO = _salesOrderObj.getSublistValue({ sublistId: 'item', fieldId: 'custcol_aae_purchaseorder', line: i });

                    // Critério: mesma SO (carregada), mesma linha vinculada ao PO atual, mesmo item e mesmo PN Cliente
                    if (soLinkedPO == _idPurchaseOrder && soItem == _poItem && soPn == _poPnCustomer) {
                        _salesOrderObj.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_aae_final_cost_po', // campo alvo na SO
                            line: i,
                            value: _poGrossAmt
                        });
                    }
                }
            });

            _salesOrderObj.save({ enableSourcing: true, ignoreMandatoryFields: true });
            return true;

        } catch (error) {
            log.error({ title: 'updateFinalCostFromPO - erro ', details: error });
        }
    }


    function clearPurchaseOrderLinkAndFinalCost(options) {
        try {
            const poId = String(options.purchaseOrderId || '').trim();
            const soId = options.salesOrderId;
            const clearBuyer = options.clearBuyerFromPOLines === true;

            if (!poId || !soId) return false;

            const soRec = record.load({
                type: TYPE, // 'salesorder'
                id: soId,
                isDynamic: false
            });

            const sublistId = 'item';
            const lineCount = soRec.getLineCount({ sublistId }) || 0;

            let touched = 0;

            for (let i = 0; i < lineCount; i++) {
                const linkedPO = soRec.getSublistValue({
                    sublistId,
                    fieldId: 'custcol_aae_purchaseorder',
                    line: i
                });

                if (String(linkedPO || '') === poId) {
                    // Desfaz vínculo com o PO
                    soRec.setSublistValue({
                        sublistId,
                        fieldId: 'custcol_aae_purchaseorder',
                        line: i,
                        value: '' // limpa (string vazia) ou null
                    });

                    // Zera/limpa o Final Cost (PO)
                    soRec.setSublistValue({
                        sublistId,
                        fieldId: 'custcol_aae_final_cost_po',
                        line: i,
                        value: '' // limpa
                    });

                    // Zera/limpa o Vendor Final (PO)
                    soRec.setSublistValue({
                        sublistId,
                        fieldId: 'custcol_pd_pow_purchord_vendor',
                        line: i,
                        value: '' // limpa
                    });

                    // Opcional: limpa buyer que veio do PO
                    if (clearBuyer) {
                        soRec.setSublistValue({
                            sublistId,
                            fieldId: 'custcol_aae_buyer_purchase_order',
                            line: i,
                            value: ''
                        });
                    }

                    touched++;
                }
            }

            if (touched > 0) {
                soRec.save({ enableSourcing: true, ignoreMandatoryFields: true });
            }

            return { updatedLines: touched };

        } catch (error) {
            log.error({ title: 'clearPurchaseOrderLinkAndFinalCost - erro', details: error });
            return false;
        }
    }

    function generateUUID() {
        try {
            let _uuid = '';
            if (typeof crypto !== 'undefined' && crypto.randomUUID) {
                _uuid = crypto.randomUUID();
            } else {
                _uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
                    let _r = Math.random() * 16 | 0;
                    let _v = c === 'x' ? _r : (_r & 0x3 | 0x8);
                    return _v.toString(16);
                });
            }
            return _uuid;
        } catch (error) {
            log.error({ title: 'generateUUID - erro', details: error });
            return false;
        }
    }

    function getSalesOrderData(idSalesOrder) {
        try {
            let _soRecord = record.load({
                type: record.Type.SALES_ORDER,
                id: idSalesOrder,
                isDynamic: false
            });

            // 🔹 Aqui está todo o processamento e coleta dos dados da Sales Order
            // ... (seu código atual permanece igual)

            // Exemplo: itemList é montado durante o processamento
            let itemList = _soRecord.getSublist({
                sublistId: 'item'
            });

            // 🔹 ADIÇÃO IMPORTANTE — garante que itemList seja sempre um array
            const _itemList = Array.isArray(itemList)
                ? itemList
                : Object.values(itemList || {});

            // 🔹 Retorno final — usando o _itemList seguro
            return {
                id: idSalesOrder,
                itemList: _itemList,
                // ...demais propriedades já existentes no seu código
            };

        } catch (error) {
            log.error({
                title: 'getSalesOrderData - erro',
                details: error
            });
            return {};
        }
    }

    //TODO: INSERÇÃO DE PROCESSO PARA REALIZAR AÇOES INCLUSÕES E EXCLUSOES NO MODO DE EDIÇÃO - 10/10/2025
    /**
     * Indexa as linhas por custcol_pd_cso_line_reference
     */
    function indexByRef(list) {
        try {
            let _idx = {};
            (list || []).forEach(function (it) {
                let _ref = it && (it.lineReference || it.custcol_pd_cso_line_reference);
                if (_ref) {
                    _idx[_ref] = it;
                }
            });
            return _idx;
        } catch (error) {
            log.error({ title: 'indexByRef - erro', details: error });
            return {};
        }
    }

    /**
     * Minimiza os campos que a PR precisa quando for inserir linhas novas
     */
    function mapSoLineForPr(soLine) {
        try {
            return {
                item: { id: soLine.item && soLine.item.id },
                quantity: soLine.quantity,
                units: soLine.units,
                poVendor: soLine.poVendor,
                partNumberCustomer: soLine.partNumberCustomer, // custcol_pd_partnumbercustomer
                memoLine: soLine.memoLine,
                slaPurchaseOrder: soLine.slaPurchaseOrder || soLine.slaPo,
                promiseDate: soLine.promiseDate,
                estimatedCostPo: soLine.estimatedCostPo,  // custcol_aae_estimated_cost_po
                statusItem: soLine.statusItem,            // custcol_pd_aae_status_item
                estimatedRate: soLine.estimatedRate,      // estimatedrate
                lineReference: soLine.lineReference       // custcol_pd_cso_line_reference
            };
        } catch (error) {
            log.error({ title: 'mapSoLineForPr - erro', details: error });
            return {};
        }
    }

    /**
     * Calcula delta entre itens antigos e atuais da SO, via lineReference
     * Retorna { itemsToInsert, refsToRemove }
     */


    function computeDeltaForPR(newItemList, oldItemList) {
        const _newRefs = new Set();
        const _oldRefs = new Set();
        const _itemsToInsert = [];
        const _refsToRemove = [];

        const _oldItemMap = {};
        oldItemList.forEach(_item => {
            if (_item.lineReference) {
                _oldRefs.add(_item.lineReference);
                _oldItemMap[_item.lineReference] = _item;
            }
        });

        newItemList.forEach(_item => {
            if (_item.lineReference) {
                _newRefs.add(_item.lineReference);

                const _existedBefore = _oldItemMap[_item.lineReference];
                const _wasBlockedBefore = _existedBefore && _existedBefore.dontCreateRequisition === true;
                const _isNowReleased = _item.dontCreateRequisition === false;

                // 👇 Caso novo: item já existia, mas foi liberado agora
                if (_existedBefore && _wasBlockedBefore && _isNowReleased) {
                    _itemsToInsert.push(_item);
                }

                // 👇 Caso tradicional: item totalmente novo
                if (!_oldRefs.has(_item.lineReference) && !_item.dontCreateRequisition) {
                    _itemsToInsert.push(_item);
                }
            }
        });

        oldItemList.forEach(_item => {
            if (_item.lineReference && !_newRefs.has(_item.lineReference)) {
                _refsToRemove.push(_item.lineReference);
            }
        });

        return {
            itemsToInsert: _itemsToInsert,
            refsToRemove: _refsToRemove
        };
    }



    function updateSOItems(options) {
        const updatedLines = [];

        if (!options || !options.itemList || !Array.isArray(options.itemList)) {
            log.error({ title: 'updateSOItems - Dados inválidos', details: options });
            return updatedLines;
        }

        const salesOrderMap = {};

        // Agrupa as linhas por id da Sales Order
        options.itemList.forEach(item => {
            const { idSalesOrder, lineReference } = item;

            if (!idSalesOrder || !lineReference) return;

            if (!salesOrderMap[idSalesOrder]) {
                salesOrderMap[idSalesOrder] = [];
            }
            salesOrderMap[idSalesOrder].push(item);
        });

        log.debug({ title: 'Linha 628 - updateSOItems - salesOrderMap', details: salesOrderMap })

        // Para cada SO identificada
        Object.keys(salesOrderMap).forEach(idSalesOrder => {
            try {
                const soRecord = record.load({ type: record.Type.SALES_ORDER, id: idSalesOrder, isDynamic: false });
                const linesToUpdate = salesOrderMap[idSalesOrder];

                for (let i = 0; i < soRecord.getLineCount({ sublistId: 'item' }); i++) {
                    const lineRef = soRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_pd_line_reference', line: i });

                    const matchingItem = linesToUpdate.find(item => item.lineReference === lineRef);
                    if (!matchingItem) continue;

                    const { grossAmt, buyer } = matchingItem;

                    const currentCost = soRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_aae_final_cost_po', line: i });
                    const currentBuyer = soRecord.getSublistValue({ sublistId: 'item', fieldId: 'custcol_aae_buyer_purchase_order', line: i });

                    if (!currentCost && grossAmt != null) {
                        soRecord.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_aae_final_cost_po',
                            line: i,
                            value: parseFloat(grossAmt)
                        });
                    }

                    if (!currentBuyer && buyer) {
                        soRecord.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_aae_buyer_purchase_order',
                            line: i,
                            value: buyer
                        });
                    }

                    updatedLines.push({ soId: idSalesOrder, lineRef, updated: true });
                }

                if (updatedLines.length > 0) {
                    soRecord.save({ ignoreMandatoryFields: true });
                }

            } catch (error) {
                log.error({ title: 'Erro ao atualizar SO: ' + idSalesOrder, details: error });
            }
        });

        return updatedLines;
    }

    /**
     * Atualiza os itens da Sales Order com o vínculo correto da Purchase Order e da Purchase Requisition.
     * Compatível com dados novos (via lineReference) e antigos (fallback via index).
     */
    function syncLinkedOrders(purchaseRequisitionData, salesOrderData) {
        try {
            log.debug({
                title: 'syncLinkedOrders - PR Data',
                details: JSON.stringify(purchaseRequisitionData)
            });
            log.debug({
                title: 'syncLinkedOrders - SO Data',
                details: JSON.stringify(salesOrderData)
            });

            const salesOrderLines = salesOrderData.itemList || [];
            const requisitionLines = purchaseRequisitionData.itemList || [];

            // Mapeia linhas da SO por lineReference
            const soLineRefMap = {};
            salesOrderLines.forEach((soItem, idx) => {
                if (soItem.lineReference) {
                    soLineRefMap[soItem.lineReference] = { item: soItem, index: idx };
                }
            });

            requisitionLines.forEach((prItem, idx) => {
                const poId = prItem.linkedOrder?.[0] || null;
                const ref = prItem.lineReference;

                if (!poId) return;

                if (ref && soLineRefMap[ref]) {
                    // Atualiza usando lineReference (modo ideal)
                    const { item: soItem } = soLineRefMap[ref];
                    soItem.purchaseOrderLinked = poId;
                    soItem.purchaseRequisition = { id: purchaseRequisitionData.id };

                    log.audit({
                        title: 'syncLinkedOrders - via lineReference',
                        details: `LineRef: ${ref} | PO: ${poId}`
                    });

                } else if (salesOrderLines[idx]) {
                    // Fallback: atualiza usando index da linha
                    salesOrderLines[idx].purchaseOrderLinked = poId;
                    salesOrderLines[idx].purchaseRequisition = { id: purchaseRequisitionData.id };

                    log.audit({
                        title: 'syncLinkedOrders - via index fallback',
                        details: `Index: ${idx} | PO: ${poId}`
                    });
                }
            });

            return salesOrderData;

        } catch (error) {
            log.error({
                title: 'syncLinkedOrders - Erro',
                details: error
            });
            throw error;
        }
    }

    /**
     * Atualiza os campos "BUYER PURCHASE ORDER" e "FINAL COST PO"
     * nos itens da Sales Order, com base nos dados processados pela syncLinkedOrders.
     *
     */

    function updateSalesOrderLineFields(salesOrderId, updatedItemList) {
        try {
            const soRecord = record.load({
                type: record.Type.SALES_ORDER,
                id: salesOrderId,
                isDynamic: false
            });

            const lineCount = soRecord.getLineCount({ sublistId: 'item' });

            for (let i = 0; i < lineCount; i++) {
                const updatedLine = updatedItemList[i];
                if (!updatedLine) continue;

                if (updatedLine.purchaseOrderLinked) {
                    soRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_aae_buyer_purchase_order',
                        line: i,
                        value: updatedLine.purchaseOrderLinked
                    });
                }

                if (updatedLine.purchaseRequisition?.id) {
                    soRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_aae_final_cost_po',
                        line: i,
                        value: updatedLine.purchaseRequisition.id
                    });
                }
            }

            soRecord.save();
            log.audit({
                title: 'SO atualizada com campos de PO e PR',
                details: `Sales Order ID: ${salesOrderId}`
            });

        } catch (e) {
            log.error({
                title: 'Erro ao atualizar itens da Sales Order',
                details: e
            });
        }
    }

    /**
 * Atualiza campos nas transações vinculadas (SO e PR) a partir da PO criada.
 * 
 * Para cada linha da PO, localiza a SO e PR associadas usando o UUID da linha
 * e atualiza os campos:
 * - SO: custcol_aae_final_cost_po, custcol_aae_buyer_purchase_order
 * - PR: custcol_aae_final_cost_po
 */
    function updateTransactionsFromPO(poRec, poId) {
        // const record = require('N/record');
        // const log = require('N/log');

        const SO_FINAL_COST_FIELD = 'custcol_aae_final_cost_po';
        const SO_BUYER_PO_FIELD = 'custcol_aae_buyer_purchase_order';
        const SO_LINE_REF_FIELD = 'custcol_pd_cso_line_reference';

        const PR_FINAL_COST_FIELD = 'custcol_aae_final_cost_po';
        const PR_LINE_REF_FIELD = 'custcol_pd_cso_line_reference';

        const poLineCount = poRec.getLineCount({ sublistId: 'item' });

        const soMap = {};
        const prMap = {};

        for (let i = 0; i < poLineCount; i++) {
            const lineRef = poRec.getSublistValue({ sublistId: 'item', fieldId: SO_LINE_REF_FIELD, line: i });
            const soId = poRec.getSublistValue({ sublistId: 'item', fieldId: 'custcol_pd_sales_order_linked', line: i });
            const prId = poRec.getSublistValue({ sublistId: 'item', fieldId: 'linkedorder', line: i });
            const amount = poRec.getSublistValue({ sublistId: 'item', fieldId: 'grossamt', line: i });
            const buyer = poRec.getSublistValue({ sublistId: 'item', fieldId: SO_BUYER_PO_FIELD, line: i });

            if (!lineRef) continue;

            if (soId) {
                if (!soMap[soId]) soMap[soId] = [];
                soMap[soId].push({ lineRef, amount, buyer });
            }

            if (prId) {
                if (!prMap[prId]) prMap[prId] = [];
                prMap[prId].push({ lineRef, amount });
            }
        }

        // Atualiza SOs
        Object.keys(soMap).forEach(function (soId) {
            try {
                const soRec = record.load({ type: record.Type.SALES_ORDER, id: soId, isDynamic: false });
                const soLines = soRec.getLineCount({ sublistId: 'item' });

                soMap[soId].forEach(function (update) {
                    for (let i = 0; i < soLines; i++) {
                        const lineRef = soRec.getSublistValue({ sublistId: 'item', fieldId: SO_LINE_REF_FIELD, line: i });
                        if (lineRef === update.lineRef) {
                            soRec.setSublistValue({ sublistId: 'item', fieldId: SO_FINAL_COST_FIELD, line: i, value: update.amount });
                            if (update.buyer) {
                                soRec.setSublistValue({ sublistId: 'item', fieldId: SO_BUYER_PO_FIELD, line: i, value: update.buyer });
                            }
                            break;
                        }
                    }
                });

                soRec.save({ ignoreMandatoryFields: true });
                log.debug('updateTransactionsFromPO', `Sales Order ${soId} atualizado com sucesso.`);
            } catch (e) {
                log.error('updateTransactionsFromPO - erro ao atualizar SO', { soId, error: e });
            }
        });

        // Atualiza PRs
        Object.keys(prMap).forEach(function (prId) {
            try {
                const prRec = record.load({ type: record.Type.PURCHASE_REQUISITION, id: prId, isDynamic: false });
                const prLines = prRec.getLineCount({ sublistId: 'item' });

                prMap[prId].forEach(function (update) {
                    for (let i = 0; i < prLines; i++) {
                        const lineRef = prRec.getSublistValue({ sublistId: 'item', fieldId: PR_LINE_REF_FIELD, line: i });
                        if (lineRef === update.lineRef) {
                            prRec.setSublistValue({ sublistId: 'item', fieldId: PR_FINAL_COST_FIELD, line: i, value: update.amount });
                            break;
                        }
                    }
                });

                prRec.save({ ignoreMandatoryFields: true });
                log.debug('updateTransactionsFromPO', `Purchase Requisition ${prId} atualizada com sucesso.`);
            } catch (e) {
                log.error('updateTransactionsFromPO - erro ao atualizar PR', { prId, error: e });
            }
        });
    }


    function updateEstimatedCostTotalPerLine(idSalesOrder) {
        try {
            const soRecord = record.load({
                type: record.Type.SALES_ORDER,
                id: idSalesOrder,
                isDynamic: false
            });

            const lineCount = soRecord.getLineCount({ sublistId: 'item' });

            for (let i = 0; i < lineCount; i++) {
                const quantity = parseFloat(soRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'quantity',
                    line: i
                })) || 0;

                const estimatedCostPo = parseFloat(soRecord.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_aae_estimated_cost_po',
                    line: i
                })) || 0;

                const total = quantity * estimatedCostPo;

                soRecord.setSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_pd_estimated_cost_tot',
                    line: i,
                    value: total
                });
            }

            soRecord.save({ ignoreMandatoryFields: true });

            return { success: true, idSalesOrder: idSalesOrder };

        } catch (error) {
            log.error({
                title: 'Erro ao atualizar custcol_pd_estimated_cost_tot',
                details: error
            });

            return { success: false, error: error, idSalesOrder: idSalesOrder };
        }
    }

    function setFinalCostUnitFromPOToSO(options) {
        const recId = options.recId;
        const values = options.values;

        if (!recId || !Array.isArray(values) || values.length === 0) {
            return;
        }

        try {
            const soRec = record.load({
                type: record.Type.SALES_ORDER,
                id: recId,
                isDynamic: false
            });

            const lineCount = soRec.getLineCount({ sublistId: 'item' });

            const costMap = {};
            for (let i = 0; i < values.length; i++) {
                const lineRef = values[i].lineRef;
                const finalCost = values[i].finalCost;

                if (lineRef && finalCost != null) {
                    costMap[lineRef] = finalCost;
                }
            }

            for (let i = 0; i < lineCount; i++) {
                const ref = soRec.getSublistValue({
                    sublistId: 'item',
                    fieldId: 'custcol_pd_cso_line_reference',
                    line: i
                });

                if (ref && costMap[ref] != null) {
                    soRec.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pd_final_cost_po_un',
                        line: i,
                        value: costMap[ref]
                    });
                }
            }

            soRec.save({ ignoreMandatoryFields: true });

        } catch (e) {
            log.error({
                title: 'Erro ao atualizar Final Cost na SO',
                details: e
            });
        }
    }

    function applyEstimatedCostTotal(salesOrderRecord) {
        try {
            const sublistId = 'item';
            const numLines = salesOrderRecord.getLineCount({ sublistId }) || 0;

            for (let i = 0; i < numLines; i++) {
                const quantity = parseFloat(salesOrderRecord.getSublistValue({
                    sublistId,
                    fieldId: 'quantity',
                    line: i
                })) || 0;

                const estimatedRate = parseFloat(salesOrderRecord.getSublistValue({
                    sublistId,
                    fieldId: 'estimatedrate',
                    line: i
                })) || 0;

                const estimatedCostTot = quantity * estimatedRate;

                salesOrderRecord.setSublistValue({
                    sublistId,
                    fieldId: 'custcol_pd_estimated_cost_tot',
                    line: i,
                    value: estimatedCostTot
                });
            }

        } catch (e) {
            log.error({
                title: 'applyEstimatedCostTotal - Erro ao calcular custo estimado total',
                details: e
            });
        }
    }

    // ^ - Fluxo de atualizaão special order PO SO
    function isSalesOrder(transactionId) {
        try {
            if (!transactionId) {
                return false;
            }

            var _type = search.lookupFields({
                type: search.Type.TRANSACTION,
                id: transactionId,
                columns: ['recordtype']
            });

            return _type && _type.recordtype === 'salesorder';

        } catch (error) {
            log.error({
                title: 'isSalesOrder - error',
                details: error
            });
            return false;
        }
    }

    function applyPurchaseOrderToSalesOrderSync(payload) {
        try {
            log.debug({
                title: 'applyPurchaseOrderToSalesOrderSync - payload',
                details: payload
            });

            if (!payload || !payload.salesOrderId) {
                return false;
            }

            const _salesOrderRecord = record.load({
                type: record.Type.SALES_ORDER,
                id: payload.salesOrderId,
                isDynamic: false
            });

            const _lineCount = _salesOrderRecord.getLineCount({
                sublistId: 'item'
            });

            (payload.lines || []).forEach(function (_payloadLine) {
                const _payloadLineReference = _payloadLine.lineReference;

                if (!_payloadLineReference) {
                    log.debug({
                        title: 'applyPurchaseOrderToSalesOrderSync - lineReference vazio',
                        details: _payloadLine
                    });
                    return;
                }

                for (let i = 0; i < _lineCount; i++) {
                    const _salesOrderLineReference = _salesOrderRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pd_cso_line_reference',
                        line: i
                    });

                    if (_salesOrderLineReference != _payloadLineReference) {
                        continue;
                    }

                    _salesOrderRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_aae_purchaseorder',
                        line: i,
                        value: payload.purchaseOrderId
                    });

                    _salesOrderRecord.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pd_pow_purchord_vendor',
                        line: i,
                        value: payload.vendor || ''
                    });

                    if (payload.buyer) {
                        _salesOrderRecord.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_aae_buyer_purchase_order',
                            line: i,
                            value: payload.buyer
                        });
                    }

                    if (payload.buyer === '' || payload.buyer === null) {
                        // mantém em branco se não vier valor
                    }

                    if (_payloadLine.finalCostPo !== undefined && _payloadLine.finalCostPo !== null && _payloadLine.finalCostPo !== '') {
                        _salesOrderRecord.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_aae_final_cost_po',
                            line: i,
                            value: _payloadLine.finalCostPo
                        });
                    }

                    if (_payloadLine.finalCostPoUn !== undefined && _payloadLine.finalCostPoUn !== null) {
                        _salesOrderRecord.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pd_final_cost_po_un',
                            line: i,
                            value: parseFloat(_payloadLine.finalCostPoUn)
                        });
                    }

                    const _alreadyProcessed = _salesOrderRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pd_pow_po_processed',
                        line: i
                    });

                    if (_alreadyProcessed !== true && _alreadyProcessed !== 'T') {
                        const _initialBuyerId = _salesOrderRecord.getSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pd_buyer_purchorder_initial',
                            line: i
                        });

                        if (_initialBuyerId) {
                            sales_order_pow_service.decrementBuyerCounter(_initialBuyerId);
                        }

                        _salesOrderRecord.setSublistValue({
                            sublistId: 'item',
                            fieldId: 'custcol_pd_pow_po_processed',
                            line: i,
                            value: true
                        });
                    }

                    break;
                }
            });

            _salesOrderRecord.save({
                enableSourcing: false,
                ignoreMandatoryFields: true
            });

            return true;

        } catch (error) {
            log.error({
                title: 'applyPurchaseOrderToSalesOrderSync - error',
                details: error
            });
            return false;
        }
    }

    return {
        generateUUID: generateUUID,
        getSalesData: getSalesData,
        readData: readData,
        syncLinkedOrders: syncLinkedOrders,
        upadtePurchaseRequistion: upadtePurchaseRequistion,
        updateSalesOrder: updateSalesOrder,
        validateItems: validateItems,
        updateFinalBuyer: updateFinalBuyer,
        updateFinalCostFromPO: updateFinalCostFromPO,
        clearPurchaseOrderLinkAndFinalCost: clearPurchaseOrderLinkAndFinalCost,
        getSalesOrderData: getSalesOrderData,
        computeDeltaForPR: computeDeltaForPR,
        updateSOItems: updateSOItems,
        updateTransactionsFromPO: updateTransactionsFromPO,
        setFinalCostUnitFromPOToSO: setFinalCostUnitFromPOToSO,
        updateEstimatedCostTotalPerLine: updateEstimatedCostTotalPerLine,
        applyEstimatedCostTotal: applyEstimatedCostTotal,
        isSalesOrder: isSalesOrder,
        applyPurchaseOrderToSalesOrderSync: applyPurchaseOrderToSalesOrderSync

    }
});