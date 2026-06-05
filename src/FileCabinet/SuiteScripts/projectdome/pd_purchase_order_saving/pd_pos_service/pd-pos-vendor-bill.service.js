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
        const TYPE = 'vendorbill';

        const FIELDS = {
            id: { name: 'internalid' },
            // status: { name: 'status' },
            // entity: { name: 'entity', type: 'list' },
            mainLine: { name: 'mainline', onlyFilter: true },
            // tranDate: { name: 'trandate' },
            // dueDate: { name: 'duedate' }
        };

        const ITEM_SUBLIST_ID = 'item';
        const ITEM_SUBLIST_FIELDS = {
            finalCost: { name: 'custcol_aae_final_cost_po' },
            estimatedCost: { name: 'custcol_aae_estimated_cost_po' },
            amount: { name: "formulanumeric", formula: "((NVL({custcol_aae_estimated_cost_po}, 0) - NVL(({rate}*{quantity})/{quantityuom}, 0)) * NVL({quantityuom}, 0) * (-1)) * 0.10" },
            item: { name: 'item', type: 'list' },
            rate: { name: "formulanumeric", formula: "ROUND(({rate}*{quantity})/{quantityuom}, 2)" },
            lineSequenceNumber: { name: 'linesequencenumber' },
            quantity: { name: "formulanumeric", formula: "ROUND({quantityuom}, 2)" },
            appliedToTransaction: { name: 'internalid', join: 'appliedToTransaction' },
            appliedToRecordType: { name: 'recordtype', join: 'appliedToTransaction' },
            appliedToTranId: { name: 'tranid', join: 'appliedToTransaction' },
            partNumber: { name: 'custcol_pd_partnumbercustomer' },
            partNumberName: { name: 'custcol_pd_partnumbercustname' },
            lineReference: { name: 'custcol_pd_cso_line_reference' },
            buyer: { name: 'custcol_aae_buyer_purchase_order' },
            perUnit: { name: "formulanumeric", formula: "{custcol_aae_estimated_cost_po}-(ROUND(({rate}*{quantity})/{quantityuom}, 2))" },
            total: { name: "formulanumeric", formula: "(NVL({custcol_aae_estimated_cost_po}, 0) - NVL(({rate}*{quantity})/{quantityuom}, 0)) * NVL({quantityuom}, 0) * (-1)" },
        }

        const EXPENSE_SUBLIST_ID = 'expense';
        const EXPENSE_SUBLIST_FIELDS = {
            account: { name: 'account' },
            amount: { name: 'amount' },
            memo: { name: 'memo' }
        }

        const STATUS = {
            open: 'VendBill:A',
            paidFull: 'VendBill:B'
        };

        function getBy(options) {

            if (options.by == 'statusAndId') {
                const _search = search_util.first({
                    type: TYPE,
                    columns: FIELDS,
                    query: filters(options)
                });

                return _search;

                function filters(options) {
                    let _filter = search_util
                        .where(search_util.query(FIELDS.id, "anyof", options.transactionId))
                        .and(search_util.query(FIELDS.status, 'anyof',
                            options.status.map(status => STATUS[status]))
                        );

                    return _filter;
                }
            }
        }

        function getLinesByTransactionIds(transactionIds) {
            const MERGED_FIELDS = {
                ...FIELDS,
                ...ITEM_SUBLIST_FIELDS
            };

            log.audit({ title: 'MERGED_FIELDS', details: MERGED_FIELDS });

            const _vendorBillLines = search_util.all({
                type: TYPE,
                columns: MERGED_FIELDS,
                query: search_util
                    .where(search_util.query(FIELDS.id, "anyof", transactionIds))
                    // .and( )
                    // .and(search_util.query(FIELDS.status, "anyof", [STATUS.open, STATUS.paidFull]))

                    .and(search_util.query(FIELDS.mainLine, "is", "F"))
                    .and(search_util.query(MERGED_FIELDS.appliedToRecordType, "startswith", "purchaseorder"))
                // .and(search_util.query(FIELDS.appliedToRecordType, "startswith", "purchaseorder"))
            });

            return _vendorBillLines;
        }

        function readData(vendorBillRecord) {
            return record_util
                .handler(vendorBillRecord)
                .data({
                    fields: FIELDS,
                    sublists: {
                        itemList: {
                            name: ITEM_SUBLIST_ID,
                            fields: ITEM_SUBLIST_FIELDS
                        }
                    }
                });
        }

        function set(options) {
            log.audit({ title: 'options.data', details: options.data });

            const approvalCommissionData = { sublists: {} };

            approvalCommissionData[FIELDS.entity.name] = options?.data?.entity;
            approvalCommissionData[FIELDS.tranDate.name] = options?.data?.tranDate;
            approvalCommissionData[FIELDS.dueDate.name] = options?.data?.dueDate;

            if (options.data?.subLists) {
                // if (options.data.subLists?.item)
                //     approvalCommissionData.sublists[ITEM_SUBLIST_ID] = buildExpenseLinesData(options.data.subLists.item)

                if (options.data.subLists?.expense)
                    approvalCommissionData.sublists[EXPENSE_SUBLIST_ID] = buildExpenseLinesData(options.data.subLists.expense)
            }

            return record_util
                .handler(options.record)
                .set(approvalCommissionData);
        }

        function buildExpenseLinesData(expenseList) {
            let _map = [];

            expenseList.forEach(function (itemLine, index) {
                _lineData = {}

                _lineData[EXPENSE_SUBLIST_FIELDS.account.name] = itemLine?.account;
                _lineData[EXPENSE_SUBLIST_FIELDS.amount.name] = itemLine?.amount;
                _lineData[EXPENSE_SUBLIST_FIELDS.memo.name] = itemLine?.memo;

                _lineData['index'] = index;

                _map.push(_lineData);
            });

            return _map;
        }

        function create(options) {
            return record.create({ type: TYPE, isDynamic: ifNullOrEmpty(options?.isDynamic, false) });
        }

        function save(record, options) {
            return record.save({
                ignoreMandatoryFields: ifNullOrEmpty(options?.ignore, false)
            })
        }

        function load(object) {
            return record.load({ type: TYPE, id: object.id, isDynamic: ifNullOrEmpty(object?.isDynamic, false) });
        }

        return {
            getBy: getBy,
            readData: readData,
            getLinesByTransactionIds: getLinesByTransactionIds,
            create: create,
            set: set,
            save: save,
            load: load
        }
    }
);