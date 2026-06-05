/**
 * @NApiVersion 2.1
 * @NScriptType Suitelet
 * @Author Mário Augusto Braga Costa - Project Dome
 */
define(
    [
        'N/log',
        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-suitelet.util'
    ],
    function (
        log,
        suitelet_util
    ) {

        function onRequest(context) {
            return suitelet_util.build({
                context: context,
                title: 'Saving - Create VendorBill',
                statics: {
                    html: (
                        [
                            'pd-pos-commission-payment.html'
                        ]
                    ),
                    js: (
                        [
                            'pd-pos-commission-payment.js'
                        ]
                    ),
                    css: (
                        [
                            'pd-pos-commission-payment.css'
                        ]
                    )
                }
            });
        }

        return {
            onRequest: onRequest
        };
    }
);