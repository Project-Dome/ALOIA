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
        const TYPE = 'customrecord_pd_ccr_approval_comission';

        const FIELDS = {
            id: { name: 'internalid' },
            transaction: { name: 'custrecord_pd_ccr_transaction' },
            status: { name: 'custrecord_pd_ccr_status' },
            approver: { name: 'custrecord_pd_ccr_approver' },
            approvalDate: { name: 'custrecord_pd_ccr_approval_date' },
            rejector: { name: 'custrecord_pd_ccr_rejector' },
            rejectDate: { name: 'custrecord_pd_ccr_rejection_date' },
            salesAdmin: { name: 'custrecord_pd_ccr_sales_admin' },
            vendorBill: { name: 'custrecord_pd_ccr_vendor_bill_linked' },
            amountValue: { name: 'custrecord_pd_ccr_amount_value' },
            vendorEmployee: { name: 'custrecord_pd_ccr_vendor_employee', type: 'list' },

            purchaseValue: { name: 'custrecord_pd_ccr_po_value' },
            saleValue: { name: 'custrecord_pd_ccr_sale_value' },
            finalProfit: { name: 'custrecord_pd_ccr_final_profit' },
            commission: { name: 'custrecord_pd_ccr_seller_commission' },
        };

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
            approvalCommissionData[FIELDS.salesAdmin.name] = options?.data?.salesAdmin;
            approvalCommissionData[FIELDS.vendorBill.name] = options?.data?.vendorBill;
            approvalCommissionData[FIELDS.amountValue.name] = options?.data?.amountValue;
            approvalCommissionData[FIELDS.vendorEmployee.name] = options?.data?.vendorEmployee;


            approvalCommissionData[FIELDS.purchaseValue.name] = options?.data?.purchaseValue;
            approvalCommissionData[FIELDS.saleValue.name] = options?.data?.saleValue;
            approvalCommissionData[FIELDS.finalProfit.name] = options?.data?.finalProfit;
            approvalCommissionData[FIELDS.commission.name] = options?.data?.commission;

            log.audit({ title: "approvalCommissionData", details: approvalCommissionData });

            // throw "Testing Projetc Dome";

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
            readData: readData,
            set: set,
            create: create,
            load: load,
            save: save,
            setSubmit: setSubmit
        }
    }
);