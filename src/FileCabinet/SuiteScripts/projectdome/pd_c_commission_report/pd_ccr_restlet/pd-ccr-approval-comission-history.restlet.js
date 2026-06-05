/**
 *@NApiVersion 2.1
 *@NScriptType Restlet
 *Author: Breno Godoy Costa
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
        percent: `{amount}/(({custcol_aae_purchaseorder.rate}*{custcol_aae_purchaseorder.quantity})+(NVL({item.quantityavailable}, 0)*{custcol_aae_purchaseorder.quantity})+{custcol_aae_purchaseorder.custbody_aee_freight_cost_vendor}+{custcol_aae_purchaseorder.custbody_aae_hazmat_aog_other_fees}+{shippingcost}+{handlingcost})/100`,
        stockAloia: `NVL({item.quantityavailable}, 0)`,
        totalCostUSD: `({custcol_aae_purchaseorder.rate}*{custcol_aae_purchaseorder.quantity})+(NVL({item.quantityavailable}, 0)*{custcol_aae_purchaseorder.quantity})+{custcol_aae_purchaseorder.custbody_aee_freight_cost_vendor}+{custcol_aae_purchaseorder.custbody_aae_hazmat_aog_other_fees}+{shippingcost}+{handlingcost}`,
        costEAUSD: `(   ({custcol_aae_purchaseorder.rate} * {custcol_aae_purchaseorder.quantity})   + (NVL({item.quantityavailable}, 0) * {custcol_aae_purchaseorder.quantity})   + {custcol_aae_purchaseorder.custbody_aee_freight_cost_vendor}   + {custcol_aae_purchaseorder.custbody_aae_hazmat_aog_other_fees}   + {shippingcost}   + {handlingcost} ) / ({quantity} + NVL({item.quantityavailable}, 0))`,
        operationalProfitUSD: `{amount}-(({custcol_aae_purchaseorder.rate}*{custcol_aae_purchaseorder.quantity})+(NVL({item.quantityavailable}, 0)*{custcol_aae_purchaseorder.quantity})+{custcol_aae_purchaseorder.custbody_aee_freight_cost_vendor}+{custcol_aae_purchaseorder.custbody_aae_hazmat_aog_other_fees}+{shippingcost}+{handlingcost})`,
        salesCommission: `NVL({applyingtransaction.trandate}, {trandate})+60`,
        usdCommission: `({amount} - (({custcol_aae_purchase_order_linked.rate}*{custcol_aae_purchase_order_linked.quantity}) + (NVL({item.quantityavailable},0)*{custcol_aae_purchase_order_linked.quantity}) + {custcol_aae_purchase_order_linked.custbody_aee_freight_cost_vendor} + {custcol_aae_purchase_order_linked.custbody_aae_hazmat_aog_other_fees} + {shippingcost} + {handlingcost}))*0.005`

    };
    const FIELDS = {
        transactionRecordType: { name: 'recordtype' },
        transactionId: { name: 'internalid' },
        tranID: { name: "tranid" },
        entityid: { name: "entityid", join: "customer" },
        companyname: { name: "companyname", join: "customer" },
        customer: { name: "formulatext", formula: "{customer.entityid} || ' ' ||  {customer.companyname}" },
        customerId: { name: "internalid", join: "customer" },
        custPO: { name: "otherrefnum" },
        soAck: { name: "formulatext", formula: "{createdFrom.tranid}" },
        soAckId: { name: "formulatext", formula: "{createdFrom.internalid}" },
        urgency: { name: "formulatext", formula: "{custbody_aae_urgency_order}" },
        buyer: { name: "formulatext", formula: "{custbody_aae_buyer.firstname} || ' ' || {custbody_aae_buyer.lastname}" },
        buyerId: { name: "formulatext", formula: "{custbody_aae_buyer.internalid}" },
        custPOReceipt: { name: "custbody_aae_cust_po_receipt" },
        salesAdmin: { name: "formulatext", formula: "{salesrep.firstname} || ' ' || {salesrep.lastname}" },
        salesAdminId: { name: "internalid", join: "salesrep" },
        deliveryDate: { name: "custbody_aae_delivery_date" },
        partNumber: { name: "itemid", join: "item" },
        description: { name: "salesdescription", join: "item" },
        qty: { name: "quantity" },
        soldEAUSD: { name: "rate" },
        supplierVendor: { name: "companyname", join: "custcol_aae_vendor_purchase_order" },
        supplierVendorId: { name: "internalid", join: "custcol_aae_vendor_purchase_order" },
        poVendor: { name: "formulatext", formula: "{custcol_aae_purchase_order_linked.tranid}" },
        poVendorId: { name: "formulatext", formula: "{custcol_aae_purchase_order_linked.internalid}" },
        vendorPODate: { name: "formuladate", formula: "{custcol_aae_purchase_order_linked.trandate}" },
        vendorShipDate: { name: "formuladate", formula: "{custcol_aae_purchase_order_linked.expectedreceiptdate}" },
        vendorTerms: { name: "formulatext", formula:"{CUSTCOL_AAE_PURCHASE_ORDER_LINKED.terms}" },
        stockAloia: { name: "formulanumeric", formula: FORMULA.stockAloia },
        dateINV: { name: "trandate" },
        customerInvoice: { name: "tranid" },
        customerInvoiceId: { name: "internalid" },
        freightAloiaToCustomer: { name: "shippingcost" },
        freightVendorToAloia: { name: "formulanumeric", formula: "{custbody_aee_freight_cost_vendor}" },
        bhCost: { name: "handlingcost" },
        hazmatFees: { name: "formulanumeric", formula: "{custbody_aae_hazmat_aog_other_fees}" },
        unitCostVendorUSD: { name: "rate"},
        totalCostUSD: { name: "formulacurrency", formula: FORMULA.totalCostUSD },
        costEAUSD: { name: "formulanumeric", formula: FORMULA.costEAUSD },
        totalSalesSold: { name: "amount" },
        operationalProfitUSD: { name: "formulacurrency", formula: FORMULA.operationalProfitUSD },
        percent: { name: "formulapercent", formula: FORMULA.percent },
        paidByCustomerOn: { name: "formuladate", formula: "{applyingtransaction.trandate}" },
        salesCommission: { name: "formuladate", formula: FORMULA.salesCommission },
        commission: { name: "formulatext", formula: "{salesrep.firstname} || ' ' || {salesrep.lastname}" },
        customerCommissionPercent: { name: "custentity_aae_comission_rates", join: "customer" },
        usdCommission: { name: "formulacurrency", formula: FORMULA.usdCommission },
        mainLine: { name: "mainline", onlyFilter: true },
        cogs: { name: "cogs", onlyFilter: true },
        shipping: { name: "shipping", onlyFilter: true },
        taxline: { name: "taxline", onlyFilter: true },
        type: { name: "type", onlyFilter: true },
        status: { name: "custrecord_pd_ccr_status", join: "custrecord_pd_ccr_transaction", onlyFilter: true },
        //amountremaining: { name: "amountremaining", onlyFilter: true }
    };

    function executeInvoiceReport(filters) {
        var results = [];

        // 🔹 condição base
        let baseQuery = search_util
            .where(search_util.query(FIELDS.type, 'anyof', "CustInvc"))
            .and(search_util.query(FIELDS.cogs, 'is', "F"))
            .and(search_util.query(FIELDS.taxline, 'is', "F"))
            .and(search_util.query(FIELDS.shipping, 'is', "F"))
            .and(search_util.query(FIELDS.mainLine, 'is', "F"));

        if (filters) {
            if (filters.customer) {
                baseQuery = baseQuery.and(
                    search_util.query(FIELDS.customer, 'contains', filters.customer)
                );
            }
            if (filters.vendor) {
                baseQuery = baseQuery.and(
                    search_util.query(FIELDS.supplierVendor, 'contains', filters.vendor)
                );
            }
            if (filters.buyer) {
                baseQuery = baseQuery.and(
                    search_util.query(FIELDS.buyer, 'contains', filters.buyer)
                );
            }
            if (filters.sales) {
                baseQuery = baseQuery.and(
                    search_util.query(FIELDS.salesAdmin, 'contains', filters.sales)
                );
            }
            if (filters.status) {
                baseQuery = baseQuery.and(
                    search_util.query(FIELDS.status, 'anyof', filters.status) // status ainda é por ID
                );
            }
            if (filters.dateFrom && filters.dateTo) {
                baseQuery = baseQuery.and(
                    search_util.query(FIELDS.dateINV, 'within', filters.dateFrom, filters.dateTo)
                );
            } else if (filters.dateFrom) {
                baseQuery = baseQuery.and(
                    search_util.query(FIELDS.dateINV, 'onorafter', filters.dateFrom)
                );
            } else if (filters.dateTo) {
                baseQuery = baseQuery.and(
                    search_util.query(FIELDS.dateINV, 'onorbefore', filters.dateTo)
                );
            }
        }

        // 🔹 executa busca
        search_util.all({
            type: TYPE,
            columns: FIELDS,
            query: baseQuery,
            each: function (data) {
                let _hasUSDComission = !isNullOrEmpty(data.usdCommission);
                if (!_hasUSDComission) return;

                log.audit("Invoice Data", data);

                data['transactionUrl'] = buildRecordUrl(data.transactionRecordType, data.transactionId);

                if (data.soAckId) data['soAckUrl'] = buildRecordUrl('salesorder', data.soAckId);
                if (data.buyerId) data['buyerUrl'] = buildRecordUrl('employee', data.buyerId);
                if (data.salesAdminId) data['salesAdminUrl'] = buildRecordUrl('employee', data.salesAdminId);
                if (data.supplierVendorId) data['supplierVendorUrl'] = buildRecordUrl('vendor', data.supplierVendorId);
                if (data.poVendorId) data['poVendorUrl'] = buildRecordUrl('purchaseorder', data.poVendorId);
                if (data.customerInvoiceId) data['customerInvoiceUrl'] = buildRecordUrl('invoice', data.customerInvoiceId);
                if (data.customerId) data['customerUrl'] = buildRecordUrl('customer', data.customerId);

                results.push(data);
            }
        });

        log.audit("Invoice Report Results", results);

        return results;
    }

    function buildRecordUrl(recordType, recordId) {
        return url.resolveRecord({
            recordType: recordType,
            recordId: recordId
        });
    }

    function postHandler(context) {
        try {
            return {
                success: true,
                data: executeInvoiceReport(context.filters || {})
            };
        } catch (e) {
            log.error("Error generating invoice report", e);
            return { error: e.message };
        }
    }

    return {
        post: postHandler
    };
});
