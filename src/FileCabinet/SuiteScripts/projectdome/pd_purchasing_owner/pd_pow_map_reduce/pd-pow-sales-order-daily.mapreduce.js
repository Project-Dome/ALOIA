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
            let _resetCount = sales_order_service.resetAllBuyerCounters();

            log.audit({
                title: 'getInputData - Contadores zerados',
                details: { buyersReset: _resetCount }
            });

            let _soSearch = search.create({
                type: search.Type.SALES_ORDER,
                filters: [
                    ['custcol_aae_purchaseorder', 'anyof', '@NONE@'],
                    'AND',
                    ['custcol_pd_cso_dont_create_purchreq', 'is', 'F']
                ],
                columns: [
                    'internalid',
                    'tranid'
                ]
            });

            let _soMap = {};
            let _soList = [];

            let _paged = _soSearch.runPaged({ pageSize: 1000 });

            for (let p = 0; p < _paged.pageRanges.length; p++) {
                let _page = _paged.fetch({ index: p });
                _page.data.forEach(function (result) {
                    let _id = result.getValue('internalid');
                    if (!_soMap[_id]) {
                        _soMap[_id] = true;
                        _soList.push({ id: _id, tranid: result.getValue('tranid') });
                    }
                });
            }

            log.debug({
                title: 'getInputData - SOs encontradas para distribuição',
                details: { count: _soList.length }
            });

            return _soList;

        } catch (error) {
            log.error({
                title: 'getInputData - error',
                details: error
            });
            return [];
        }
    }


    function map(context) {
        try {
            const result = JSON.parse(context.value);
            const soId = result.id;

            const success = sales_order_service.assignBuyerToSO(soId);

            log.debug({
                title: success ? 'map - SO distribuída' : 'map - SO não distribuída',
                details: { soId: soId, tranid: result.tranid }
            });

        } catch (error) {
            log.error({
                title: 'map - error',
                details: error
            });
        }
    }


    function summarize(summary) {
        try {
            log.audit('MR Diário finalizado', {
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
