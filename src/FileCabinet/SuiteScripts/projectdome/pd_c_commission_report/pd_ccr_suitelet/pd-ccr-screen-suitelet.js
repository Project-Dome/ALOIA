/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * Author: Lucas Monaco
 */
define([
    'N/record', 'N/log', 'N/render', 'N/format', 'N/file', 'N/runtime', 'N/search',
    '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-suitelet.util',
    '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js'
],
    function (
        record, log, render, format, file, runtime, search,
        suitelet_util
    ) {
        function onRequest(context) {

            return suitelet_util.build({
                context: context,
                title: 'Relatorio para Comissionamento',
                statics: {
                    html: (
                        [
                            'pd-ccr-screen.html'
                        ]
                    ),
                    js: (
                        [
                            'pd-ccr-screen.js'
                        ]
                    ),
                    css: (
                        [
                            'pd-ccr-screen.css'
                        ]
                    )
                }
            });
        }

        return {
            onRequest: onRequest,
        };
    }
);