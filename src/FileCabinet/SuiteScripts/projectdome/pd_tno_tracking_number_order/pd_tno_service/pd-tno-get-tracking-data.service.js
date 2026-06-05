/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author Project Dome - Rogério Gonçalves Rodrigues
 */


define([
    'N/search',
    'N/log'
], function (
    search,
    log
) {

    function getTrackingData(idPurchaseOrder) {

        let payloadObj = {
            idPurchaseOrder: idPurchaseOrder,
            items: []
        };


        const purchaseorderSearchObj = search.create({
            type: "purchaseorder",
            settings: [{ "name": "consolidationtype", "value": "ACCTTYPE" }, { "name": "includeperiodendtransactions", "value": "F" }],
            filters:
                [
                    ["type", "anyof", "PurchOrd"],
                    "AND",
                    ["mainline", "any", ""],
                    "AND",
                    ["custcol_pd_cso_line_reference", "isnotempty", ""],
                    "AND",
                    ["custcol_pd_tno_track_nmb_order_line", "isnotempty", ""],
                    "AND",
                    ["internalid", "anyof", idPurchaseOrder]
                ],
            columns:
                [
                    search.createColumn({ name: "custcol_pd_cso_line_reference", label: "PD | Line Reference" }),
                    search.createColumn({ name: "custcol_pd_tno_track_nmb_order_line", label: "Tracking Number Order Line" }),
                    search.createColumn({ name: "custcol_pd_17track_tracking_carrier", label: "Tracking Carrier" }),
                    search.createColumn({ name: "custcol_pd_tno_status", label: "Tracking Number Status" }),
                    search.createColumn({ name: "line", label: "Line ID" })
                ]
        });
        var searchResultCount = purchaseorderSearchObj.runPaged().count;
        log.debug("purchaseorderSearchObj result count", searchResultCount);

        purchaseorderSearchObj.run().each(function (result) {

            payloadObj.items.push({

                lineReference: result.getValue({ name: "custcol_pd_cso_line_reference", label: "PD | Line Reference" }),
                trackingNumerLine: result.getValue({ name: "custcol_pd_tno_track_nmb_order_line", label: "Tracking Number Order Line" }),
                carrier: result.getValue({ name: "custcol_pd_17track_tracking_carrier", label: "Tracking Carrier" }),
                trackingNumerStatus: result.getValue({ name: "custcol_pd_tno_status", label: "Tracking Number Status" }),
                line: result.getValue({ name: "line", label: "Line ID" })

            });

            // .run().each has a limit of 4,000 results
            return true;
        });

        /*
        purchaseorderSearchObj.id="customsearch1763594696929";
        purchaseorderSearchObj.title="PD | TNO | Tracking Number Data (copy)";
        var newSearchId = purchaseorderSearchObj.save();
        */

        return payloadObj;
    }

    return {
        getTrackingData: getTrackingData
    }
})





