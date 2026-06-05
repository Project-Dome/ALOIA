/**
 * @NApiVersion 2.1
 * @NModuleScope public
 * @author Project Dome - Rogério Gonçalves Rodrigues
 */

define(
    [], 
    function(){


    function getCarrierIdFromMap(notificationMap, notificationId) {
        if (
            !notificationMap ||
            !notificationMap[notificationId] ||
            !notificationMap[notificationId][0] ||
            !notificationMap[notificationId][0].carrier
        ) {
            return null;
        }

        return parseInt(notificationMap[notificationId][0].carrier, 10);
    }

    return {
        getCarrierIdFromMap: getCarrierIdFromMap
    };
});
