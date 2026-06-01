/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author Project Dome - Rogério Gonçalves Rodrigues
 */
define(
    [
        'N/log',
        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-record.util.js'
    ],
    function (
        log,
        record_util
    ) {

        const TYPE = 'purchaseorder';

        const FIELDS = {
            createdFrom: { name: 'createdfrom' }
        };

        const ITEM_SUBLIST_ID = 'item';

        const ITEM_SUBLIST_FIELDS = {
            item: { name: 'item' },
            partNumberVendor: { name: 'custcol_pd_partnumbervendor' }
        };

        function readData(options) {
            try {

                log.debug({ title: 'readData - options', details: options });

                let _purchaseOrderData = record_util
                    .handler(options)
                    .data(
                        {
                            fields: FIELDS,
                            sublists: {
                                itemList: {
                                    name: ITEM_SUBLIST_ID,
                                    fields: ITEM_SUBLIST_FIELDS,
                                }
                            }
                        }
                    );

                return _purchaseOrderData;

            } catch (_error) {
                log.error({ title: 'readData - error', details: _error });
            }
        }

        return {
            readData: readData
        };
    }
);
