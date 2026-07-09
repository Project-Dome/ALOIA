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
        'N/format',
        'N/runtime',
        'N/query',

        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-search.util.js',
        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-record.util.js',

        '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js'
    ],

    function (
        log,
        record,
        search,
        format,
        runtime,
        query,

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
            lastSOAssignment: 'custentity_pd_last_so_assignment',
            timezone: 'custentity_pd_pow_timezone'

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

        function assignBuyerToSO(idSalesOrder) {
            try {

                let _buyers = getEligibleBuyers();

                if (!_buyers || _buyers.length === 0) {
                    log.debug({
                        title: 'assignBuyerToSO - No eligible buyers',
                        details: `No eligible buyers found for Sales Order ${idSalesOrder}`
                    });
                    return null;
                }

                let _filteredBuyers = applyUrgencyRules(_buyers);

                assignBuyerToLine(idSalesOrder, _filteredBuyers);

                log.debug({
                    title: 'assignBuyerToSO - Distribution complete',
                    details: `Sales Order ${idSalesOrder} - lines distributed`
                });

                return true;

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
                        EMPLOYEE_FIELDS.lastSOAssignment,
                        EMPLOYEE_FIELDS.timezone
                    ]
                });

                let _allBuyers = [];
                let _timezoneMap = getTimezoneOlsonMap();

                _employeeSearch.run().each(function (result) {
                    let _id = result.getValue('internalid');
                    let _name = result.getValue('entityid');
                    let _salesAssignedToday = parseInt(result.getValue(EMPLOYEE_FIELDS.salesAssignedToday), 10) || 0;
                    let _shiftStart = result.getValue(EMPLOYEE_FIELDS.shiftStart) || '';
                    let _shiftEnd = result.getValue(EMPLOYEE_FIELDS.shiftEnd) || '';
                    let _lastSOAssignmentRaw = result.getValue(EMPLOYEE_FIELDS.lastSOAssignment) || '';
                    let _lastSOAssignment = '';
                    if (_lastSOAssignmentRaw) {
                        try {
                            let _parsed = format.parse({ value: _lastSOAssignmentRaw, type: format.Type.DATETIMETZ });
                            _lastSOAssignment = (_parsed instanceof Date) ? _parsed.toISOString() : '';
                        } catch (e) {
                            _lastSOAssignment = '';
                        }
                    }

                    let _startMin = parseTimeToMinutes(_shiftStart);
                    let _endMin = parseTimeToMinutes(_shiftEnd);
                    let _timezoneKey = parseInt(result.getValue(EMPLOYEE_FIELDS.timezone), 10) || null;

                    if (!_timezoneKey) {
                        _timezoneKey = parseInt(runtime.getCurrentUser().getPreference({ name: 'TIMEZONE' }), 10) || null;
                    }

                    let _timezoneId = _timezoneKey ? (_timezoneMap[_timezoneKey] || null) : null;

                    _allBuyers.push({
                        id: _id,
                        name: _name,
                        salesAssignedToday: _salesAssignedToday,
                        lastSOAssignment: _lastSOAssignment,
                        shiftStartMin: _startMin,
                        shiftEndMin: _endMin,
                        timezoneId: _timezoneId
                    });

                    return true;
                });

                let _buyersInShift = _allBuyers.filter(function (b) {
                    if (b.shiftStartMin === null || b.shiftEndMin === null) return true;
                    let _nowMin = getNowMinutesInTimezone(b.timezoneId);
                    return isNowInShift(_nowMin, b.shiftStartMin, b.shiftEndMin);
                });

                let _buyers = _buyersInShift;

                log.debug({
                    title: 'getEligibleBuyers - Eligible buyers',
                    details: {
                        total: _allBuyers.length,
                        inShift: _buyersInShift.length,
                        noBuyersInShift: _buyersInShift.length === 0,
                        buyers: _buyers
                    }
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

        function assignBuyerToLine(idSalesOrder, buyers) {
            try {
                if (!idSalesOrder || !buyers || buyers.length === 0) return;

                let _salesOrderRec = record.load({
                    type: record.Type.SALES_ORDER,
                    id: idSalesOrder,
                    isDynamic: false
                });

                let _lineCount = _salesOrderRec.getLineCount({ sublistId: 'item' });
                if (!_lineCount || _lineCount === 0) return;

                let _buyerPool = buyers.map(function (b) { return Object.assign({}, b); });
                let _assignedBuyerIdsList = [];
                let _nowBase = new Date().getTime();
                let _offset = 0;

                for (let i = 0; i < _lineCount; i++) {

                    let _skipLine = _salesOrderRec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pd_cso_dont_create_purchreq',
                        line: i
                    });

                    if (_skipLine === true || _skipLine === 'T') continue;

                    let _lineStatus = _salesOrderRec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_aae_line_status',
                        line: i
                    });

                    if (_lineStatus && String(_lineStatus) !== '4') continue;

                    let _quantity = _salesOrderRec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'quantity',
                        line: i
                    });

                    if (!_quantity || parseFloat(_quantity) === 0) continue;

                    let _linkedPO = _salesOrderRec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_aae_purchaseorder',
                        line: i
                    });

                    if (_linkedPO) continue;

                    let _existingBuyer = _salesOrderRec.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pd_buyer_purchorder_initial',
                        line: i
                    });

                    if (_existingBuyer) continue;

                    let _chosenBuyer = pickBuyerByOldestLastAssignment(_buyerPool);
                    if (!_chosenBuyer) continue;

                    _salesOrderRec.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pd_buyer_purchorder_initial',
                        line: i,
                        value: _chosenBuyer.id
                    });

                    /**
                     * Analisar se essa lógica realmente esta funcional
                     * Ao pegar dat/hora de um campo do netsuite não usar new Date() para converter o valor para data e hora para o calculo
                     * usar format.parse
                     * Verificar se new Date(_nowBase + _offset).toISOString() realmente esta funcionando e se sim qual a conversão esta trazendo e se o calculo esta correto
                     */
                    
                    let _buyerInPool = _buyerPool.find(function (b) { return b.id === _chosenBuyer.id; });
                    if (_buyerInPool) {
                        let _rawDate = format.format({
                            value: new Date(_nowBase + _offset),
                            type: format.Type.DATETIMETZ
                        });
                        _buyerInPool.lastSOAssignment = format.parse({
                            value: _rawDate,
                            type: format.Type.DATETIMETZ
                        }).toISOString();
                        _buyerInPool.salesAssignedToday = (_buyerInPool.salesAssignedToday || 0) + 1;
                        _offset += 1000;
                    }

                    _assignedBuyerIdsList.push(_chosenBuyer.id);

                    log.debug({
                        title: 'assignBuyerToLine - Line assigned',
                        details: { line: i, buyerId: _chosenBuyer.id }
                    });
                }

                try {
                    _salesOrderRec.save({
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    });
                } catch (saveError) {
                    log.error({
                        title: 'assignBuyerToLine - Save failed',
                        details: {
                            salesOrderId: idSalesOrder,
                            error: saveError.message || saveError
                        }
                    });
                    return;
                }

                // Incrementa compradores após save bem-sucedido
                _assignedBuyerIdsList.forEach(function (buyerId) {
                    incrementBuyerCounter(buyerId);
                });

                let _uniqueBuyerIds = _assignedBuyerIdsList.filter(function (id, idx, arr) {
                    return arr.indexOf(id) === idx;
                });

                _uniqueBuyerIds.forEach(function (buyerId) {
                    let _poolEntry = _buyerPool.find(function (b) { return b.id === buyerId; });
                    let _timestamp = (_poolEntry && _poolEntry.lastSOAssignment) ? new Date(_poolEntry.lastSOAssignment) : new Date();
                    updateEmployeeLastSOAssignment(buyerId, _timestamp);
                });

                log.debug({
                    title: 'assignBuyerToLine - Complete',
                    details: { salesOrderId: idSalesOrder, buyersAssigned: _uniqueBuyerIds }
                });

            } catch (error) {
                log.error({
                    title: 'assignBuyerToLine - Error processing',
                    details: error
                });
            }
        }

        function updateEmployeeLastSOAssignment(employeeId, timestamp) {
            try {
                if (!employeeId) {
                    return;
                }

                let _timestamp = (timestamp instanceof Date) ? timestamp : new Date();

                record.submitFields({
                    type: record.Type.EMPLOYEE,
                    id: employeeId,
                    values: {
                        custentity_pd_last_so_assignment: _timestamp
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
                        lastAssignment: _timestamp
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

                if (!buyers || buyers.length === 0) return null;

                // 1º critério: menor quantidade de SOs atribuídas
                let _minCount = Number.MAX_SAFE_INTEGER;
                buyers.forEach(function (b) {
                    if (b.salesAssignedToday < _minCount) _minCount = b.salesAssignedToday;
                });

                let _byCount = buyers.filter(function (b) {
                    return b.salesAssignedToday === _minCount;
                });

                // 2º critério (desempate): timestamp mais antigo
                let _byCountSorted = _byCount.slice().sort(function (a, b) {
                    if (!a.lastSOAssignment && !b.lastSOAssignment) return 0;
                    if (!a.lastSOAssignment) return -1;
                    if (!b.lastSOAssignment) return 1;
                    return new Date(a.lastSOAssignment).getTime() - new Date(b.lastSOAssignment).getTime();
                });

                let _oldestTime = _byCountSorted[0].lastSOAssignment
                    ? new Date(_byCountSorted[0].lastSOAssignment).getTime()
                    : null;

                let _candidates = _byCountSorted.filter(function (b) {
                    if (!_oldestTime && !b.lastSOAssignment) return true;
                    return b.lastSOAssignment && new Date(b.lastSOAssignment).getTime() === _oldestTime;
                });

                // 3º critério (ainda empatado): sorteio
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

        function handleCreatePODecrement(oldRecord, newRecord) {
            try {
                if (!newRecord) return;

                let _salesOrderId = newRecord.id;
                let _lineCount = newRecord.getLineCount({ sublistId: 'item' });

                if (!_lineCount || _lineCount === 0) return;

                let _linesToProcess = [];

                for (let i = 0; i < _lineCount; i++) {

                    let _linkedPO = newRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_aae_purchaseorder',
                        line: i
                    });

                    if (!_linkedPO) continue;

                    let _processed = newRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pd_pow_po_processed',
                        line: i
                    });

                    if (_processed === true || _processed === 'T') continue;

                    let _buyerId = newRecord.getSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pd_buyer_purchorder_initial',
                        line: i
                    });

                    if (!_buyerId) continue;

                    _linesToProcess.push({ line: i, buyerId: _buyerId });
                }

                if (_linesToProcess.length === 0) return;

                let _salesOrderRec = record.load({
                    type: record.Type.SALES_ORDER,
                    id: _salesOrderId,
                    isDynamic: false
                });

                let _needsSave = false;

                _linesToProcess.forEach(function (item) {
                    decrementBuyerCounter(item.buyerId);

                    _salesOrderRec.setSublistValue({
                        sublistId: 'item',
                        fieldId: 'custcol_pd_pow_po_processed',
                        line: item.line,
                        value: true
                    });

                    _needsSave = true;

                    log.audit({
                        title: 'handleCreatePODecrement - PO Processed',
                        details: { line: item.line, buyerId: item.buyerId }
                    });
                });

                if (_needsSave) {
                    _salesOrderRec.save({
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    });
                }

            } catch (error) {
                log.error({
                    title: 'handleCreatePODecrement - Error processing',
                    details: error
                });
            }
        }

        function resetAllBuyerCounters() {
            try {
                let _employeeSearch = search.create({
                    type: search.Type.EMPLOYEE,
                    filters: [
                        [EMPLOYEE_FIELDS.buyerFlag, 'is', 'T'],
                        'AND',
                        ['isinactive', 'is', 'F']
                    ],
                    columns: ['internalid']
                });

                let _resetCount = 0;

                _employeeSearch.run().each(function (result) {
                    let _id = result.getValue('internalid');

                    record.submitFields({
                        type: record.Type.EMPLOYEE,
                        id: _id,
                        values: {
                            custentity_pd_pow_sales_assigned_today: 0
                        },
                        options: {
                            enableSourcing: false,
                            ignoreMandatoryFields: true
                        }
                    });

                    _resetCount++;
                    return true;
                });

                log.audit({
                    title: 'resetAllBuyerCounters - Complete',
                    details: { buyersReset: _resetCount }
                });

                return _resetCount;

            } catch (error) {
                log.error({
                    title: 'resetAllBuyerCounters - Error processing',
                    details: error
                });
                return 0;
            }
        }

        function decrementBuyerCounter(employeeId) {
            try {
                if (!employeeId) return;

                let _employeeLookup = search.lookupFields({
                    type: search.Type.EMPLOYEE,
                    id: employeeId,
                    columns: [EMPLOYEE_FIELDS.salesAssignedToday]
                });

                let _currentCount = 0;

                if (_employeeLookup && _employeeLookup[EMPLOYEE_FIELDS.salesAssignedToday] != null) {
                    let _raw = _employeeLookup[EMPLOYEE_FIELDS.salesAssignedToday];
                    if (Array.isArray(_raw)) _raw = _raw[0];
                    _currentCount = parseInt(_raw, 10) || 0;
                }

                let _updatedCount = Math.max(0, _currentCount - 1);

                record.submitFields({
                    type: record.Type.EMPLOYEE,
                    id: employeeId,
                    values: {
                        custentity_pd_pow_sales_assigned_today: _updatedCount
                    },
                    options: {
                        enableSourcing: false,
                        ignoreMandatoryFields: true
                    }
                });

                log.debug({
                    title: 'decrementBuyerCounter - Counter updated',
                    details: {
                        employeeId: employeeId,
                        previousValue: _currentCount,
                        updatedValue: _updatedCount
                    }
                });

            } catch (error) {
                log.error({
                    title: 'decrementBuyerCounter - Error processing',
                    details: error
                });
            }
        }

        function getNowMinutesInTimezone(timezoneId) {
            try {
                let _tz = timezoneId
                    ? timezoneId
                    : runtime.getCurrentUser().getPreference({ name: 'TIMEZONE' });

                let _nowFormatted = format.format({
                    value: new Date(),
                    type: format.Type.DATETIME,
                    timezone: _tz
                });

                let _parts = _nowFormatted.split(' ');
                return parseTimeToMinutes(_parts[1] + ' ' + _parts[2]);

            } catch (e) {
                log.error('getNowMinutesInTimezone error', e);
                let _now = new Date();
                return _now.getHours() * 60 + _now.getMinutes();
            }
        }

        function isBuyerBlockedByUrgencyLine(employeeId) {
            try {
                let _soSearch = search.create({
                    type: search.Type.SALES_ORDER,
                    filters: [
                        ['custcol_pd_buyer_purchorder_initial', 'anyof', employeeId],
                        'AND',
                        ['custcol_aae_purchaseorder', 'anyof', '@NONE@'],
                        'AND',
                        ['custcol_pd_cso_dont_create_purchreq', 'is', 'F'],
                        'AND',
                        ['custbody_aae_urgency_order', 'anyof', '2'],
                        'AND',
                        ['mainline', 'is', 'F']
                    ],
                    columns: ['internalid']
                });

                let _paged = _soSearch.runPaged({ pageSize: 1 });
                let _blocked = (_paged.count > 0);

                log.debug('isBuyerBlockedByUrgencyLine', {
                    employeeId: employeeId,
                    blocked: _blocked
                });

                return _blocked;

            } catch (error) {
                log.error('isBuyerBlockedByUrgencyLine - error', error);
                return false;
            }
        }

        function applyUrgencyRules(buyers) {
            try {
                let _filtered = [];
                let _blockedCount = 0;

                for (let i = 0; i < buyers.length; i++) {
                    let _buyer = buyers[i];
                    let _blocked = isBuyerBlockedByUrgencyLine(_buyer.id);

                    log.debug('applyUrgencyRules', {
                        buyerId: _buyer.id,
                        blocked: _blocked
                    });

                    if (_blocked) {
                        _blockedCount++;
                    } else {
                        _filtered.push(_buyer);
                    }
                }

                if (_blockedCount === buyers.length) {
                    log.debug('applyUrgencyRules - todos bloqueados, usando lista completa', {
                        totalBuyers: buyers.length
                    });
                    return buyers;
                }

                return _filtered;

            } catch (error) {
                log.error('applyUrgencyRules - error', error);
                return buyers || [];
            }
        }

        function getTimezoneOlsonMap() {
            try {
                let _results = query.runSuiteQL({
                    query: 'SELECT uniquekey, id FROM timezone'
                }).asMappedResults();

                let _map = {};

                _results.forEach(function (row) {
                    _map[row.uniquekey] = row.id;
                });

                log.debug({
                    title: 'getTimezoneOlsonMap - Mapa montado',
                    details: { total: _results.length }
                });

                return _map;

            } catch (error) {
                log.error({
                    title: 'getTimezoneOlsonMap - Error processing',
                    details: error
                });
                return {};
            }
        }

        return {
            readData: readData,
            assignBuyerToSO: assignBuyerToSO,
            assignBuyerToLine: assignBuyerToLine,
            getEligibleBuyers: getEligibleBuyers,
            pickBuyerByLeastLoad: pickBuyerByLeastLoad,
            incrementBuyerCounter: incrementBuyerCounter,
            updateEmployeeLastSOAssignment: updateEmployeeLastSOAssignment,
            pickBuyerByOldestLastAssignment: pickBuyerByOldestLastAssignment,
            handleCreatePODecrement: handleCreatePODecrement,
            decrementBuyerCounter: decrementBuyerCounter,
            resetAllBuyerCounters: resetAllBuyerCounters
        };
    }
);