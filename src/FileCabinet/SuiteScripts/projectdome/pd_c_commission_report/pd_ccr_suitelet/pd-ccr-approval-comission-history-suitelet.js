/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * Author: Breno Godoy
 */
define([
    'N/record', 'N/log', 'N/render', 'N/format', 'N/file', 'N/runtime', 'N/search',
    '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-suitelet.util',
    '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js'
], function (record, log, render, format, file, runtime, search, suitelet_util) {

    function onRequest(context) {
        return suitelet_util.build({
            context: context,
            title: 'Relatórios de Relacionamento',
            statics: {
                html: ['pd-ccr-approval-comission-history.html'],
                js: ['pd-ccr-approval-comission-history.js']
            }
        });
    }

    return {
        onRequest: onRequest,
    };
});
