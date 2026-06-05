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
        const TYPE = 'vendor';

        const FIELDS = {
            id: { name: 'internalid' },
            isEmployee: { name: 'custentity_pd_aae_is_employee' }
        };

        // const ITEM_SUBLIST_ID = 'item';
        // const ITEM_SUBLIST_FIELDS = {
        //     finalCost: { name: 'custcol_aae_final_cost_po' },
        //     estimatedCost: { name: 'custcol_aae_estimated_cost_po' }
        // }

        function getBy(options) {

            if (options.by == 'id') {
                const _search = search_util.first({
                    type: TYPE,
                    columns: FIELDS,
                    query: filters(options)
                });

                return _search;

                function filters(options) {
                    let _filter = search_util
                        .where(search_util.query(FIELDS.id, "anyof", options.vendorId));

                    return _filter;
                }
            }
        }

        function readData(vendorBillRecord) {
            return record_util
                .handler(vendorBillRecord)
                .data({
                    fields: FIELDS,
                    // sublists: {
                    //     applyList: {
                    //         name: ITEM_SUBLIST_ID,
                    //         fields: ITEM_SUBLIST_FIELDS
                    //     }
                    // }
                });
        }

        return {
            getBy: getBy,
            readData: readData
        }
    }
);