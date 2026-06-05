/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @author
 *  Project Dome / SuiteCode
 *
 * Este MR faz duas coisas:
 *  1) RECONCILIA o contador {custentity_pd_pow_prs_assigned_today} de TODOS os compradores elegíveis.
 *  2) (Re)atribui PRs sem buyer ou com buyer "On Leave", via service.assignBuyerToPR(...).
 *
 * Observação sobre o contador:
 *  - COUNTER_MODE = 'OPEN'  -> conta PRs atribuídas ao comprador que estejam "em aberto" (filtro de status é opcional, veja TODO).
 *  - COUNTER_MODE = 'TODAY' -> conta PRs atribuídas ao comprador com trandate = HOJE.
 *  Recomendo 'OPEN' para balancear a carga corrente.
 */

define(['N/search', 'N/log', 'N/record', '../pd_pow_service/pd-pow-purchase-requisition.service'],
    function (search, log, record, purchase_requisition_service) {

        // =============================
        // Configurações
        // =============================
        const COUNTER_MODE = 'OPEN'; // 'OPEN' | 'TODAY'

        // Se quiser excluir status "fechados" no modo OPEN, ajuste aqui os IDs internos:
        // (Ex.: 'PurchReq:B' etc. Use os seus IDs internos reais. Se não souber, deixe vazio que conta todas.)
        const CLOSED_PR_STATUS_IDS = []; // exemplo: ['PurchReq:C','PurchReq:D']

        // =============================
        // getInputData
        // =============================
        function getInputData() {
            try {
                const items = [];

                // A) Enfileira TODOS os compradores elegíveis para reconciliar o contador
                queryEligibleBuyers().forEach(function (emp) {
                    items.push({ kind: 'EMP', employeeId: emp.id, name: emp.name });
                });

                // B) Enfileira PRs alvo para (re)atribuição
                queryTargetPRs().forEach(function (pr) {
                    items.push({ kind: 'PR', prId: pr.id, tranid: pr.tranid, buyer: pr.buyer });
                });

                log.audit('getInputData', {
                    totalEmployeesForRecount: items.filter(i => i.kind === 'EMP').length,
                    totalPRsForAssignment: items.filter(i => i.kind === 'PR').length
                });

                return items;
            } catch (error) {
                log.error({ title: 'Error getInputData', details: error });
            }
        }

        // =============================
        // map
        // =============================
        function map(context) {
            try {
                const item = JSON.parse(context.value);

                if (item.kind === 'EMP') {
                    // 1) Recalcula e atualiza o contador do funcionário
                    const empId = item.employeeId;
                    const newCount = recountEmployeePRs(empId);

                    if (newCount != null) {
                        // Atualiza o campo {custentity_pd_pow_prs_assigned_today}
                        try {
                            record.submitFields({
                                type: record.Type.EMPLOYEE,
                                id: empId,
                                values: { custentity_pd_pow_prs_assigned_today: newCount },
                                options: { enableSourcing: false, ignoreMandatoryFields: true }
                            });

                            log.debug('Recount OK', {
                                employeeId: empId,
                                employeeName: item.name,
                                counterMode: COUNTER_MODE,
                                newCount
                            });
                        } catch (e) {
                            log.error('Recount submitFields error', { employeeId: empId, error: e });
                        }
                    } else {
                        log.error('Recount failed', {
                            employeeId: empId,
                            employeeName: item.name
                        });
                    }

                    return; // fim do ramo EMP
                }

                if (item.kind === 'PR') {
                    // 2) (Re)atribui PR
                    const prId = item.prId;
                   
                    // TODO: SUSPENSA REDISTRIBUIÇÃO FINAL DO EXPEDIENTE
                    // const result = purchase_requisition_service.assignBuyerToPR(prId, { forceRedistribution: true });

                    // Como o service atual retorna só o buyerId (ou null), lidamos com isso:
                    // if (result) {
                    //     log.debug('Map - PR atribuída', { prId, buyerId: result });
                    // } else {
                    //     log.debug('Map - PR não atribuída', { prId, reason: 'no candidate or blocked' });
                    // }
                    
                    return;
                }

                log.error('Map - item desconhecido', item);

            } catch (error) {
                log.error({ title: 'Error map function', details: error });
            }
        }

        // =============================
        // summarize
        // =============================
        function summarize(summary) {
            try {
                log.audit('Summarize - MR concluído', {
                    dateCreated: summary.dateCreated,
                    seconds: summary.seconds,
                    usage: summary.usage,
                    yields: summary.yields,
                    concurrency: summary.concurrency
                });

                if (summary.inputSummary && summary.inputSummary.error) {
                    log.error('Summarize - erro em getInputData', summary.inputSummary.error);
                }

                if (summary.mapSummary && summary.mapSummary.errors) {
                    summary.mapSummary.errors.iterator().each(function (key, e) {
                        log.error('Summarize - erro no Map', 'Key: ' + key + ' | Error: ' + e);
                        return true;
                    });
                }

                if (summary.reduceSummary && summary.reduceSummary.errors) {
                    summary.reduceSummary.errors.iterator().each(function (key, e) {
                        log.error('Summarize - erro no Reduce', 'Key: ' + key + ' | Error: ' + e);
                        return true;
                    });
                }
            } catch (error) {
                log.error({ title: 'Error summarize function', details: error });
            }
        }

        // =============================
        // Queries auxiliares
        // =============================

        function queryEligibleBuyers() {
            const list = [];
            try {
                const s = search.create({
                    type: search.Type.EMPLOYEE,
                    filters: [
                        ['custentity_pd_pow_buyer', 'is', 'T'],
                        'AND', ['custentity_pd_pow_aae_onleave', 'is', 'F'],
                        'AND', ['isinactive', 'is', 'F']
                    ],
                    columns: [
                        'internalid',
                        'entityid'
                    ]
                });

                s.run().each(function (r) {
                    list.push({
                        id: r.getValue('internalid'),
                        name: r.getValue('entityid')
                    });
                    return true;
                });
            } catch (e) {
                log.error('queryEligibleBuyers error', e);
            }
            return list;
        }

        function queryTargetPRs() {
            const list = [];
            try {
                const s = search.create({
                    type: 'purchaserequisition',
                    filters: [
                        [
                            ['custbody_aae_buyer', 'anyof', '@NONE@'], // sem comprador
                            'OR',
                            ['custbody_aae_buyer.custentity_pd_pow_aae_onleave', 'is', 'T'] // comprador "On Leave"
                        ],
                        'AND', ['mainline', 'is', 'T'],
                        'AND', ['type', 'anyof', 'PurchReq'],
                    ],
                    columns: [
                        search.createColumn({ name: 'internalid' }),
                        search.createColumn({ name: 'tranid' }),
                        search.createColumn({ name: 'custbody_aae_buyer' })
                    ]
                });

                s.run().each(function (r) {
                    list.push({
                        id: r.getValue('internalid'),
                        tranid: r.getValue('tranid'),
                        buyer: r.getValue('custbody_aae_buyer') || null
                    });
                    return true;
                });
            } catch (e) {
                log.error('queryTargetPRs error', e);
            }
            return list;
        }

        // =============================
        // Cálculo do contador por funcionário
        // =============================

        function recountEmployeePRs(employeeId) {
            try {
                var s = search.create({
                    type: 'purchaserequisition',
                    filters: [
                        ['custbody_aae_buyer', 'anyof', employeeId],
                        'AND', ['mainline', 'is', 'T'],
                        'AND', ['type', 'anyof', 'PurchReq']
                    ],
                    columns: [
                        'internalid',
                        'status'
                    ]
                });

                var count = 0;
                s.run().each(function (r) {
                    var statusText = r.getText('status') || '';
                    if (statusText === 'Pending Order') {
                        count++;
                    }
                    return true;
                });

                log.debug('recountEmployeePRs (Pending Order only)', { employeeId: employeeId, count: count });
                return count;
            } catch (e) {
                log.error('recountEmployeePRs error', { employeeId: employeeId, error: e });
                return null;
            }
        }


        // Helper simples p/ datas em searches (MM/DD/YYYY)
        function formatDate(dt) {
            const mm = (dt.getMonth() + 1).toString().padStart(2, '0');
            const dd = dt.getDate().toString().padStart(2, '0');
            const yyyy = dt.getFullYear();
            return mm + '/' + dd + '/' + yyyy;
        }

        return {
            getInputData: getInputData,
            map: map,
            summarize: summarize
        };
    });
