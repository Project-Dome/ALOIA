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
        'N/url',
        'N/query',

        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-search.util.js',
        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-restlet.util',
        '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js'
    ],
    function (
        runtime,
        search,
        log,
        url,
        query,

        search_util,
        restlet_util,
        common_util
    ) {

        const TYPE = 'invoice';
        const FORMULA = {
            percent: "{amount}/(({custcol_aae_purchaseorder.rate}*{custcol_aae_purchaseorder.quantity})+(NVL({item.quantityavailable}, 0)*{custcol_aae_purchaseorder.quantity})+{custcol_aae_purchaseorder.custbody_aee_freight_cost_vendor}+{custcol_aae_purchaseorder.custbody_aae_hazmat_aog_other_fees}+{shippingcost}+{handlingcost})/100",
            stockAloia: "NVL({item.quantityavailable}, 0)",
            totalCostUSD: "({custcol_aae_purchaseorder.rate}*{custcol_aae_purchaseorder.quantity})+(NVL({item.quantityavailable}, 0)*{custcol_aae_purchaseorder.quantity})+{custcol_aae_purchaseorder.custbody_aee_freight_cost_vendor}+{custcol_aae_purchaseorder.custbody_aae_hazmat_aog_other_fees}+{shippingcost}+{handlingcost}",
            costEAUSD: "(   ({custcol_aae_purchaseorder.rate} * {custcol_aae_purchaseorder.quantity})   + (NVL({item.quantityavailable}, 0) * {custcol_aae_purchaseorder.quantity})   + {custcol_aae_purchaseorder.custbody_aee_freight_cost_vendor}   + {custcol_aae_purchaseorder.custbody_aae_hazmat_aog_other_fees}   + {shippingcost}   + {handlingcost} ) / ({quantity} + NVL({item.quantityavailable}, 0))",
            operationalProfitUSD: "{amount}-(({custcol_aae_purchaseorder.rate}*{custcol_aae_purchaseorder.quantity})+(NVL({item.quantityavailable}, 0)*{custcol_aae_purchaseorder.quantity})+{custcol_aae_purchaseorder.custbody_aee_freight_cost_vendor}+{custcol_aae_purchaseorder.custbody_aae_hazmat_aog_other_fees}+{shippingcost}+{handlingcost})",
            salesCommission: "{applyingtransaction.trandate}+60",
            usdCommission: "({amount}- (({custcol_aae_purchaseorder.rate} * {custcol_aae_purchaseorder.quantity}) + (NVL({item.quantityavailable}, 0) * {custcol_aae_purchaseorder.quantity}) + {custcol_aae_purchaseorder.custbody_aee_freight_cost_vendor} + {custcol_aae_purchaseorder.custbody_aae_hazmat_aog_other_fees} + {shippingcost}+{handlingcost})) * 0.005"
        };

        const FIELDS = {
            transactionRecordType: { name: 'recordtype' },
            transactionId: { name: 'internalid' },
            tranID: { name: "tranid" },
            item: { name: "item", type: "list" },
            customer: { name: "mainname", type: "list" },
            otherRefNum: { name: "otherrefnum" },
            soTranId: { name: "tranid", join: "createdFrom" },
            soInternalId: { name: "internalid", join: "createdFrom" },
            soRecordType: { name: "recordtype", join: "createdFrom" },
            urgency: { name: "custbody_aae_urgency_order", type: "list" },
            buyer: { name: "custbody_aae_buyer", type: "list" },
            custPOReceipt: { name: "custbody_aae_cust_po_receipt" },
            salesRep: { name: "salesrep", type: "list" },
            deliveryDate: { name: "custbody_aae_delivery_date" },
            salesDescription: { name: "salesdescription", join: "item" },
            quantity: { name: "quantity" },
            rate: { name: "rate" },
            supplierVendor: { name: "custcol_aae_vendor_purchase_order", type: "list" },
            stockAloia: { name: "formulanumeric", formula: FORMULA.stockAloia },
            tranDate: { name: "trandate" },
            customerInvoice: { name: "tranid" },
            shippingCost: { name: "shippingcost" },
            handlingCost: { name: "handlingcost" },
            totalCostUSD: { name: "formulacurrency", formula: FORMULA.totalCostUSD },
            costEAUSD: { name: "formulanumeric", formula: FORMULA.costEAUSD },
            amount: { name: "amount" },
            operationalProfitUSD: { name: "formulacurrency", formula: FORMULA.operationalProfitUSD },
            percent: { name: "formulapercent", formula: FORMULA.percent },
            applyingTransaction: { name: "applyingtransaction" },
            paidByCustomerOn: { name: "trandate", join: "applyingTransaction" },
            salesCommission: { name: "formuladate", formula: FORMULA.salesCommission },
            commission: { name: "salesrep" },
            customerCommissionPercent: { name: "custentity_aae_comission_rates", join: "customer" },
            usdCommission: { name: "formulacurrency", formula: FORMULA.usdCommission },
            type: { name: "type", onlyFilter: true },
            mainLine: { name: "mainline", onlyFilter: true },
            cogs: { name: "cogs", onlyFilter: true },
            taxline: { name: "taxline", onlyFilter: true },
            shipping: { name: "shipping", onlyFilter: true },
            status: { name: "custrecord_pd_ccr_status", join: "custrecord_pd_ccr_transaction", onlyFilter: true },
            commissionId: { name: "internalid", join: "custrecord_pd_ccr_transaction" }
        };

        function invoiceData() {
            const mapByInvoiceTranId = {};

            search_util.all({
                type: TYPE,
                columns: FIELDS,
                query: search_util
                    .where(search_util.query(FIELDS.type, 'anyof', "CustInvc"))
                    .and(search_util.query(FIELDS.mainLine, 'is', "F"))
                    .and(search_util.query(FIELDS.cogs, 'is', "F"))
                    .and(search_util.query(FIELDS.taxline, 'is', "F"))
                    .and(search_util.query(FIELDS.shipping, 'is', "F"))
                    .and(search_util.query(FIELDS.status, 'anyof', "3")),
                each: function (data) {
                    log.audit("Invoice Data", data);

                    // let _hasUSDComission = !isNullOrEmpty(data.usdCommission);
                    // if (!_hasUSDComission) return;

                    if (!mapByInvoiceTranId[data.tranID]) {
                        mapByInvoiceTranId[data.tranID] = {
                            invoiceId: data.transactionId,
                            commissionTotal: 0,
                            items: [],
                            commissionId: data.commissionId
                        };
                    }
                    mapByInvoiceTranId[data.tranID].commissionTotal += parseFloat(ifNullOrEmpty(data.usdCommission, 0));

                    data['invoiceUrl'] = buildRecordUrl(data.transactionRecordType, data.transactionId);
                    data['soUrl'] = buildRecordUrl(data.soRecordType, data.soInternalId);

                    mapByInvoiceTranId[data.tranID].items.push(data);

                    log.audit("Invoice Data", data);
                }
            })

            log.audit("Invoice Report Results", mapByInvoiceTranId);

            return mapByInvoiceTranId;
        }

        function buildRecordUrl(recordType, recordId) {
            return url.resolveRecord({
                recordType: recordType,
                recordId: recordId
            });
        }

        function postHandler() {
            // return invoiceData();
        }

        function getHandler() {
            return invoiceData();
        }

        return {
            post: postHandler,
            get: getHandler
        }
    }
);
