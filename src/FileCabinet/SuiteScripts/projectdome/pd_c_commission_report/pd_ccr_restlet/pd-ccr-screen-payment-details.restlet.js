/**
 * @NApiVersion 2.x
 * @NScriptType Restlet
 */
define(['N/search'], function(search) {
    
    function getCommissionDetails(request) {
        var vendorEmployeeId = request.vendorEmployee; // agora vem o ID
        var results = [];

        if (!vendorEmployeeId) {
            return { success: false, message: "Missing vendorEmployee ID" };
        }

        var s = search.create({
            type: 'customrecord_pd_ccr_comission',
            filters: [
                ['custrecord_pd_ccr_vendor_employee', 'anyof', vendorEmployeeId]
            ],
            columns: [
                search.createColumn({name: 'custrecord_pd_ccr_approval_date'}),
                search.createColumn({name: 'custrecord_pd_ccr_amount_value'})
            ]
        });

        s.run().each(function(r) {
            results.push({
                approvalDate: r.getValue('custrecord_pd_ccr_approval_date'),
                amountValue: r.getValue('custrecord_pd_ccr_amount_value'),
                id: r.id
            });
            return true;
        });

        return {
            success: true,
            data: results
        };
    }

    return {
        post: getCommissionDetails
    };
});
