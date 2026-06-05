/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @Author Filipe Carvalho - SuiteCode
 */
define([
    'N/log',
    '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-suitelet.util'
], function (log, suitelet_util) {

    function onRequest(context) {
        return suitelet_util.build({
            context: context,
            title: 'Report for Creating Commission Invoice',
            statics: {
                html: ['pd-commission-invoice-payment-screen.html'],
                js: ['pd-commission-invoice-payment-screen.js']
            }
        });
    }

    return {
        onRequest: onRequest
    };
});