/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author Project Dome - Mário Augusto Braga Costa
 */
define(
    [
        'N/runtime',
        'N/search',
        'N/log',
        'N/url',
        'N/query',

        '../../pd_c_netsuite_tools/pd_cnt_standard/pd-cnts-search.util.js',
        '../../pd_c_netsuite_tools/pd_cnt_common/pd-cntc-common.util.js'
    ],
    function (
        runtime,
        search,
        log,
        url,
        query,

        search_util
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
            poTransaction: { name: "custcol_aae_purchaseorder", type: "list" },
            stockAloia: { name: "formulanumeric", formula: FORMULA.stockAloia },
            tranDate: { name: "trandate" },
            customerInvoice: { name: "tranid" },
            shippingCost: { name: "shippingcost" },
            handlingCost: { name: "handlingcost" },
            totalCostUSD: { name: "formulacurrency", formula: FORMULA.totalCostUSD },
            costEAUSD: { name: "formulanumeric", formula: FORMULA.costEAUSD },
            percent: { name: "formulapercent", formula: FORMULA.percent },
            applyingTransaction: { name: "applyingtransaction" },

            amount: { name: "amount" },
            finalCostPO: { name: "custcol_aae_final_cost_po" },
            commissionRate: { name: "custentity_aae_comission_rates", join: "customer" },
            customerCommissionPercent: { name: "custentity_aae_comission_rates", join: "customer" },
            operationalProfitUSD: { name: "formulacurrency", formula: FORMULA.operationalProfitUSD },

            paidByCustomerOn: { name: "trandate", join: "applyingTransaction" },
            salesCommission: { name: "formuladate", formula: FORMULA.salesCommission },
            commission: { name: "salesrep" },
            usdCommission: { name: "formulacurrency", formula: FORMULA.usdCommission },
            type: { name: "type", onlyFilter: true },
            mainLine: { name: "mainline", onlyFilter: true },
            cogs: { name: "cogs", onlyFilter: true },
            taxline: { name: "taxline", onlyFilter: true },
            shipping: { name: "shipping", onlyFilter: true },
            status: { name: "custrecord_pd_ccr_status", join: "custrecord_pd_ccr_transaction", onlyFilter: true },
            commissionId: { name: "internalid", join: "custrecord_pd_ccr_transaction" }
        };

        function getBy(options) {

            if (options.by == 'transactionId') {
                let commissionTotal = 0;
                let purchaseValue = 0;
                let salesValue = 0;
                let finalProfit = 0;

                let invoice = search_util.all({
                    type: TYPE,
                    columns: FIELDS,
                    query: search_util
                        .where(search_util.query(FIELDS.type, 'anyof', "CustInvc"))
                        .and(search_util.query(FIELDS.mainLine, 'is', "F"))
                        .and(search_util.query(FIELDS.cogs, 'is', "F"))
                        .and(search_util.query(FIELDS.taxline, 'is', "F"))
                        .and(search_util.query(FIELDS.shipping, 'is', "F"))
                        .and(search_util.query(FIELDS.shipping, 'is', "F"))
                        .and(search_util.query(FIELDS.poTransaction, 'noneof', "@NONE@"))
                        // .and(search_util.query(FIELDS.status, 'anyof', "3"))
                        .and(search_util.query(FIELDS.transactionId, 'anyof', options.transactionId))
                })

                invoice.forEach(data => {
                    if (!isNullOrEmpty(data.finalCostPO))
                        purchaseValue += parseFloat(data.finalCostPO);

                    if (!isNullOrEmpty(data.amount))
                        salesValue += parseFloat(data.amount);

                    let _hasUSDComission = !isNullOrEmpty(data.usdCommission);
                    if (!_hasUSDComission) return;

                    commissionTotal += parseFloat(data.usdCommission);
                });

                log.audit(
                    "invoice",
                    {
                        commissionTotal: commissionTotal,
                        purchaseValue: purchaseValue,
                        salesValue: salesValue,
                        finalProfit: finalProfit
                    }
                );

                return {
                    invoiceData: invoice,
                    commissionTotal: commissionTotal,
                    purchaseValue: purchaseValue,
                    salesValue: salesValue,
                    finalProfit: salesValue - purchaseValue
                }
            }
        }

        return {
            getBy: getBy
        }
    }
);
