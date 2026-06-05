/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author Project Dome - Mário Augusto Braga Costa
 */
define(
    [
        'N/log',
        'N/record',

        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-record.util',
        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-search.util',
        '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js'
    ],
    function (
        log,
        record,

        record_util,
        search_util
    ) {
        const TYPE = 'vendorpayment';
        const FIELDS = {
            id: { name: 'internalid' },
        };

        const APPLY = 'apply';
        const APPLY_SUBLIST_FIELDS = {
            doc: { name: 'doc' },
            apply: { name: 'apply' }
        }

        function readData(vendorPaymentRecord) {
            return record_util
                .handler(vendorPaymentRecord)
                .data({
                    fields: FIELDS,
                    sublists: {
                        applyList: {
                            name: APPLY,
                            fields: APPLY_SUBLIST_FIELDS
                        }
                    }
                });
        }

        return {
            readData: readData
        }
    }
);