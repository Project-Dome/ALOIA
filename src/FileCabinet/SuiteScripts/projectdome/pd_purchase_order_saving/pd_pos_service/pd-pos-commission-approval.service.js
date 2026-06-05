/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author Project Dome - Mário Augusto Braga Costa
 */
define(
    [
        'N/log',
        'N/record',
        'N/url',

        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-record.util',
        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-search.util',
        '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js'
    ],
    function (
        log,
        record,
        url,

        record_util,
        search_util
    ) {
        const TYPE = 'customrecord_pd_pos_approval_saving';
        const FIELDS = {
            id: { name: 'internalid' },
            transaction: { name: 'custrecord_pd_pos_pas_transaction' },
            tranId: { name: 'transactionnumber', join: 'custrecord_pd_pos_pas_transaction' },
            mainLineTransaction: { name: 'mainline', join: 'custrecord_pd_pos_pas_transaction' },
            status: { name: 'custrecord_pd_pos_pas_status' },
            approver: { name: 'custrecord_pd_pos_pas_approver' },
            approvalDate: { name: 'custrecord_pd_pos_pas_approval_date' },
            rejector: { name: 'custrecord_pd_pos_pas_rejector' },
            rejectDate: { name: 'custrecord_pd_pos_pas_rejection_date' },
            buyer: { name: 'custrecord_pd_pos_pas_employee' },
            // salesAdm: { name: 'custrecord_pd_pos_sales_admin' },
            vendorBill: { name: 'custrecord_pd_pos_pas_vendor_bill' },
            amountValue: { name: 'custrecord_pd_pos_pas_commission_amount' },
            vendorEmployee: { name: 'custrecord_pd_pos_pas_vendor', type: 'list' },

            saleValue: { name: 'custrecord_pd_pos_pas_sale_value' },
            finalProfit: { name: 'custrecord_pd_pos_pas_final_profit' },
            purchaseValue: { name: 'custrecord_pd_pos_pas_purchase_value' },
            buyerCommission: { name: 'custrecord_pd_pos_pas_buyer_commission' }
        };

        function getBy(options) {

            if (options.by == 'transactionId') {
                let _search = search_util.first({
                    type: TYPE,
                    columns: FIELDS,
                    query: search_util
                        .where(search_util.query(FIELDS.transaction, "anyof", options.transactionId))
                });

                return _search;

            } else if (options.by == 'status') {
                let _search = search_util.get({
                    type: TYPE,
                    columns: FIELDS,
                    query: search_util
                        .where(search_util.query(FIELDS.status, "anyof", options.status))
                        .and(search_util.query(FIELDS.mainLineTransaction, "is", "T"))
                });

                return _search;

            } else if (options.by == 'statusAndTransactionCommission') {
                let _search = search_util.get({
                    type: TYPE,
                    columns: FIELDS,
                    query: search_util
                        .where(search_util.query(FIELDS.status, "anyof", options.status))
                        .and(search_util.query(FIELDS.mainLineTransaction, "is", "T"))
                        .and(search_util.query(FIELDS.vendorBill, 'anyof', "@NONE@"))
                });

                return _search;
            }
        }

        function getAllTransactionId(data) {
            return data.map(item => Number(item.transaction));
        }

        function map(options) {
            if (options.by == 'vendor') {
                var mappedByVendor = options.data.reduce((acc, item) => {
                    const vendorId = item.vendorEmployee.id;

                    if (!acc[vendorId]) {
                        acc[vendorId] = {
                            vendorEmployee: item.vendorEmployee,
                            totalCommission: 0,
                            items: [],
                            commissionIds: []
                        };
                    }

                    item['transactionUrl'] = buildRecordUrl('vendorbill', item.transaction);
                    acc[vendorId].totalCommission += parseFloat(item.amountValue);
                    acc[vendorId].commissionIds.push(item.id);

                    acc[vendorId].items.push(item);

                    return acc;
                }, {});
            }

            return mappedByVendor;
        }

        function buildRecordUrl(recordType, recordId) {
            return url.resolveRecord({
                recordType: recordType,
                recordId: recordId
            });
        }

        function readData(vendorBillRecord) {
            return record_util
                .handler(vendorBillRecord)
                .data({
                    fields: FIELDS
                });
        }

        function set(options) {
            const approvalCommissionData = {};

            approvalCommissionData[FIELDS.transaction.name] = options?.data?.transaction;
            approvalCommissionData[FIELDS.status.name] = options?.data?.status;
            approvalCommissionData[FIELDS.approver.name] = options?.data?.approver;
            approvalCommissionData[FIELDS.approvalDate.name] = options?.data?.approvalDate;
            approvalCommissionData[FIELDS.rejector.name] = options?.data?.rejector;
            approvalCommissionData[FIELDS.rejectDate.name] = options?.data?.rejectDate;
            // approvalCommissionData[FIELDS.salesAdm.name] = options?.data?.salesAdm;
            approvalCommissionData[FIELDS.vendorBill.name] = options?.data?.vendorBill;
            approvalCommissionData[FIELDS.amountValue.name] = options?.data?.amountValue;
            approvalCommissionData[FIELDS.vendorEmployee.name] = options?.data?.vendorEmployee;
            approvalCommissionData[FIELDS.buyer.name] = options?.data?.buyer;

            approvalCommissionData[FIELDS.saleValue.name] = options?.data?.saleValue;
            approvalCommissionData[FIELDS.finalProfit.name] = options?.data?.finalProfit;
            approvalCommissionData[FIELDS.purchaseValue.name] = options?.data?.purchaseValue;
            approvalCommissionData[FIELDS.buyerCommission.name] = options?.data?.buyerCommission;

            return record_util
                .handler(options.record)
                .set(approvalCommissionData);
        }

        function create() {
            return record.create({ type: TYPE });
        }

        function load(object) {
            return record.load({ type: TYPE, id: object.id, isDynamic: ifNullOrEmpty(object?.isDynamic, false) });
        }

        function save(record, options) {
            return record.save({
                ignoreMandatoryFields: ifNullOrEmpty(options?.ignore, false)
            })
        }

        function setSubmit(options) {
            let _mapValues = {};

            options?.vendorBill ? _mapValues[FIELDS.vendorBill.name] = options.vendorBill : null;

            return record.submitFields({
                type: TYPE,
                id: options.recordId,
                values: _mapValues
            });
        }

        return {
            getBy: getBy,
            readData: readData,
            set: set,
            create: create,
            load: load,
            save: save,
            setSubmit: setSubmit,
            getAllTransactionId: getAllTransactionId,
            map: map
        }
    }
);