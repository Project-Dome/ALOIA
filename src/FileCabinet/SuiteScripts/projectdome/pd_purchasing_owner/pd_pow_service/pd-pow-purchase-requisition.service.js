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
        'N/search',

        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-search.util.js',
        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-record.util.js',

        '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js'
    ],

    function (
        log,
        record,
        runtime,
        search,

        search_util,
        record_util
    ) {

        const TYPE = 'purchaserequisition';

        const FIELDS = {
            internalId: { name: 'internalid' },
            approvalStatus: { name: 'approvalstatus' },
            buyer: { name: 'custbody_aae_buyer' },
            requestor: { name: 'entity' },
            status: { name: 'status' },
            urgencyOrder: { name: 'custbody_aae_urgency_order' },
        };
        // Valor interno do campo {custbody_pd_sales_orderstatus} = ON HOLD
        const SO_STATUS_ON_HOLD = '5';

        function readData(options) {
            try {

                let _requisitionId = options.id;
                log.debug({ title: 'Linha 42 - readData - _requisitionId', details: _requisitionId });

                let _requistionData = record_util
                    .handler(options)
                    .data(
                        {
                            fields: FIELDS,
                            // sublists: {
                            //     itemList: {
                            //         name: ITEM_SUBLIST_ID,
                            //         fields: ITEM_SUBLIST_FIELDS,
                            //     }
                            // }
                        }
                    );

                log.debug({ title: 'Linha 58 - readData - _requistionData', details: _requistionData });

                return _requistionData;

            } catch (error) {
                log.error({ title: 'Linha 63 - readData - error', details: error });
            }

        }

        function assignBuyerToPR(idPurchaseResquistion, options) {
            try {
                const forceRedistribution = options && options.forceRedistribution;

                // 1) Busca buyer atual da PR
                let _prLookup = search.lookupFields({
                    type: TYPE,
                    id: idPurchaseResquistion,
                    columns: ['custbody_aae_buyer', 'custbody_aae_urgency_order']
                });

                let currentBuyer = (_prLookup && _prLookup.custbody_aae_buyer && _prLookup.custbody_aae_buyer.length)
                    ? _prLookup.custbody_aae_buyer[0].value
                    : null;

                // 2) Se já tem buyer
                if (currentBuyer) {
                    // Carregar registro do employee para verificar status "On Leave"
                    let employeeRec = record.load({ type: record.Type.EMPLOYEE, id: currentBuyer });
                    let isOnLeave = employeeRec.getValue({ fieldId: 'custentity_pd_pow_aae_onleave' });

                    if (!forceRedistribution || !isOnLeave) {
                        // Mantém comprador atual, sem redistribuir
                        return currentBuyer;
                    }

                    // Se redistribuir: decrementa contador do buyer atual
                    // let oldCount = parseInt(employeeRec.getValue({ fieldId: 'custentity_pd_pow_prs_assigned_today' })) || 0;
                    // if (oldCount > 0) {
                    //     employeeRec.setValue({
                    //         fieldId: 'custentity_pd_pow_prs_assigned_today',
                    //         value: oldCount - 1
                    //     });
                    //     employeeRec.save({ enableSourcing: false, ignoreMandatoryFields: true });
                    // }
                }

                // 3) Recupera compradores elegíveis
                let _buyers = getEligibleBuyers();
                if (!_buyers || _buyers.length === 0) {
                    return null;
                }

                // 4) Aplica regras de urgência (bloqueio temporário)
                let _filtered = applyUrgencyRules(_buyers);

                // 5) Seleciona buyer com menor carga
                let _chosen = pickBuyerByLeastLoad(_filtered);
                if (!_chosen) {
                    return null;
                }

                // 6) Atualiza PR com novo comprador
                updatePRBuyer(idPurchaseResquistion, _chosen.id);

                // 7) Incrementa contador do novo buyer
                // incrementBuyerCounter(_chosen.id);

                log.debug({
                    title: 'assignBuyerToPR - buyer atribuído/redistribuído',
                    details: `PR ${idPurchaseResquistion} -> Buyer ${_chosen.id}`
                });

                return _chosen.id;

            } catch (error) {
                log.error('assignBuyerToPR - Erro de processamento', error);
                return null;
            }
        }


        /**
        * Bloqueia o funcionário se ele estiver como buyer em alguma LINHA de Sales Order
        * cujo {custbody_pd_sales_orderstatus} = ON HOLD (5).
        * Observação: como o buyer está em campo de linha ({custcol_aae_buyer_purchase_order}),
        * buscamos mainline = F para atingir as linhas.
        */
        function isBuyerBlockedByOnHoldSO(employeeId) {
            try {
                // Busca transações Sales Order por linha
                var soSearch = search.create({
                    type: search.Type.SALES_ORDER,
                    filters: [
                        // Campo de corpo customizado com a lista de status
                        ['custbody_pd_sales_orderstatus', 'anyof', SO_STATUS_ON_HOLD],
                        'AND',
                        // Campo de LINHA que referencia o funcionário-buyer
                        ['custcol_aae_buyer_purchase_order', 'anyof', employeeId],
                        'AND',
                        // Precisamos olhar as linhas (não o cabeçalho)
                        ['mainline', 'is', 'F']
                    ],
                    columns: ['internalid']
                });

                // Basta saber se existe ao menos uma
                var paged = soSearch.runPaged({ pageSize: 1 });
                var blocked = (paged.count > 0);

                log.debug({
                    title: 'isBuyerBlockedByOnHoldSO',
                    details: { employeeId: employeeId, blockedByOnHoldSO: blocked }
                });

                return blocked;
            } catch (error) {
                log.error({
                    title: 'isBuyerBlockedByOnHoldSO - Erro de processamento',
                    details: error
                });
                return false;
            }
        }


        function getEligibleBuyers() {

            try {

                let _now = new Date();
                let _nowMinutes = _now.getHours() * 60 + _now.getMinutes();

                let _buyers = [];

                let employeeSearchObj = search.create({
                    type: search.Type.EMPLOYEE,
                    filters: [
                        ["custentity_pd_pow_buyer", "is", "T"],
                        "AND",
                        ["custentity_pd_pow_aae_onleave", "is", "F"],
                        "AND",
                        ["isinactive", "is", "F"]
                    ],
                    columns: [
                        "internalid",
                        "entityid",
                        "custentity_pd_pow_prs_assigned_today",
                        "custentity_pd_pow_shift_start",
                        "custentity_pd_pow_shift_end"
                    ]
                });

                // Executa a pesquisa diretamente
                employeeSearchObj.run().each(function (result) {
                    let _id = result.getValue("internalid");
                    let _name = result.getValue("entityid");
                    let _prsToday = parseInt(result.getValue("custentity_pd_pow_prs_assigned_today")) || 0;
                    let _shiftStart = result.getValue("custentity_pd_pow_shift_start") || "";
                    let _shiftEnd = result.getValue("custentity_pd_pow_shift_end") || "";

                    // Converte horários para minutos
                    let _startMin = parseTimeToMinutes(_shiftStart);
                    let _endMin = parseTimeToMinutes(_shiftEnd);

                    log.debug({
                        title: 'Linha 169  - getEligibleBuyers - _id e _name',
                        details: `Id do employee: ${_id} - nome do employee: ${_name}`
                    });
                    log.debug({
                        title: 'Linha 173 - getEligibleBuyers -  _prsToday',
                        details: `Quantas requisições atribuídas: ${_prsToday}`
                    });
                    log.debug({
                        title: 'Linha 177 - getEligibleBuyers - _startMin',
                        details: _startMin
                    });
                    log.debug({
                        title: 'Linha 181 - getEligibleBuyers - _endMin',
                        details: _endMin
                    });

                    let _inShift = true;

                    if (_startMin !== null && _endMin !== null) {
                        _inShift = isNowInShift(_nowMinutes, _startMin, _endMin);

                        log.debug({
                            title: 'Linha 191 - getEligibleBuyers - _inShift',
                            details: _inShift
                        });
                    }

                    if (_inShift) {
                        _buyers.push({
                            id: _id,
                            name: _name,
                            prsToday: _prsToday,
                            shiftStartMin: _startMin,
                            shiftEndMin: _endMin
                        });
                    }

                    return true; // continua iterando
                });

                log.debug({
                    title: "getEligibleBuyers - compradores elegíveis",
                    details: _buyers
                });

                return _buyers;

            } catch (error) {

                log.error({
                    title: 'Linha 219- getEligibleBuyers - Erro de processamento ',
                    details: error
                });
            }
        }

        function applyUrgencyRules(buyers) {
            try {
                let _filtered = [];
                let _blockedCount = 0;

                for (let i = 0; i < buyers.length; i++) {
                    let _buyer = buyers[i];

                    // Regra 1 (já existente): urgente sem PO
                    let blockedByUrgency = isBuyerBlockedByUrgency(_buyer.id);

                    // Regra 2 (NOVA): possui SO em ON HOLD onde ele é o buyer na linha
                    let blockedByOnHoldSO = isBuyerBlockedByOnHoldSO(_buyer.id);

                    let blocked = blockedByUrgency || blockedByOnHoldSO;

                    log.debug({
                        title: 'applyUrgencyRules - buyer block check',
                        details: {
                            buyerId: _buyer.id,
                            blockedByUrgency: blockedByUrgency,
                            blockedByOnHoldSO: blockedByOnHoldSO,
                            finalBlocked: blocked
                        }
                    });

                    if (blocked) {
                        _blockedCount++;
                    } else {
                        _filtered.push(_buyer);
                    }
                }

                // Se todos ficarem bloqueados, devolve a lista original para não paralisar o fluxo
                if (_blockedCount === buyers.length) {
                    return buyers;
                }

                log.debug({
                    title: 'applyUrgencyRules - compradores filtrados',
                    details: _filtered
                });

                return _filtered;
            } catch (error) {
                log.error({
                    title: 'applyUrgencyRules - Erro de processamento',
                    details: error
                });
            }
        }

        function isBuyerBlockedByUrgency(employeeId) {

            try {

                let _prSearch = search.create({
                    type: TYPE,
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
                                'AND', ['mainline', 'is', 'T']
                            ],
                            columns: ['internalid']
                        });

                        let _poPaged = _poSearch.runPaged({ pageSize: 1 });

                        if (_poPaged.count === 0) {

                            _hasUrgentWithoutPO = true;
                            break outer;
                        } else {
                            continue;
                        }
                    }
                }

                log.debug({
                    title: 'Linha 296 - isBuyerBlockedByUrgency - compradores filtrados ',
                    details: _hasUrgentWithoutPO
                })

                return _hasUrgentWithoutPO;

            } catch (error) {

                log.error({
                    title: 'Linha 305 - isBuyerBlockedByUrgency - Erro de processamento ',
                    details: error
                });
            }

        }

        function pickBuyerByLeastLoad(buyers) {

            try {

                if (!buyers || buyers.length === 0) {

                    return null;
                }

                let _min = Number.MAX_SAFE_INTEGER;

                buyers.forEach(function (buyer) {

                    if (buyer.prsToday < _min) _min = buyer.prsToday;
                });

                let _candidates = buyers.filter(function (buyer) {
                    return buyer.prsToday === _min;
                });

                let _idx = Math.floor(Math.random() * _candidates.length);

                log.debug({
                    title: 'Linha 333 - pickBuyerByLeastLoad - _candidates[_idx]',
                    details: _candidates[_idx]
                })

                return _candidates[_idx];

            } catch (error) {

                log.error({
                    title: 'Linha 342 - pickBuyerByLeastLoad - Erro de processamento ',
                    details: error
                });
            }

        }

        function incrementBuyerCounter(employeeId) {
            try {

                // Busca o campo de PRs atribuídas hoje no registro do funcionário
                let _employeeLookup = search.lookupFields({
                    type: search.Type.EMPLOYEE,
                    id: employeeId,
                    columns: ['custentity_pd_pow_prs_assigned_today']
                });

                let _currentAssignedCount = 0;

                if (_employeeLookup && _employeeLookup.custentity_pd_pow_prs_assigned_today) {

                    let _rawAssignedValue = _employeeLookup.custentity_pd_pow_prs_assigned_today;

                    // Caso o retorno seja um array (dependendo do tipo do campo)
                    if (Array.isArray(_rawAssignedValue)) {

                        _rawAssignedValue = _rawAssignedValue[0];
                    }

                    _currentAssignedCount = parseInt(_rawAssignedValue, 10) || 0;
                }

                let _updatedAssignedCount = _currentAssignedCount + 1;

                // Atualiza o campo no registro do funcionário
                record.submitFields({
                    type: record.Type.EMPLOYEE,
                    id: employeeId,
                    values: { custentity_pd_pow_prs_assigned_today: _updatedAssignedCount },
                    options: { enableSourcing: false, ignoreMandatoryFields: true }
                });

                log.debug({
                    title: 'Linha 387 - incrementBuyerCounter - lookup result',
                    details: _employeeLookup
                });

            } catch (error) {

                log.error({
                    title: 'Linha 394 - incrementBuyerCounter - Erro de processamento',
                    details: error
                });
            }
        }

        function updatePRBuyer(idPurchaseRequisition, idBuyer) {
            try {

                record.submitFields({
                    type: TYPE,
                    id: idPurchaseRequisition,
                    values: { custbody_aae_buyer: idBuyer },
                    options: { enableSourcing: false, ignoreMandatoryFields: true }
                });

            } catch (error) {

                log.error({
                    title: 'Linha 413 - updatePRBuyer - Erro de processamento',
                    details: error
                });
                throw error;
            }
        }

        function parseTimeToMinutes(timeString) {

            try {

                if (!timeString) return null;

                // Converte para string e remove espaços extras
                let _cleanTime = ('' + timeString).trim();

                // Variável para armazenar AM ou PM, caso exista
                let _meridian = null;

                // Verifica se contém AM ou PM
                if (_cleanTime.toUpperCase().includes('AM') || _cleanTime.toUpperCase().includes('PM')) {
                    _meridian = _cleanTime.toUpperCase().includes('PM') ? 'PM' : 'AM';
                    _cleanTime = _cleanTime.replace(/AM|PM/i, '').trim();
                }

                // Quebra em partes (ex: "10:30" → ["10", "30"])
                let _timeParts = _cleanTime.split(':');

                // Converte hora e minuto para números
                let _hours = parseInt(_timeParts[0], 10) || 0;
                let _minutes = parseInt(_timeParts[1], 10) || 0;

                // Ajusta para formato 24h caso tenha AM/PM
                if (_meridian) {

                    if (_meridian === 'PM' && _hours < 12) _hours += 12;  // 1PM → 13h
                    if (_meridian === 'AM' && _hours === 12) _hours = 0;  // 12AM → 00h
                }

                // Retorna o total de minutos desde 00:00
                return _hours * 60 + _minutes;

            } catch (error) {
                log.error({
                    title: 'Linha 457 - parseTimeToMinutes - Erro de processamento',
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
                    title: 'Linha 480 - parseTimeToMinutes - Erro de processamento',
                    details: error
                });
            }
        }


        return {
            readData: readData,
            assignBuyerToPR: assignBuyerToPR,
            getEligibleBuyers: getEligibleBuyers,
            applyUrgencyRules: applyUrgencyRules,
            pickBuyerByLeastLoad: pickBuyerByLeastLoad,
            incrementBuyerCounter: incrementBuyerCounter,
            updatePRBuyer: updatePRBuyer
        }
    })