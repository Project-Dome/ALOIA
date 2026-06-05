/**
 *@NApiVersion 2.1
 *@NScriptType Restlet
 *Author: Lucas Monaco 
 */
define(
    [
        'N/runtime',
        'N/search',
        'N/log',
        'N/record',
        'N/url',
        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-search.util.js',
        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-restlet.util',
        '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js'
    ],
    function (
        runtime,
        search,
        log,
        record,
        url,
        search_util,
        restlet_util,
        common_util
    ) {

        const TYPE = 'customrecord_pd_ccr_approval_comission';

        const FIELDS = {
            rtId: { name: 'internalid' },
            status: { name: 'custrecord_pd_ccr_status' },
            invoiceId: { name: 'custrecord_pd_ccr_transaction' }
        };

        function executeCommissionReport() {
            var results = [];

            search_util.all({
                type: TYPE,
                columns: FIELDS,
                query: search_util
                    .where(search_util.query(FIELDS.status, 'is', "3")),
                each: function (data) {
                    results.push(data);
                }
            });

            log.audit("Commission Report Results", results);

            return { success: true, data: results };
        }

        function getComissionByInvoiceId(invoiceId) {
            return search_util.all({
                type: TYPE,
                columns: FIELDS,
                query: search_util
                    .where(search_util.query(FIELDS.invoiceId, 'anyof', invoiceId))
            });
        }

        const STATUS_COMISSION = {
            PENDING: 3,
            APPROVED: 1,
            REPROVED: 2
        }

        function updateCommissionStatus(context) {
            log.audit("Update Commission Status Context", context);

            const isApprov = context.isApprov;
            const userId = runtime.getCurrentUser().id;

            context.records.forEach(commissionId => {
                let commisionRecord = record.load({
                    type: TYPE,
                    id: commissionId,
                    isDynamic: true
                });

                if (isApprov) {
                    commisionRecord.setValue({
                        fieldId: 'custrecord_pd_ccr_status',
                        value: STATUS_COMISSION.APPROVED
                    });
                    commisionRecord.setValue({
                        fieldId: 'custrecord_pd_ccr_approver',
                        value: userId
                    });
                    commisionRecord.setValue({
                        fieldId: 'custrecord_pd_ccr_approval_date',
                        value: new Date()
                    });
                } else {
                    commisionRecord.setValue({
                        fieldId: 'custrecord_pd_ccr_status',
                        value: STATUS_COMISSION.REPROVED
                    });
                    commisionRecord.setValue({
                        fieldId: 'custrecord_pd_ccr_rejector',
                        value: userId
                    });
                    commisionRecord.setValue({
                        fieldId: 'custrecord_pd_ccr_rejection_date',
                        value: new Date()
                    });
                }

                commisionRecord.save();
            });

            return { success: true };
        }

        function getHandler() {
            try {
                return executeCommissionReport();
            } catch (e) {
                log.error("Erro ao executar GET", e);
                return { success: false, message: e.message };
            }
        }

        function postHandler(context) {
            try {
                return updateCommissionStatus(context);
            } catch (e) {
                log.error("Erro ao executar POST", e);
                return { success: false, message: e.message };
            }
        }

        return {
            get: getHandler,
            post: postHandler
        }
    }
);
