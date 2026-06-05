/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @author Mário Augusto Braga Costa - Project Dome
 */
define(
    [
        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-suitelet.util',
        '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js'
    ],
    function (
        suitelet_util
    ) {

        function onRequest(context) {

            return suitelet_util.build({
                context: context,
                title: 'Approver Commission Saving',
                statics: {
                    html: (
                        [
                            'pd-pos-commission-approval.html'
                        ]
                    ),
                    js: (
                        [
                            'pd-pos-commission-approval.js'
                        ]
                    ),
                    css: (
                        [
                            'pd-pos-commission-approval.css'
                        ]
                    )
                }
            });
        }

        return {
            onRequest: onRequest,
        };
    });