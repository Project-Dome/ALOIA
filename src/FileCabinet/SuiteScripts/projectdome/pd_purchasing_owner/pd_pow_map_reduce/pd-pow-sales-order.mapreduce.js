/**
 * @NApiVersion 2.1
 * @NScriptType MapReduceScript
 * @author Project Dome - Rogério Gonçalves Rodrigues
 */

define([
    'N/search',
    'N/log',
    '../pd_pow_service/pd-pow-sales-order.service'
], function (
    search,
    log,
    sales_order_service
) {

    function getInputData() {
        try {
            return search.create({
                type: search.Type.SALES_ORDER,
                filters: [
                    [
                        ['custbody_aae_buyer', 'noneof', '@NONE@'], //^ sem buyer
                        'OR',
                        ['custbody_aae_buyer.custentity_pd_pow_aae_onleave', 'is', 'F'] //^ buyer em afastamento
                    ],
                    'AND',
                    ['mainline', 'is', 'T']
                ],
                columns: [
                    'internalid',
                    'tranid'
                ]
            });

        } catch (error) {
            log.error({
                title: 'getInputData - error',
                details: error
            });
        }
    }


    function map(context) {
        try {
            const result = JSON.parse(context.value);
            const soId = result.id;

            const buyerId = sales_order_service.assignBuyerToSO(soId, {
                forceRedistribution: true
            });

            if (buyerId) {
                log.debug('SO atribuída', {
                    soId: soId,
                    buyerId: buyerId
                });
            } else {
                log.debug('SO não atribuída', {
                    soId: soId,
                    reason: 'sem candidatos ou bloqueado'
                });
            }

        } catch (error) {
            log.error({
                title: 'map - error',
                details: error
            });
        }
    }


    function summarize(summary) {
        try {
            log.audit('MR finalizado', {
                usage: summary.usage,
                yields: summary.yields,
                concurrency: summary.concurrency
            });

            if (summary.inputSummary && summary.inputSummary.error) {
                log.error('Erro no input', summary.inputSummary.error);
            }

            if (summary.mapSummary && summary.mapSummary.errors) {
                summary.mapSummary.errors.iterator().each(function (key, e) {
                    log.error('Erro no Map', 'Key: ' + key + ' | Error: ' + e);
                    return true;
                });
            }

        } catch (error) {
            log.error({
                title: 'summarize - error',
                details: error
            });
        }
    }

    return {
        getInputData: getInputData,
        map: map,
        summarize: summarize
    };
});