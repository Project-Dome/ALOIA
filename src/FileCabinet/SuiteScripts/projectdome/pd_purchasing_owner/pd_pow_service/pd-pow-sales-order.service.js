/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author Project Dome - Rogério Gonçalves Rodrigues
 */

define(
    [
        'N/log',
        'N/record',
        'N/search',

        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-search.util.js',
        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-record.util.js',

        '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js'
    ],

    function (
        log,
        record,
        search,

        search_util,
        record_util
    ) {

        const TYPE = 'salesorder';

        const FIELDS = {
            internalId: { name: 'internalid' },
            buyer: { name: 'custbody_aae_buyer' },
            status: { name: 'status' }
        };

        const EMPLOYEE_FIELDS = {
            buyerFlag: 'custentity_pd_pow_buyer',
            onLeave: 'custentity_pd_pow_aae_onleave',
            shiftStart: 'custentity_pd_pow_shift_start',
            shiftEnd: 'custentity_pd_pow_shift_end',
            salesAssignedToday: 'custentity_pd_pow_sales_assigned_today',
            lastSOAssignment: 'custentity_pd_last_so_assignment'

        };

        const SALES_ORDER_STATUS = {
            onHold: '5'
        };

        function readData(options) {
            try {
                let _salesOrderId = options.id;

                let _salesOrderData = record_util
                    .handler(options)
                    .data({
                        fields: FIELDS
                    });

                log.debug({
                    title: 'readData - salesOrderData',
                    details: _salesOrderData
                });

                return _salesOrderData;

            } catch (error) {
                log.error({
                    title: 'readData - Error processing',
                    details: error
                });
            }
        }

        function assignBuyerToSO(idSalesOrder, options) {
            try {

                // Autoproteção: não atribuir buyer se todas as linhas estiverem marcadas
                if (shouldSkipBuyerAssignment(idSalesOrder)) {
                    log.debug({
                        title: 'assignBuyerToSO - Skipped',
                        details: `Sales Order ${idSalesOrder} marcada para não criar PR/PO em todas as linhas`
                    });
                    return null;
                }

                const forceRedistribution = options && options.forceRedistribution;

                let _soLookup = search.lookupFields({
                    type: TYPE,
                    id: idSalesOrder,
                    columns: [FIELDS.buyer.name]
                });

                let _currentBuyer = (_soLookup &&
                    _soLookup[FIELDS.buyer.name] &&
                    _soLookup[FIELDS.buyer.name].length)
                    ? _soLookup[FIELDS.buyer.name][0].value
                    : null;

                if (_currentBuyer) {
                    let _employeeRec = record.load({
                        type: record.Type.EMPLOYEE,
                        id: _currentBuyer
                    });

                    let _isOnLeave = _employeeRec.getValue({
                        fieldId: EMPLOYEE_FIELDS.onLeave
                    });

                    if (!forceRedistribution || !_isOnLeave) {
                        return _currentBuyer;
                    }

                    let _oldCount = parseInt(_employeeRec.getValue({
                        fieldId: EMPLOYEE_FIELDS.salesAssignedToday
                    }), 10) || 0;

                    if (_oldCount > 0) {
                        _employeeRec.setValue({
                            fieldId: EMPLOYEE_FIELDS.salesAssignedToday,
                            value: _oldCount - 1
                        });

                        _employeeRec.save({
                            enableSourcing: false,
                            ignoreMandatoryFields: true
                        });
                    }
                }

                let _buyers = getEligibleBuyers();

                if (!_buyers || _buyers.length === 0) {
                    log.debug({
                        title: 'assignBuyerToSO - No eligible buyers',
                        details: `No eligible buyers found for Sales Order ${idSalesOrder}`
                    });
                    return null;
                }

                // let _filteredBuyers = applyUrgencyRules(_buyers);
                let _filteredBuyers = _buyers;

                // let _chosenBuyer = pickBuyerByLeastLoad(_filteredBuyers);
                let _chosenBuyer = pickBuyerByOldestLastAssignment(_filteredBuyers);

                if (!_chosenBuyer) {
                    log.debug({
                        title: 'assignBuyerToSO - No chosen buyer',
                        details: `No buyer selected for Sales Order ${idSalesOrder}`
                    });
                    return null;
                }

                updateSOBuyer(idSalesOrder, _chosenBuyer.id);
                updateSOItemBuyerLines(idSalesOrder, _chosenBuyer.id); //Novo código
                // incrementBuyerCounter(_chosenBuyer.id); //parar de controlar a sales order atribuídas.
                updateEmployeeLastSOAssignment(_chosenBuyer.id); //registra o tempo no employee.

                log.debug({
                    title: 'assignBuyerToSO - Buyer assigned',
                    details: `Sales Order ${idSalesOrder} -> Buyer ${_chosenBuyer.id}`
                });

                return _chosenBuyer.id;

            } catch (error) {
                log.error({
                    title: 'assignBuyerToSO - Error processing',
                    details: error
                });
                return null;
            }
        }

        function getEligibleBuyers() {
            try {
                let _now = new Date();
                let _nowMinutes = _now.getHours() * 60 + _now.getMinutes();

                let _buyers = [];

                let _employeeSearch = search.create({
                    type: search.Type.EMPLOYEE,
                    filters: [
                        [EMPLOYEE_FIELDS.buyerFlag, 'is', 'T'],
                        'AND',
                        [EMPLOYEE_FIELDS.onLeave, 'is', 'F'],
                        'AND',
                        ['isinactive', 'is', 'F']
                    ],
                    columns: [
                        'internalid',
                        'entityid',
                        EMPLOYEE_FIELDS.salesAssignedToday,
                        EMPLOYEE_FIELDS.shiftStart,
                        EMPLOYEE_FIELDS.shiftEnd,
                        EMPLOYEE_FIELDS.lastSOAssignment
                    ]
                });

                _employeeSearch.run().each(function (result) {
                    let _id = result.getValue('internalid');
                    let _name = result.getValue('entityid');
                    let _salesAssignedToday = parseInt(result.getValue(EMPLOYEE_FIELDS.salesAssignedToday), 10) || 0;
                    let _shiftStart = result.getValue(EMPLOYEE_FIELDS.shiftStart) || '';
                    let _shiftEnd = result.getValue(EMPLOYEE_FIELDS.shiftEnd) || '';
                    let _lastSOAssignment = result.getValue(EMPLOYEE_FIELDS.lastSOAssignment) || '';

                    let _startMin = parseTimeToMinutes(_shiftStart);
                    let _endMin = parseTimeToMinutes(_shiftEnd);

                    let _inShift = true;

                    if (_startMin !== null && _endMin !== null) {
                        _inShift = isNowInShift(_nowMinutes, _startMin, _endMin);
                    }

                    if (_inShift) {
                        _buyers.push({
                            id: _id,
                            name: _name,
                            salesAssignedToday: _salesAssignedToday,
                            lastSOAssignment: _lastSOAssignment,
                            shiftStartMin: _startMin,
                            shiftEndMin: _endMin
                        });
                    }

                    return true;
                });

                log.debug({
                    title: 'getEligibleBuyers - Eligible buyers',
                    details: _buyers
                });

                return _buyers;

            } catch (error) {
                log.error({
                    title: 'getEligibleBuyers - Error processing',
                    details: error
                });
                return [];
            }
        }

        function applyUrgencyRules(buyers) {
            try {
                let _filtered = [];
                let _blockedCount = 0;

                for (let i = 0; i < buyers.length; i++) {
                    let _buyer = buyers[i];

                    let _blockedByUrgency = isBuyerBlockedByUrgency(_buyer.id);
                    let _blockedByOnHoldSO = isBuyerBlockedByOnHoldSO(_buyer.id);

                    let _blocked = _blockedByUrgency || _blockedByOnHoldSO;

                    log.debug({
                        title: 'applyUrgencyRules - buyer block check',
                        details: {
                            buyerId: _buyer.id,
                            blockedByUrgency: _blockedByUrgency,
                            blockedByOnHoldSO: _blockedByOnHoldSO,
                            finalBlocked: _blocked
                        }
                    });

                    if (_blocked) {
                        _blockedCount++;
                    } else {
                        _filtered.push(_buyer);
                    }
                }

                if (_blockedCount === buyers.length) {
                    return buyers;
                }

                return _filtered;

            } catch (error) {
                log.error({
                    title: 'applyUrgencyRules - Error processing',
                    details: error
                });
                return buyers || [];
            }
        }

        function isBuyerBlockedByUrgency(employeeId) {
            try {
                let _prSearch = search.create({
                    type: 'purchaserequisition',
                    filters: [
                        ['type', 'anyof', 'PurchReq'],
                        'AND',
                        ['mainline', 'is', 'T'],
                        'AND',
                        ['custbody_aae_urgency_order', 'anyof', '2'],
                        'AND',
                        ['custbody_aae_buyer', 'anyof', employeeId],
                        'AND',
                        ['status', 'anyof', 'PurchReq:B']
                    ],
                    columns: [
                        'internalid',
                        'status'
                    ]
                });

                let _hasUrgentWithoutPO = false;
                let _paged = _prSearch.runPaged({ pageSize: 100 });

                outer:
                for (let p = 0; p < _paged.pageRanges.length; p++) {
                    let _page = _paged.fetch({ index: p });
                    let _dataArr = _page.data;

                    for (let r = 0; r < _dataArr.length; r++) {
                        let _prId = _dataArr[r].getValue('internalid');

                        let _poSearch = search.create({
                            type: search.Type.PURCHASE_ORDER,
                            filters: [
                                ['createdfrom', 'anyof', _prId],
                                'AND',
                                ['mainline', 'is', 'T']
                            ],
                            columns: ['internalid']
                        });

                        let _poPaged = _poSearch.runPaged({ pageSize: 1 });

                        if (_poPaged.count === 0) {
                            _hasUrgentWithoutPO = true;
                            break outer;
                        }
                    }
                }

                return _hasUrgentWithoutPO;

            } catch (error) {
                log.error({
                    title: 'isBuyerBlockedByUrgency - Error processing',
                    details: error
                });
                return false;
            }
        }

        function isBuyerBlockedByOnHoldSO(employeeId) {
            try {
                let _soSearch = search.create({
                    type: search.Type.SALES_ORDER,
                    filters: [
                        ['custbody_pd_sales_orderstatus', 'anyof', SALES_ORDER_STATUS.onHold],
                        'AND',
                        ['custbody_aae_buyer', 'anyof', employeeId],
                        'AND',
                        ['mainline', 'is', 'T']
                    ],
                    columns: ['internalid']
                });

                let _paged = _soSearch.runPaged({ pageSize: 1 });
                let _blocked = (_paged.count > 0);

                log.debug({
                    title: 'isBuyerBlockedByOnHoldSO',
                    details: {
                        employeeId: employeeId,
                        blockedByOnHoldSO: _blocked
                    }
                });

                return _blocked;

            } catch (error) {
                log.error({
                    title: 'isBuyerBlockedByOnHoldSO - Error processing',
                    details: error
                });
                return false;
            }
        }

        function pickBuyerByLeastLoad(buyers) {
            try {
                if (!buyers || buyers.length === 0) {
                    return null;
                }

                let _min = Number.MAX_SAFE_INTEGER;

                buyers.forEach(function (buyer) {
                    if (buyer.salesAssignedToday < _min) {
                        _min = buyer.salesAssignedToday;
                    }
                });

                let _candidates = buyers.filter(function (buyer) {
                    return buyer.salesAssignedToday === _min;
                });

                let _idx = Math.floor(Math.random() * _candidates.length);

                log.debug({
                    title: 'pickBuyerByLeastLoad - chosen candidate',
                    details: _candidates[_idx]
                });

                return _candidates[_idx];

            } catch (error) {
                log.error({
                    title: 'pickBuyerByLeastLoad - Error processing',
                    details: error
                });
                return null;
            }
        }

        function incrementBuyerCounter(employeeId) {
            try {
                let _employeeLookup = search.lookupFields({
                    type: search.Type.EMPLOYEE,
                    id: employeeId,
                    columns: [EMPLOYEE_FIELDS.salesAssignedToday]
                });

                let _currentAssignedCount = 0;

                if (_employeeLookup && _employeeLookup[EMPLOYEE_FIELDS.salesAssignedToday] != null) {
                    let _rawAssignedValue = _employeeLookup[EMPLOYEE_FIELDS.salesAssignedToday];

                    if (Array.isArray(_rawAssignedValue)) {
                        _rawAssignedValue = _rawAssignedValue[0];
                    }

                    _currentAssignedCount = parseInt(_rawAssignedValue, 10) || 0;
                }

                let _updatedAssignedCount = _currentAssignedCount + 1;

                record.submitFields({
                    type: record.Type.EMPLOYEE,
                    id: employeeId,
                    values: {
                        custentity_pd_pow_sales_assigned_today: _updatedAssignedCount
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });

                log.debug({
                    title: 'incrementBuyerCounter - Counter updated',
                    details: {
                        employeeId: employeeId,
                        previousValue: _currentAssignedCount,
                        updatedValue: _updatedAssignedCount
                    }
                });

            } catch (error) {
                log.error({
                    title: 'incrementBuyerCounter - Error processing',
                    details: error
                });
            }
        }

        function updateSOBuyer(idSalesOrder, idBuyer) {
            try {
                record.submitFields({
                    type: TYPE,
                    id: idSalesOrder,
                    values: {
                        custbody_aae_buyer: idBuyer
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });

                log.debug({
                    title: 'updateSOBuyer - Buyer updated',
                    details: {
                        salesOrderId: idSalesOrder,
                        buyerId: idBuyer
                    }
                });

            } catch (error) {
                log.error({
                    title: 'updateSOBuyer - Error processing',
                    details: error
                });
                throw error;
            }
        }

        function parseTimeToMinutes(timeString) {
            try {
                if (!timeString) return null;

                let _cleanTime = ('' + timeString).trim();
                let _meridian = null;

                if (_cleanTime.toUpperCase().includes('AM') || _cleanTime.toUpperCase().includes('PM')) {
                    _meridian = _cleanTime.toUpperCase().includes('PM') ? 'PM' : 'AM';
                    _cleanTime = _cleanTime.replace(/AM|PM/i, '').trim();
                }

                let _timeParts = _cleanTime.split(':');
                let _hours = parseInt(_timeParts[0], 10) || 0;
                let _minutes = parseInt(_timeParts[1], 10) || 0;

                if (_meridian) {
                    if (_meridian === 'PM' && _hours < 12) _hours += 12;
                    if (_meridian === 'AM' && _hours === 12) _hours = 0;
                }

                return _hours * 60 + _minutes;

            } catch (error) {
                log.error({
                    title: 'parseTimeToMinutes - Error processing',
                    details: error
                });
                return null;
            }
        }

        function isNowInShift(nowMin, startMin, endMin) {
            try {
                if (startMin === null || endMin === null) {
                    return true;
                }

                if (startMin <= endMin) {
                    return nowMin >= startMin && nowMin <= endMin;
                } else {
                    return nowMin >= startMin || nowMin <= endMin;
                }

            } catch (error) {
                log.error({
                    title: 'isNowInShift - Error processing',
                    details: error
                });
                return false;
            }
        }

        function shouldSkipBuyerAssignment(salesOrderId) {
            try {
                if (!salesOrderId) return false;

                let _salesOrderRec = record.load({
                    type: record.Type.SALES_ORDER,
                    id: salesOrderId,
                    isDynamic: false
                });

                let _lineCount = _salesOrderRec.getLineCount({
                    sublistId: 'item'
                });

                if (!_lineCount || _lineCount === 0) {
                    return false;
                }

                for (let i = 0; i < _lineCount; i++) {
                    let _flag = _salesOrderRec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pd_cso_dont_create_purchreq',
                        line: i
                    });

                    if (_flag !== true && _flag !== 'T') {
                        return false;
                    }
                }

                return true;

            } catch (error) {
                log.error({
                    title: 'shouldSkipBuyerAssignment - Error processing',
                    details: error
                });
                return false;
            }
        }

        function updateSOItemBuyerLines(idSalesOrder, idBuyer) {
            try {

                if (!idSalesOrder || !idBuyer) {
                    return;
                }

                let _salesOrderRec = record.load({
                    type: record.Type.SALES_ORDER,
                    id: idSalesOrder,
                    isDynamic: false
                });

                let _lineCount = _salesOrderRec.getLineCount({
                    sublistId: 'item'
                });

                if (!_lineCount || _lineCount === 0) {
                    return;
                }

                for (let i = 0; i < _lineCount; i++) {

                    _salesOrderRec.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pd_buyer_purchorder_initial',
                        line: i,
                        value: idBuyer
                    });
                }

                _salesOrderRec.save({
                    enableSourcing: false,
                    ignoreMandatoryFields: true
                });

                log.debug({
                    title: 'updateSOItemBuyerLines - Buyer configurado nas linhas',
                    details: {
                        salesOrderId: idSalesOrder,
                        buyerId: idBuyer,
                        linesUpdated: _lineCount
                    }
                });

            } catch (error) {

                log.error({
                    title: 'updateSOItemBuyerLines - Error processing',
                    details: error
                });
            }
        }

        function updateEmployeeLastSOAssignment(employeeId) {
            try {
                if (!employeeId) {
                    return;
                }

                record.submitFields({
                    type: record.Type.EMPLOYEE,
                    id: employeeId,
                    values: {
                        custentity_pd_last_so_assignment: new Date()
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });

                log.debug({
                    title: 'updateEmployeeLastSOAssignment - Timestamp atualizado',
                    details: {
                        employeeId: employeeId,
                        lastAssignment: new Date()
                    }
                });

            } catch (error) {
                log.error({
                    title: 'updateEmployeeLastSOAssignment - Error processing',
                    details: error
                });
            }
        }

        function pickBuyerByOldestLastAssignment(buyers) {
            try {

                if (!buyers || buyers.length === 0) {
                    return null;
                }

                let _buyersSorted = buyers.slice().sort(function (a, b) {

                    // Buyer sem data recebe prioridade
                    if (!a.lastSOAssignment && !b.lastSOAssignment) {
                        return 0;
                    }

                    if (!a.lastSOAssignment) {
                        return -1;
                    }

                    if (!b.lastSOAssignment) {
                        return 1;
                    }

                    let _timeA = new Date(a.lastSOAssignment).getTime();
                    let _timeB = new Date(b.lastSOAssignment).getTime();

                    return _timeA - _timeB;
                });

                // Identifica o menor timestamp
                let _oldestTime = _buyersSorted[0].lastSOAssignment
                    ? new Date(_buyersSorted[0].lastSOAssignment).getTime()
                    : null;

                // Buyers empatados
                let _candidates = _buyersSorted.filter(function (buyer) {

                    if (!_oldestTime && !buyer.lastSOAssignment) {
                        return true;
                    }

                    return buyer.lastSOAssignment &&
                        new Date(buyer.lastSOAssignment).getTime() === _oldestTime;
                });

                // Sorteio em caso de empate
                let _idx = Math.floor(Math.random() * _candidates.length);

                log.debug({
                    title: 'pickBuyerByOldestLastAssignment - chosen candidate',
                    details: _candidates[_idx]
                });

                return _candidates[_idx];

            } catch (error) {

                log.error({
                    title: 'pickBuyerByOldestLastAssignment - Error processing',
                    details: error
                });

                return null;
            }
        }

        return {
            readData: readData,
            assignBuyerToSO: assignBuyerToSO,
            getEligibleBuyers: getEligibleBuyers,
            applyUrgencyRules: applyUrgencyRules,
            pickBuyerByLeastLoad: pickBuyerByLeastLoad,
            incrementBuyerCounter: incrementBuyerCounter,
            updateSOBuyer: updateSOBuyer,
            updateSOItemBuyerLines: updateSOItemBuyerLines,
            updateEmployeeLastSOAssignment: updateEmployeeLastSOAssignment,
            pickBuyerByOldestLastAssignment: pickBuyerByOldestLastAssignment
        };
    }
);