/**
 * @NApiVersion 2.1
 */
define([
        "N/search"
    ],
    (search) => {
        const handler = {}

        handler.getCustomerLookup = (customerId) => {
            if (!customerId) return null;
            const customerLookup = search.lookupFields({
                type: search.Type.CUSTOMER,
                id: customerId,
                columns: [
                    "entitynumber"
                ]
            });
            return {
                entitynumber: customerLookup["entitynumber"]
            }
        }

        handler.getEmployeeLookup = (employeeId) => {
            if (!employeeId) return null;
            const employeeLookup = search.lookupFields({
                type: search.Type.EMPLOYEE,
                id: employeeId,
                columns: [
                    "entityid",
                    "custentity_pd_aae_signature"
                ]
            });
            log.debug({
                title: "Employee Lookup",
                details: employeeLookup
            });
            return {
                entityid: employeeLookup["entityid"],
                signatureId: employeeLookup["custentity_pd_aae_signature"][0]?.text,
            }
        }

        // REPLACED: now fetches lot dates from the lot record directly
        handler.getInventoryDetaiLookup = (inventoryDetailId) => {
            if (!inventoryDetailId) return null;
            const inventoryDetailLookup = search.lookupFields({
                type: search.Type.INVENTORY_NUMBER,
                id: inventoryDetailId,
                columns: [
                    "inventorynumber",
                    "expirationdate",
                    "custitemnumber_aln_manufactured_date",
                    "custitemnumber_aae_manufacturerdetail"
                ]
            });
            return {
                inventorynumber: inventoryDetailLookup["inventorynumber"],
                expirationdate: inventoryDetailLookup["expirationdate"],
                custitemnumber_aln_manufactured_date: inventoryDetailLookup["custitemnumber_aln_manufactured_date"],
                manufacturer: inventoryDetailLookup["custitemnumber_aae_manufacturerdetail"][0]?.text
            }
        }

        handler.getItemRecordType = (itemId) => {
            if (!itemId) return null;
            return search.lookupFields({
                type: search.Type.ITEM,
                id: itemId,
                columns: [
                    "recordtype"
                ]
            })["recordtype"];
        }

        handler.addressFinalData = (addressId) => {
            if (!addressId) return null;
            return search.lookupFields({
                type: "customrecord_aae_final_destination_cust",
                id: addressId,
                columns: [
                    "custrecord_aae_fdc_address"
                ]
            })["custrecord_aae_fdc_address"]
        }

        handler.transactionLookup = (transactionId) => {
            if (!transactionId) return null;
            return search.lookupFields({
                type: search.Type.TRANSACTION,
                id: transactionId,
                columns: [
                    "tranid"
                ]
            })["tranid"]
        }

        return handler;
    });